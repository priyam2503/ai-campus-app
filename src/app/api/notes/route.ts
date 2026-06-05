/* POST /api/notes — generate study notes from the uploaded material. */
import { embed, chat, hasKey, friendlyError } from "@/lib/gemini";
import { searchChunks, sampleChunks, isEmpty } from "@/lib/store";

export const runtime = "nodejs";

const STYLES: Record<string, string> = {
  "Short Notes": "Write concise short notes: only the most important points, tightly summarized.",
  "Long Notes": "Write detailed, thorough notes covering concepts, explanations and examples.",
  "Revision Notes": "Write quick revision notes: bullet points, key terms, and one-line definitions for fast review.",
  "One-Day-Before-Exam Notes": "Write last-minute exam notes: only the highest-yield facts, formulas, and likely questions.",
};

export async function POST(request: Request) {
  try {
    if (!hasKey()) return Response.json({ error: "No Gemini API key set." }, { status: 400 });
    if (await isEmpty()) return Response.json({ error: "Upload a PDF first." }, { status: 400 });

    const { type, topic } = await request.json();
    const style = STYLES[type] || STYLES["Short Notes"];

    // Pick relevant chunks: by topic if given, else a broad sample of the document.
    const hits = topic && topic.trim() ? await searchChunks(await embed(topic), 8) : await sampleChunks(8);
    const context = hits.map((h, i) => `(${i + 1}) ${h.text}`).join("\n\n");

    const prompt = `You are a tutor creating "${type}"${topic ? ` on the topic "${topic}"` : ""} for a student, using ONLY their uploaded material below. ${style}
Output clean Markdown: use ## headings, bullet lists, **bold** for key terms, and show formulas/definitions where relevant. Do not invent facts that aren't in the material.

Material:
${context}

Notes (Markdown):`;

    const notes = await chat(prompt);
    return Response.json({ notes });
  } catch (err) {
    console.error("notes error:", err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}
