# Young Agripreneurs Lesson Recorder 

A local-first classroom recorder with slide, screen, camera, annotation, question-paper, memo and animated-whiteboard workflows.

## Simple deployment architecture

- **Vercel:** serves the recorder website only.
- **Supabase Edge Function `classroom-ai`:** connects classroom AI to **DeepSeek only**.
- **Browser IndexedDB:** stores recordings locally. There is no cloud backup unless you download the WebM files.
- **Not required:** Supabase database, Supabase Storage, user accounts, Docker, Kimi credentials, or a Vercel API function.

There is no Kimi AI fallback. The DeepSeek key is read only inside the Supabase Edge Function. Never put it in `src/`, give it a `VITE_` prefix, commit it, or upload a real `.env` file.

## Deploy the Supabase AI function

Upload/push the complete source project, including `supabase/config.toml`, `supabase/functions/classroom-ai/index.ts` and its `import_map.json`. Do not upload `.env`, `node_modules`, `dist` or `.git`.

1. In **Supabase → Edge Functions → Secrets**, add:
   - Name: `DEEPSEEK_API_KEY`
   - Value: your own DeepSeek API key
2. Install/use the Supabase CLI, sign in, and link your project:

```bash
npx supabase@latest login
npx supabase@latest link --project-ref YOUR_PROJECT_REF
npx supabase@latest functions deploy classroom-ai
```

Replace `YOUR_PROJECT_REF` with the reference shown in Supabase Project Settings. Do not paste the DeepSeek key into the terminal command or into chat; the dashboard secret is enough.

Optional: add `DEEPSEEK_MODEL=deepseek-chat` as another Supabase secret only if you need to force that model. Otherwise the function prefers `deepseek-chat` when available.

## Deploy the frontend on Vercel

1. Push the complete project to GitHub and import it into Vercel.
2. In **Vercel → Project → Settings → Environment Variables**, add only this frontend setting for Production:
   - Name: `VITE_SUPABASE_URL`
   - Value: `https://YOUR_PROJECT_REF.supabase.co`
3. Redeploy Vercel after adding or changing it.

`VITE_SUPABASE_URL` is a public project address, not a secret. No Supabase anon, publishable, secret, or service-role key is needed by this no-login prototype. `DEEPSEEK_API_KEY` is no longer required in Vercel when `VITE_SUPABASE_URL` is set.

The Vercel configuration now builds only `dist/public`; it does not require the previously ignored `api/dist/vercel.js` file. Dependency installation uses the public npm registry.

## Run locally with the existing Node backend

1. Install Node.js 20 or newer and run `npm install`.
2. Copy `.env.example` to `.env` and add your own DeepSeek key there.
3. Leave `VITE_SUPABASE_URL` empty to use the local Hono backend.
4. Run `npm run dev` and open `http://localhost:3000`.

To test the Supabase route locally instead, set `VITE_SUPABASE_URL` and deploy/serve the Edge Function using the Supabase CLI. Local Supabase function secrets belong in `supabase/functions/.env`, which is ignored by Git.

## Checks

```bash
npm run check
npm run build
npm run vercel-build
```

Recording startup still requires microphone permission. Approve the browser prompt near the address bar; Supabase cannot change browser media permissions. Recordings remain in the current browser's IndexedDB, so download important lessons. AI-generated questions and answers must be checked by the teacher. Scanned-page reading depends on whether the selected DeepSeek model supports image input; text PDFs and pasted text remain available otherwise.
