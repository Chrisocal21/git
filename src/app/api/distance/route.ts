import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const origins = searchParams.get('origins') // e.g., "Hotel Address"
    const destinations = searchParams.get('destinations') // e.g., "Venue Address|Airport"

    if (!origins || !destinations) {
      return NextResponse.json({ 
        error: 'Origins and destinations are required' 
      }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      return NextResponse.json({ 
        error: 'Google Maps API key not configured'
      }, { status: 500 })
    }

    // Call Google Distance Matrix API
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&units=imperial&key=${apiKey}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Distance Matrix API failed: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      return NextResponse.json({ 
        error: `API error: ${data.status}`,
        message: data.error_message || 'Unknown error'
      }, { status: 500 })
    }

    // Format the response
    const results = data.rows[0]?.elements || []
    const destinationAddresses = data.destination_addresses || []

    const distances = results.map((element: any, index: number) => {
      if (element.status === 'OK') {
        return {
          destination: destinationAddresses[index],
          distance: element.distance.text, // e.g., "3.2 mi"
          duration: element.duration.text, // e.g., "15 mins"
          distanceValue: element.distance.value, // meters
          durationValue: element.duration.value, // seconds
        }
      } else {
        return {
          destination: destinationAddresses[index],
          error: element.status,
          distance: null,
          duration: null,
        }
      }
    })

    return NextResponse.json({
      origin: data.origin_addresses[0],
      distances,
    })

  } catch (error) {
    console.error('Distance Matrix API error:', error)
    return NextResponse.json({ 
      error: 'Failed to calculate distances',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
