# Google Maps Autocomplete Setup

## ✅ Code Status
The address autocomplete feature is **already built** and integrated into:
- Venue addresses
- Hotel addresses  
- Flight departure/arrival addresses
- Rental car pickup/dropoff locations

## 🔑 Get Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials)
2. Create a new project or select existing one
3. Click "Create Credentials" → "API key"
4. **Enable Required APIs:**
   - Maps JavaScript API
   - Places API
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

1. Go to any job/fldr
2. Edit venue, hotel, or flight info
3. Start typing an address
4. You should see autocomplete suggestions appear

If autocomplete doesn't work, check browser console for warnings.

---

**Time to complete:** ~5 minutes  
**Status:** ✅ Ship it!
