/**
 * Field Guide D1 Database Client
 * Handles all database operations for laser engraving settings
 */

import { queryD1, isD1Enabled } from './d1'

// ============================================================
// TYPES
// ============================================================

export interface Machine {
  id: string
  label: string
}

export interface Material {
  id: string
  label: string
  product_name: string | null
  product_sku: string | null
  photo_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Setting {
  id: string
  machine_id: string
  material_id: string
  speed: string | null
  power: string | null
  frequency: string | null
  passes: number | null
  mode: string | null
  focus_notes: string | null
  notes: string | null
  updated_by: string | null
  updated_at: string
}

export interface Product {
  id: string
  label: string
  material_id: string
  photo_url: string | null
  notes: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface FieldGuideData {
  machines: Machine[]
  materials: Material[]
  settings: Setting[]
  settings_version: string
}

// ============================================================
// MACHINES
// ============================================================

export async function getMachines(): Promise<Machine[]> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  return await queryD1('SELECT * FROM fg_machines ORDER BY id')
}

// ============================================================
// MATERIALS
// ============================================================

export async function getMaterials(): Promise<Material[]> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  return await queryD1('SELECT * FROM fg_materials ORDER BY sort_order, label')
}

export async function getMaterialById(id: string): Promise<Material | null> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  const results = await queryD1('SELECT * FROM fg_materials WHERE id = ?', [id])
  return results[0] || null
}

export async function createMaterial(data: {
  id: string
  label: string
  product_name?: string | null
  product_sku?: string | null
  photo_url?: string | null
  sort_order?: number
}): Promise<Material> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  
  await queryD1(
    `INSERT INTO fg_materials (id, label, product_name, product_sku, photo_url, sort_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.id,
      data.label,
      data.product_name || null,
      data.product_sku || null,
      data.photo_url || null,
      data.sort_order || 0
    ]
  )
  
  const material = await getMaterialById(data.id)
  if (!material) {
    throw new Error('Failed to create material')
  }
  
  return material
}

export async function updateMaterial(
  id: string,
  data: Partial<Pick<Material, 'label' | 'product_name' | 'product_sku' | 'photo_url' | 'sort_order'>>
): Promise<Material> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  
  const updates: string[] = []
  const params: any[] = []
  
  if (data.label !== undefined) {
    updates.push('label = ?')
    params.push(data.label)
  }
  if (data.product_name !== undefined) {
    updates.push('product_name = ?')
    params.push(data.product_name)
  }
  if (data.product_sku !== undefined) {
    updates.push('product_sku = ?')
    params.push(data.product_sku)
  }
  if (data.photo_url !== undefined) {
    updates.push('photo_url = ?')
    params.push(data.photo_url)
  }
  if (data.sort_order !== undefined) {
    updates.push('sort_order = ?')
    params.push(data.sort_order)
  }
  
  updates.push('updated_at = datetime("now")')
  params.push(id)
  
  await queryD1(
    `UPDATE fg_materials SET ${updates.join(', ')} WHERE id = ?`,
    params
  )
  
  const material = await getMaterialById(id)
  if (!material) {
    throw new Error('Material not found after update')
  }
  
  return material
}

export async function deleteMaterial(id: string): Promise<void> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  
  // Delete associated settings first
  await queryD1('DELETE FROM fg_settings WHERE material_id = ?', [id])
  
  // Then delete the material
  await queryD1('DELETE FROM fg_materials WHERE id = ?', [id])
}

// ============================================================
// SETTINGS
// ============================================================

export async function getSettings(): Promise<Setting[]> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  return await queryD1('SELECT * FROM fg_settings ORDER BY material_id, machine_id')
}

export async function getSettingById(id: string): Promise<Setting | null> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  const results = await queryD1('SELECT * FROM fg_settings WHERE id = ?', [id])
  return results[0] || null
}

export async function getSettingByMachineAndMaterial(
  machineId: string,
  materialId: string
): Promise<Setting | null> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  const results = await queryD1(
    'SELECT * FROM fg_settings WHERE machine_id = ? AND material_id = ?',
    [machineId, materialId]
  )
  return results[0] || null
}

export async function createSetting(data: {
  id: string
  machine_id: string
  material_id: string
  speed?: string | null
  power?: string | null
  frequency?: string | null
  passes?: number | null
  mode?: string | null
  focus_notes?: string | null
  notes?: string | null
  updated_by?: string | null
}): Promise<Setting> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  
  await queryD1(
    `INSERT INTO fg_settings (
      id, machine_id, material_id, speed, power, frequency, 
      passes, mode, focus_notes, notes, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.id,
      data.machine_id,
      data.material_id,
      data.speed || null,
      data.power || null,
      data.frequency || null,
      data.passes || null,
      data.mode || null,
      data.focus_notes || null,
      data.notes || null,
      data.updated_by || null
    ]
  )
  
  const setting = await getSettingById(data.id)
  if (!setting) {
    throw new Error('Failed to create setting')
  }
  
  return setting
}

export async function updateSetting(
  id: string,
  data: Partial<Omit<Setting, 'id' | 'machine_id' | 'material_id' | 'updated_at'>>
): Promise<Setting> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  
  const updates: string[] = []
  const params: any[] = []
  
  const fields = ['speed', 'power', 'frequency', 'passes', 'mode', 'focus_notes', 'notes', 'updated_by']
  
  for (const field of fields) {
    if (field in data) {
      updates.push(`${field} = ?`)
      params.push((data as any)[field])
    }
  }
  
  updates.push('updated_at = datetime("now")')
  params.push(id)
  
  await queryD1(
    `UPDATE fg_settings SET ${updates.join(', ')} WHERE id = ?`,
    params
  )
  
  const setting = await getSettingById(id)
  if (!setting) {
    throw new Error('Setting not found after update')
  }
  
  return setting
}

// ============================================================
// COMBINED DATA (FOR CACHING)
// ============================================================

export async function getAllFieldGuideData(): Promise<FieldGuideData> {
  if (!isD1Enabled()) {
    throw new Error('D1 not enabled')
  }
  
  const [machines, materials, settings] = await Promise.all([
    getMachines(),
    getMaterials(),
    getSettings()
  ])
  
  return {
    machines,
    materials,
    settings,
    settings_version: new Date().toISOString()
  }
}
