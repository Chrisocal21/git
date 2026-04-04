'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Machine, Material, Setting } from '@/lib/fieldGuideD1'

interface FieldGuideData {
  machines: Machine[]
  materials: Material[]
  settings: Setting[]
  settings_version: string
}

export default function SettingsCardPage({ params }: { params: { materialId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [data, setData] = useState<FieldGuideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [showEditMaterial, setShowEditMaterial] = useState(false)
  const materialId = params.materialId
  const machineId = searchParams.get('machine') || 'f1'

  // Material edit form state
  const [editMaterialLabel, setEditMaterialLabel] = useState('')
  const [editProductName, setEditProductName] = useState('')
  const [editProductSku, setEditProductSku] = useState('')

  // Settings form state
  const [speed, setSpeed] = useState('')
  const [power, setPower] = useState('')
  const [frequency, setFrequency] = useState('')
  const [passes, setPasses] = useState('')
  const [mode, setMode] = useState('Fill')
  const [focusNotes, setFocusNotes] = useState('')
  const [dimensions, setDimensions] = useState('')
  const [notes, setNotes] = useState('')
  const [updatedBy, setUpdatedBy] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const response = await fetch(`/api/field-guide/settings?t=${Date.now()}`, {
        cache: 'no-store'
      })
      if (!response.ok) throw new Error('Failed to load')
      const json = await response.json()
      setData(json)
      
      // Pre-populate material edit form
      const existingMaterial = json.materials.find((m: Material) => m.id === materialId)
      if (existingMaterial) {
        setEditMaterialLabel(existingMaterial.label || '')
        setEditProductName(existingMaterial.product_name || '')
        setEditProductSku(existingMaterial.product_sku || '')
      }

      // Pre-populate settings form if setting exists
      const existingSetting = json.settings.find(
        (s: Setting) => s.machine_id === machineId && s.material_id === materialId
      )
      if (existingSetting) {
        setSpeed(existingSetting.speed || '')
        setPower(existingSetting.power || '')
        setFrequency(existingSetting.frequency || '')
        setPasses(existingSetting.passes?.toString() || '')
        setMode(existingSetting.mode || 'Fill')
        setFocusNotes(existingSetting.focus_notes || '')
        setDimensions(existingSetting.dimensions || '')
        setNotes(existingSetting.notes || '')
        setUpdatedBy(existingSetting.updated_by || '')
      }
    } catch (error) {
      console.error('Failed to load Field Guide data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/field-guide/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machineId,
          material_id: materialId,
          speed: speed.trim() || null,
          power: power.trim() || null,
          frequency: frequency.trim() || null,
          passes: passes ? parseInt(passes) : null,
          mode: mode.trim() || null,
          focus_notes: focusNotes.trim() || null,
          dimensions: dimensions.trim() || null,
          notes: notes.trim() || null,
          updated_by: updatedBy.trim() || null
        })
      })
      
      if (!response.ok) throw new Error('Failed to save')
      
      await loadData()
      router.refresh()
      setShowForm(false)
      
      // Force hard refresh to show changes immediately
      setTimeout(() => window.location.reload(), 100)
    } catch (error) {
      console.error('Failed to save setting:', error)
      alert('Failed to save setting')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${data?.materials.find(m => m.id === materialId)?.label}"? This will also delete all associated settings.`)) {
      return
    }

    try {
      const response = await fetch(`/api/field-guide/materials/${materialId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete')
      
      // Hard reload to main page
      window.location.href = '/field-guide'
    } catch (error) {
      console.error('Failed to delete material:', error)
      alert('Failed to delete material')
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/field-guide/materials/${materialId}/photo`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload photo')
      }

      // Reload data to show new photo
      setTimeout(() => window.location.reload(), 100)
    } catch (error: any) {
      console.error('Failed to upload photo:', error)
      alert(error.message || 'Failed to upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function handlePhotoDelete() {
    if (!confirm('Remove photo?')) return

    try {
      const response = await fetch(`/api/field-guide/materials/${materialId}/photo`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete photo')

      // Reload data to show photo removed
      setTimeout(() => window.location.reload(), 100)
    } catch (error) {
      console.error('Failed to delete photo:', error)
      alert('Failed to delete photo')
    }
  }

  async function handleMaterialUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editMaterialLabel.trim()) return

    setSaving(true)
    try {
      const response = await fetch(`/api/field-guide/materials/${materialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: editMaterialLabel.trim(),
          product_name: editProductName.trim() || null,
          product_sku: editProductSku.trim() || null
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update material')
      }

      setShowEditMaterial(false)
      // Reload to show changes
      setTimeout(() => window.location.reload(), 100)
    } catch (error: any) {
      console.error('Failed to update material:', error)
      alert(error.message || 'Failed to update material')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading settings...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-red-400">Failed to load settings</div>
      </div>
    )
  }

  const material = data.materials.find(m => m.id === materialId)
  const machine = data.machines.find(m => m.id === machineId)
  const setting = data.settings.find(
    s => s.machine_id === machineId && s.material_id === materialId
  )

  if (!material || !machine) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <div className="max-w-lg mx-auto px-4 py-6">
          <button
            onClick={() => router.back()}
            className="text-[#E8B44D] hover:underline mb-4"
          >
            ← Back
          </button>
          <div className="text-center py-12 text-gray-400">
            Material not found
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Back Button & Refresh */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="text-[#E8B44D] hover:underline flex items-center gap-2"
          >
            <span>←</span>
            <span>Back to materials</span>
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-gray-500 hover:text-[#E8B44D] transition-colors"
            title="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{material.label}</h1>
            <p className="text-sm text-gray-400">{machine.label}</p>
          </div>
          <button
            onClick={handleDelete}
            className="text-red-500 hover:text-red-400 transition-colors text-sm"
            title="Delete Material"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Material Photo */}
        <div className="mb-6">
          {material.photo_url ? (
            <div className="relative rounded-lg overflow-hidden border border-[#2a2a2a]">
              <img
                src={material.photo_url}
                alt={material.label}
                className="w-full h-48 object-cover"
              />
              <button
                onClick={handlePhotoDelete}
                className="absolute top-2 right-2 bg-black/70 hover:bg-red-600/70 text-white p-2 rounded-lg transition-colors"
                title="Remove photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <label className="block cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadingPhoto}
                className="hidden"
              />
              <div className="border-2 border-dashed border-[#2a2a2a] rounded-lg p-8 text-center hover:border-[#E8B44D] transition-colors">
                {uploadingPhoto ? (
                  <div className="text-gray-400">Uploading photo...</div>
                ) : (
                  <>
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 text-sm">
                      Click to upload photo
                    </p>
                    <p className="text-gray-600 text-xs mt-1">
                      Max 5MB
                    </p>
                  </>
                )}
              </div>
            </label>
          )}
        </div>

        {/* Material Info Section */}
        {!showEditMaterial ? (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Material Info</h2>
              <button
                onClick={() => setShowEditMaterial(true)}
                className="text-[#E8B44D] hover:underline text-sm"
              >
                Edit
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Name</div>
                <div className="text-white">{material.label}</div>
              </div>
              {material.product_name && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Product Name</div>
                  <div className="text-white">{material.product_name}</div>
                </div>
              )}
              {material.product_sku && (
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">SKU</div>
                  <div className="text-white">{material.product_sku}</div>
                </div>
              )}
              {!material.product_name && !material.product_sku && (
                <p className="text-sm text-gray-500">No product details set</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Edit Material Info</h2>
            <form onSubmit={handleMaterialUpdate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Material Name *</label>
                <input
                  type="text"
                  value={editMaterialLabel}
                  onChange={(e) => setEditMaterialLabel(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Product Name</label>
                <input
                  type="text"
                  value={editProductName}
                  onChange={(e) => setEditProductName(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  placeholder="e.g., Premium Cowhide Leather"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">SKU</label>
                <input
                  type="text"
                  value={editProductSku}
                  onChange={(e) => setEditProductSku(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  placeholder="e.g., LTH-001"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditMaterial(false)
                    // Reset to current values
                    setEditMaterialLabel(material.label)
                    setEditProductName(material.product_name || '')
                    setEditProductSku(material.product_sku || '')
                  }}
                  className="flex-1 border border-[#2a2a2a] px-6 py-3 rounded-lg font-medium hover:bg-[#1a1a1a] transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E8B44D] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#d4a347] transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Settings Display (when not editing) */}
        {!showForm && setting && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 space-y-6 mb-4">
            {/* Speed */}
            {setting.speed && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Speed</div>
                <div className="text-3xl font-bold text-[#E8B44D]">{setting.speed}</div>
              </div>
            )}

            {/* Power */}
            {setting.power && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Power</div>
                <div className="text-3xl font-bold text-[#E8B44D]">{setting.power}%</div>
              </div>
            )}

            {/* Frequency */}
            {setting.frequency && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Frequency</div>
                <div className="text-3xl font-bold text-white">{setting.frequency} kHz</div>
              </div>
            )}

            {/* Passes */}
            {setting.passes && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Passes</div>
                <div className="text-3xl font-bold text-white">{setting.passes}</div>
              </div>
            )}

            {/* Mode */}
            {setting.mode && (
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Mode</div>
                <div className="text-lg font-medium text-white">{setting.mode}</div>
              </div>
            )}

            {/* Focus Notes */}
            {setting.focus_notes && (
              <div className="pt-4 border-t border-[#2a2a2a]">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Focus</div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{setting.focus_notes}</div>
              </div>
            )}

            {/* Dimensions */}
            {setting.dimensions && (
              <div className="pt-4 border-t border-[#2a2a2a]">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Dimensions (caracture size output)</div>
                <div className="text-sm text-gray-300">{setting.dimensions}</div>
              </div>
            )}

            {/* Notes */}
            {setting.notes && (
              <div className="pt-4 border-t border-[#2a2a2a]">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Notes</div>
                <div className="text-sm text-gray-300 whitespace-pre-wrap">{setting.notes}</div>
              </div>
            )}

            {/* Updated info */}
            {setting.updated_by && (
              <div className="pt-4 border-t border-[#2a2a2a] text-xs text-gray-500">
                Last updated by {setting.updated_by}
              </div>
            )}
          </div>
        )}

        {/* Edit Button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-[#E8B44D] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#d4a347] transition-colors"
          >
            {setting ? 'Edit Settings' : '+ Add Settings'}
          </button>
        )}

        {/* Settings Form (when editing) */}
        {showForm && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4">
              {setting ? 'Edit Settings' : 'Add Settings'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Speed (mm/s)</label>
                  <input
                    type="text"
                    value={speed}
                    onChange={(e) => setSpeed(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                    placeholder="e.g., 100 or 75-80"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Power (%)</label>
                  <input
                    type="text"
                    value={power}
                    onChange={(e) => setPower(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                    placeholder="e.g., 80 or 70-75"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Frequency (kHz)</label>
                  <input
                    type="text"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                    placeholder="e.g., 40"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Passes</label>
                  <input
                    type="number"
                    value={passes}
                    onChange={(e) => setPasses(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                    placeholder="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                >
                  <option value="Fill">Fill</option>
                  <option value="Line">Line</option>
                  <option value="Fill + Line">Fill + Line</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Focus Notes</label>
                <input
                  type="text"
                  value={focusNotes}
                  onChange={(e) => setFocusNotes(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  placeholder="e.g., Auto focus, Manual +2mm"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Dimensions (caracture size output)</label>
                <input
                  type="text"
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  placeholder="e.g., 12x12x3mm or 12in x 12in"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none resize-none"
                  placeholder="Additional notes..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Updated By</label>
                <input
                  type="text"
                  value={updatedBy}
                  onChange={(e) => setUpdatedBy(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  placeholder="Your name"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 border border-[#2a2a2a] px-6 py-3 rounded-lg font-medium hover:bg-[#1a1a1a] transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#E8B44D] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#d4a347] transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
