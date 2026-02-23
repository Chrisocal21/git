import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')
    const lat = searchParams.get('lat')
    const lng = searchParams.get('lng')

    if (!address && (!lat || !lng)) {
      return NextResponse.json({ 
        error: 'Address or coordinates (lat/lng) are required' 
      }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      return NextResponse.json({ 
        error: 'Google Maps API key not configured'
      }, { status: 500 })
    }

    let latitude = lat
    let longitude = lng

    // If address provided, geocode it first
    if (address && (!lat || !lng)) {
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
      latitude = location.lat.toString()
      longitude = location.lng.toString()
    }

    // Get timezone for coordinates
    const timestamp = Math.floor(Date.now() / 1000) // Current Unix timestamp
    const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${latitude},${longitude}&timestamp=${timestamp}&key=${apiKey}`
    
    const timezoneResponse = await fetch(timezoneUrl)
    
    if (!timezoneResponse.ok) {
      throw new Error(`Timezone API failed: ${timezoneResponse.statusText}`)
    }

    const timezoneData = await timezoneResponse.json()

    if (timezoneData.status !== 'OK') {
      return NextResponse.json({ 
        error: `API error: ${timezoneData.status}`,
        message: timezoneData.errorMessage || 'Unknown error'
      }, { status: 500 })
    }

    // Calculate current time in that timezone
    const utcOffset = (timezoneData.rawOffset + timezoneData.dstOffset) / 3600 // Convert to hours
    const currentTime = new Date()
    const utcTime = currentTime.getTime() + (currentTime.getTimezoneOffset() * 60000)
    const locationTime = new Date(utcTime + (3600000 * utcOffset))

    return NextResponse.json({
      timeZoneId: timezoneData.timeZoneId,
      timeZoneName: timezoneData.timeZoneName,
      rawOffset: timezoneData.rawOffset,
      dstOffset: timezoneData.dstOffset,
      utcOffset: utcOffset,
      currentTime: locationTime.toISOString(),
      formattedTime: locationTime.toLocaleString('en-US', {
        timeZone: timezoneData.timeZoneId,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      coordinates: {
        lat: latitude,
        lng: longitude,
      }
    })

  } catch (error) {
    console.error('Timezone API error:', error)
    return NextResponse.json({ 
      error: 'Failed to get timezone',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
