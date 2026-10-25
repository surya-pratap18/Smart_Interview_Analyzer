# 🎙️ Smart Interview Analyzer

AI-powered interview coach — real-time emotion detection, speech analysis, filler word detection, multi-language support, and personalized feedback.

**Tech Stack:** React + Vite · Flask · PostgreSQL · Whisper · MediaPipe · DeepFace · HuggingFace

---

## 📁 Project Structure

```
smart-interview-analyzer/
├── backend/
│   ├── app.py                    ← Flask entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── analyze.py            ← POST /api/analyze
│   │   ├── history.py            ← GET  /api/history
│   │   └── realtime.py           ← WebSocket + translate
│   ├── services/
│   │   ├── transcription.py      ← Whisper STT
│   │   ├── nlp_analysis.py       ← Sentiment, fillers, score
│   │   ├── vision.py             ← MediaPipe + DeepFace
│   │   ├── alerts.py             ← Real-time alert engine
│   │   ├── translation.py        ← Multi-language
│   │   └── database.py           ← PostgreSQL queries
│   └── models/
│       └── gesture_model.pkl     ← Your trained gesture model
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── training/
    └── train_gesture_classifier.py  ← Google Colab notebook
```

---

## ⚙️ Setup — Step by Step

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL (local) OR Supabase account (free cloud)

---

### Step 1 — Clone & enter project

```bash
git clone https://github.com/yourusername/smart-interview-analyzer.git
cd smart-interview-analyzer
```

---

### Step 2 — Backend setup

```bash
cd backend

# Create virtual environment (keeps packages isolated)
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install all dependencies
pip install -r requirements.txt

# Download spaCy language model
python -m spacy download en_core_web_sm
```

---

### Step 3 — Configure environment

```bash
# Copy the example env file
cp .env.example .env

# Open .env and fill in your values
```

**Minimum required in .env:**
```env
SECRET_KEY=any-random-string-here

# For local PostgreSQL:
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/smart_interview

# For Supabase (free cloud):
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

WHISPER_MODEL=base
```

---

### Step 4 — Set up PostgreSQL

**Option A: Local PostgreSQL**
```sql
-- In psql or pgAdmin:
CREATE DATABASE smart_interview;
-- Tables are created automatically when you run the backend
```

**Option B: Supabase (recommended — free, no setup)**
1. Go to [supabase.com](https://supabase.com)
2. Create free account → New Project
3. Go to Settings → Database → Connection String
4. Copy the URI into your `.env` as `DATABASE_URL`

---

### Step 5 — Run the backend

```bash
# Make sure venv is activated
python app.py
```

You should see:
```
=======================================================
  🎙️  Smart Interview Analyzer — Backend
=======================================================
  URL:      http://localhost:5000
  Debug:    True
  Whisper:  base
=======================================================
✅ [DB] Tables initialized successfully
```

Test it:
```bash
curl http://localhost:5000/api/health
# → {"status": "ok", "version": "1.0.0"}
```

---

### Step 6 — Frontend setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

### Step 7 — First analysis test

1. Open http://localhost:5173
2. Go to **Analyze** page
3. Upload any MP3/MP4 file (or record live)
4. Click **Analyze Interview**
5. Wait 10–30 seconds (first run downloads AI models)
6. See your results dashboard

---

## 🤖 Model Training (Google Colab)

### Train the gesture classifier

1. Open [Google Colab](https://colab.research.google.com)
2. Upload `training/train_gesture_classifier.py`
3. Run each section in order
4. Download `gesture_model.pkl`
5. Place it in `backend/models/`

### First-run model downloads

These download automatically on first use:
| Model | Size | Download time |
|---|---|---|
| Whisper base | ~140MB | ~1 min |
| spaCy en_core_web_sm | ~12MB | ~10 sec |
| HuggingFace RoBERTa | ~500MB | ~2 min |
| DeepFace VGG-Face | ~580MB | ~2 min |
| MediaPipe models | ~10MB | ~10 sec |

**Total first-run download: ~1.2GB** — happens once, cached after that.

---

## 🚀 Deployment (Free)

### Frontend → Vercel

```bash
cd frontend
npm run build

# Install Vercel CLI
npm install -g vercel
vercel deploy
```

Set environment variable in Vercel:
```
VITE_API_URL=https://your-backend-url.com
```

### Backend → Oracle Cloud Always Free

1. Create free account at [oracle.com/cloud/free](https://oracle.com/cloud/free)
2. Create VM: Ubuntu 22.04, 4GB RAM (Always Free tier)
3. SSH in and run:

```bash
# Install Python
sudo apt update && sudo apt install python3.10 python3-pip -y

# Clone your repo
git clone https://github.com/yourusername/smart-interview-analyzer.git
cd smart-interview-analyzer/backend

# Install dependencies
pip3 install -r requirements.txt
python3 -m spacy download en_core_web_sm

# Set up .env
cp .env.example .env
nano .env  # fill in your values

# Run with gunicorn (production server)
pip3 install gunicorn eventlet
gunicorn --worker-class eventlet -w 1 --bind 0.0.0.0:5000 app:app
```

---

## 📡 API Reference

### POST /api/analyze
Upload audio/video for analysis.

**Request:** `multipart/form-data`
| Field | Type | Required |
|---|---|---|
| file | File | ✅ |
| target_language | string | ❌ (e.g. 'hi', 'de') |
| run_vision | string | ❌ ('true'/'false') |

**Response:**
```json
{
  "session_id": "uuid",
  "overall_score": 73,
  "transcript": "...",
  "sentiment": {"label": "positive", "confidence": 81},
  "fillers": {"found": {"um": 12}, "total_count": 34},
  "score": {"overall": 73, "breakdown": {...}, "wpm": 143},
  "feedback": [{"category": "Filler Words", "priority": "high", ...}],
  "emotion_summary": {"happy": 47, "neutral": 37, ...},
  "subtitles": {"srt": "...", "vtt": "..."}
}
```

### GET /api/history
```json
{"interviews": [...], "limit": 20, "offset": 0}
```

### GET /api/interview/:session_id
Full session data.

### GET /api/languages
List of supported translation languages.

### WebSocket Events
| Event | Direction | Description |
|---|---|---|
| join_session | Client→Server | Start live session |
| video_frame | Client→Server | Send webcam frame (base64) |
| frame_result | Server→Client | Emotion + gaze for frame |
| alert | Server→Client | Real-time alert |
| leave_session | Client→Server | End session |
| session_summary | Server→Client | Aggregated results |

---

## 🛠️ Troubleshooting

**Whisper model download fails:**
```bash
pip install --upgrade openai-whisper
```

**MediaPipe import error:**
```bash
pip install mediapipe==0.10.14
```

**DeepFace first run is slow:**
Normal — it downloads VGG-Face model (~580MB) once.

**PostgreSQL connection refused:**
```bash
# Check PostgreSQL is running
sudo service postgresql start
# Or use Supabase (cloud) instead
```

**Camera not accessible in browser:**
Make sure you're on `localhost` (not an IP address).
Chrome requires HTTPS or localhost for camera access.

---

## 📊 Scoring Breakdown

| Dimension | Weight | What it measures |
|---|---|---|
| Sentiment | 30% | Positive/confident tone |
| Filler usage | 25% | Um, uh, like frequency |
| Clarity | 20% | Sentence structure, vocabulary |
| Pace | 15% | Words per minute (ideal: 120-160) |
| Emotion | 10% | Facial engagement (if video) |

---

## 📄 License
MIT — free to use, modify, and deploy.
