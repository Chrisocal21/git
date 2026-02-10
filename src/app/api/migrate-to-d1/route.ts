import { NextRequest, NextResponse } from 'next/server'
import { createFldr } from '@/lib/d1'
import { Fldr } from '@/types/fldr'

const D1_ENABLED = process.env.D1_ENABLED === 'true'
const useD1 = process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_DATABASE_ID && process.env.CLOUDFLARE_API_TOKEN

export async function POST(request: NextRequest) {
  if (!D1_ENABLED || !useD1) {
    return NextResponse.json(
      { error: 'D1 is not enabled' },
      { status: 400 }
    )
  }

  try {
    const { fldrs } = await request.json() as { fldrs: Fldr[] }
    
    if (!Array.isArray(fldrs) || fldrs.length === 0) {
      return NextResponse.json(
        { error: 'No fldrs provided' },
        { status: 400 }
      )
    }

    const results = {
      success: [] as string[],
      failed: [] as { id: string, error: string }[],
    }

    for (const fldr of fldrs) {
      try {
        await createFldr(fldr)
        results.success.push(fldr.id)
        console.log('✅ Migrated fldr to D1:', fldr.id)
      } catch (error) {
        results.failed.push({
          id: fldr.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        console.error('❌ Failed to migrate fldr:', fldr.id, error)
      }
    }

    return NextResponse.json({
      total: fldrs.length,
      migrated: results.success.length,
      failed: results.failed.length,
      results,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
