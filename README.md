# Activity Payment Tracker

Tracks contracted construction activities (per apartment or per floor) for Block A and Block B, their progress, and every payment — so no job is ever paid twice and you can see what is left on each floor.

**Stack:** React + Vite + TypeScript + Tailwind · Supabase (Postgres + Auth) · Netlify

## How it works

| Table | What it holds |
|---|---|
| `blocks`, `floors`, `apartments` | Pre-loaded: Blocks A & B, floors 1–9, apartments R / M / L (floors 1–8) and PH1 / PH2 (floor 9) |
| `activities` | Typed by an admin (e.g. *Electrical wire pulling*), marked **per apartment** or **per floor**. Used as the dropdown for work orders |
| `work_orders` | One activity at one location + contract amount |
| `payments` | Each row = "paid up to **X %**". The amount is calculated: `contract × (X − previous %)` |

Rules enforced by the database (not just the UI):

- The same activity can't be contracted twice at the same location.
- A per-apartment activity must have an apartment on that floor; a per-floor one must not.
- A new payment must be for a higher % than what's already paid, and never above 100 %.
- Everyone logged in can **read**; only **admins** can create, edit or delete.

## 1. Set up Supabase (once)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste the whole of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Sign In / Providers** → turn **off** “Allow new users to sign up” (only invited people get in).
4. **Authentication → Users → Invite user** → invite yourself. Accept the email and set a password.
5. Make yourself admin — in the SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
6. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

> Free Supabase projects pause after 7 days with no activity. Normal daily use keeps it awake; if it pauses, restore it from the dashboard (no data is lost).

## 2. Run locally

```bash
cp .env.example .env.local      # paste your URL and anon key
npm install
npm run dev                     # http://localhost:5173
```

## 3. Deploy on Netlify

1. Push this repo to GitHub.
2. Netlify → **Add new site → Import from Git** → pick the repo. Build settings come from `netlify.toml`.
3. **Site configuration → Environment variables**: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Every push to `main` redeploys automatically.
5. In Supabase → **Authentication → URL Configuration**, set **Site URL** to your Netlify URL (so invite emails link to the app).

## Adding users

Supabase → Authentication → Users → **Invite user**. New users are **view-only**. An admin can promote them on the app's **Users** page.

## Testing the database rules

`supabase/tests/` runs the schema on plain PostgreSQL 15+ with a small auth stub:

```bash
createdb apt_test
psql -d apt_test -f supabase/tests/stub_supabase.sql
psql -d apt_test -f supabase/schema.sql
psql -d apt_test -f supabase/tests/test_rules.sql   # prints PASS / expected errors
```

## Project structure

```
supabase/schema.sql        tables, rules, views, security, seed data
src/lib/                   Supabase client, types, formatting
src/auth/AuthProvider.tsx  session + admin/viewer role
src/pages/                 Progress, Floor, Work orders, Work order detail, Payments, Activities, Users, Login
src/components/            layout, tables, forms, UI pieces
```
