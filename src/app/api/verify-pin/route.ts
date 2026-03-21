import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()
    
    // Get PIN from environment variable
    const correctPin = process.env.APP_PIN
    
    if (!correctPin) {
      console.error('[PIN] APP_PIN environment variable not set')
      return NextResponse.json(
        { verified: false, error: 'Server configuration error' },
        { status: 500 }
      )
    }
    
    // Verify PIN
    const isValid = pin === correctPin
    
    if (isValid) {
      console.log('[PIN] Valid PIN entered')
    } else {
      console.log('[PIN] Invalid PIN attempt')
    }
    
    return NextResponse.json({ verified: isValid })
  } catch (error) {
    console.error('[PIN] Verification error:', error)
    return NextResponse.json(
      { verified: false, error: 'Verification failed' },
      { status: 500 }
    )
  }
}
