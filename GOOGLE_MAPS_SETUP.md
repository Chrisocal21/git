# Google Maps Autocomplete Setup

## ✅ Code Status
The Google Maps integration is **fully implemented** with:
- ✅ Address autocomplete (Venue, Hotel, Flight, Rental Car)
- ✅ Distance Matrix (Travel times between locations)
- ✅ Nearby Search (Find restaurants, coffee, gas stations)
- ✅ Auto Timezone Detection (Real local time at destination)

**Just add your API key to activate all features!**

## 🔑 Get Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials)
2. Create a new project or select existing one
3. Click "Create Credentials" → "API key"
4. **Enable Required APIs:**
   - Maps JavaScript API
   - Places API
   - Distance Matrix API
   - Time Zone API
   - Geocoding API
5. (Optional but recommended) Restrict your API key:
   - Application restrictions: HTTP referrers
   - Add your domain(s): `*.vercel.app`, `yourdomain.com`
   - API restrictions: Select only Maps JavaScript API and Places API

## 🚀 Local Development

1. Copy your API key
2. Open `.env.local` in the project root
3. Replace `your_google_maps_api_key_here` with your actual key:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...your-key-here
   ```
4. Restart your dev server (`npm run dev`)

## ☁️ Vercel Deployment

1. Go to your Vercel project dashboard
2. Settings → Environment Variables
3. Add new variable:
   - **Name:** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value:** Your API key
   - **Environments:** Production, Preview, Development (check all)
4. Redeploy your app

## ✨ How It Works

The app uses a singleton loader that:
- Loads Google Maps API only once
- Gracefully falls back to regular text input if API key is missing
- Shows autocomplete suggestions as you type
- Extracts full address details when you select a suggestion

## 🧪 Testing

**Autocomplete:**
1. Go to any job/fldr
2. Edit venue, hotel, or flight info
3. Start typing an address
4. You should see autocomplete suggestions appear

**Distance Matrix:**
1. Add hotel and venue addresses to a job
2. Open the "Job Summary" card
3. Look for "🚗 Travel Times" section
4. Should show drive times and distances

**Nearby Search:**
1. Add a venue address
2. Scroll to bottom of Venue Info card
3. Click 🍽️ Food, ☕ Coffee, or ⛽ Gas tabs
4. Should see nearby places with ratings and distances

**Timezone Detection:**
1. Add a location or venue address
2. Check the job header
3. Should show local time at that location

If any feature doesn't work, check browser console for warnings.

---

**Time to complete:** ~5 minutes  
**Status:** ✅ Full integration complete! (See GOOGLE_MAPS_COMPLETE.md for details)
