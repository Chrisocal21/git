import { NextRequest, NextResponse } from 'next/server'
import { addUnits, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jigs/[id]/units
 * Add units to an individually tracked jig: { count? } numbers them on from the
 * highest existing "#n", or { label } adds one with a specific name
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    const jig = await addUnits(params.id, await readJson(request))
    return NextResponse.json(jig, { status: 201 })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to add units')
  }
}
