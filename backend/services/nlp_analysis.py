"""
NLP Analysis Service — TextBlob version
─────────────────────────────────────────
No transformers, no HuggingFace, no internet needed.
Works 100% offline after first NLTK download.

Features:
  1. Filler word detection
  2. Sentiment analysis (TextBlob)
  3. Keyword extraction (NLTK POS tagging)
  4. Clarity analysis
  5. Scoring engine
  6. Feedback generator
"""

import re
import os
from collections import Counter
import nltk

# ── Download NLTK data on first run ───────────────────────────────────────────
def _ensure_nltk():
    packages = [
        ("tokenizers/punkt_tab",                          "punkt_tab"),
        ("corpora/stopwords",                             "stopwords"),
        ("taggers/averaged_perceptron_tagger_eng",        "averaged_perceptron_tagger_eng"),
        ("corpora/wordnet",                               "wordnet"),
    ]
    for path, name in packages:
        try:
            nltk.data.find(path)
        except LookupError:
            print(f"📥 [NLTK] Downloading {name}...")
            nltk.download(name, quiet=True)

_ensure_nltk()

from nltk.tokenize import sent_tokenize, word_tokenize
from nltk.corpus   import stopwords
from nltk.tag      import pos_tag

STOPWORDS = set(stopwords.words("english"))

# ── Filler words ──────────────────────────────────────────────────────────────
FILLER_WORDS = {
    "um", "uh", "like", "you know", "basically", "literally",
    "actually", "right", "so", "well", "okay", "ok", "hmm",
    "ah", "er", "sort of", "kind of", "i mean", "you see",
    "obviously", "honestly", "frankly", "anyway", "whatever",
    "at the end of the day", "thing is",
    # Hindi transliterated
    "matlab", "aur", "bas", "toh",
    # French
    "euh", "ben",
    # Spanish
    "pues", "o sea",
    # German
    "äh", "ähm",
}

POWER_WORDS = {
    "achieved", "delivered", "led", "built", "improved", "reduced",
    "increased", "managed", "designed", "developed", "launched",
    "optimized", "collaborated", "created", "implemented", "solved",
    "results", "impact", "success", "growth", "efficiency",
}


# ── 1. Sentiment Analysis (TextBlob — offline) ────────────────────────────────

def analyze_sentiment(text: str) -> dict:
    """
    Analyze sentiment using TextBlob.
    Works completely offline — no downloads, no API calls.

    TextBlob polarity: -1.0 (very negative) to +1.0 (very positive)

    Returns:
        label:      'positive' | 'neutral' | 'negative'
        confidence: 0-100
    """
    try:
        from textblob import TextBlob

        # Limit text length for speed
        sample   = text[:2000] if len(text) > 2000 else text
        blob     = TextBlob(sample)
        polarity = blob.sentiment.polarity  # -1 to +1

        if polarity > 0.1:
            label      = "positive"
            confidence = round(min(50 + polarity * 49, 99.0), 1)
        elif polarity < -0.1:
            label      = "negative"
            confidence = round(min(50 + abs(polarity) * 49, 99.0), 1)
        else:
            label      = "neutral"
            confidence = round(65.0, 1)

        print(f"   ✅ Sentiment: {label} ({confidence}%) [TextBlob polarity={polarity:.3f}]")
        return {"label": label, "confidence": confidence}

    except ImportError:
        print("⚠️  [Sentiment] TextBlob not installed — pip install textblob")
        return {"label": "neutral", "confidence": 60.0}
    except Exception as e:
        print(f"⚠️  [Sentiment] Error: {e}")
        return {"label": "neutral", "confidence": 60.0}


# ── 2. Filler Word Detection ──────────────────────────────────────────────────

def detect_fillers(text: str) -> dict:
    """Find and count every filler word in the transcript."""
    text_lower = text.lower()
    words      = text_lower.split()
    word_count = len(words)
    found      = {}

    for filler in FILLER_WORDS:
        pattern = r'\b' + re.escape(filler) + r'\b'
        matches = re.findall(pattern, text_lower)
        if matches:
            found[filler] = len(matches)

    total_count         = sum(found.values())
    filler_rate_percent = round((total_count / max(word_count, 1)) * 100, 2)
    found               = dict(sorted(found.items(), key=lambda x: -x[1]))

    return {
        "found":               found,
        "total_count":         total_count,
        "filler_rate_percent": filler_rate_percent,
        "word_count":          word_count,
    }


