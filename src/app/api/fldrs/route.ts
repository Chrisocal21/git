import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { NewFldr, Fldr, FlightSegment, HotelInfo, VenueInfo, RentalCarInfo, JobInfo } from '@/types/fldr'
import { getAllFldrs, createFldr, updateFldr } from '@/lib/d1'

// Check if D1 is configured
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
// Temporarily disable D1 until table is confirmed working
const D1_ENABLED = process.env.D1_ENABLED === 'true'

console.log('🗄️ D1 Configuration:', {
  hasCredentials: !!useD1,
  enabled: D1_ENABLED,
  mode: D1_ENABLED && useD1 ? 'D1 + localStorage' : 'localStorage only'
})

// Normalize fldr data to ensure proper types and structures
function normalizeFldr(fldr: any): Fldr {
  // Normalize flight_info: convert old object format to array, ensure it's either null or array
  let flight_info = fldr.flight_info
  if (flight_info && !Array.isArray(flight_info)) {
    // Migrate old object format to array
    const oldFlightInfo = flight_info as any
    flight_info = [{
      id: crypto.randomUUID(),
      departure_airport: oldFlightInfo.departure_airport || null,
      departure_code: oldFlightInfo.departure_code || null,
      departure_address: oldFlightInfo.departure_address || null,
      departure_time: oldFlightInfo.departure_time || null,
      arrival_airport: oldFlightInfo.arrival_airport || null,
      arrival_code: oldFlightInfo.arrival_code || null,
      arrival_address: oldFlightInfo.arrival_address || null,
      arrival_time: oldFlightInfo.arrival_time || null,
      flight_number: oldFlightInfo.flight_number || null,
      airline: oldFlightInfo.airline || null,
      confirmation: oldFlightInfo.confirmation || null,
      notes: oldFlightInfo.notes || null,
      segment_type: 'outbound',
    }]
  } else if (flight_info === undefined) {
    flight_info = null
  }

  // Normalize job_info: ensure reference_links and team_members are arrays
  let job_info = fldr.job_info
  if (job_info) {
    job_info = {
      ...job_info,
      reference_links: Array.isArray(job_info.reference_links) ? job_info.reference_links : [],
      team_members: Array.isArray(job_info.team_members) ? job_info.team_members : [],
      use_daily_schedule: job_info.use_daily_schedule ?? false,
    }
  }

  // Ensure array fields are either null or arrays (not undefined)
  const normalizedFldr: Fldr = {
    ...fldr,
    flight_info,
    hotel_info: fldr.hotel_info === undefined ? null : fldr.hotel_info,
    venue_info: fldr.venue_info === undefined ? null : fldr.venue_info,
    rental_car_info: fldr.rental_car_info === undefined ? null : fldr.rental_car_info,
    job_info: job_info === undefined ? null : job_info,
    checklist: fldr.checklist === undefined ? null : (Array.isArray(fldr.checklist) ? fldr.checklist : null),
    people: fldr.people === undefined ? null : (Array.isArray(fldr.people) ? fldr.people : null),
    photos: fldr.photos === undefined ? null : (Array.isArray(fldr.photos) ? fldr.photos : null),
    products: fldr.products === undefined ? null : (Array.isArray(fldr.products) ? fldr.products : null),
    polished_messages: Array.isArray(fldr.polished_messages) ? fldr.polished_messages : [],
    attending: fldr.attending ?? false,
  }

  return normalizedFldr
}

export async function GET() {
  // For now, always use in-memory store (Vercel serverless limitation)
  // D1 will be used once table is set up and D1_ENABLED=true
  const fldrs = fldrStore.getAll()
  console.log(`GET /api/fldrs - returning ${fldrs.length} fldrs from memory`)
  
  // If D1 is enabled, try to load from there instead
  if (D1_ENABLED && useD1) {
    try {
      let d1Fldrs = await getAllFldrs()
      console.log(`✅ Loaded ${d1Fldrs.length} fldrs from D1`)
      
      // Normalize all fldrs and save back if changes were made
      const normalizedFldrs = await Promise.all(d1Fldrs.map(async (fldr) => {
        const normalized = normalizeFldr(fldr)
        
        // Check if normalization made changes (compare flight_info structure)
        const needsUpdate = (
          (fldr.flight_info && !Array.isArray(fldr.flight_info)) ||
          (fldr.job_info && (!Array.isArray(fldr.job_info.reference_links) || !Array.isArray(fldr.job_info.team_members)))
        )
        
        if (needsUpdate) {
          console.log(`💾 Saving normalized data back to D1 for fldr ${fldr.id}`)
          await updateFldr(fldr.id, normalized)
        }
        
        return normalized
      }))
      
      return NextResponse.json(normalizedFldrs)
    } catch (error) {
      console.error('❌ D1 fetch failed, using memory:', error)
    }
  }
  
  // Normalize in-memory data too
  const normalizedFldrs = fldrs.map(fldr => {
    const normalized = normalizeFldr(fldr)
    
    // Update in-memory store if changes were made
    const needsUpdate = (
      (fldr.flight_info && !Array.isArray(fldr.flight_info)) ||
      (fldr.job_info && (!Array.isArray((fldr.job_info as any).reference_links) || !Array.isArray((fldr.job_info as any).team_members)))
    )
    
    if (needsUpdate) {
      fldrStore.update(fldr.id, normalized)
    }
    
    return normalized
  })
  
  return NextResponse.json(normalizedFldrs)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NewFldr
    const fldr = fldrStore.create(body) // Generate ID and validate
    
    if (D1_ENABLED && useD1) {
      // Cloud-first: Save to D1 and fail if it fails
      try {
        await createFldr(fldr)
        console.log('✅ Fldr saved to D1:', fldr.id)
      } catch (d1Error) {
        console.error('❌ D1 save failed:', d1Error)
        return NextResponse.json(
          { error: 'Failed to save to cloud storage' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(fldr, { status: 201 })
  } catch (error) {
    console.error('Error creating fldr:', error)
    return NextResponse.json(
      { error: 'Failed to create fldr' },
      { status: 400 }
    )
  }
}
