# D1 Sync Verification Checklist

Now that D1 is enabled, let's verify cross-device sync is working!

## 🧪 Test 1: Create New Fldr
**On Computer A:**
1. Open https://git-chrisoc.vercel.app
2. Open Console (F12)
3. Create a new Fldr
4. Look for: `✅ Fldr saved to D1: [id]`

**On Computer B:**
1. Open https://git-chrisoc.vercel.app
2. Refresh the page
3. ✅ **SUCCESS**: You should see the new Fldr!

---

## 🧪 Test 2: Edit Existing Fldr
**On Computer A:**
1. Open an existing Fldr
2. Click "Edit" button
3. Change the title
4. Save
5. Look for: `✅ Fldr synced to D1: [id]`

**On Computer B:**
1. Refresh the page
2. Open the same Fldr
3. ✅ **SUCCESS**: Title should be updated!

---

## 🧪 Test 3: Add Module Data
**On Computer A:**
1. Open a Fldr
2. Fill in Quick Reference (hotel address, flight info)
3. Watch console - should see "Saving..." then "Saved just now"
4. Wait 2 seconds (for debounce)
5. Look for: `✅ Fldr synced to D1: [id]`

**On Computer B:**
1. Refresh and open same Fldr
2. ✅ **SUCCESS**: All your edits should be there!

---

## 🧪 Test 4: Import Old Data
**On Computer A:**
1. Go to /import
2. Import jobs from old TripFldr
3. Check console for success messages

**On Computer B:**
1. Refresh main page
2. ✅ **SUCCESS**: Imported jobs should appear!

---

## ⚠️ Troubleshooting

### If You See This:
```
❌ D1 sync failed, using in-memory only
```

**Problem**: D1 table might not exist or credentials are wrong

**Solution**:
1. Go to: https://dash.cloudflare.com/
2. Workers & Pages → D1 → Your database
3. Console tab → Run this SQL again:
```sql
CREATE TABLE IF NOT EXISTS fldrs (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### If Console Shows:
```
🗄️ D1 Configuration: { hasCredentials: true, enabled: false, ... }
```

**Problem**: `D1_ENABLED` env var not set or not `true`

**Solution**:
1. Go to Vercel → Settings → Environment Variables
2. Check `D1_ENABLED` = `true`
3. Redeploy

### If Console Shows:
```
🗄️ D1 Configuration: { hasCredentials: false, enabled: true, ... }
```

**Problem**: Missing Cloudflare credentials

**Solution**:
1. Verify these env vars exist in Vercel:
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_DATABASE_ID`
   - `CLOUDFLARE_API_TOKEN`

---

## ✅ Success Indicators

When everything is working, you should see:

**On Save:**
```
✅ Fldr synced to D1: abc-123-def
```

**On Load:**
```
✅ Loaded 5 fldrs from D1
```

**Storage Info:**
```
📦 Storage Keys: ['git-fldrs', 'git_offline_fldrs_abc-123', ...]
```

---

## 📊 What's Happening Behind the Scenes

Every time you edit:
1. **Instant**: Saved to localStorage (device cache)
2. **1 second later**: Sent to Vercel API
3. **At API**: Saved to D1 database (Cloudflare)
4. **On other devices**: Loaded from D1 on refresh

LocalStorage = Fast but device-specific
D1 Database = Slower but synced everywhere

---

## 🎉 When It Works

You'll be able to:
- Edit on your phone → See on laptop
- Edit at home → See at work
- Never lose data (it's in the cloud)
- Still work offline (localStorage backup)

Test it out and let me know what you see in the console!