def add_filler_per_minute(filler_data: dict, duration_seconds: float) -> dict:
    mins = max(duration_seconds / 60, 0.01)
    filler_data["per_minute"] = round(filler_data["total_count"] / mins, 1)
    return filler_data


# ── 3. Keyword Extraction ─────────────────────────────────────────────────────

def extract_keywords(text: str, top_n: int = 12) -> list:
    """Extract keywords using NLTK POS tagging — nouns and proper nouns."""
    try:
        words  = word_tokenize(text[:5000].lower())
        tagged = pos_tag(words)

        keywords = [
            word for word, tag in tagged
            if tag in {"NN", "NNS", "NNP", "NNPS"}
            and word not in STOPWORDS
            and len(word) > 2
            and word.isalpha()
        ]

        freq = Counter(keywords)
        return [
            {"word": w, "count": c, "is_power_word": w in POWER_WORDS}
            for w, c in freq.most_common(top_n)
        ]
    except Exception as e:
        print(f"⚠️  [Keywords] Error: {e}")
        return []


# ── 4. Clarity Analysis ───────────────────────────────────────────────────────

def check_clarity(text: str) -> dict:
    """Measure clarity: sentence length, complex words, power words."""
    try:
        sentences = sent_tokenize(text[:5000])

        if not sentences:
            return {
                "avg_sentence_length": 0,
                "complex_word_ratio":  0,
                "clarity_score":       50,
                "sentence_count":      0,
                "power_word_count":    0,
            }

        avg_len = sum(len(s.split()) for s in sentences) / len(sentences)

        words         = text.lower().split()
        complex_words = [w for w in words if len(w) > 8]
        complex_ratio = round(len(complex_words) / max(len(words), 1) * 100, 1)

        power_word_count = sum(1 for w in words if w.strip(".,!?") in POWER_WORDS)

        score  = 100
        if avg_len > 20:
            score -= min(25, (avg_len - 20) * 2)
        if avg_len < 5:
            score -= 10
        score -= min(15, max(0, complex_ratio - 15))
        score += min(10, power_word_count * 2)
        score  = max(0, min(100, round(score)))

        return {
            "avg_sentence_length": round(avg_len, 1),
            "complex_word_ratio":  complex_ratio,
            "clarity_score":       score,
            "sentence_count":      len(sentences),
            "power_word_count":    power_word_count,
        }
    except Exception as e:
        print(f"⚠️  [Clarity] Error: {e}")
        return {
            "avg_sentence_length": 0,
            "complex_word_ratio":  0,
            "clarity_score":       50,
            "sentence_count":      0,
            "power_word_count":    0,
        }


# ── 5. Scoring Engine ─────────────────────────────────────────────────────────

