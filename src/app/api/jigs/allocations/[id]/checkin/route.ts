import { NextRequest, NextResponse } from 'next/server'
import { checkInAllocation, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jigs/allocations/[id]/checkin
 * Bring a jig back: { by, condition: 'ok' | 'needs_repair' | 'lost', notes? }
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    const allocations = await checkInAllocation(params.id, await readJson(request))
    return NextResponse.json({ allocations })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to check the jig in')
  }
}
