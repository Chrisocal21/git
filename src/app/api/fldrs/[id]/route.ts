import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { Fldr } from '@/types/fldr'
import { getFldrById, updateFldr, deleteFldr } from '@/lib/d1'

// Check if D1 is configured
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN
const D1_ENABLED = process.env.D1_ENABLED === 'true'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (D1_ENABLED && useD1) {
      // Use D1 for persistent storage
      const fldr = await getFldrById(params.id)
      if (!fldr) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      return NextResponse.json(fldr)
    } else {
      // Fallback to in-memory store
      const fldr = fldrStore.getById(params.id)
      if (!fldr) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      return NextResponse.json(fldr)
    }
  } catch (error) {
    console.error('Error fetching fldr:', error)
    // Fallback to in-memory if D1 fails
    const fldr = fldrStore.getById(params.id)
    if (!fldr) {
      return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
    }
    return NextResponse.json(fldr)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json() as Partial<Fldr>
    
    // Always update in-memory store first
    const fldr = fldrStore.update(params.id, updates)
    if (!fldr) {
      return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
    }
    
    if (D1_ENABLED && useD1) {
      try {
        // Try to sync to D1
        await updateFldr(params.id, updates)
        console.log('✅ Fldr synced to D1:', params.id)
      } catch (d1Error) {
        console.error('❌ D1 sync failed, using in-memory only:', d1Error)
        // Continue anyway - data is in memory
      }
    }
    
    return NextResponse.json(fldr)
  } catch (error) {
    console.error('Error updating fldr:', error)
    return NextResponse.json(
      { error: 'Failed to update fldr' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (D1_ENABLED && useD1) {
      // Use D1 for persistent storage
      await deleteFldr(params.id)
      // Also delete from in-memory store
      fldrStore.delete(params.id)
      return NextResponse.json({ success: true })
    } else {
      // Fallback to in-memory store
      const success = fldrStore.delete(params.id)
      if (!success) {
        return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    }
  } catch (error) {
    console.error('Error deleting fldr:', error)
    return NextResponse.json(
      { error: 'Failed to delete fldr' },
      { status: 500 }
    )
  }
}
