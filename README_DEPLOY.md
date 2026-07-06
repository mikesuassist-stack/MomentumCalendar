# GSMR Content Calendar — Deploy Guide (~30 min, one time)

A shared web calendar you + staff log into to add/edit posts, tick off
platforms per post, and that the AgencyHQ agent reads each Monday.

## 1. Create the database (Supabase — free)
1. Go to https://supabase.com → sign up → "New project".
2. Name it (e.g. gsmr-calendar), set a database password, pick a region near
   Sydney, create. Wait ~2 min for it to provision.
3. Left sidebar → SQL Editor → New query → paste the entire contents of
   `supabase_schema.sql` (in this folder) → Run. This creates the posts table,
   auto-reference trigger, and login-based security.
4. Left sidebar → Project Settings → API. Copy two values:
   - Project URL  (https://xxxx.supabase.co)
   - anon public key  (a long string under "Project API keys")

## 2. Create logins for you + staff
1. Left sidebar → Authentication → Providers → make sure "Email" is enabled.
   Turn OFF "Confirm email" for simplicity (Authentication → Providers → Email
   → uncheck Confirm email) so accounts work immediately.
2. You'll create accounts from the app itself (the Sign up link) once deployed.
   Or add them here under Authentication → Users → Add user.

## 3. Deploy the web app (Vercel — free)
Option A — from GitHub (recommended):
1. Put this `calendar-app` folder in a GitHub repo.
2. Go to https://vercel.com → sign up → "Add New Project" → import the repo.
3. Before deploying, expand "Environment Variables" and add:
   - NEXT_PUBLIC_SUPABASE_URL   = your Project URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = your anon public key
4. Deploy. You get a URL like https://gsmr-calendar.vercel.app

Option B — Vercel CLI:
1. Install: `npm i -g vercel`
2. In this folder: `vercel` (follow prompts), then add the two env vars in the
   Vercel dashboard (Project → Settings → Environment Variables) and redeploy.

## 4. Connect the agent
In ~/AgencyHQ/config.json → settings.social_calendar, set:
  "provider": "supabase",
  "supabase_url": "<your Project URL>",
  "supabase_key": "<your anon public key>",
  "posts_table": "posts"
That's it — the Social Calendar Agent will read this Monday's posts, build the
staff checklists, and write completion back so the app shows green ticks.

## 5. Use it
- Open your Vercel URL, sign up (you), then share the URL — staff sign up too.
- "+ New post": set client, title, date, optional link/caption, tick platforms.
- On the post card, tap a platform chip to mark it done (or staff do it by
  replying DONE <ref> to Jarvis — both stay in sync).
- Posts are grouped by week; green left-border = all platforms done.

## Notes
- Free tiers are plenty for this. Supabase free = 500MB DB, unlimited API
  requests for practical purposes; Vercel free hosts it fine.
- Anyone with a login can edit (that's the shared-doc behaviour you wanted).
  To restrict later, tighten the RLS policy in Supabase.
