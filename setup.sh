#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Smart Interview Analyzer — One-command setup script
# Run: bash setup.sh
# ─────────────────────────────────────────────────────────────

set -e  # Exit on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${BLUE}  🎙️  Smart Interview Analyzer — Setup${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""

# ── Check Python ──────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Checking Python...${NC}"
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}❌ Python 3 not found. Install from python.org${NC}"
    exit 1
fi
PY_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✅ Python $PY_VERSION found${NC}"

# ── Check Node ────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Checking Node.js...${NC}"
if ! command -v node &>/dev/null; then
    echo -e "${RED}❌ Node.js not found. Install from nodejs.org${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node $NODE_VERSION found${NC}"

# ── Backend setup ─────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/6] Setting up backend...${NC}"
cd backend

# Create virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo -e "${GREEN}✅ Virtual environment created${NC}"
fi

# Activate
source venv/bin/activate 2>/dev/null || source venv/Scripts/activate 2>/dev/null

# Install dependencies
echo "   Installing Python packages (this takes 2-5 minutes first time)..."
pip install -r requirements.txt --quiet
echo -e "${GREEN}✅ Python packages installed${NC}"

# spaCy model
echo "   Downloading spaCy language model..."
python3 -m spacy download en_core_web_sm --quiet
echo -e "${GREEN}✅ spaCy model ready${NC}"

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Created .env file — edit it with your database credentials${NC}"
fi

# Create models directory
mkdir -p models uploads
echo -e "${GREEN}✅ Backend ready${NC}"

cd ..

# ── Frontend setup ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6] Setting up frontend...${NC}"
cd frontend
npm install --silent
echo -e "${GREEN}✅ Frontend packages installed${NC}"
cd ..

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}=================================================${NC}"
echo -e "${GREEN}  ✅ Setup complete!${NC}"
echo -e "${BLUE}=================================================${NC}"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo ""
echo -e "  1. Edit ${BLUE}backend/.env${NC} with your database URL"
echo ""
echo -e "  2. Start the backend:"
echo -e "     ${GREEN}cd backend && source venv/bin/activate && python app.py${NC}"
echo ""
echo -e "  3. Start the frontend (new terminal):"
echo -e "     ${GREEN}cd frontend && npm run dev${NC}"
echo ""
echo -e "  4. Open ${BLUE}http://localhost:5173${NC}"
echo ""
echo -e "  ${YELLOW}First analysis will take 2-3 minutes${NC} to download AI models."
echo -e "  After that, each analysis takes 10-30 seconds."
echo ""
