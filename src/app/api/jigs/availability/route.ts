import { NextRequest, NextResponse } from 'next/server'
import { getAvailability, jigErrorResponse, requireD1 } from '@/lib/jigsD1'
import type { JigAvailabilityResponse } from '@/types/jigs'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jigs/availability?job_id=…&start=YYYY-MM-DD&end=YYYY-MM-DD
 * For each active jig: how many can still be added to that job for those dates,
 * and who has the rest.
 */
export async function GET(request: NextRequest) {
  try {
    requireD1()
    const q = request.nextUrl.searchParams
    const types = await getAvailability({
      job_id: q.get('job_id'),
      start: q.get('start'),
      end: q.get('end'),
    })
    const body: JigAvailabilityResponse = { types }
    return NextResponse.json(body)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to check what is available')
  }
}
