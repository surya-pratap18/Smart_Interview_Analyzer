"""
Transcription Service — OpenAI Whisper
───────────────────────────────────────
Loads audio using librosa (Python-only, no ffmpeg subprocess).
Whisper accepts numpy arrays directly — no ffmpeg.exe call needed.
Supports: WebM, WAV, MP3, MP4, OGG, M4A
"""

import os
import numpy as np
import whisper
import warnings
warnings.filterwarnings("ignore", category=UserWarning,   module="librosa")
warnings.filterwarnings("ignore", category=FutureWarning, module="librosa")

# ── Language map ───────────────────────────────────────────────────────────────
LANGUAGE_NAMES = {
    "en": "English",   "hi": "Hindi",     "fr": "French",
    "es": "Spanish",   "de": "German",    "zh": "Chinese",
    "ar": "Arabic",    "pt": "Portuguese","ru": "Russian",
    "ja": "Japanese",  "ko": "Korean",    "it": "Italian",
    "ta": "Tamil",     "te": "Telugu",    "mr": "Marathi",
    "bn": "Bengali",   "nl": "Dutch",     "tr": "Turkish",
    "vi": "Vietnamese","pl": "Polish",    "ur": "Urdu",
    "pa": "Punjabi",   "gu": "Gujarati",  "kn": "Kannada",
}

# Whisper requires 16kHz mono audio
TARGET_SR = 16000

# ── Model cache ───────────────────────────────────────────────────────────────
_model = None

def get_whisper_model():
    global _model
    if _model is None:
        model_size = os.getenv("WHISPER_MODEL", "base")
        print(f"🎙️  [Whisper] Loading '{model_size}' model...")
        _model = whisper.load_model(model_size)
        print(f"✅ [Whisper] Model ready")
    return _model


# ── Audio loading ─────────────────────────────────────────────────────────────

def load_audio_librosa(file_path: str) -> np.ndarray:
    """
    Load audio file using librosa — pure Python, no ffmpeg subprocess.
    Converts to 16kHz mono float32 as required by Whisper.

    Supports: WAV, MP3, OGG, FLAC, M4A
    For WebM/MP4: requires soundfile with appropriate codec support.
    """
    import librosa
    print(f"   Loading audio with librosa...")
    audio, sr = librosa.load(file_path, sr=TARGET_SR, mono=True)
    duration  = len(audio) / TARGET_SR
    print(f"   Audio loaded: {duration:.1f}s at {TARGET_SR}Hz")
    return audio.astype(np.float32)


def load_audio_soundfile(file_path: str) -> np.ndarray:
    """
    Alternative: load using soundfile + resampling.
    Good for WAV files.
    """
    import soundfile as sf
    from scipy import signal as scipy_signal

    data, sr = sf.read(file_path, always_2d=False)

    # Convert stereo to mono
    if data.ndim == 2:
        data = data.mean(axis=1)

    # Resample to 16kHz if needed
    if sr != TARGET_SR:
        num_samples = int(len(data) * TARGET_SR / sr)
        data        = scipy_signal.resample(data, num_samples)

    return data.astype(np.float32)


def load_audio_pydub(file_path: str) -> np.ndarray:
    """
    Alternative: load using pydub (works if ffmpeg is available).
    """
    from pydub import AudioSegment
    audio   = AudioSegment.from_file(file_path)
    audio   = audio.set_frame_rate(TARGET_SR).set_channels(1)
    samples = np.array(audio.get_array_of_samples()).astype(np.float32)
    samples = samples / (2**15)   # normalize int16 → float32
    return samples


def load_audio(file_path: str) -> np.ndarray:
    """
    Try multiple methods to load audio.
    Falls back gracefully if one method fails.
    """
    errors = []

    # Method 1: librosa (best for WebM, OGG, MP3)
    try:
        return load_audio_librosa(file_path)
    except Exception as e:
        errors.append(f"librosa: {e}")

    # Method 2: soundfile (best for WAV, FLAC)
    try:
        return load_audio_soundfile(file_path)
    except Exception as e:
        errors.append(f"soundfile: {e}")

    # Method 3: pydub (needs ffmpeg but try anyway)
    try:
        return load_audio_pydub(file_path)
    except Exception as e:
        errors.append(f"pydub: {e}")

    # All failed
    print("❌ [Audio] All loading methods failed:")
    for err in errors:
        print(f"   - {err}")
    raise RuntimeError(
        f"Cannot load audio from {os.path.basename(file_path)}. "
        f"Install librosa: pip install librosa"
    )


# ── Main transcription ────────────────────────────────────────────────────────

def transcribe(file_path: str) -> dict:
    """
    Transcribe audio or video file using Whisper.

    Loads audio via Python (librosa/soundfile) — no ffmpeg subprocess.
    Passes numpy array directly to Whisper model.

    Returns:
        text, language, language_name, segments, duration, word_count
    """
    model = get_whisper_model()

    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    print(f"🔄 [Whisper] Transcribing: {os.path.basename(file_path)}")
    print(f"   File size: {file_size_mb:.1f} MB")

    # Load audio as numpy array
    audio = load_audio(file_path)

    # Transcribe numpy array directly
    # Whisper accepts: file path OR numpy float32 array at 16kHz
    result = model.transcribe(
        audio,              # ← numpy array, no ffmpeg needed
        task="transcribe",
        verbose=False,
        fp16=False,         # CPU mode
    )

    # Parse segments
    segments = []
    for seg in result.get("segments", []):
        segments.append({
            "id":    seg["id"],
            "start": round(seg["start"], 2),
            "end":   round(seg["end"],   2),
            "text":  seg["text"].strip(),
        })

    detected_lang = result.get("language", "en")
    language_name = LANGUAGE_NAMES.get(detected_lang, detected_lang.upper())
    full_text     = result["text"].strip()
    word_count    = len(full_text.split())
    duration      = len(audio) / TARGET_SR

    if word_count == 0:
        print("⚠️  [Whisper] 0 words — audio may be silent or too short")
        print(f"   Duration: {duration:.1f}s")
        print(f"   Audio samples: {len(audio)}")
    else:
        print(f"✅ [Whisper] Done — {word_count} words, "
              f"{len(segments)} segments, {language_name}")

    return {
        "text":          full_text,
        "language":      detected_lang,
        "language_name": language_name,
        "segments":      segments,
        "duration":      duration,
        "word_count":    word_count,
    }