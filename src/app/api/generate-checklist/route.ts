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

    // Build context from job data
    const systemPrompt = `You are an experienced production manager for a promotional laser engraving company. Focus ONLY on production prep work done AT THE OFFICE before the trip.

BUSINESS CONTEXT:
- Company does on-site laser engraving at events using XTool F1 Lite engravers
- Team is based in Vista, CA at 925 Poinsettia Ave (office/workshop)
- Equipment is picked up from the office before travel

YOUR TASK: Generate a PRODUCTION-FOCUSED checklist for HOME/OFFICE prep work.

ONLY INCLUDE THESE TYPES OF ITEMS:

1. **EQUIPMENT TESTING & PREP** (category: production)
   - Test XTool engravers, check alignment/calibration
   - Charge all batteries (laptop, iPad, power banks)
   - Test jigs with actual products
   - Update/install software on devices
   - Clean laser lens, mirrors, fans

2. **CUSTOM JIG BUILDING** (category: production)
   - Design/build jigs for specific products
   - Test fit products in jigs
   - Make backup jigs if high volume

3. **PRODUCT QUALITY CHECKS** (category: production)
   - Inspect shipped products for defects
   - Test engrave on sample items
   - Count and verify product quantities
   - Organize products by type/size

4. **MATERIAL GATHERING** (category: production)
   - Gather specific backup materials
   - Prepare cleaning supplies specific to products
   - Organize workspace for efficient packing

DO NOT INCLUDE:
- ❌ Travel logistics (flights, rental cars, airports, hotel)
- ❌ Venue contact/confirmation (handled elsewhere)
- ❌ Packing lists (what to bring on trip)
- ❌ Weather gear selection
- ❌ Schedule confirmations
- ❌ Team coordination meetings

Return ONLY valid JSON:
{
  "items": [
    {
      "item": "Specific production task",
      "reason": "WHY this production work is needed",
      "category": "production"
    }
  ]
}

Keep it SHORT - 3-7 items max. Focus on critical production work specific to this job's products/equipment needs.`

    // Build user context from job data
    let context = '=== JOB ANALYSIS ===\n\n'
    
    // Basic Info
    if (jobData.jobTitle) context += `Job Title: ${jobData.jobTitle}\n`
    if (jobData.jobType) context += `Service Type: ${jobData.jobType}\n`
    if (jobData.clientName) context += `Client: ${jobData.clientName}\n`
    if (jobData.dateStart) context += `Start Date: ${jobData.dateStart}\n`
    if (jobData.dateEnd) context += `End Date: ${jobData.dateEnd}\n`
    
    // Location & Venue
    if (jobData.location || jobData.venueInfo) {
      context += `\n--- VENUE DETAILS ---\n`
      if (jobData.location) context += `Location: ${jobData.location}\n`
      if (jobData.venueInfo) context += `${jobData.venueInfo}\n`
    }
    
    // Schedule & Timing
    if (jobData.showUpTime || jobData.eventSchedule || jobData.eventDuration) {
      context += `\n--- EVENT SCHEDULE ---\n`
      if (jobData.showUpTime) context += `Show Up Time: ${jobData.showUpTime}\n`
      if (jobData.eventSchedule) context += `Event Hours: ${jobData.eventSchedule}\n`
      if (jobData.eventDuration) context += `Duration: ${jobData.eventDuration}\n`
      if (jobData.breakTime) context += `Break Time: ${jobData.breakTime}\n`
    }
    
    // Travel Analysis
    if (jobData.flightDetails || jobData.rentalCarInfo || jobData.timePressure) {
      context += `\n--- TRAVEL LOGISTICS ---\n`
      if (jobData.flightDetails) context += `Flights:\n${jobData.flightDetails}\n`
      if (jobData.travelComplexity) context += `IMPORTANT: ${jobData.travelComplexity}\n`
      if (jobData.timePressure) context += `IMPORTANT: ${jobData.timePressure}\n`
      if (jobData.rentalCarInfo) context += `Rental Car: ${jobData.rentalCarInfo}\n`
    }
    
    // Accommodations
    if (jobData.hotelInfo) {
      context += `\n--- ACCOMMODATIONS ---\n`
      context += `${jobData.hotelInfo}\n`
      if (jobData.multiEventTravel) context += `IMPORTANT: ${jobData.multiEventTravel}\n`
    }
    
    // Weather Forecast
    if (jobData.weather) {
      context += `\n--- WEATHER FORECAST ---\n`
      context += `Current: ${jobData.weather.current.temp}°F, ${jobData.weather.current.description}\n`
      context += `Humidity: ${jobData.weather.current.humidity}%, Wind: ${jobData.weather.current.wind_speed} mph\n`
      if (jobData.weather.forecast && jobData.weather.forecast.length > 0) {
        context += `Next 3 Days:\n`
        jobData.weather.forecast.forEach((f: any) => {
          context += `  • ${f.date}: ${f.high}°/${f.low}°F, ${f.description}`
          if (f.precipitation > 0) context += ` (${f.precipitation}% rain)`
          context += `\n`
        })
      }
    }
    
    // Products & Inventory
    if (jobData.productInfo || jobData.totalProductVolume) {
      context += `\n--- PRODUCT INVENTORY ---\n`
      if (jobData.totalProductVolume) context += `${jobData.totalProductVolume}\n`
      if (jobData.productInfo) context += `${jobData.productInfo}\n`
    }
    
    // Team Composition
    if (jobData.teamMembers || jobData.contactList) {
      context += `\n--- TEAM & CONTACTS ---\n`
      if (jobData.teamMembers) context += `Team: ${jobData.teamMembers}\n`
      if (jobData.contactList) context += `Contacts: ${jobData.contactList}\n`
    }
    
    // Pre-Engrave Details
    if (jobData.preEngraveDetails) {
      context += `\n--- PRE-ENGRAVE SPECIFICATIONS ---\n`
      context += `${jobData.preEngraveDetails}\n`
    }
    
    // Historical Notes
    if (jobData.venueHistoricalNotes || jobData.generalNotes) {
      context += `\n--- IMPORTANT NOTES & HISTORY ---\n`
      if (jobData.venueHistoricalNotes) context += `${jobData.venueHistoricalNotes}\n`
      if (jobData.generalNotes) context += `${jobData.generalNotes}\n`
    }
    
    // Existing Checklist
    if (jobData.existingChecklist && jobData.existingChecklist.length > 0) {
      context += `\n--- ITEMS ALREADY ON CHECKLIST (don't duplicate) ---\n`
      context += `${jobData.existingChecklist.map((item: string) => `• ${item}`).join('\n')}\n`
    }

    context += `\n--- YOUR ANALYSIS ---\n`
    context += `Generate 3-7 PRODUCTION-FOCUSED tasks for work done AT THE OFFICE:\n`
    context += `- Equipment testing specific to this job's products\n`
    context += `- Custom jig building if products need special fixtures\n`
    context += `- Product quality inspection and quantity verification\n`
    context += `- Battery charging and device prep\n`
    context += `\nDO NOT include travel logistics, venue confirmation, or packing items.\n`

    console.log('[AI] Generating production checklist with context:', context.substring(0, 200) + '...')

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: context }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7, // Slightly higher for creative suggestions
    })

    const content = completion.choices[0]?.message?.content
    
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    console.log('[AI] Generated checklist successfully')

    const checklist = JSON.parse(content)

    return NextResponse.json({
      success: true,
      checklist
    })

  } catch (error) {
    console.error('Checklist generation error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate checklist'
      },
      { status: 500 }
    )
  }
}
