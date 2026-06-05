# 🎓 AI Campus OS — Stage 3 (Real RAG App)

<div align="center">

### 🔗 [**Try the Live Demo →**](https://ai-campus-app-teal.vercel.app/)

*Upload a PDF and chat with it — running live on Vercel.*

</div>

---

A real **Chat-with-your-PDF** app: upload a PDF → the AI reads it → ask questions → get answers grounded in *your* document, with citations. Built with Next.js 16 + TypeScript + Tailwind + Google Gemini.

## 🚀 Run it in 3 steps

### 1. Get a FREE Gemini API key (~2 min)
- Visit **https://aistudio.google.com/apikey**
- Sign in with Google → **Create API key** → copy it.

### 2. Paste the key
Open **`.env.local`** in this folder and paste your key:
```
GEMINI_API_KEY=your_key_here
```
Save the file.

### 3. Start the app
In a terminal, from this folder:
```
npm run dev
```
Then open **http://localhost:3000** in your browser.

> Tip in this Claude session: type `! cd ai-campus-app; npm run dev` to start it from here.

## 🧠 How the RAG works
```
Upload PDF
  → extract text (pdf-parse)
  → split into overlapping chunks         (src/lib/store.ts → chunkText)
  → embed each chunk into a vector         (src/lib/gemini.ts → embed, gemini-embedding-001)
  → store vectors in memory                (src/lib/store.ts → store)

Ask a question
  → embed the question
  → find the most similar chunks (cosine)  (src/lib/store.ts → topK)
  → send those chunks + question to Gemini (src/lib/gemini.ts → chat, gemini-2.5-flash)
  → return the answer + source snippets
```

## 📁 Key files
| File | Role |
|------|------|
| `src/app/page.tsx` | The UI (upload + chat) |
| `src/app/api/upload/route.ts` | Read → chunk → embed → store |
| `src/app/api/chat/route.ts` | Retrieve → ask Gemini → answer + sources |
| `src/lib/gemini.ts` | Gemini embed/chat helpers |
| `src/lib/store.ts` | In-memory vector store + similarity |
| `.env.local` | Your API key |

## ⚠️ Notes
- The vector store is **in-memory** — it resets when you restart `npm run dev`. (Production would use Pinecone/Chroma + a database.)
- Free tier has rate limits, so each PDF is capped at 40 chunks. Raise `MAX_CHUNKS` in `api/upload/route.ts` later.
- Scanned/image-only PDFs won't extract text (would need OCR).
- Models in use: chat = `gemini-2.5-flash`, embeddings = `gemini-embedding-001` (verified working on the free key). If one ever errors, override with `GEMINI_MODEL=` / `GEMINI_EMBED_MODEL=` in `.env.local`.
- Free tier has rate limits — if you see a `429` error, wait a minute and retry.

## 🔜 Next steps
- Add user accounts (Firebase Auth) so each student has a private library
- Port the full dashboard UI (Mind Maps, Exam Predictor) on top of this RAG core
