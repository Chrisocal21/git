import { NextRequest, NextResponse } from 'next/server'
import { fldrStore } from '@/lib/store'
import { NewFldr } from '@/types/fldr'

export async function GET() {
  const fldrs = fldrStore.getAll()
  return NextResponse.json(fldrs)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NewFldr
    const fldr = fldrStore.create(body)
    return NextResponse.json(fldr, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create fldr' },
      { status: 400 }
    )
  }
}