def compute_score(sentiment: dict, fillers: dict, clarity: dict,
                  duration: float, emotion: dict = None,
                  eye_contact: int = None) -> dict:
    """Compute 0-100 score across all dimensions."""

    word_count = fillers.get("word_count", 0)

    # Sentiment score
    s_map      = {"positive": 90, "neutral": 60, "negative": 25}
    s_base     = s_map.get(sentiment["label"], 60)
    sent_score = round(s_base * 0.5 + (sentiment["confidence"] / 100) * s_base * 0.5)

    # Filler score
    filler_score = max(0, round(100 - fillers["filler_rate_percent"] * 9))

    # Clarity
    clarity_score = clarity["clarity_score"]

    # Pace
    wpm = round((word_count / max(duration, 1)) * 60)
    if   120 <= wpm <= 160: pace_score = 100
    elif 100 <= wpm <= 180: pace_score = 80
    elif  80 <= wpm <= 200: pace_score = 60
    else:                    pace_score = 35

    # Emotion
    emotion_score = 70
    if emotion:
        happy   = emotion.get("happy",   0)
        neutral = emotion.get("neutral", 0)
        fearful = emotion.get("fearful", 0)
        angry   = emotion.get("angry",   0)
        emotion_score = min(100, round(
            happy * 1.0 + neutral * 0.6 - fearful * 0.5 - angry * 0.8
        ))

    eye_score = eye_contact if eye_contact is not None else 70

    # Weighted overall
    if emotion:
        overall = round(
            sent_score    * 0.28 +
            filler_score  * 0.22 +
            clarity_score * 0.18 +
            pace_score    * 0.15 +
            emotion_score * 0.10 +
            eye_score     * 0.07
        )
    else:
        overall = round(
            sent_score    * 0.30 +
            filler_score  * 0.25 +
            clarity_score * 0.25 +
            pace_score    * 0.20
        )

    overall = min(100, max(0, overall))
    grade   = ("A" if overall >= 85 else
               "B" if overall >= 70 else
               "C" if overall >= 55 else
               "D" if overall >= 40 else "F")

    return {
        "overall": overall,
        "grade":   grade,
        "wpm":     wpm,
        "breakdown": {
            "sentiment":    sent_score,
            "filler_usage": filler_score,
            "clarity":      clarity_score,
            "pace":         pace_score,
            "emotion":      emotion_score,
            "eye_contact":  eye_score,
        }
    }


# ── 6. Feedback Generator ─────────────────────────────────────────────────────

