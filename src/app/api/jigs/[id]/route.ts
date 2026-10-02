import { NextRequest, NextResponse } from 'next/server'
import { updateJigType, deleteJigType, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * PUT /api/jigs/[id]
 * Update a jig: any of { name, notes, total_qty (counted jigs), archived }
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    const jig = await updateJigType(params.id, await readJson(request))
    return NextResponse.json(jig)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to update the jig')
  }
}

/**
 * DELETE /api/jigs/[id]
 * Only allowed if the jig has never been on a job; otherwise archive it
 */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    requireD1()
    await deleteJigType(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to delete the jig')
  }
}
