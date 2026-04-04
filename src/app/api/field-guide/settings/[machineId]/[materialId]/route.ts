import { NextRequest, NextResponse } from 'next/server'
import { getSettingByMachineAndMaterial } from '@/lib/fieldGuideD1'
import { isD1Enabled } from '@/lib/d1'

/**
 * GET /api/field-guide/settings/[machineId]/[materialId]
 * Returns a single settings card for a specific machine + material combination
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { machineId: string; materialId: string } }
) {
  if (!isD1Enabled()) {
    return NextResponse.json(
      { error: 'Field Guide database not configured' },
      { status: 503 }
    )
  }

  const { machineId, materialId } = params

  try {
    const setting = await getSettingByMachineAndMaterial(machineId, materialId)
    
    if (!setting) {
      return NextResponse.json(
        { error: 'Settings not found for this combination' },
        { status: 404 }
      )
    }

    return NextResponse.json(setting, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      }
    })
  } catch (error) {
    console.error('[Field Guide] Failed to fetch setting:', error)
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    )
  }
}
