import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const { jobData } = await request.json()

    if (!jobData) {
      return NextResponse.json(
        { error: 'Job data is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey })

    const systemPrompt = `You are an experienced travel logistics coordinator for a laser engraving company traveling to on-site events. Analyze the comprehensive travel data including calculated flight durations, drive times, and event durations to generate a detailed itinerary with timing recommendations.

YOU ARE PROVIDED WITH:
- Flight segments with exact departure and arrival times
- Drive times between locations (already calculated via Google Maps)
- Event durations (already calculated)
- All actual times and addresses
- Equipment pickup location (Vista office)

IMPORTANT WORKFLOW CONTEXT:
- Equipment (XTool cases) is stored at the office in Vista, CA
- At the START of a trip, team must pick up equipment from office before heading to airport
- The travel time from home/current location to office is PERSONALIZED (varies per team member)
- When including office pickup, mark it as "personalized" - this segment varies by person, day/time, and traffic

YOUR TASK:
1. Extract the EXACT times from the provided data
2. For trip START: Include equipment pickup from office as first step (mark as personalized)
3. Work BACKWARDS from critical deadlines (flight departures, event starts) to calculate when to leave
4. Add buffer recommendations for transitions (TSA, equipment handling, setup)
5. Create recommendations that show when to depart for each destination

CRITICAL RULES:
- "Depart for airport" must be BEFORE the flight departure time (not after!)
- "Arrive at venue" must be BEFORE event start time
- For trip start: Include "Pick up equipment at office" and mention it's on the way to airport
- Work backwards: If flight departs at 6:20 AM and drive is 30 min, recommend leaving at 5:50 AM (with TSA buffer: leave at 4:00 AM)
- Always parse times carefully - if you see "6:20 AM" that means 6:20 in the morning!

BUFFER RECOMMENDATIONS:
- Domestic TSA: 2 hours before departure
- Drive time: Use the provided Google Maps duration + 15-20% traffic buffer
- Equipment pickup/loading: 15-20 min at office
- Rental car pickup: 20-30 min
- Hotel check-in: 10-15 min  
- Load/unload equipment: 15-20 min per location
- Event setup time: 45-60 min before event start

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "time": "HH:MM AM/PM",
      "action": "Brief action description",
      "duration": "Travel duration (if applicable, e.g., '2h 30m flight' or '45 min drive')",
      "reason": "Detailed explanation with all buffers and reasoning",
      "location": "From → To (or just location)",
      "type": "flight|drive|event|transition|equipment_pickup",
      "personalized": true/false (true if segment varies per person, like home → office)
    }
  ],
  "overview": "Summary of the complete travel day flow from start to finish"
}

EXAMPLE: If flight departs at 6:20 AM with office pickup:
- Calculate: 6:20 AM - 2h TSA - 30min office→airport - 20min equipment loading = 3:30 AM arrive at office
- Include recommendations for: (1) Depart home for office [personalized], (2) Pick up equipment at office, (3) Depart office for airport, (4) Arrive at airport

INCLUDE ENTRIES FOR:
- Equipment pickup from office (at trip start)
- Departure for airport (calculated backward from flight time)
- Each flight segment (use exact departure time from data)
- Each drive segment (use exact time + duration) 
- Event start/end (use exact times from data)
- Key transitions (calculated based on buffers)

Be specific with times and ALWAYS work backwards from deadlines. Parse times carefully!`

    // Build context
    let context = '=== ITINERARY ANALYSIS REQUEST ===\n\n'
    
    if (jobData.flights) {
      context += '--- FLIGHTS ---\n'
      context += `${jobData.flights}\n\n`
    }
    
    if (jobData.hotel) {
      context += '--- HOTEL ---\n'
      context += `${jobData.hotel}\n\n`
    }
    
    if (jobData.venue) {
      context += '--- VENUE ---\n'
      context += `${jobData.venue}\n\n`
    }
    
    if (jobData.eventSchedule) {
      context += '--- EVENT SCHEDULE ---\n'
      context += `${jobData.eventSchedule}\n\n`
    }
    
    if (jobData.rentalCar) {
      context += '--- RENTAL CAR ---\n'
      context += `${jobData.rentalCar}\n\n`
    }
    
    if (jobData.equipmentPickup) {
      context += '--- EQUIPMENT PICKUP ---\n'
      context += `Office Location: ${jobData.equipmentPickup}\n`
      if (jobData.equipmentNote) {
        context += `${jobData.equipmentNote}\n`
      }
      context += '\n'
    }
    
    if (jobData.driveTimes) {
      context += '--- CALCULATED DRIVE TIMES (from Google Maps) ---\n'
      context += `${jobData.driveTimes}\n\n`
    }
    
    context += '--- YOUR TASK ---\n'
    context += 'Generate a chronological itinerary showing ALL travel segments (flights, drives, events) with their durations.\n'
    context += 'Add timing recommendations for transitions (when to leave, when to arrive).\n'
    context += '\n'
    context += 'CRITICAL: Work BACKWARDS from each deadline:\n'
    context += '- If flight DEPARTS at 6:20 AM, and drive is 30 min, and TSA needs 2 hours: recommend "Depart for airport" at 3:50 AM (NOT 8:10 AM!)\n'
    context += '- If event STARTS at 10:00 AM, and setup needs 1 hour, and drive is 20 min: recommend "Depart for venue" at 8:40 AM\n'
    context += '- Parse times carefully: "6:20 AM" means early morning (before noon), "6:20 PM" means evening\n'
    context += '\n'
    context += 'Use the exact durations provided above. Include setup time, equipment handling, traffic buffers, and TSA time in your transition recommendations.\n'
    context += 'Be specific and reference the calculated durations. ALWAYS recommend departure times BEFORE the deadline, not after!\n'

    console.log('[AI] Generating smart itinerary recommendations')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower for more consistent timing calculations
    })

    const content = completion.choices[0]?.message?.content
    
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    console.log('[AI] Generated itinerary recommendations')

    const itinerary = JSON.parse(content)

    return NextResponse.json({
      success: true,
      itinerary
    })

  } catch (error) {
    console.error('Itinerary generation error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate itinerary'
      },
      { status: 500 }
    )
  }
}
