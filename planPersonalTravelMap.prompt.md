## Plan: Supabase auth + Vercel serverless for multi-user travel map

TL;DR - Upgrade the existing Vite React travel map from single-user localStorage to Supabase Auth + Postgres, add Vercel serverless API endpoints for secure footprint CRUD, and retain the current footprint JSON shape while introducing user_id ownership.

**Steps**
1. Add Supabase dependencies and environment variables.
   - Install `@supabase/supabase-js`.
   - Add local env entries: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
   - Keep `SUPABASE_SERVICE_ROLE_KEY` server-only in Vercel secrets, not exposed to client.

2. Create Supabase client helpers.
   - Add `src/lib/supabaseClient.js` for client auth initialization with Vite env vars.
   - Add `api/supabaseAdmin.js` for serverless admin client initialization using the service role key.

3. Create the login form component.
   - Add `src/components/LoginForm.jsx` to render email/password sign-up and sign-in.
   - Implement Supabase Auth flows: signUp, signInWithPassword, signOut, and session state callbacks.
   - Expose user session info and access token to `App.jsx`.

4. Add Vercel serverless footprint API.
   - Create `api/footprints.js` for GET (list footprints) and POST (create footprint).
   - Create `api/footprints/[id].js` for PUT (update footprint) and DELETE (delete footprint).
   - In each endpoint, validate the client token via Supabase admin `auth.getUser` or equivalent.
   - Enforce `user_id = authenticated_user.id` on all queries.
   - Reject any footprint access where the record’s `user_id` does not match.

5. Update frontend data flow in `src/App.jsx`.
   - Replace localStorage-only persistence with fetches to `/api/footprints` after login.
   - Keep the original footprint object fields unchanged: `id`, `city`, `date`, `year`, `lat`, `lng`, `note`, `image`.
   - Include `Authorization: Bearer ${session.access_token}` on every API request.
   - Retain the existing map UI, card UI, and audio behavior.
   - Optionally keep localStorage fallback only for unauthenticated demo state or remove it once backend is active.

6. Define Supabase DB schema.
   - `users` table: `id` uuid primary key, `email` text unique, `created_at` timestamp.
   - `footprints` table: `id` text primary key, `user_id` uuid references `users(id)`, `city` text, `date` text, `year` text, `lat` numeric, `lng` numeric, `note` text, `image` text, `created_at` timestamp.
   - Enforce per-user ownership via `user_id` and query filtering.

**Verification**
1. Confirm Supabase auth works locally using the new login form.
2. Confirm `GET /api/footprints` returns only the logged-in user’s records.
3. Confirm `POST`, `PUT`, `DELETE` endpoints work and reject requests authenticated as another user or without a token.
4. Confirm footprint objects returned by the API keep the same field names and types as the existing JSON structure.
5. Deploy to Vercel with env vars and verify login + footprint CRUD works in production.

**Decisions**
- Use Supabase Auth + Postgres because it is the simplest cloud full-stack path for a Vite static app plus serverless API.
- Implement a Vercel `api/` folder to keep server-side security separate from the client.
- Keep the original footprint JSON shape unchanged; only the database adds `user_id`.

**Further considerations**
1. If you want, I can also propose a `login status` guard in the UI so anonymous users must sign in before editing.
2. If you prefer, this plan can be adapted later to use Vercel Postgres directly with NextAuth instead of Supabase.