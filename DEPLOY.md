# 🚀 Deploy AI Campus OS to Vercel

The app is **deploy-ready**. It uses Upstash Vector (a free hosted database) in the cloud so your uploaded PDFs persist. Follow these steps — they take ~10 minutes.

---

## ✅ STEP 1 — Create the database (Upstash, free)
1. Go to **https://console.upstash.com** → sign up (Google/GitHub login is easiest).
2. Click **Vector** in the left menu → **Create Index**.
3. Fill in:
   - **Name:** `ai-campus`
   - **Region:** pick the one closest to you
   - **Dimensions:** `1536`   ← IMPORTANT (free-tier max; the app truncates Gemini's vectors to match)
   - **Metric:** `COSINE`
4. Click **Create**.
5. On the index page, find the **REST API** section and copy two values:
   - `UPSTASH_VECTOR_REST_URL`
   - `UPSTASH_VECTOR_REST_TOKEN`
6. Paste them into `.env.local` (and tell Claude — we'll test locally first).

---

## ✅ STEP 2 — Deploy to Vercel (free)
You don't need GitHub — the Vercel CLI deploys this folder directly.

1. Create an account at **https://vercel.com/signup** (free "Hobby" plan).
2. In this Claude session, run the login (type it with the `!` prefix):
   ```
   ! npx vercel login
   ```
   Follow the prompt (it emails you a code / opens the browser).
3. Deploy:
   ```
   ! npx vercel
   ```
   Accept the defaults (it auto-detects Next.js). This creates a **preview** URL.

---

## ✅ STEP 3 — Add your secret keys to Vercel
The app needs its keys in the cloud (your `.env.local` is NOT uploaded).

In the Vercel dashboard → your project → **Settings → Environment Variables**, add:
| Name | Value |
|------|-------|
| `GEMINI_API_KEY` | your Gemini key |
| `UPSTASH_VECTOR_REST_URL` | from Upstash |
| `UPSTASH_VECTOR_REST_TOKEN` | from Upstash |

Then deploy the live version:
```
! npx vercel --prod
```

🎉 You'll get a public URL like `https://ai-campus-app.vercel.app` — share it with anyone!

---

## Notes
- Free Gemini tier has low daily limits; for many users, enable billing on Google AI Studio.
- The local `.data/store.json` is only used when Upstash keys are absent (i.e. local dev).
- To redeploy after changes: `! npx vercel --prod`.
