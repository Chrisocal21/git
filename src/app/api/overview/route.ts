import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { fldr } = await request.json()

    if (!fldr) {
      return NextResponse.json(
        { error: 'Job data is required' },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      // Return a mock response for development
      const mockOverview = generateMockOverview(fldr)
      
      return NextResponse.json({ 
        overview: mockOverview,
        mock: true 
      })
    }

    // Build the prompt
    const prompt = buildOverviewPrompt(fldr)

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a professional event coordinator creating clean, professional job overviews for production teams. Focus on key details, times, locations, and team information. Keep it concise and well-formatted.'
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error('OpenAI API request failed')
    }

    const data = await response.json()
    const overview = data.choices[0]?.message?.content || generateMockOverview(fldr)

    return NextResponse.json({ overview })
  } catch (error) {
    console.error('Overview API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate overview' },
      { status: 500 }
    )
  }
}

function buildOverviewPrompt(fldr: any): string {
  const parts: string[] = []
  
  parts.push('Generate a professional job overview for the following production event. Include all relevant details in a clean, easy-to-read format.\n')
  
  // Basic info
  parts.push(`Job Title: ${fldr.fldr_title || 'Untitled Job'}`)
  if (fldr.date_start || fldr.date_end) {
    parts.push(`Dates: ${formatDateRange(fldr.date_start, fldr.date_end)}`)
  }
  if (fldr.location) {
    parts.push(`Location: ${fldr.location}`)
  }
  
  // Venue
  if (fldr.venue_info?.name) {
    parts.push(`\nVenue: ${fldr.venue_info.name}`)
    if (fldr.venue_info.address) {
      parts.push(`Address: ${fldr.venue_info.address}`)
    }
    if (fldr.venue_info.contact_name || fldr.venue_info.contact_phone) {
      const contact = [fldr.venue_info.contact_name, fldr.venue_info.contact_phone].filter(Boolean).join(' - ')
      parts.push(`Venue Contact: ${contact}`)
    }
  }
  
  // Client info
  if (fldr.job_info?.client_name) {
    parts.push(`\nClient: ${fldr.job_info.client_name}`)
    if (fldr.job_info.client_contact_name || fldr.job_info.client_contact_phone || fldr.job_info.client_contact_email) {
      const clientContact = [
        fldr.job_info.client_contact_name,
        fldr.job_info.client_contact_phone,
        fldr.job_info.client_contact_email
      ].filter(Boolean).join(' - ')
      parts.push(`Client Contact: ${clientContact}`)
    }
  }
  
  // Job details
  if (fldr.job_info?.job_title) {
    parts.push(`\nJob Type: ${fldr.job_info.job_title}`)
  }
  if (fldr.job_info?.item) {
    parts.push(`Services: ${fldr.job_info.item}`)
  }
  if (fldr.job_info?.quantity) {
    parts.push(`Quantity: ${fldr.job_info.quantity}`)
  }
  
  // Schedule
  const schedules = []
  if (fldr.job_info?.show_up_time) {
    schedules.push(`Show Up: ${formatTimeOnly(fldr.job_info.show_up_time)}`)
  }
  if (fldr.job_info?.use_daily_schedule) {
    if (fldr.job_info.daily_start_time) {
      schedules.push(`Daily Start: ${fldr.job_info.daily_start_time}`)
    }
    if (fldr.job_info.daily_end_time) {
      schedules.push(`Daily End: ${fldr.job_info.daily_end_time}`)
    }
  } else {
    if (fldr.job_info?.job_start_time) {
      schedules.push(`Start: ${formatTimeOnly(fldr.job_info.job_start_time)}`)
    }
    if (fldr.job_info?.job_end_time) {
      schedules.push(`End: ${formatTimeOnly(fldr.job_info.job_end_time)}`)
    }
  }
  if (schedules.length > 0) {
    parts.push(`\nSchedule:\n${schedules.join('\n')}`)
  }
  
  // Team
  if (fldr.job_info?.team_members && fldr.job_info.team_members.length > 0) {
    parts.push(`\nTeam: ${fldr.job_info.team_members.join(', ')}`)
  }
  
  // Travel info (if applicable)
  if (fldr.flight_info && fldr.flight_info.length > 0) {
    const firstFlight = fldr.flight_info[0]
    if (firstFlight.airline || firstFlight.flight_number) {
      parts.push(`\nTravel: Flight ${firstFlight.airline || ''} ${firstFlight.flight_number || ''}`)
    }
  }
  if (fldr.hotel_info?.name) {
    parts.push(`Hotel: ${fldr.hotel_info.name}`)
    if (fldr.hotel_info.check_in && fldr.hotel_info.check_out) {
      parts.push(`Check-in: ${formatDateOnly(fldr.hotel_info.check_in)} - Check-out: ${formatDateOnly(fldr.hotel_info.check_out)}`)
    }
  }
  
  // Notes (brief mention if present)
  if (fldr.notes && fldr.notes.trim()) {
    parts.push('\nAdditional Notes: See internal notes section')
  }
  
  parts.push('\n---\nCreate a clean, professional summary from the above information. Format it as a readable overview suitable for copying into external communications. DO NOT include any internal/sensitive notes.')
  
  return parts.join('\n')
}

