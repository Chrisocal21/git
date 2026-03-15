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
  attending: boolean
  icon: string // "✈️" if attending, "" if not
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

      // Ensure dates are in full YYYY-MM-DD format
      const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return dateStr // Return as-is if invalid
        // Format as YYYY-MM-DD
        return date.toISOString().split('T')[0]
      }

      return {
        id: fldr.id,
        title: fldr.title,
        location,
        date: formatDate(fldr.date_start) || fldr.date_start,
        end_date: formatDate(fldr.date_end),
        attending: fldr.attending || false,
        icon: fldr.attending ? "✈️" : "",
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

    return NextResponse.json(
      {
        events: filteredEvents,
        count: filteredEvents.length,
        generated_at: new Date().toISOString(),
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  } catch (error) {
    console.error('[Calendar API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  )
}
