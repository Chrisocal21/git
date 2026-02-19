import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { Fldr, FlightSegment } from '@/types/fldr'
import { getFldrById, updateFldr, deleteFldr } from '@/lib/d1'

// Check if D1 is configured
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
const D1_ENABLED = process.env.D1_ENABLED === 'true'

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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (D1_ENABLED && useD1) {
      // Use D1 for persistent storage
      let fldr = await getFldrById(params.id)
      if (!fldr) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      
      // Normalize and check if updates needed
      const normalized = normalizeFldr(fldr)
      const needsUpdate = (
        (fldr.flight_info && !Array.isArray(fldr.flight_info)) ||
        (fldr.job_info && (!Array.isArray((fldr.job_info as any).reference_links) || !Array.isArray((fldr.job_info as any).team_members)))
      )
      
      if (needsUpdate) {
        console.log(`💾 Saving normalized data back to D1 for fldr ${params.id}`)
        await updateFldr(params.id, normalized)
      }
      
      return NextResponse.json(normalized)
    } else {
      // Fallback to in-memory store
      let fldr = fldrStore.getById(params.id)
      if (!fldr) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      
      // Normalize
      const normalized = normalizeFldr(fldr)
      const needsUpdate = (
        (fldr.flight_info && !Array.isArray(fldr.flight_info)) ||
        (fldr.job_info && (!Array.isArray((fldr.job_info as any).reference_links) || !Array.isArray((fldr.job_info as any).team_members)))
      )
      
      if (needsUpdate) {
        fldrStore.update(params.id, normalized)
      }
      
      return NextResponse.json(normalized)
    }
  } catch (error) {
    console.error('Error fetching fldr:', error)
    // Fallback to in-memory if D1 fails
    let fldr = fldrStore.getById(params.id)
    if (!fldr) {
      return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
    }
    
    // Normalize
    const normalized = normalizeFldr(fldr)
    const needsUpdate = (
      (fldr.flight_info && !Array.isArray(fldr.flight_info)) ||
      (fldr.job_info && (!Array.isArray((fldr.job_info as any).reference_links) || !Array.isArray((fldr.job_info as any).team_members)))
    )
    
    if (needsUpdate) {
      fldrStore.update(params.id, normalized)
    }
    
    return NextResponse.json(normalized)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json() as Partial<Fldr>
    
    console.log('📥 PATCH request for fldr:', params.id, 'updates:', Object.keys(updates))
    if (updates.photos) {
      console.log('📷 Photos in request:', updates.photos.length)
      const totalSize = JSON.stringify(updates.photos).length
      console.log('📊 Photos data size:', (totalSize / 1024).toFixed(2), 'KB')
    }
    
    if (D1_ENABLED && useD1) {
      // Cloud-first: Update D1 and fail if it fails
      try {
        const fldr = await updateFldr(params.id, updates)
        if (!fldr) {
          return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
        }
        console.log('✅ Fldr updated in D1:', params.id, 'photos:', fldr.photos?.length || 0)
        return NextResponse.json(fldr)
      } catch (d1Error) {
        console.error('❌ D1 update failed:', d1Error)
        return NextResponse.json(
          { error: 'Failed to update cloud storage' },
          { status: 500 }
        )
      }
    } else {
      // Fallback to in-memory when D1 disabled
      const fldr = fldrStore.update(params.id, updates)
      if (!fldr) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      return NextResponse.json(fldr)
    }
  } catch (error) {
    console.error('Error updating fldr:', error)
    return NextResponse.json(
      { error: 'Failed to update fldr' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (D1_ENABLED && useD1) {
      // Use D1 for persistent storage
      await deleteFldr(params.id)
      // Also delete from in-memory store
      fldrStore.delete(params.id)
      return NextResponse.json({ success: true })
    } else {
      // Fallback to in-memory store
      const success = fldrStore.delete(params.id)
      if (!success) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error deleting fldr:', error)
    return NextResponse.json(
      { error: 'Failed to delete fldr' },
      { status: 500 }
    )
  }
}
