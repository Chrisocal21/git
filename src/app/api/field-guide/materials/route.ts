import { NextRequest, NextResponse } from 'next/server'
import { createMaterial } from '@/lib/fieldGuideD1'
import { isD1Enabled } from '@/lib/d1'

/**
 * POST /api/field-guide/materials
 * Create a new material
 */
export async function POST(request: NextRequest) {
  if (!isD1Enabled()) {
    // Mock success response for demo mode
    const body = await request.json()
    const { label } = body
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return NextResponse.json(
      { id, label, photo_url: null, sort_order: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { status: 201 }
    )
  }

  try {
    const body = await request.json()
    const { label, photo_url, sort_order } = body

    if (!label) {
      return NextResponse.json(
        { error: 'Material label is required' },
        { status: 400 }
      )
    }

    // Generate ID from label (lowercase, hyphenated slug)
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    const material = await createMaterial({
      id,
      label,
      photo_url: photo_url || null,
      sort_order: sort_order || 0
    })

    // TODO: Sync to Google Sheets (fire-and-forget)

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('[Field Guide] Failed to create material:', error)
    
    // Check if it's a duplicate ID error
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('UNIQUE constraint') || errorMessage.includes('already exists')) {
      return NextResponse.json(
        { error: 'A material with this name already exists' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    )
  }
}
