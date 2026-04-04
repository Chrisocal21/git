import { NextRequest, NextResponse } from 'next/server'
import { updateMaterial } from '@/lib/fieldGuideD1'
import { isD1Enabled } from '@/lib/d1'

/**
 * POST /api/field-guide/materials/[id]/photo
 * Upload a photo for a material (stores as base64 data URL for now)
 * TODO: Migrate to R2 storage when ready
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Convert to base64 data URL for now
    // TODO: Upload to R2 instead
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    if (!isD1Enabled()) {
      return NextResponse.json({ photo_url: dataUrl })
    }

    // Update material with photo URL
    const material = await updateMaterial(params.id, {
      photo_url: dataUrl
    })

    return NextResponse.json({ photo_url: material.photo_url })
  } catch (error) {
    console.error('[Field Guide] Failed to upload photo:', error)
    return NextResponse.json(
      { error: 'Failed to upload photo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/field-guide/materials/[id]/photo
 * Remove photo from a material
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isD1Enabled()) {
    return NextResponse.json({ success: true })
  }

  try {
    await updateMaterial(params.id, {
      photo_url: null
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Field Guide] Failed to delete photo:', error)
    return NextResponse.json(
      { error: 'Failed to delete photo' },
      { status: 500 }
    )
  }
}
