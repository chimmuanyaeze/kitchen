# syntax=docker/dockerfile:1
FROM python:3.11-slim

# espeak-ng: required by Kokoro's phonemizer (misaki)
# ffmpeg: required by faster-whisper for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout=120 --retries=5 -r requirements.txt \
    https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl

# Cache dir used by huggingface_hub; keep it consistent between build and runtime
ENV HF_HOME=/root/.cache/huggingface

# Pre-download both models at build time so the container never needs
# network access to the HF Hub when it starts up
RUN --mount=type=cache,target=/root/.cache/huggingface \
    python -c "from faster_whisper import WhisperModel; WhisperModel('small.en', device='cpu', compute_type='int8'); from kokoro import KPipeline; KPipeline(lang_code='a')" \
    && cp -r /root/.cache/huggingface /app/hf_cache_baked

ENV HF_HOME=/app/hf_cache_baked

COPY server.py .

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]