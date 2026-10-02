import { NextRequest, NextResponse } from 'next/server'
import { reserveJig, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'

export const dynamic = 'force-dynamic'

/**
 * POST /api/jigs/allocations
 * Plan a jig for a job: { job_id, type_id, product_id?, qty, start, end, created_by? }
 * 409 'unavailable' ("No more available.") when those dates are already covered.
 * Returns the job's updated jig list.
 */
export async function POST(request: NextRequest) {
  try {
    requireD1()
    const allocations = await reserveJig(await readJson(request))
    return NextResponse.json({ allocations }, { status: 201 })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to add the jig to the job')
  }
}
