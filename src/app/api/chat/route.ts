/* POST /api/chat — CONVERSATIONAL RAG.
   Accepts { question, history } and answers in an ongoing 1-to-1
   conversation, grounded in the student's uploaded PDFs. */
import { embed, chat, hasKey, friendlyError } from "@/lib/gemini";
import { searchChunks, isEmpty } from "@/lib/store";

export const runtime = "nodejs";

type Turn = { role: "user" | "ai"; text: string };

export async function POST(request: Request) {
  try {
    if (!hasKey()) {
      return Response.json({
        answer: "⚠️ No Gemini API key set yet. Add GEMINI_API_KEY to .env.local and restart — see the README.",
        sources: [],
      });
    }

    const { question, history } = await request.json();
    if (!question || typeof question !== "string") {
      return Response.json({ error: "Missing question." }, { status: 400 });
    }

    if (await isEmpty()) {
      return Response.json({
        answer: "📂 I don't have any material yet. Upload a PDF first, then let's talk about it!",
        sources: [],
      });
    }

    const turns: Turn[] = Array.isArray(history) ? history : [];

    // Retrieval works better with context: blend the last user turns into the query.
    const recentUser = turns.filter((t) => t.role === "user").slice(-2).map((t) => t.text).join(" ");
    const retrievalQuery = `${recentUser} ${question}`.trim();
    const queryEmbedding = await embed(retrievalQuery);
    const hits = await searchChunks(queryEmbedding, 4);

    const context = hits.map((h, i) => `[${i + 1}] (from ${h.file})\n${h.text}`).join("\n\n");

    // Render the conversation so far so the AI has memory of it.
    const convo = turns
      .slice(-8)
      .map((t) => `${t.role === "user" ? "Student" : "Tutor"}: ${t.text}`)
      .join("\n");

    const prompt = `You are a warm, encouraging university tutor having an ongoing 1-to-1 conversation with a student. Answer using ONLY the context below, which comes from the student's own uploaded material. Cite facts with [1], [2], etc. Refer back to earlier parts of the conversation when relevant (e.g. "as we discussed…"). If the answer isn't in the context, say so honestly and suggest what to upload. Keep replies clear and friendly.

Context from the student's documents:
${context}

${convo ? `Conversation so far:\n${convo}\n\n` : ""}Student: ${question}
Tutor:`;

    const answer = await chat(prompt);

    const sources = hits.map((h, i) => ({
      n: i + 1,
      file: h.file,
      snippet: h.text.slice(0, 160) + (h.text.length > 160 ? "…" : ""),
    }));

    return Response.json({ answer, sources });
  } catch (err) {
    console.error("chat error:", err);
    return Response.json({ answer: "❌ " + friendlyError(err), sources: [] });
  }
}
