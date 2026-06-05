/* POST /api/quiz — generate a multiple-choice quiz from the material. */
import { chat, hasKey, friendlyError } from "@/lib/gemini";
import { sampleChunks, isEmpty } from "@/lib/store";

export const runtime = "nodejs";

export type QuizQuestion = {
  q: string;
  options: string[];
  answer: number; // 0-based index of correct option
  explanation: string;
};

export async function POST(request: Request) {
  try {
    if (!hasKey()) return Response.json({ error: "No Gemini API key set." }, { status: 400 });
    if (await isEmpty()) return Response.json({ error: "Upload a PDF first." }, { status: 400 });

    const { difficulty = "Medium", count = 5 } = await request.json();
    const n = Math.min(Math.max(Number(count) || 5, 1), 10);

    // Use a broad sample of the document as the source.
    const context = (await sampleChunks(10)).map((h) => h.text).join("\n\n");

    const prompt = `Create ${n} ${difficulty} multiple-choice questions based STRICTLY on the context below.
Return ONLY valid JSON — no markdown fences, no commentary — as an array of objects with EXACTLY this shape:
[{"q":"question text","options":["option A","option B","option C","option D"],"answer":0,"explanation":"why the answer is correct"}]
"answer" is the 0-based index (0-3) of the correct option. Make the wrong options plausible.

Context:
${context}

JSON:`;

    let raw = (await chat(prompt)).trim();
    // Strip code fences if the model added them.
    raw = raw.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    // Extract the JSON array.
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1) {
      return Response.json({ error: "Couldn't generate a quiz — please try again." }, { status: 502 });
    }

    let questions: QuizQuestion[];
    try {
      questions = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return Response.json({ error: "Couldn't parse the quiz — please try again." }, { status: 502 });
    }

    // Basic validation
    questions = questions.filter(
      (q) => q && typeof q.q === "string" && Array.isArray(q.options) && q.options.length >= 2 && typeof q.answer === "number"
    );
    if (questions.length === 0) {
      return Response.json({ error: "No valid questions generated — try again." }, { status: 502 });
    }

    return Response.json({ questions });
  } catch (err) {
    console.error("quiz error:", err);
    return Response.json({ error: friendlyError(err) }, { status: 500 });
  }
}
