/* =========================================================
   Google Gemini helpers — the AI brain.
   Reads the API key from .env.local (GEMINI_API_KEY).
   ========================================================= */
import { GoogleGenerativeAI } from "@google/generative-ai";

const KEY = process.env.GEMINI_API_KEY;
// Change these if Google returns a "model not found" error (see README).
const CHAT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
// gemini-embedding-001 returns 3072 dims. We truncate to 1536 (valid because the
// model uses Matryoshka representation) to fit Upstash Vector's free-tier limit.
const EMBED_DIM = 1536;

export function hasKey(): boolean {
  return !!KEY && KEY.trim().length > 0;
}

function client(): GoogleGenerativeAI {
  if (!hasKey()) throw new Error("NO_KEY");
  return new GoogleGenerativeAI(KEY!);
}

/** Turn a piece of text into an embedding vector (truncated to EMBED_DIM). */
export async function embed(text: string): Promise<number[]> {
  const model = client().getGenerativeModel({ model: EMBED_MODEL });
  const res = await model.embedContent(text);
  return res.embedding.values.slice(0, EMBED_DIM);
}

/** Ask Gemini to generate an answer from a full prompt. */
export async function chat(prompt: string): Promise<string> {
  const model = client().getGenerativeModel({ model: CHAT_MODEL });
  const res = await model.generateContent(prompt);
  return res.response.text();
}

/** Turn a raw Gemini/SDK error into a friendly, student-readable message. */
export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429") || /quota|rate limit/i.test(msg)) {
    return "⏳ You've hit Gemini's free-tier limit. Wait a minute (or until tomorrow for the daily cap) and try again — or enable billing for higher limits.";
  }
  if (/api[_ ]?key|401|403|permission/i.test(msg)) {
    return "🔑 There's a problem with the API key. Check GEMINI_API_KEY in .env.local.";
  }
  return msg;
}
