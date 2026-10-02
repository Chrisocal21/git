import { NextRequest, NextResponse } from 'next/server'
import { removeAllocation, setNeededQty, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/jigs/allocations/[id]
 * Change how many of a counted jig a job needs: { qty, start, end }
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    const allocations = await setNeededQty(params.id, await readJson(request))
    return NextResponse.json({ allocations })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to change the quantity')
  }
}

/**
 * DELETE /api/jigs/allocations/[id]
 * Take a jig off a job's list. Only before it has been checked out.
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    const allocations = await removeAllocation(params.id)
    return NextResponse.json({ allocations })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to remove the jig')
  }
}
