import { NextRequest, NextResponse } from 'next/server'
import { updateMaterial, deleteMaterial } from '@/lib/fieldGuideD1'
import { isD1Enabled } from '@/lib/d1'

/**
 * PUT /api/field-guide/materials/[id]
 * Update an existing material
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isD1Enabled()) {
    // Mock success response for demo mode
    const body = await request.json()
    const { label, photo_url } = body
    return NextResponse.json(
      { id: params.id, label, photo_url, sort_order: 0, created_at: '2024-01-01', updated_at: new Date().toISOString() },
      { status: 200 }
    )
  }

  const { id } = params

  try {
    const body = await request.json()
    const { label, product_name, product_sku, photo_url, sort_order } = body

    const updates: any = {}
    if (label !== undefined) updates.label = label
    if (product_name !== undefined) updates.product_name = product_name
    if (product_sku !== undefined) updates.product_sku = product_sku
    if (photo_url !== undefined) updates.photo_url = photo_url
    if (sort_order !== undefined) updates.sort_order = sort_order

    const material = await updateMaterial(id, updates)

    // TODO: Sync to Google Sheets (fire-and-forget)

    return NextResponse.json(material)
  } catch (error) {
    console.error('[Field Guide] Failed to update material:', error)
    return NextResponse.json(
      { error: 'Failed to update material' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/field-guide/materials/[id]
 * Delete a material (and all associated settings)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isD1Enabled()) {
    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  }

  const { id } = params

  try {
    await deleteMaterial(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Field Guide] Failed to delete material:', error)
    return NextResponse.json(
      { error: 'Failed to delete material' },
      { status: 500 }
    )
  }
}