function generateMockOverview(fldr: any): string {
  const lines: string[] = []
  
  lines.push(`JOB OVERVIEW - ${fldr.fldr_title || 'Untitled Job'}\n`)
  
  if (fldr.date_start || fldr.date_end) {
    lines.push(`Dates: ${formatDateRange(fldr.date_start, fldr.date_end)}`)
  }
  
  if (fldr.location) {
    lines.push(`Location: ${fldr.location}`)
  }
  
  if (fldr.venue_info?.name) {
    lines.push(`\nVenue: ${fldr.venue_info.name}`)
    if (fldr.venue_info.address) {
      lines.push(`Address: ${fldr.venue_info.address}`)
    }
    if (fldr.venue_info.contact_name || fldr.venue_info.contact_phone) {
      const contact = [fldr.venue_info.contact_name, fldr.venue_info.contact_phone].filter(Boolean).join(' - ')
      lines.push(`Contact: ${contact}`)
    }
  }
  
  if (fldr.job_info?.client_name) {
    lines.push(`\nClient: ${fldr.job_info.client_name}`)
    if (fldr.job_info.client_contact_name || fldr.job_info.client_contact_phone || fldr.job_info.client_contact_email) {
      const contact = [
        fldr.job_info.client_contact_name,
        fldr.job_info.client_contact_phone,
        fldr.job_info.client_contact_email
      ].filter(Boolean).join(' - ')
      lines.push(`Contact: ${contact}`)
    }
  }
  
  if (fldr.job_info?.item) {
    lines.push(`\nServices: ${fldr.job_info.item}`)
    if (fldr.job_info.quantity) {
      lines.push(`Quantity: ${fldr.job_info.quantity}`)
    }
  }
  
  const schedules = []
  if (fldr.job_info?.show_up_time) {
    schedules.push(`Show Up: ${formatTimeOnly(fldr.job_info.show_up_time)}`)
  }
  if (fldr.job_info?.use_daily_schedule) {
    if (fldr.job_info.daily_start_time) {
      schedules.push(`Daily Start: ${fldr.job_info.daily_start_time}`)
    }
    if (fldr.job_info.daily_end_time) {
      schedules.push(`Daily End: ${fldr.job_info.daily_end_time}`)
    }
  } else {
    if (fldr.job_info?.job_start_time) {
      schedules.push(`Start: ${formatTimeOnly(fldr.job_info.job_start_time)}`)
    }
    if (fldr.job_info?.job_end_time) {
      schedules.push(`End: ${formatTimeOnly(fldr.job_info.job_end_time)}`)
    }
  }
  if (schedules.length > 0) {
    lines.push(`\nSchedule:`)
    schedules.forEach(s => lines.push(s))
  }
  
  if (fldr.job_info?.team_members && fldr.job_info.team_members.length > 0) {
    lines.push(`\nTeam: ${fldr.job_info.team_members.join(', ')}`)
  }
  
  if (fldr.hotel_info?.name) {
    lines.push(`\nHotel: ${fldr.hotel_info.name}`)
    if (fldr.hotel_info.check_in && fldr.hotel_info.check_out) {
      lines.push(`Check-in: ${formatDateOnly(fldr.hotel_info.check_in)}`)
      lines.push(`Check-out: ${formatDateOnly(fldr.hotel_info.check_out)}`)
    }
  }
  
  return lines.join('\n')
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return ''
  if (!end || start === end) {
    return new Date(start!).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }
  const startDate = new Date(start!)
  const endDate = new Date(end!)
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

function formatDateOnly(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  })
}

function formatTimeOnly(dateTimeStr: string | null): string {
  if (!dateTimeStr) return ''
  return new Date(dateTimeStr).toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit'
  })
}
