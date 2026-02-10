import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { NewFldr } from '@/types/fldr'
import { getAllFldrs, createFldr } from '@/lib/d1'

// Check if D1 is configured
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN

export async function GET() {
  try {
    if (useD1) {
      // Use D1 for persistent storage
      const fldrs = await getAllFldrs()
      return NextResponse.json(fldrs)
    } else {
      // Fallback to in-memory store
      const fldrs = fldrStore.getAll()
      return NextResponse.json(fldrs)
    }
  } catch (error) {
    console.error('Error fetching fldrs:', error)
    // Fallback to in-memory if D1 fails
    const fldrs = fldrStore.getAll()
    return NextResponse.json(fldrs)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NewFldr
    const fldr = fldrStore.create(body) // Generate ID and validate
    
    if (useD1) {
      try {
        // Try to save to D1 for persistent storage
        await createFldr(fldr)
        console.log('Fldr saved to D1:', fldr.id)
      } catch (d1Error) {
        console.error('D1 save failed, using in-memory only:', d1Error)
        // Continue anyway - data is in memory
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
