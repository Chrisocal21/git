import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { getAllFldrs } from '@/lib/d1'

// Check if D1 is configured
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
const D1_ENABLED = process.env.D1_ENABLED === 'true'

interface CalendarEvent {
  id: string
  title: string
  location: string | null
  date: string
  end_date: string | null
}

export async function GET(request: NextRequest) {
  try {
    let fldrs

    // Fetch from D1 if enabled, otherwise use in-memory store
    if (D1_ENABLED && useD1) {
      try {
        fldrs = await getAllFldrs()
        console.log(`[Calendar API] Loaded ${fldrs.length} events from D1`)
      } catch (error) {
        console.error('[Calendar API] D1 fetch failed, using memory:', error)
        fldrs = fldrStore.getAll()
      }
    } else {
      fldrs = fldrStore.getAll()
      console.log(`[Calendar API] Loaded ${fldrs.length} events from memory`)
    }

    // Map to simplified calendar event format
    const calendarEvents: CalendarEvent[] = fldrs.map(fldr => {
      // Determine location from venue info or fallback to general location
      const location = fldr.venue_info?.address || fldr.location || null

      return {
        id: fldr.id,
        title: fldr.title,
        location,
        date: fldr.date_start,
        end_date: fldr.date_end,
      }
    })

    // Optional filtering by date range via query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    let filteredEvents = calendarEvents

    // Filter by date range if provided
    if (startDate) {
      filteredEvents = filteredEvents.filter(
        event => event.date >= startDate
      )
    }

    if (endDate) {
      filteredEvents = filteredEvents.filter(
        event => event.date <= endDate
      )
    }

    return NextResponse.json({
      events: filteredEvents,
      count: filteredEvents.length,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    )
  }
}
