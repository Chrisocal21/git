'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Machine, Material, Setting } from '@/lib/fieldGuideD1'

interface FieldGuideData {
  machines: Machine[]
  materials: Material[]
  settings: Setting[]
  settings_version: string
}

export default function FieldGuidePage() {
  const router = useRouter()
  const [data, setData] = useState<FieldGuideData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showMaterialForm, setShowMaterialForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const selectedMachine = 'f1' // Default to F1
  
  // Material form state
  const [materialId, setMaterialId] = useState('')
  const [materialLabel, setMaterialLabel] = useState('')

  // Load data on mount
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
    } catch (error) {
      console.error('Failed to load Field Guide data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleMaterialClick(materialId: string) {
    router.push(`/field-guide/${materialId}?machine=${selectedMachine}`)
  }

  async function handleMaterialSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!materialLabel.trim()) return

    // Generate slug from label
    const slug = materialLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    
    setSaving(true)
    try {
      const response = await fetch('/api/field-guide/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slug,
          label: materialLabel.trim()
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create material')
      }
      
      await loadData()
      router.refresh()
      setMaterialId('')
      setMaterialLabel('')
      setShowMaterialForm(false)
      
      // Force hard refresh to bypass all caching
      setTimeout(() => window.location.reload(), 100)
    } catch (error: any) {
      console.error('Failed to create material:', error)
      alert(error.message || 'Failed to create material')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading Field Guide...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-red-400">Failed to load Field Guide</div>
      </div>
    )
  }

  const selectedMachineObj = data.machines.find(m => m.id === selectedMachine)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-[#E8B44D]">Field Guide</h1>
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
        </div>
      </div>

      {/* Material Grid */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {data.materials.map(material => {
            const hasSetting = data.settings.some(
              s => s.machine_id === selectedMachine && s.material_id === material.id
            )

            return (
              <button
                key={material.id}
                onClick={() => handleMaterialClick(material.id)}
                className={`relative aspect-square rounded-lg overflow-hidden border transition-all ${
                  hasSetting
                    ? 'border-[#2a2a2a] hover:border-[#E8B44D] cursor-pointer'
                    : 'border-[#1a1a1a] opacity-40 cursor-pointer'
                }`}
              >
                {/* Photo */}
                {material.photo_url ? (
                  <img
                    src={material.photo_url}
                    alt={material.label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#1a1a1a] flex items-center justify-center">
                    <span className="text-4xl">📦</span>
                  </div>
                )}

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
                  <p className="text-sm font-medium text-white">{material.label}</p>
                </div>

                {/* "No settings" indicator */}
                {!hasSetting && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <p className="text-xs text-gray-400">No settings</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {data.materials.length === 0 && !showMaterialForm && (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-4">No materials configured yet.</p>
            <button
              onClick={() => setShowMaterialForm(true)}
              className="bg-[#E8B44D] text-black px-6 py-3 rounded-lg font-medium hover:bg-[#d4a347] transition-colors"
            >
              + Add Your First Material
            </button>
          </div>
        )}

        {/* Material Form */}
        {showMaterialForm && (
          <div className="mt-6 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Add Material</h2>
            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Material Name *</label>
                <input
                  type="text"
                  value={materialLabel}
                  onChange={(e) => setMaterialLabel(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white focus:border-[#E8B44D] focus:outline-none"
                  placeholder="e.g., Leather, Wood, Acrylic"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialForm(false)
                    setMaterialLabel('')
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
                  {saving ? 'Adding...' : 'Add Material'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Floating Add Button */}
      {!showMaterialForm && data.materials.length > 0 && (
        <button
          onClick={() => setShowMaterialForm(true)}
          className="fixed bottom-20 right-4 w-14 h-14 bg-[#E8B44D] text-black rounded-full shadow-lg flex items-center justify-center hover:bg-[#d4a347] transition-all hover:scale-110"
          title="Add Material"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
