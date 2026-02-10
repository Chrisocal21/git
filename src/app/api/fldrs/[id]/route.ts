import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { Fldr } from '@/types/fldr'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const fldr = fldrStore.getById(params.id)
  if (!fldr) {
    return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
  }
  return NextResponse.json(fldr)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json() as Partial<Fldr>
    const fldr = fldrStore.update(params.id, updates)
    if (!fldr) {
      return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
    }
    return NextResponse.json(fldr)
  } catch (error) {
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
  const success = fldrStore.delete(params.id)
  if (!success) {
    return NextResponse.json({ error: 'Fldr not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
