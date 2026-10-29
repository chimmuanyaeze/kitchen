"""
kitchen-os inference server
----------------------------
Two endpoints:
  POST /transcribe  -> faster-whisper (open source Whisper, CTranslate2 backend)
  POST /speak        -> Kokoro-82M (open source, Apache-2.0 licensed TTS)

Both models load once at startup and stay warm in memory, so there's no
per-request cold start the way there is with serverless API providers.
That's the main speed win over Replicate/HF Inference API.
"""

import hashlib
import io
import os
import tempfile
import time

import numpy as np
import soundfile as sf
from diskcache import Cache
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import Response
from faster_whisper import WhisperModel
from kokoro import KPipeline
from starlette.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="kitchen-os inference server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://kitchen-six-wheat.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

API_KEY = os.environ.get("INFERENCE_API_KEY")

# --- TTS cache ---
# Keyed by (voice + normalized text) -> WAV bytes. Same step text, same
# confirmation phrase, same substitution suggestion -> hits this instead of
# re-running Kokoro. size_limit auto-evicts the least-recently-used entries
# once the cache directory hits this size, so it's safe to leave unbounded
# in terms of maintenance.
# Mount /app/cache as a Docker volume so this survives container restarts —
# otherwise every redeploy starts back at a cold cache.
tts_cache = Cache("/app/cache/tts", size_limit=2 * 1024**3)  # 2 GB


def tts_cache_key(text: str, voice: str) -> str:
    normalized = text.strip().lower()
    return hashlib.sha256(f"{voice}:{normalized}".encode()).hexdigest()

# --- Load models once at startup ---
# "small.en" is a good accuracy/speed tradeoff for short command phrases on CPU.
# Bump to "base.en" if you need it faster and can tolerate slightly worse accuracy,
# or "distil-large-v3" if you have the RAM/CPU headroom and want max accuracy.
whisper_model = WhisperModel("small.en", device="cpu", compute_type="int8")

# lang_code="a" = American English. See the Kokoro README for other language codes.
tts_pipeline = KPipeline(lang_code="a")

VOICE_MAP = {"female": "af_heart", "male": "am_michael"}


def check_auth(authorization: str | None):
    if not API_KEY:
        return  # auth disabled if no key set (fine for local dev only)
    if not authorization or authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/health")
async def health():
    return {"status": "ok"}


def _run_whisper(path: str) -> str:
    """The actual blocking Whisper call, run off the event loop thread —
    see the run_in_threadpool call below for why this matters."""
    segments, _ = whisper_model.transcribe(
        path,
        language="en",
        beam_size=1,  # beam_size=1 (greedy) is noticeably faster; bump to 5 if accuracy matters more than speed
        vad_filter=False,  # client-side VAD already trims to speech-only segments;
        # stacking Whisper's own VAD filter on top of an already-trimmed
        # clip can cause it to decide there's no speech at all and
        # discard everything, returning an empty transcript.
    )
    return " ".join(seg.text for seg in segments).strip()


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...), authorization: str = Header(None)):
    check_auth(authorization)

    raw = await audio.read()

    # Cheap guard before spending compute on Whisper: a real spoken command
    # is never a handful of bytes. VAD occasionally lets through a very
    # short blip (a cough, a dropped pan lid) — catch it here for free.
    if len(raw) < 2000:
        return {"transcript": ""}

    # delete=False + manual cleanup
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        tmp.write(raw)
        tmp.flush()
        tmp.close()  # release our lock before Whisper opens it

        # CRITICAL: run_in_threadpool prevents freezing the event loop
        text = await run_in_threadpool(_run_whisper, tmp.name)
    finally:
        os.unlink(tmp.name)  # manual cleanup since delete=False skips auto-removal

    # --- Filter out Whisper hallucinations ---
    # Whisper often guesses these specific phrases when fed background noise.
    normalized = text.lower().strip(" .!?")
    hallucinations = {
        "thank you",
        "thanks for watching",
        "thank you for watching",
        "you",
        "subscribe",
        "thanks"
    }

    if normalized in hallucinations or len(normalized) < 3:
        print(f"[transcribe] Ignored hallucination/fragment: {text!r}")
        return {"transcript": ""}

    print(f"[transcribe] received {len(raw)} bytes, result: {text!r}")
    return {"transcript": text}

def _run_kokoro(text: str, voice: str) -> bytes:
    """The actual blocking Kokoro generation, run off the event loop thread —
    same reasoning as _run_whisper above."""
    chunks = [audio_chunk for _, _, audio_chunk in tts_pipeline(text, voice=voice)]
    if not chunks:
        raise RuntimeError("TTS produced no audio")
    full_audio = np.concatenate(chunks)
    buf = io.BytesIO()
    sf.write(buf, full_audio, 24000, format="WAV")
    return buf.getvalue()


@app.post("/speak")
async def speak(payload: dict, authorization: str = Header(None)):
    check_auth(authorization)

    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided")

    voice = VOICE_MAP.get(payload.get("voiceGender", "female"), "af_heart")

    key = tts_cache_key(text, voice)
    cached_audio = tts_cache.get(key)
    if cached_audio is not None:
        return Response(content=cached_audio, media_type="audio/wav", headers={"X-Cache": "HIT"})

    try:
        audio_bytes = await run_in_threadpool(_run_kokoro, text, voice)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    tts_cache.set(key, audio_bytes)

    return Response(content=audio_bytes, media_type="audio/wav", headers={"X-Cache": "MISS"})


@app.post("/prewarm")
async def prewarm(payload: dict, authorization: str = Header(None)):
    """
    Generate and cache TTS for a batch of known phrases ahead of time —
    call this when a recipe is created/saved with its step instructions,
    so a user's first cooking session never pays the generation cost live.
    Body: { "phrases": [{"text": "...", "voiceGender": "female"}, ...] }
    """
    check_auth(authorization)
    phrases = payload.get("phrases", [])
    generated = 0

    for item in phrases:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        voice = VOICE_MAP.get(item.get("voiceGender", "female"), "af_heart")
        key = tts_cache_key(text, voice)

        if tts_cache.get(key) is not None:
            continue  # already cached

        # Reuses the same threadpool-wrapped Kokoro call as /speak, same
        # reasoning: don't block the event loop during batch generation.
        try:
            tts_cache.set(key, await run_in_threadpool(_run_kokoro, text, voice))
            generated += 1
        except RuntimeError:
            continue

    return {"cached": generated, "skipped": len(phrases) - generated}