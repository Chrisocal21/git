import { NextResponse } from 'next/server'
import { isD1Enabled } from '@/lib/d1'
import { getJobAllocations, jigErrorResponse } from '@/lib/jigsD1'
import type { JobJigsResponse } from '@/types/jigs'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jigs/job/[jobId]
 * Every jig line on one job: needed, out and returned
 */
export async function GET(_request: Request, { params }: { params: { jobId: string } }) {
  const as_of = new Date().toISOString()

  if (!isD1Enabled()) {
    const empty: JobJigsResponse = { allocations: [], d1: false, as_of }
    return NextResponse.json(empty)
  }

  try {
    const body: JobJigsResponse = { allocations: await getJobAllocations(params.jobId), d1: true, as_of }
    return NextResponse.json(body)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to load this job’s jigs')
  }
}
