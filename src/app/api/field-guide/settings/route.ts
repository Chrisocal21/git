import { NextResponse } from 'next/server'
import { getAllFieldGuideData } from '@/lib/fieldGuideD1'
import { isD1Enabled } from '@/lib/d1'

/**
 * GET /api/field-guide/settings
 * Returns ALL settings, materials, and machines in one payload
 * This is the primary endpoint for offline-first caching
 */
export async function GET() {
  // Graceful fallback if D1 not configured - return mock data
  if (!isD1Enabled()) {
    console.log('[Field Guide] D1 not enabled, returning mock data')
    return NextResponse.json({
      machines: [
        { id: 'f1', label: 'xTool F1', created_at: '2024-01-01', updated_at: '2024-01-01' }
      ],
      materials: [
        { id: 'leather', label: 'Leather', photo_url: null, sort_order: 0, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'wood', label: 'Wood', photo_url: null, sort_order: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'eco-leather', label: 'Eco Leather', photo_url: null, sort_order: 2, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'cardstock', label: 'Cardstock', photo_url: null, sort_order: 3, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'acrylic', label: 'Acrylic', photo_url: null, sort_order: 4, created_at: '2024-01-01', updated_at: '2024-01-01' }
      ],
      settings: [
        { id: '1', machine_id: 'f1', material_id: 'leather', speed: 400, power: 80, frequency: 40, passes: 1, mode: 'Line', focus_notes: 'Auto focus', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '2', machine_id: 'f1', material_id: 'wood', speed: 300, power: 90, frequency: 50, passes: 1, mode: 'Line', focus_notes: 'Manual +2mm', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '3', machine_id: 'f1', material_id: 'eco-leather', speed: 450, power: 75, frequency: 40, passes: 1, mode: 'Line', focus_notes: 'Auto focus', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '4', machine_id: 'f1', material_id: 'cardstock', speed: 500, power: 60, frequency: 30, passes: 1, mode: 'Fill', focus_notes: 'Auto focus', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '5', machine_id: 'f1', material_id: 'acrylic', speed: 250, power: 95, frequency: 60, passes: 2, mode: 'Line', focus_notes: 'Manual -1mm', created_at: '2024-01-01', updated_at: '2024-01-01' }
      ],
      settings_version: new Date().toISOString()
    })
  }

  try {
    const data = await getAllFieldGuideData()
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    })
  } catch (error) {
    console.error('[Field Guide] Failed to fetch settings:', error)
    
    // Return mock data on error (tables might not exist yet)
    return NextResponse.json({
      machines: [
        { id: 'f1', label: 'xTool F1', created_at: '2024-01-01', updated_at: '2024-01-01' }
      ],
      materials: [
        { id: 'leather', label: 'Leather', photo_url: null, sort_order: 0, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'wood', label: 'Wood', photo_url: null, sort_order: 1, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'eco-leather', label: 'Eco Leather', photo_url: null, sort_order: 2, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'cardstock', label: 'Cardstock', photo_url: null, sort_order: 3, created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: 'acrylic', label: 'Acrylic', photo_url: null, sort_order: 4, created_at: '2024-01-01', updated_at: '2024-01-01' }
      ],
      settings: [
        { id: '1', machine_id: 'f1', material_id: 'leather', speed: 400, power: 80, frequency: 40, passes: 1, mode: 'Line', focus_notes: 'Auto focus', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '2', machine_id: 'f1', material_id: 'wood', speed: 300, power: 90, frequency: 50, passes: 1, mode: 'Line', focus_notes: 'Manual +2mm', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '3', machine_id: 'f1', material_id: 'eco-leather', speed: 450, power: 75, frequency: 40, passes: 1, mode: 'Line', focus_notes: 'Auto focus', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '4', machine_id: 'f1', material_id: 'cardstock', speed: 500, power: 60, frequency: 30, passes: 1, mode: 'Fill', focus_notes: 'Auto focus', created_at: '2024-01-01', updated_at: '2024-01-01' },
        { id: '5', machine_id: 'f1', material_id: 'acrylic', speed: 250, power: 95, frequency: 60, passes: 2, mode: 'Line', focus_notes: 'Manual -1mm', created_at: '2024-01-01', updated_at: '2024-01-01' }
      ],
      settings_version: new Date().toISOString()
    })
  }
}
