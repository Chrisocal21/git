# Autocomplete Setup Guide

The app now includes smart autocomplete for addresses and airports to help you fill in information faster.

## Features

### ✈️ Airport Autocomplete
- **Type any part** of an airport name, code, or city
- Get instant suggestions from 30+ major US airports
- Auto-fills both the airport name and code
- Works on all flight info fields

**Example:** Type "los angeles" or "lax" → Get "Los Angeles International (LAX)"

### 📍 Address Autocomplete  
- **Type any address** and get real-time suggestions from Google Places
- Works for:
  - Hotel addresses
  - Venue addresses
  - Rental car pickup/dropoff locations
- Automatically formats the full address for you

## Setup Instructions

### 1. Get a Google Maps API Key

The address autocomplete feature requires a Google Maps API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Places API**
4. Go to **Credentials** and create an API key
5. (Optional but recommended) Restrict your API key:
   - Application restrictions: HTTP referrers
   - Add your domain (e.g., `yourapp.com/*`)
   - API restrictions: Select only Maps JavaScript API and Places API

### 2. Add API Key to Your Project

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your Google Maps API key to `.env.local`:
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
   ```

3. Restart your development server

### 3. Test It Out

1. Create or open a fldr
2. Add the Flight Info or Hotel Info module
3. Start typing in an airport or address field
4. You should see suggestions appear as you type!

## Pricing Note

Google Maps Platform has a generous free tier:
- **$200 free credit** per month
- Places Autocomplete: ~17,000 free requests/month
- For most personal/small team use, this stays within the free tier

## Troubleshooting

**Autocomplete not working?**
- Check that your API key is correctly set in `.env.local`
- Verify Maps JavaScript API and Places API are enabled
- Check browser console for errors
- Make sure you restarted the dev server after adding the key

**Can I use it without Google Maps?**
- Yes! The airport autocomplete works without any API key (uses built-in airport list)
- Address fields will work as regular text inputs if no API key is provided

## Airport List

The built-in airport autocomplete includes:
- All major US hubs (ATL, LAX, ORD, DFW, etc.)
- Common destination airports
- 30+ airports total

Want to add more airports? Edit `src/components/AirportAutocomplete.tsx` and add to the `AIRPORTS` array!
