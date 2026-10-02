import { NextRequest, NextResponse } from 'next/server'
import { updateUnit, deleteUnit, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/jigs/units/[unitId]
 * Update one unit: any of { label, status: 'ok' | 'needs_repair' | 'retired', notes }
 * Returns the whole jig it belongs to
 */
export async function PUT(request: NextRequest, { params }: { params: { unitId: string } }) {
  try {
    requireD1()
    const jig = await updateUnit(params.unitId, await readJson(request))
    return NextResponse.json(jig)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to update the unit')
  }
}

/**
 * DELETE /api/jigs/units/[unitId]
 * Only allowed if the unit has never been on a job; otherwise retire it
 */
export async function DELETE(_request: NextRequest, { params }: { params: { unitId: string } }) {
  try {
    requireD1()
    const jig = await deleteUnit(params.unitId)
    return NextResponse.json(jig)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to delete the unit')
  }
}
