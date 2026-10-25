"""
Translation Service
────────────────────
Uses MyMemory free API + direct requests fallback.
No API key needed. Supports 35+ languages including all major Indian languages.
"""

import time
import requests

# ── Full language support including all Indian languages ──────────────────────
SUPPORTED_LANGUAGES = {
    # Indian Languages
    "hi":  "Hindi",
    "bn":  "Bengali",
    "te":  "Telugu",
    "mr":  "Marathi",
    "ta":  "Tamil",
    "ur":  "Urdu",
    "gu":  "Gujarati",
    "kn":  "Kannada",
    "ml":  "Malayalam",
    "pa":  "Punjabi",
    "or":  "Odia",
    "as":  "Assamese",
    "sa":  "Sanskrit",
    "ne":  "Nepali",
    "si":  "Sinhala",
    "mai": "Maithili",
    "kok": "Konkani",
    # International
    "en":    "English",
    "fr":    "French",
    "de":    "German",
    "es":    "Spanish",
    "pt":    "Portuguese",
    "it":    "Italian",
    "ru":    "Russian",
    "ar":    "Arabic",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    "ja":    "Japanese",
    "ko":    "Korean",
    "nl":    "Dutch",
    "tr":    "Turkish",
    "vi":    "Vietnamese",
    "pl":    "Polish",
    "sv":    "Swedish",
    "fi":    "Finnish",
    "id":    "Indonesian",
    "ms":    "Malay",
    "th":    "Thai",
    "af":    "Afrikaans",
    "sw":    "Swahili",
}

# MyMemory uses different codes for some languages
MYMEMORY_CODE_MAP = {
    "zh-CN": "zh",
    "zh-TW": "zh-TW",
    "or":    "or",
    "mai":   "mai",
    "kok":   "kok",
    "as":    "as",
}


def _translate_mymemory(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate using MyMemory free API — no key needed."""
    tgt = MYMEMORY_CODE_MAP.get(target_lang, target_lang)
    src = MYMEMORY_CODE_MAP.get(source_lang, source_lang)

    if src == "auto":
        langpair = f"en|{tgt}"
    else:
        langpair = f"{src}|{tgt}"

    resp = requests.get(
        "https://api.mymemory.translated.net/get",
        params={"q": text[:500], "langpair": langpair},
        headers={"User-Agent": "Mozilla/5.0"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()

    if data.get("responseStatus") != 200:
        raise Exception(f"MyMemory: {data.get('responseDetails', 'error')}")

    result = data["responseData"]["translatedText"]
    if "QUERY LENGTH" in result.upper():
        raise Exception("MyMemory: query too long")

    return result


def _translate_google_free(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """Translate using Google's free endpoint via requests."""
    src = source_lang if source_lang != "auto" else "auto"

    resp = requests.get(
        "https://translate.googleapis.com/translate_a/single",
        params={
            "client": "gtx",
            "sl":     src,
            "tl":     target_lang,
            "dt":     "t",
            "q":      text[:2000],
        },
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        timeout=15,
    )
    resp.raise_for_status()

    # Parse response — can be empty or malformed
    raw = resp.text
    if not raw or raw.strip() == "":
        raise Exception("Google: empty response")

    data = resp.json()
    if not data or not data[0]:
        raise Exception("Google: invalid response format")

    parts = [part[0] for part in data[0] if part and part[0]]
    result = "".join(parts).strip()
    return result if result else text


def translate_text(text: str, target_lang: str, source_lang: str = "auto") -> str:
    """
    Translate text to target language.
    Tries MyMemory first, then Google free endpoint.

    Args:
        text:        Text to translate
        target_lang: Language code (e.g. 'hi', 'ta', 'de')
        source_lang: Source code or 'auto'

    Returns:
        Translated string or original if all methods fail
    """
    if not text or not text.strip():
        return text

    if source_lang == target_lang:
        return text

    # Split into 400-char chunks (safe for MyMemory)
    words  = text.split()
    chunks = []
    chunk  = []
    length = 0

    for word in words:
        if length + len(word) + 1 > 400:
            chunks.append(" ".join(chunk))
            chunk  = [word]
            length = len(word)
        else:
            chunk.append(word)
            length += len(word) + 1
    if chunk:
        chunks.append(" ".join(chunk))

    translated_chunks = []

    for i, chunk_text in enumerate(chunks):
        if not chunk_text.strip():
            continue

        result = None

        # Method 1: MyMemory
        for attempt in range(2):
            try:
                r = _translate_mymemory(chunk_text, target_lang, source_lang)
                if r and r.strip() and r.strip() != chunk_text.strip():
                    result = r
                    break
            except Exception as e:
                if attempt == 0:
                    time.sleep(1)
                else:
                    print(f"⚠️  [Translation] MyMemory failed: {e}")

        # Method 2: Google free endpoint
        if not result:
            try:
                r = _translate_google_free(chunk_text, target_lang, source_lang)
                if r and r.strip() and r.strip() != chunk_text.strip():
                    result = r
                else:
                    print(f"⚠️  [Translation] Google returned same text")
            except Exception as e:
                print(f"⚠️  [Translation] Google failed: {e}")

        translated_chunks.append(result if result else chunk_text)

        if i < len(chunks) - 1:
            time.sleep(0.3)

    final = " ".join(translated_chunks).strip()

    if final == text.strip():
        print(f"⚠️  [Translation] Could not translate — returning original")
        return text

    print(f"✅ [Translation] {source_lang} → {target_lang}")
    print(f"   Original  : {text[:70]}")
    print(f"   Translated: {final[:70]}")
    return final


def translate_segments(segments: list, target_lang: str,
                       source_lang: str = "auto") -> list:
    """Translate subtitle segments preserving timestamps."""
    translated = []
    for i, seg in enumerate(segments):
        try:
            t = translate_text(seg["text"], target_lang, source_lang)
            if i < len(segments) - 1:
                time.sleep(0.2)
        except Exception:
            t = seg["text"]

        translated.append({
            **seg,
            "text":          t,
            "original_text": seg["text"],
        })
    return translated


def generate_srt(segments: list) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        s = _to_srt_time(seg["start"])
        e = _to_srt_time(seg["end"])
        lines.append(f"{i}\n{s} --> {e}\n{seg['text']}\n")
    return "\n".join(lines)


def generate_vtt(segments: list) -> str:
    lines = ["WEBVTT\n"]
    for seg in segments:
        s = _to_vtt_time(seg["start"])
        e = _to_vtt_time(seg["end"])
        lines.append(f"{s} --> {e}\n{seg['text']}\n")
    return "\n".join(lines)


def _to_srt_time(s: float) -> str:
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    ms   = int((s % 1) * 1000)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d},{ms:03d}"


def _to_vtt_time(s: float) -> str:
    h, s = divmod(s, 3600)
    m, s = divmod(s, 60)
    ms   = int((s % 1) * 1000)
    return f"{int(h):02d}:{int(m):02d}:{int(s):02d}.{ms:03d}"