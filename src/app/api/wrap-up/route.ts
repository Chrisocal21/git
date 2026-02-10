import { NextRequest, NextResponse } from 'next/server'
import { buildWrapUpPrompt } from '@/lib/wrapUp'

export async function POST(request: NextRequest) {
  try {
    const { notes, fldr_title } = await request.json()

    if (!notes) {
      return NextResponse.json(
        { error: 'Notes are required' },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      // Return a mock response for development
      const mockWrapUp = `Here's a summary of ${fldr_title}:\n\n${notes}\n\nCheers!`
      
      return NextResponse.json({ 
        wrap_up: mockWrapUp,
        mock: true 
      })
    }

    // Build the prompt
    const prompt = buildWrapUpPrompt(notes, fldr_title)

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
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    })

    if (!response.ok) {
      throw new Error('OpenAI API request failed')
    }

    const data = await response.json()
    const wrapUp = data.choices[0]?.message?.content || notes

    return NextResponse.json({ wrap_up: wrapUp })
  } catch (error) {
    console.error('Wrap-up API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate wrap-up' },
      { status: 500 }
    )
  }
}
