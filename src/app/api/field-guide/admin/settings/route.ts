import { NextRequest, NextResponse } from 'next/server'
import { createSetting, updateSetting, getSettingByMachineAndMaterial } from '@/lib/fieldGuideD1'
import { isD1Enabled } from '@/lib/d1'

/**
 * POST /api/field-guide/admin/settings
 * Create or update a settings record
 */
export async function POST(request: NextRequest) {
  if (!isD1Enabled()) {
    // Mock success response for demo mode
    const body = await request.json()
    return NextResponse.json(
      { 
        id: Date.now().toString(),
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { status: 201 }
    )
  }

  try {
    const body = await request.json()
    const {
      machine_id,
      material_id,
      speed,
      power,
      frequency,
      passes,
      mode,
      focus_notes,
      notes,
      updated_by
    } = body

    if (!machine_id || !material_id) {
      return NextResponse.json(
        { error: 'machine_id and material_id are required' },
        { status: 400 }
      )
    }

    // Check if setting already exists
    const existing = await getSettingByMachineAndMaterial(machine_id, material_id)

    let setting
    if (existing) {
      // Update existing
      setting = await updateSetting(existing.id, {
        speed,
        power,
        frequency,
        passes,
        mode,
        focus_notes,
        notes,
        updated_by
      })
    } else {
      // Create new
      const id = `${machine_id}_${material_id}`
      setting = await createSetting({
        id,
        machine_id,
        material_id,
        speed,
        power,
        frequency,
        passes,
        mode,
        focus_notes,
        notes,
        updated_by
      })
    }

    // TODO: Sync to Google Sheets (fire-and-forget)

    return NextResponse.json(setting, { status: existing ? 200 : 201 })
  } catch (error) {
    console.error('[Field Guide] Failed to save setting:', error)
    return NextResponse.json(
      { error: 'Failed to save setting' },
      { status: 500 }
    )
  }
}
