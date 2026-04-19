require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk").default;
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Agent definitions ───────────────────────────────────────────────────────

const AGENTS = {
  intake: {
    name: "Intake Agent",
    system: `You are a structured intake agent for a hiring pipeline. 
Your job is to parse a job description and candidate profile into clean, structured data.
Respond ONLY with valid JSON — no markdown fences, no explanation.
Schema:
{
  "candidate_name": "string",
  "jd_requirements": ["string"],
  "key_strengths": ["string"],
  "key_gaps": ["string"],
  "match_signals": ["string"],
  "red_flags": ["string"]
}`,
  },

  scorer: {
    name: "Scoring Agent",
    system: `You are a calibrated hiring scoring agent. 
You receive structured candidate data and score fit objectively across dimensions.
Respond ONLY with valid JSON — no markdown fences, no explanation.
Schema:
{
  "technical_fit": number (0-100),
  "systems_thinking": number (0-100),
  "ownership_drive": number (0-100),
  "domain_fit": number (0-100),
  "overall": number (0-100),
  "verdict": "Strong hire" | "Consider" | "Pass",
  "confidence": "High" | "Medium" | "Low",
  "one_line_rationale": "string"
}`,
  },

  synthesizer: {
    name: "Synthesis Agent",
    system: `You are a senior hiring synthesizer. 
You receive a candidate's structured profile and scores, and produce a concise hiring brief.
Respond ONLY with valid JSON — no markdown fences, no explanation.
Schema:
{
  "summary": "string (2-3 sentences)",
  "top_strengths": ["string", "string", "string"],
  "key_risks": ["string", "string"],
  "interview_questions": ["string", "string", "string", "string"],
  "recommended_next_step": "string"
}`,
  },
};

async function callAgent(agentKey, userMessage) {
  const agent = AGENTS[agentKey];
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: agent.system,
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = message.content[0].text.replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

// ─── Pipeline endpoint (streaming progress via SSE) ──────────────────────────

app.get("/api/pipeline", async (req, res) => {
  const { jd, candidate } = req.query;

  if (!jd || !candidate) {
    return res.status(400).json({ error: "jd and candidate are required" });
  }

  // Server-Sent Events for real-time progress
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Agent 1: Intake
    send("agent_start", { agent: "intake", name: "Intake Agent" });
    const intake = await callAgent(
      "intake",
      `Job Description:\n${jd}\n\nCandidate Profile:\n${candidate}`
    );
    send("agent_done", { agent: "intake", result: intake });

    // Agent 2: Scorer
    send("agent_start", { agent: "scorer", name: "Scoring Agent" });
    const scores = await callAgent(
      "scorer",
      `Structured candidate profile:\n${JSON.stringify(intake, null, 2)}\n\nOriginal JD:\n${jd}`
    );
    send("agent_done", { agent: "scorer", result: scores });

    // Agent 3: Synthesizer
    send("agent_start", { agent: "synthesizer", name: "Synthesis Agent" });
    const synthesis = await callAgent(
      "synthesizer",
      `Candidate profile:\n${JSON.stringify(intake, null, 2)}\n\nScores:\n${JSON.stringify(scores, null, 2)}`
    );
    send("agent_done", { agent: "synthesizer", result: synthesis });

    // Final combined result
    send("complete", {
      candidate: intake,
      scores,
      synthesis,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    send("error", { message: err.message });
  }

  res.end();
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    apiKeySet: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n Candidate Pipeline running at http://localhost:${PORT}`);
  console.log(`   API key: ${process.env.ANTHROPIC_API_KEY ? "✓ set" : "✗ missing — add to .env"}\n`);
});
