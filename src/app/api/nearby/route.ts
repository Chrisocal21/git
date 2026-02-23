import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')
    const type = searchParams.get('type') || 'restaurant' // restaurant, cafe, gas_station, etc.
    const radius = searchParams.get('radius') || '1609' // Default 1 mile in meters

    if (!address) {
      return NextResponse.json({ 
        error: 'Address is required' 
      }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      return NextResponse.json({ 
        error: 'Google Maps API key not configured'
      }, { status: 500 })
    }

    // First, geocode the address to get coordinates
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    
    const geocodeResponse = await fetch(geocodeUrl)
    
    if (!geocodeResponse.ok) {
      throw new Error(`Geocoding failed: ${geocodeResponse.statusText}`)
    }

    const geocodeData = await geocodeResponse.json()

    if (geocodeData.status !== 'OK' || !geocodeData.results.length) {
      return NextResponse.json({ 
        error: 'Could not geocode address'
      }, { status: 404 })
    }

    const location = geocodeData.results[0].geometry.location
    const lat = location.lat
    const lng = location.lng

    // Now search for nearby places
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`
    
    const nearbyResponse = await fetch(nearbyUrl)
    
    if (!nearbyResponse.ok) {
      throw new Error(`Nearby Search failed: ${nearbyResponse.statusText}`)
    }

    const nearbyData = await nearbyResponse.json()

    if (nearbyData.status !== 'OK' && nearbyData.status !== 'ZERO_RESULTS') {
      return NextResponse.json({ 
        error: `API error: ${nearbyData.status}`,
        message: nearbyData.error_message || 'Unknown error'
      }, { status: 500 })
    }

    // Format results
    const places = (nearbyData.results || []).slice(0, 10).map((place: any) => {
      // Calculate distance from venue
      const placeLat = place.geometry.location.lat
      const placeLng = place.geometry.location.lng
      const distance = calculateDistance(lat, lng, placeLat, placeLng)

      return {
        name: place.name,
        vicinity: place.vicinity,
        rating: place.rating || null,
        userRatingsTotal: place.user_ratings_total || 0,
        priceLevel: place.price_level || null,
        openNow: place.opening_hours?.open_now || null,
        types: place.types || [],
        distance: `${distance.toFixed(1)} mi`,
        distanceValue: distance,
        placeId: place.place_id,
      }
    }).sort((a: any, b: any) => a.distanceValue - b.distanceValue)

    return NextResponse.json({
      location: {
        lat,
        lng,
        address,
      },
      type,
      places,
    })

  } catch (error) {
    console.error('Nearby Search API error:', error)
    return NextResponse.json({ 
      error: 'Failed to search nearby places',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Haversine formula to calculate distance between two coordinates
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959 // Earth's radius in miles
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180)
}
