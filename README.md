# Mewtwo Planner — PWA + Instant Save + Supabase (Stable)

- Instant save (debounced ~350ms) on all inputs/selects.
- Mobile keyboard fix: stable state updates to avoid input blur/focus loss.
- PWA: manifest + service worker, installable on iOS/Android.
- "Belt & braces" plan handling: app creates/fetches `plans` row for the logged-in user; writes use real `plan_id`.
- Offline queue: edits are queued and flushed when back online & logged in.
- Uses `VITE_PUBLIC_BASE_URL` for magic-link redirect.

## Deploy
1) Put secrets in Vercel/Netlify env vars **or** copy `.env.placeholder` → `.env` locally.
2) Build & deploy:
   - Build: `npm run build`
   - Output: `dist`
3) Supabase:
   - Auth → URL Configuration → set Site URL to your Vercel URL; add it + localhost in Additional Redirect URLs.
   - SQL Editor → run `schema.sql` once.

