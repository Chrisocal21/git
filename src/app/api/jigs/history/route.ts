import { NextRequest, NextResponse } from 'next/server'
import { isD1Enabled } from '@/lib/d1'
import { getHistory, jigErrorResponse } from '@/lib/jigsD1'
import type { JigHistoryResponse } from '@/types/jigs'

export const dynamic = 'force-dynamic'

/**
 * GET /api/jigs/history?jig=…&unit=…&limit=50&before=<iso>&before_id=<id>
 * Every time a jig went out or came back, newest first. Narrow it to one jig or one unit,
 * and page back by passing the last event's `at` and `id` as before / before_id.
 */
export async function GET(request: NextRequest) {
  const as_of = new Date().toISOString()

  if (!isD1Enabled()) {
    const empty: JigHistoryResponse = { events: [], has_more: false, d1: false, as_of }
    return NextResponse.json(empty)
  }

  try {
    const q = request.nextUrl.searchParams
    const { events, has_more } = await getHistory({
      jig: q.get('jig'),
      unit: q.get('unit'),
      limit: q.get('limit'),
      before: q.get('before'),
      before_id: q.get('before_id'),
    })
    const body: JigHistoryResponse = { events, has_more, d1: true, as_of }
    return NextResponse.json(body)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to load the history')
  }
}
