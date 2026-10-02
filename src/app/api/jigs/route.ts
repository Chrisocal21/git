import { NextRequest, NextResponse } from 'next/server'
import { isD1Enabled } from '@/lib/d1'
import { getInventory, createJigType, jigErrorResponse, readJson, requireD1 } from '@/lib/jigsD1'
import type { JigInventoryResponse } from '@/types/jigs'

// Counts change every time something is checked out or in, so never cache this
export const dynamic = 'force-dynamic'

/**
 * GET /api/jigs
 * Every jig (archived ones included) with counts and where each one is
 */
export async function GET() {
  const as_of = new Date().toISOString()

  if (!isD1Enabled()) {
    const empty: JigInventoryResponse = { jigs: [], d1: false, as_of }
    return NextResponse.json(empty)
  }

  try {
    const body: JigInventoryResponse = { jigs: await getInventory(), d1: true, as_of }
    return NextResponse.json(body)
  } catch (error) {
    return jigErrorResponse(error, 'Failed to load inventory')
  }
}

/**
 * POST /api/jigs
 * Add a jig: { name, tracking: 'unit' | 'bulk', quantity, notes?, created_by? }
 */
export async function POST(request: NextRequest) {
  try {
    requireD1()
    const jig = await createJigType(await readJson(request))
    return NextResponse.json(jig, { status: 201 })
  } catch (error) {
    return jigErrorResponse(error, 'Failed to add the jig')
  }
}
