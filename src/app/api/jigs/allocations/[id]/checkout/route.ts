import { NextRequest, NextResponse } from 'next/server'
import { checkOutAllocation, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jigs/allocations/[id]/checkout
 * Take a planned jig out of the shop: { by, unit_id } (unit_id for jigs tracked one by one)
 * 409 'unavailable' when it's already out, with details.holders saying where.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    const allocations = await checkOutAllocation(params.id, await readJson(request))
    return NextResponse.json({ allocations })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to check the jig out')
  }
}
