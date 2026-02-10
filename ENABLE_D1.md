# Quick D1 Setup for Cross-Device Sync

Your data is currently **device-specific** (localStorage only). To sync between devices:

## Step 1: Create the D1 Table

1. Go to: https://dash.cloudflare.com/
2. Navigate to **Workers & Pages** → **D1**
3. Find your database: `git-db` (ID: `430628c9-2002-4237-8db4-5830c74b388b`)
4. Click **Console** tab
5. **Copy and paste this entire SQL block:**

```sql
CREATE TABLE IF NOT EXISTS fldrs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fldrs_updated ON fldrs(updated_at);
```

6. Click **Execute**
7. You should see: `Success: 0 rows read, 0 rows written`

## Step 2: Enable D1 in Vercel

1. Go to your Vercel project: https://vercel.com/
2. Go to **Settings** → **Environment Variables**
3. Add this variable:
   - **Name**: `D1_ENABLED`
   - **Value**: `true`
   - **Environments**: Production, Preview, Development (all)
4. Click **Save**
5. Go to **Deployments** → Click **...** on latest → **Redeploy**

## Step 3: Verify It's Working

1. Open Console (F12) on Computer A
2. Edit a fldr - you should see: `Fldr saved to D1: [id]`
3. Open the app on Computer B
4. You should now see the data!

## What This Does:

- **Before**: Data only in localStorage (device-specific)
- **After**: Data syncs to D1 database (accessible from any device)
- Each save will write to both localStorage (instant) and D1 (persistent)

## Troubleshooting:

If you see "D1 save failed" in console:
- Table might not be created yet
- Check Cloudflare D1 console for table
- Make sure `D1_ENABLED=true` in Vercel

## Already Have Data?

Your localStorage data will stay on each device until you:
1. Import it again using the Import page
2. Or manually recreate it on the new D1 setup

---

**Note**: Until D1 is set up, your data will remain device-specific!
