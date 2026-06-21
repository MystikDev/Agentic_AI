# Supabase setup (auth + database)

FitCoach uses Supabase for accounts and for storing the athlete profile and
conversation history. The app authenticates with Supabase directly (public anon
key), then sends its access token to the FitCoach backend, which verifies it and
does all database work with the service-role key.

```
app ──(anon key)──► Supabase Auth ──► access token
app ──(Bearer token)──► FitCoach backend ──(service-role key)──► Postgres
```

## 1. Create a project
1. Sign in at https://supabase.com and create a new project.
2. Wait for it to finish provisioning.

## 2. Create the schema
Open **SQL Editor** in the Supabase dashboard, paste the contents of
[`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql), and
run it. This creates `profiles`, `conversations`, and `messages` with row-level
security enabled.

(If you use the Supabase CLI instead: `supabase db push` with the migration in
`supabase/migrations/`.)

## 3. Grab your keys
In **Project Settings → API**:
- **Project URL** — e.g. `https://abcd1234.supabase.co`
- **anon public** key — safe to ship in the app
- **service_role** key — SECRET, server only

## 4. Configure the backend
In `server/.env`:
```
SUPABASE_URL=https://abcd1234.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
```

## 5. Configure the app
In `app/app.json` under `expo.extra`:
```json
"supabaseUrl": "https://abcd1234.supabase.co",
"supabaseAnonKey": "<anon public key>"
```

## 6. Email confirmation (dev tip)
By default Supabase requires email confirmation on sign-up. For fast local
testing you can disable it in **Authentication → Providers → Email → "Confirm
email"**, or just use the confirmation link Supabase emails you.

## Notes
- The backend validates tokens by calling `supabase.auth.getUser(token)`, which
  works regardless of the project's JWT signing algorithm. For high traffic this
  can be swapped for local JWKS verification (Supabase publishes a JWKS endpoint)
  to avoid the per-request round trip — see `server/src/auth.ts`.
- RLS policies scope every row to its owner. The backend's service-role key
  bypasses RLS, so `server/src/db.ts` also filters every query by `user_id`; RLS
  is the defense-in-depth layer protecting against any direct anon-key access.
- Without Supabase configured, the server still boots: the public
  `GET /coach/persona` endpoint works, and the authenticated endpoints return
  `503` so the failure is obvious.
