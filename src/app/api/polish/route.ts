import { NextRequest, NextResponse } from 'next/server'
import { buildPolishPrompt } from '@/lib/toneProfile'

export async function POST(request: NextRequest) {
  try {
    const { original_message, draft, polish_level } = await request.json()

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft is required' },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      // Return a mock response for development
      const mockPolished = polish_level === 'full_suit'
        ? `${draft}\n\nCheers!`
        : `${draft.trim()}\n\nCheers!`
      
      return NextResponse.json({ 
        polished: mockPolished,
        mock: true 
      })
    }

    // Build the prompt using tone profile
    const prompt = buildPolishPrompt(draft, original_message || null, polish_level)

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
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error('OpenAI API request failed')
    }

    const data = await response.json()
    const polished = data.choices[0]?.message?.content || draft

    return NextResponse.json({ polished })
  } catch (error) {
    console.error('Polish API error:', error)
    return NextResponse.json(
      { error: 'Failed to polish message' },
      { status: 500 }
    )
  }
}
