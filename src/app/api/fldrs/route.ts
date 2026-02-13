import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { NewFldr } from '@/types/fldr'
import { getAllFldrs, createFldr } from '@/lib/d1'

// Check if D1 is configured
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
// Temporarily disable D1 until table is confirmed working
const D1_ENABLED = process.env.D1_ENABLED === 'true'

console.log('🗄️ D1 Configuration:', {
  hasCredentials: !!useD1,
  enabled: D1_ENABLED,
  mode: D1_ENABLED && useD1 ? 'D1 + localStorage' : 'localStorage only'
})

export async function GET() {
  // For now, always use in-memory store (Vercel serverless limitation)
  // D1 will be used once table is set up and D1_ENABLED=true
  const fldrs = fldrStore.getAll()
  console.log(`GET /api/fldrs - returning ${fldrs.length} fldrs from memory`)
  
  // If D1 is enabled, try to load from there instead
  if (D1_ENABLED && useD1) {
    try {
      const d1Fldrs = await getAllFldrs()
      console.log(`✅ Loaded ${d1Fldrs.length} fldrs from D1`)
      return NextResponse.json(d1Fldrs)
    } catch (error) {
      console.error('❌ D1 fetch failed, using memory:', error)
    }
  }
  
  return NextResponse.json(fldrs)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NewFldr
    const fldr = fldrStore.create(body) // Generate ID and validate
    
    if (D1_ENABLED && useD1) {
      // Cloud-first: Save to D1 and fail if it fails
      try {
        await createFldr(fldr)
        console.log('✅ Fldr saved to D1:', fldr.id)
      } catch (d1Error) {
        console.error('❌ D1 save failed:', d1Error)
        return NextResponse.json(
          { error: 'Failed to save to cloud storage' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(fldr, { status: 201 })
  } catch (error) {
    console.error('Error creating fldr:', error)
    return NextResponse.json(
      { error: 'Failed to create fldr' },
      { status: 400 }
    )
  }
}
