# Candidate Intelligence Pipeline

A multi-agent AI system that screens candidates through three sequential specialized agents: **intake → scoring → synthesis**. Each agent receives the structured output of the previous one, building compounding intelligence over the pipeline. Results persist in a memory layer that enables cross-candidate ranking and feedback loops.

![Pipeline: Intake Agent → Scoring Agent → Synthesis Agent → Memory Layer](https://img.shields.io/badge/agents-3_sequential-blue) ![Stack](https://img.shields.io/badge/stack-Node.js_+_Claude_API-black)

---

## What it does

| Agent | Input | Output |
|---|---|---|
| **Intake** | Raw JD + candidate text | Structured JSON: requirements, strengths, gaps, signals |
| **Scorer** | Structured profile | Scores across 4 dimensions + verdict + confidence |
| **Synthesizer** | Profile + scores | Hiring brief, targeted interview questions, next step |
| **Memory** | Full pipeline result | Persistent store → cross-candidate ranking |

**Business impact:** ~25 min of manual screening → ~90 seconds. At 50 candidates/month, that's ~20 hours saved per hiring cycle.

---

## Quickstart

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/candidate-pipeline.git
cd candidate-pipeline
npm install
```

### 2. Set your API key

```bash
cp .env.example .env
# Edit .env and add your Anthropic API key
# Get one at: https://console.anthropic.com
```

### 3. Run

```bash
npm start
# → http://localhost:3000
```

---

## Deploy to Railway (recommended — free tier available)

Railway is the fastest way to deploy this publicly.

1. Push your repo to GitHub (see below)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Select your repo
4. Add environment variable: `ANTHROPIC_API_KEY` = your key
5. Railway auto-detects Node.js and deploys. You get a public URL instantly.

## Deploy to Render (free tier)

1. Go to [render.com](https://render.com) → New Web Service → Connect GitHub repo
2. Build command: `npm install`
3. Start command: `npm start`
4. Add env var: `ANTHROPIC_API_KEY`

---

## Push to GitHub

```bash
cd candidate-pipeline
git init
git add .
git commit -m "Initial: multi-agent candidate screening pipeline"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/candidate-pipeline.git
git push -u origin main
```

---

## Architecture

```
User input (JD + candidate)
        │
        ▼
┌─────────────────┐
│  Intake Agent   │  → Normalizes raw text into structured schema
│  (Claude API)   │     {requirements, strengths, gaps, signals}
└────────┬────────┘
         │  structured JSON
         ▼
┌─────────────────┐
│  Scoring Agent  │  → Scores fit across 4 dimensions
│  (Claude API)   │     {technical, systems, ownership, domain}
└────────┬────────┘
         │  scores + verdict
         ▼
┌─────────────────┐
│ Synthesis Agent │  → Generates hiring brief + interview questions
│  (Claude API)   │
└────────┬────────┘
         │  full result
         ▼
┌─────────────────┐
│  Memory Layer   │  → Persists all evaluations for ranking
└─────────────────┘
```

**Key design decisions:**
- Agents communicate through structured JSON, never raw text — this makes the pipeline reliable and the outputs composable
- Server-Sent Events stream pipeline progress to the UI in real time
- API key stays on the server — never exposed to the client
- Memory layer is localStorage for simplicity; production swap = Postgres + pgvector for semantic search

---

## Extending this

Some things worth building on top of this:

- **Feedback loop:** Track which "Strong hire" candidates actually converted. Feed that back into the scorer's calibration prompt.
- **Batch mode:** `POST /api/batch` with an array of candidates, returns ranked shortlist
- **Semantic search:** Replace localStorage with pgvector — query "find candidates similar to our best hire"
- **Slack integration:** Post a hiring brief to a channel when a strong candidate is found
- **Multi-role support:** Let the scorer compare against multiple open roles simultaneously

---

## Stack

- **Runtime:** Node.js 18+
- **Backend:** Express
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`)
- **Frontend:** Vanilla JS, no build step
- **Streaming:** Server-Sent Events (SSE)
