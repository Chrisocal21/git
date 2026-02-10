# Cloudflare D1 Setup

Your GIT app now uses Cloudflare D1 for persistent data storage!

## Initial Database Setup

You need to create the `fldrs` table in your D1 database. You have two options:

### Option 1: Using Cloudflare Dashboard (Easiest)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** > **D1**
3. Select your database: `430628c9-2002-4237-8db4-5830c74b388b`
4. Click **Console** tab
5. Copy and paste this SQL:

```sql
-- Create fldrs table
CREATE TABLE IF NOT EXISTS fldrs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_fldrs_updated ON fldrs(updated_at DESC);
```

6. Click **Execute**

### Option 2: Using Wrangler CLI

If you have wrangler installed:

```bash
# From the project root
wrangler d1 execute DB --file=./schema.sql
```

(Replace `DB` with your database name or ID)

## How It Works

- **Production/Deployed**: Uses D1 for persistent storage (data survives deployments!)
- **Local Development**: Falls back to in-memory storage (resets on restart)
- **Migration**: Your imported TripFldr data is separate in the old tables (trips, blocks, etc.)

## Environment Variables

Make sure these are set in Vercel:

```
CLOUDFLARE_ACCOUNT_ID=7accc8c4599bee1498e96c90d59e965c
CLOUDFLARE_DATABASE_ID=430628c9-2002-4237-8db4-5830c74b388b
CLOUDFLARE_API_TOKEN=nFIFfG08KpwMTv_e3j0lCKstLo8yf4D1UMBISIXR
OPENAI_API_KEY=sk-proj-...
```

## Testing

After creating the table:

1. Create a new Fldr in your deployed app
2. Refresh the page - it should still be there!
3. Redeploy the app - data persists!

## Data Migration (Optional)

To move existing localStorage data to D1, you could:
1. Open browser console
2. Export your localStorage fldrs
3. Use the import feature to recreate them

Or just start fresh - your old TripFldr data is already imported!
