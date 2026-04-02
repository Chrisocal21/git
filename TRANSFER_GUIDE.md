# Project Transfer Guide

How to move this project from one Vercel account + Cloudflare account to another, with all data intact.

---

## Overview of what needs to move

| Thing | Where it lives | What to do |
|---|---|---|
| Source code | GitHub repo | Transfer or re-push |
| D1 database + data | Cloudflare account | Export → new account → import |
| Cloudflare API token | Old account | Generate new one in new account |
| OpenAI API key | OpenAI dashboard | Generate new key (or move billing) |
| Google Maps API key | Google Cloud Console | Transfer project or create new key |
| APP_PIN | Vercel env vars | Just re-enter it |
| Vercel project | Old Vercel account | Delete old, create new |

---

## Step 1 — Transfer the GitHub repo

You have two options:

### Option A: Transfer existing repo (cleanest)
1. Go to the GitHub repo → **Settings** → scroll to bottom → **Transfer**
2. Enter the new owner's GitHub username or org
3. Confirm — the repo moves instantly, old URL redirects automatically

### Option B: Fresh push to new account
```bash
# Clone locally if you don't already have it
git clone https://github.com/OLD_ACCOUNT/REPO_NAME.git
cd REPO_NAME

# Change remote to new repo (create an empty repo on new GitHub account first)
git remote set-url origin https://github.com/NEW_ACCOUNT/REPO_NAME.git
git push -u origin main
```

---

## Step 2 — Export Cloudflare D1 data

Do this **before** touching anything else. You need Wrangler CLI installed.

### Install Wrangler if you don't have it
```bash
npm install -g wrangler
```

### Log into the OLD Cloudflare account
```bash
wrangler login
```
This opens a browser — log in with the **old** account credentials.

### Find your database name
```bash
wrangler d1 list
```
Note the database name (e.g., `burrow-db` or whatever it is).

### Export all data
```bash
wrangler d1 export YOUR_DATABASE_NAME --output=./d1-backup.sql
```
This creates a `d1-backup.sql` file with all your table schema and data as SQL INSERT statements. **Keep this file safe.**

> If the export command isn't available in your Wrangler version, use this instead:
> ```bash
> wrangler d1 execute YOUR_DATABASE_NAME --command="SELECT * FROM fldrs" --json > fldrs-backup.json
> ```
> Then you'd need to re-insert via script — the `--output` export flag is simpler if it works.

---

## Step 3 — Set up Cloudflare on the new account

### Create a new Cloudflare account
Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up with the new email (or log in if the account already exists).

### Log Wrangler into the NEW account
```bash
wrangler logout
wrangler login
```
Log in with the **new** account this time.

### Create a new D1 database
```bash
wrangler d1 create burrow-db
```
Note the output — it gives you the new **database ID** (a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Save this.

### Apply the schema
```bash
wrangler d1 execute burrow-db --file=./schema.sql
```

### Import your data
```bash
wrangler d1 execute burrow-db --file=./d1-backup.sql
```

### Verify the data came through
```bash
wrangler d1 execute burrow-db --command="SELECT COUNT(*) FROM fldrs"
```

---

## Step 4 — Create a new Cloudflare API token

The old API token belongs to the old account — it won't work in the new one.

1. Go to [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) (logged into new account)
2. Click **Create Token**
3. Use the **"Edit Cloudflare Workers"** template — or create a custom token with:
   - **D1 — Edit** permission
   - Scope it to your account
4. Click **Continue to summary** → **Create Token**
5. Copy the token immediately — you only see it once

You'll also need your new **Account ID**:
- Go to the Cloudflare dashboard → click on any zone (or go to Workers & Pages)
- Your Account ID is in the right sidebar, or in the URL: `dash.cloudflare.com/ACCOUNT_ID/...`

---

## Step 5 — Handle API keys

### OpenAI
Two options:
- **Simple:** Generate a new API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys) and use that in the new Vercel project. The old key keeps working until you revoke it.
- **Transfer billing:** If you want the whole OpenAI account moved, you'd need to create a new OpenAI org and invite the new user — more involved.

### Google Maps
Two options:
- **Simple:** Go to [console.cloud.google.com](https://console.cloud.google.com) → the existing project → **APIs & Services** → **Credentials** → create a new API key. Add HTTP referrer restrictions for the new Vercel domain.
- **Transfer GCP project:** You can transfer a GCP project to a different Google account via **IAM & Admin** → **Settings** → **Migrate project**. More involved but keeps billing history.

For most cases, just create a new API key — it's 2 minutes.

**Important:** After you know the new Vercel project URL, add it to the allowed HTTP referrers for the Google Maps key. Otherwise Maps won't load.

---

## Step 6 — Create the new Vercel project

1. Log into [vercel.com](https://vercel.com) with the new account
2. Click **Add New Project**
3. Connect to GitHub and import the repo (transferred or re-pushed in Step 1)
4. Framework: **Next.js** (Vercel should detect this automatically)
5. **Do not deploy yet** — set environment variables first

### Add all environment variables
Go to **Settings** → **Environment Variables** and add each one:

| Variable | Value | Where to get it |
|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | Your new account ID | Cloudflare dashboard (Step 4) |
| `CLOUDFLARE_DATABASE_ID` | New database UUID | Output from `wrangler d1 create` (Step 3) |
| `CLOUDFLARE_API_TOKEN` | New API token | Created in Step 4 |
| `D1_ENABLED` | `true` | Just type it |
| `OPENAI_API_KEY` | `sk-...` | From OpenAI (Step 5) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Your Maps key | From Google Cloud Console (Step 5) |
| `APP_PIN` | Your PIN | Whatever you use to log in |

Set all variables for **Production**, **Preview**, and **Development** environments (or just Production + Development at minimum).

6. Click **Deploy**

---

## Step 7 — Verify everything works

Once deployed, hit the new Vercel URL and check:

- [ ] App loads and PIN screen appears
- [ ] PIN authentication works
- [ ] `/api/config` endpoint shows D1 as configured (you can hit this in the browser — it's a debug route)
- [ ] Existing fldrs/jobs load from D1
- [ ] Google Maps loads on the map page
- [ ] AI features work (OpenAI calls)
- [ ] Weather works

---

## Step 8 — Cleanup (after confirming everything works)

Only do this once the new setup is fully verified:

- Delete the old Vercel project (Settings → scroll to bottom → Delete)
- Revoke the old Cloudflare API token (old account → API Tokens → Revoke)
- Optionally delete the old D1 database (`wrangler d1 delete OLD_DATABASE_NAME` logged in as old account)
- Optionally revoke the old OpenAI key

---

## Troubleshooting

**D1 data not showing up after import**
Run `wrangler d1 execute burrow-db --command="SELECT COUNT(*) FROM fldrs"` to confirm rows exist. If 0, re-run the import step.

**Google Maps not loading**
The API key has HTTP referrer restrictions — add your new Vercel domain (`*.vercel.app` or the custom domain) in Google Cloud Console → Credentials → your key → edit.

**PIN not working**
Double-check the `APP_PIN` env variable in Vercel — it's case-sensitive and must be an exact match. After changing env vars, you need to redeploy.

**Wrangler export fails**
If `--output` flag isn't available in your version of Wrangler, update it: `npm install -g wrangler@latest`, then retry.