def generate_feedback(score: dict, fillers: dict, sentiment: dict,
                      clarity: dict, emotion: dict = None) -> list:
    """Generate prioritized actionable feedback."""
    feedback = []
    bd       = score["breakdown"]
    wpm      = score["wpm"]

    # Filler words
    if bd["filler_usage"] < 60:
        top     = sorted(fillers["found"].items(), key=lambda x: -x[1])[:3]
        top_str = ", ".join([f'"{w}" ({c}×)' for w, c in top])
        feedback.append({
            "category": "Filler Words", "priority": "high", "icon": "🔴",
            "message": f"You used {fillers['total_count']} filler words "
                       f"({fillers['filler_rate_percent']}% of speech). "
                       f"Top: {top_str}.",
            "tip": "Pause silently instead of saying um or like."
        })
    elif bd["filler_usage"] < 80:
        feedback.append({
            "category": "Filler Words", "priority": "medium", "icon": "🟡",
            "message": "Some filler words detected. Aim for under 2% filler rate.",
            "tip": "Replace fillers with a 1-2 second pause."
        })
    else:
        feedback.append({
            "category": "Filler Words", "priority": "positive", "icon": "🟢",
            "message": "Excellent filler word control. Speech sounds professional.",
            "tip": None
        })

    # Sentiment
    if bd["sentiment"] < 50:
        feedback.append({
            "category": "Tone & Confidence", "priority": "high", "icon": "🔴",
            "message": "Tone sounds negative or uncertain. Use confident, action-oriented language.",
            "tip": "Start answers with 'I achieved', 'I led', 'I built' instead of 'I tried'."
        })
    elif bd["sentiment"] < 70:
        feedback.append({
            "category": "Tone & Confidence", "priority": "medium", "icon": "🟡",
            "message": "Neutral tone detected. Let your enthusiasm for the role come through.",
            "tip": "Add one sentence per answer about why you are passionate about the topic."
        })
    else:
        feedback.append({
            "category": "Tone & Confidence", "priority": "positive", "icon": "🟢",
            "message": f"Strong, confident tone detected ({sentiment['confidence']}% confidence).",
            "tip": None
        })

    # Pace
    if wpm > 190:
        feedback.append({
            "category": "Speaking Pace", "priority": "high", "icon": "🔴",
            "message": f"Speaking too fast ({wpm} wpm). Interviewers struggle to follow.",
            "tip": "Take a breath after each sentence. Pause after key points."
        })
    elif wpm < 90 and wpm > 0:
        feedback.append({
            "category": "Speaking Pace", "priority": "medium", "icon": "🟡",
            "message": f"Speaking slowly ({wpm} wpm). Try to be more energetic.",
            "tip": "Think of your ideal pace as a confident news presenter."
        })
    else:
        feedback.append({
            "category": "Speaking Pace", "priority": "positive", "icon": "🟢",
            "message": f"Good speaking pace at {wpm} wpm — ideal range is 120-160 wpm.",
            "tip": None
        })

    # Clarity
    avg_len = clarity.get("avg_sentence_length", 0)
    if bd["clarity"] < 60:
        feedback.append({
            "category": "Answer Clarity", "priority": "high", "icon": "🔴",
            "message": f"Avg sentence length is {avg_len} words — too complex.",
            "tip": "Use STAR method: Situation → Task → Action → Result."
        })
    elif bd["clarity"] < 75:
        feedback.append({
            "category": "Answer Clarity", "priority": "medium", "icon": "🟡",
            "message": f"Some answers run long ({avg_len} words avg). Aim for under 15 words.",
            "tip": "Ask yourself: could I say this in half the words?"
        })
    else:
        feedback.append({
            "category": "Answer Clarity", "priority": "positive", "icon": "🟢",
            "message": f"Clear, structured answers. {clarity['sentence_count']} sentences at {avg_len} words avg.",
            "tip": None
        })

    # Power words
    if clarity.get("power_word_count", 0) < 3:
        feedback.append({
            "category": "Vocabulary", "priority": "medium", "icon": "🟡",
            "message": "Use more action verbs — achieved, built, led, delivered make answers memorable.",
            "tip": "Write 5 achievement sentences starting with strong verbs before your interview."
        })

    # Emotion (if camera used)
    if emotion:
        fearful = emotion.get("fearful", 0)
        happy   = emotion.get("happy",   0)
        neutral = emotion.get("neutral", 0)

        if fearful > 20:
            feedback.append({
                "category": "Facial Expression", "priority": "high", "icon": "🔴",
                "message": f"Nervous expression detected {fearful}% of session.",
                "tip": "Take 3 deep breaths before answering. Smile at start of each answer."
            })
        elif neutral > 60:
            feedback.append({
                "category": "Facial Expression", "priority": "medium", "icon": "🟡",
                "message": f"Neutral expression for {neutral}% of session. Show more engagement.",
                "tip": "Smile when mentioning achievements. Nod when making key points."
            })
        elif happy > 40:
            feedback.append({
                "category": "Facial Expression", "priority": "positive", "icon": "🟢",
                "message": f"Great facial engagement — positive expression {happy}% of session.",
                "tip": None
            })

    # Sort: high → medium → positive
    order = {"high": 0, "medium": 1, "positive": 2}
    feedback.sort(key=lambda x: order.get(x["priority"], 3))
    return feedback


# ── Master function ────────────────────────────────────────────────────────────

def analyze_full(transcript: str, duration: float,
                 emotion: dict = None, eye_contact: int = None) -> dict:
    """Run complete NLP analysis pipeline on a transcript."""
    print("🧠 [NLP] Starting analysis pipeline...")

    sentiment = analyze_sentiment(transcript)

    fillers = detect_fillers(transcript)
    fillers = add_filler_per_minute(fillers, duration)
    print(f"   ✅ Fillers: {fillers['total_count']} found ({fillers['filler_rate_percent']}%)")

    keywords = extract_keywords(transcript)
    print(f"   ✅ Keywords: {len(keywords)} extracted")

    clarity = check_clarity(transcript)
    print(f"   ✅ Clarity: {clarity['clarity_score']}/100")

    score = compute_score(sentiment, fillers, clarity, duration, emotion, eye_contact)
    print(f"   ✅ Score: {score['overall']}/100 (Grade {score['grade']})")

    feedback = generate_feedback(score, fillers, sentiment, clarity, emotion)
    print(f"   ✅ Feedback: {len(feedback)} items generated")

    return {
        "sentiment": sentiment,
        "fillers":   fillers,
        "keywords":  keywords,
        "clarity":   clarity,
        "score":     score,
        "feedback":  feedback,
    }