import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const { emailText, imageData, type } = await request.json()

    if ((!emailText && !imageData) || !type) {
      return NextResponse.json(
        { error: 'Email text or image data, and type are required' },
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

    let systemPrompt = ''
    let responseFormat: any = null

    // Configure prompt and response format based on type
    if (type === 'flight') {
      systemPrompt = `Extract flight information from the provided confirmation email or text.
Return ONLY valid JSON with these exact fields (use null for missing data):
{
  "airline": "airline name",
  "flight_number": "flight number (e.g., AA123)",
  "confirmation": "confirmation/record locator number",
  "departure_airport": "full departure airport name",
  "departure_code": "3-letter IATA code",
  "departure_time": "ISO 8601 datetime (e.g., 2024-03-15T14:30:00)",
  "arrival_airport": "full arrival airport name",
  "arrival_code": "3-letter IATA code",
  "arrival_time": "ISO 8601 datetime",
  "notes": "any additional relevant information"
}

Important:
- For times, use ISO 8601 format with the flight's local timezone
- If year is missing, assume current year
- Extract airport codes from the email (LAX, JFK, ORD, etc.)
- Include confirmation/record locator number if present
- Put passenger name, seat assignments, or other details in notes`

      responseFormat = {
        type: 'json_object'
      }
    } else if (type === 'hotel') {
      systemPrompt = `Extract hotel information from the provided confirmation email or text.
Return ONLY valid JSON with these exact fields (use null for missing data):
{
  "name": "hotel name",
  "address": "full hotel address",
  "phone": "hotel phone number",
  "confirmation": "confirmation number",
  "check_in": "ISO 8601 datetime (e.g., 2024-03-15T15:00:00)",
  "check_out": "ISO 8601 datetime",
  "notes": "room type, special requests, or other relevant information"
}

Important:
- For check-in/out times, use ISO 8601 format
- If specific times aren't provided, use 3:00 PM for check-in and 11:00 AM for check-out
- If year is missing, assume current year
- Include full street address if available
- Put room details, amenities, or special requests in notes`

      responseFormat = {
        type: 'json_object'
      }
    } else if (type === 'rental_car') {
      systemPrompt = `Extract rental car information from the provided confirmation email or text.
Return ONLY valid JSON with these exact fields (use null for missing data):
{
  "company": "rental car company name",
  "vehicle_type": "vehicle type/class",
  "confirmation": "confirmation number",
  "pickup_location": "pickup location address",
  "pickup_time": "ISO 8601 datetime (e.g., 2024-03-15T10:00:00)",
  "dropoff_location": "drop-off location address",
  "dropoff_time": "ISO 8601 datetime",
  "notes": "vehicle details, insurance info, or other relevant information"
}

Important:
- For pickup/drop-off times, use ISO 8601 format
- If year is missing, assume current year
- Extract full addresses for pickup and drop-off locations
- Include vehicle class/type (economy, SUV, etc.)
- Put insurance details, extras, or special instructions in notes`

      responseFormat = {
        type: 'json_object'
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be: flight, hotel, or rental_car' },
        { status: 400 }
      )
    }

    if (imageData) {
      console.log(`🤖 Parsing ${type} from image (${imageData.length} bytes)`)
    } else {
      console.log(`🤖 Parsing ${type} email (${emailText.length} chars)`)
    }

    // Use GPT-4o for images (has vision), GPT-4o-mini for text only
    const model = imageData ? 'gpt-4o' : 'gpt-4o-mini'

    // Build messages based on whether we have an image or text
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ]

    if (imageData) {
      // For images, use the vision format
      messages.push({
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract the information from this confirmation email screenshot:'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageData
            }
          }
        ]
      })
    } else {
      // For text, simple content
      messages.push({
        role: 'user',
        content: emailText
      })
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      response_format: responseFormat,
      temperature: 0.1, // Low temperature for consistent extraction
    })

    const content = completion.choices[0]?.message?.content
    
    if (!content) {
      throw new Error('No response from OpenAI')
    }

    console.log('✅ Parsed successfully:', content.substring(0, 100) + '...')

    const parsedData = JSON.parse(content)

    return NextResponse.json({
      success: true,
      data: parsedData
    })

  } catch (error) {
    console.error('Email parsing error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse email'
      },
      { status: 500 }
    )
  }
}
