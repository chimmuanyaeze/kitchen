"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MicVAD } from "@ricky0123/vad-web";

// npm install @ricky0123/vad-web onnxruntime-web
//
// @ricky0123/vad-web runs Silero VAD (a small open-source voice-activity
// model) entirely client-side via ONNX. It only calls onSpeechEnd when it
// has detected an actual utterance boundary — ambient noise, background
// music, the extractor fan, etc. never trigger it. This is the fix for
// "listens to everything" — the old code fired on interim results from
// whatever the mic picked up; this only fires on real speech segments.

type UseHandsFreeVoiceOptions = {
  onTranscript: (text: string) => void;
  voiceGender: "female" | "male";
  enabled: boolean;
};

export function useHandsFreeVoice({ onTranscript, voiceGender, enabled }: UseHandsFreeVoiceOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const lastHeardTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLastHeard = useCallback((text: string | null) => {
    if (lastHeardTimeoutRef.current) clearTimeout(lastHeardTimeoutRef.current);
    setLastHeard(text);
    if (text) {
      // Revert to the normal listening prompt after a couple seconds, so
      // this doesn't stay on screen forever after one command.
      lastHeardTimeoutRef.current = setTimeout(() => setLastHeard(null), 2500);
    }
  }, []);
  const [vadReady, setVadReady] = useState(false);

  const vadRef = useRef<MicVAD | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Speech control: a generation counter that invalidates stale speak()
  // calls, the abort handle for the in-flight TTS request, the resolver for
  // the playback promise, and an unmount flag.
  const speechGenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const resolvePlaybackRef = useRef<(() => void) | null>(null);
  const unmountedRef = useRef(false);

  // Always-current refs so callbacks below don't close over stale values —
  // onTranscript is a new function identity on every parent render, and
  // isListening changes over time, so reading these via ref (rather than
  // depending on them directly) keeps handleSpeechSegment/the cleanup
  // effect stable without ever acting on outdated data.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Declared before the VAD-setup effect below (and stable, thanks to the
  // ref above) so it can be referenced there safely.
  const handleSpeechSegment = useCallback(async (audio: Float32Array) => {
    setIsTranscribing(true);
    try {
      const wavBlob = float32ToWavBlob(audio, 16000);
      const form = new FormData();
      form.append("audio", wavBlob, "command.wav");

      const res = await fetch("/api/ai/transcribe", { method: "POST", body: form });
      const data = await res.json();

      if (data.transcript && data.transcript.trim().length > 0) {
        console.log("[Transcribe] Heard:", data.transcript);
        showLastHeard(data.transcript);
        onTranscriptRef.current(data.transcript.trim().toLowerCase());
      } else {
        console.log("[Transcribe] Empty transcript returned");
        showLastHeard(null);
      }
    } catch (err) {
      console.error("Transcription failed:", err);
    } finally {
      setIsTranscribing(false);
    }
  }, [showLastHeard]);

  // --- Set up VAD once ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        const { MicVAD } = await import("@ricky0123/vad-web");

        const vad = await MicVAD.new({
          // Points at the model/wasm files copied into /public — without
          // these, onnxruntime-web tries to fetch them relative to whatever
          // page you're on, which fails.
          baseAssetPath: "/vad/",
          onnxWASMBasePath: "/ort/",
          // Without this, MicVAD starts listening the instant it's created —
          // before the user has clicked the mic button, and (critically)
          // even on an orphaned instance created by React Strict Mode's
          // double-invoke in development (see the cancelled check below).
          startOnLoad: false,
          // Retuned from very loose debugging values — real speech is
          // reliably detected at these levels without also picking up as
          // much ambient room noise.
          positiveSpeechThreshold: 0.6,
          negativeSpeechThreshold: 0.4,
          minSpeechMs: 150,
          preSpeechPadMs: 400,
          onSpeechEnd: async (audio: Float32Array) => {
            console.log("[VAD] Speech segment detected, length:", audio.length);
            await handleSpeechSegment(audio);
          },
          onVADMisfire: () => {
            console.log("[VAD] Misfire — detected then discarded a too-short segment");
          },
        });

        if (cancelled) {
          // This effect's cleanup already ran (e.g. React Strict Mode's
          // dev-only double-invoke) before this async setup finished — this
          // instance is an orphan nothing else will ever reference. Destroy
          // it rather than leaving it alive and listening forever,
          // disconnected from the component.
          //
          // destroy() can both throw synchronously AND return a Promise
          // that rejects — a plain try/catch only catches the synchronous
          // case. Awaiting it here routes a rejected Promise through the
          // same catch too, since we're already inside an async function.
          try {
            await vad.destroy();
          } catch {
            // Nothing to clean up if it never had a real stream/context to begin with.
          }
          return;
        }

        vadRef.current = vad;
        setVadReady(true);
      } catch (err) {
        // Two likely causes, both benign in development: React Strict
        // Mode's double-invoke caused two MicVAD.new() calls to race for
        // the microphone (getUserMedia) at once and this one lost — or the
        // browser's permission prompt hasn't been resolved yet. Either
        // way, don't let it become an unhandled rejection; the other
        // invocation (or the next real mount) will succeed instead.
        console.warn("VAD setup did not complete (often harmless in dev):", err);
      }
    })();

    return () => {
      cancelled = true;
      try {
        // destroy() may return a Promise that rejects — a synchronous
        // try/catch alone doesn't catch that (this function can't be
        // async, cleanup functions must return synchronously), so
        // explicitly attach a no-op .catch() to whatever comes back if
        // it's thenable.
        const result = vadRef.current?.destroy?.();
        if (result && typeof (result as unknown as Promise<void>).then === "function") {
          (result as unknown as Promise<void>).catch(() => {});
        }
      } catch {
        // Same reasoning as above — a never-fully-initialized instance
        // can throw synchronously on destroy(); nothing to clean up in that case.
      }
    };
  }, [handleSpeechSegment]);

  const toggleListening = useCallback(() => {
    if (!vadRef.current) return;
    if (isListening) {
      try {
        const result = vadRef.current.pause();
        if (result && typeof (result as unknown as Promise<void>).then === "function") {
          (result as unknown as Promise<void>).catch(() => {});
        }
      } catch {
        // Nothing meaningful to do if pausing an already-broken instance fails.
      }
      setIsListening(false);
    } else {
      try {
        const result = vadRef.current.start();
        if (result && typeof (result as unknown as Promise<void>).then === "function") {
          (result as unknown as Promise<void>).catch((err: unknown) => {
            console.error("Failed to start listening:", err);
            setIsListening(false);
            alert(
              "Microphone access was denied. Please check your browser's site permissions and try again."
            );
          });
        }
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start listening:", err);
        alert(
          "Microphone access was denied. Please check your browser's site permissions and try again."
        );
      }
    }
  }, [isListening]);

  // --- AI text-to-speech playback ---
  // Hard-stops any speech: cancels an in-flight TTS request, silences the
  // audio element, and invalidates any speak() call still waiting on
  // either (via the generation counter) so it can't start playing later.
  const stopSpeaking = useCallback(() => {
    speechGenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;

    const audioEl = audioElRef.current;
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute("src");
      audioEl.load();
    }

    // Unblock a speak() that is awaiting playback to finish.
    resolvePlaybackRef.current?.();
    resolvePlaybackRef.current = null;
  }, []);

  // Leaving the page (unmount) must silence everything immediately, and
  // any speak() call that arrives afterwards (e.g. an async handler that
  // finishes after navigation) must do nothing.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopSpeaking();
      setIsSpeaking(false);
    };
  }, [stopSpeaking]);

  const speak = useCallback(
    async (text: string, genderOverride?: "female" | "male") => {
      if (unmountedRef.current) return;

      // Starting a new utterance cancels the previous one, so audio can
      // never pile up or play out of order behind what's on screen.
      stopSpeaking();
      const myGen = speechGenRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      // Read via ref, not the isListening state variable directly — this
      // function can be called immediately after toggleListening() in the
      // same synchronous block (e.g. the mic-activation announcement),
      // before React has re-rendered with the new isListening value. The
      // ref is updated synchronously, so it never reads a stale value here.
      const wasListening = isListeningRef.current;

      try {
        if (wasListening) vadRef.current?.pause();

        setIsSpeaking(true);
        const res = await fetch("/api/ai/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceGender: genderOverride || voiceGender }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("TTS request failed");

        const audioBlob = await res.blob();

        // Superseded by a newer speak(), or the page was left, while the
        // request was in flight — don't play stale audio.
        if (myGen !== speechGenRef.current || unmountedRef.current) return;

        const url = URL.createObjectURL(audioBlob);

        if (!audioElRef.current) {
          audioElRef.current = new Audio();
        }
        const audioEl = audioElRef.current;
        audioEl.src = url;

        try {
          await new Promise<void>((resolve) => {
            resolvePlaybackRef.current = resolve;
            audioEl.onended = () => resolve();
            audioEl.onerror = () => resolve();
            audioEl.play().catch(() => resolve());
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        // An abort is expected when speech is cancelled — not an error.
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("TTS playback failed:", err);
        }
      } finally {
        // Only the most recent speak() owns the speaking indicator and the
        // VAD resume. A cancelled/superseded call must not un-pause the mic
        // while a newer utterance is still playing, nor touch a VAD that
        // was destroyed on unmount.
        if (myGen === speechGenRef.current && !unmountedRef.current) {
          setIsSpeaking(false);
          if (wasListening) vadRef.current?.start();
        }
      }
    },
    [voiceGender, stopSpeaking]
  );

  // Syncs the VAD's running state to the `enabled` prop. Depends only on
  // `enabled` (reads isListening via ref) so it doesn't re-run every time
  // isListening itself changes — avoiding the cascading-render pattern.
  useEffect(() => {
    if (!enabled && isListeningRef.current) {
      vadRef.current?.pause();
      setIsListening(false);
    }
  }, [enabled]);

  return { isListening, isTranscribing, isSpeaking, lastHeard, vadReady, toggleListening, speak, stopSpeaking };
}

// --- Helpers: raw Float32 PCM (what VAD gives us) -> playable WAV blob ---
function float32ToWavBlob(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}