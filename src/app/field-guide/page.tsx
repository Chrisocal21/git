'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Machine, Material, Setting } from '@/lib/fieldGuideD1'
import PageHeader from '@/components/PageHeader'

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
  const [productName, setProductName] = useState('')
  const [productSku, setProductSku] = useState('')

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
          label: materialLabel.trim(),
          product_name: productName.trim() || null,
          product_sku: productSku.trim() || null
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
      setProductName('')
      setProductSku('')
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
      <div className="min-h-page text-white flex items-center justify-center">
        <div className="text-sm text-white/50">Loading Field Guide...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-page text-white flex items-center justify-center">
        <div className="text-sm text-red-400">Failed to load Field Guide</div>
      </div>
    )
  }

  const selectedMachineObj = data.machines.find(m => m.id === selectedMachine)

  return (
    <div className="min-h-page text-white">
      <PageHeader
        title="Field Guide"
        width="max-w-lg"
        actions={
          <button
            onClick={() => window.location.reload()}
            className="icon-btn"
            title="Refresh"
            aria-label="Refresh"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        }
      />

      {/* Material Grid */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-3">
          {data.materials.map(material => {
            const hasSetting = data.settings.some(
              s => s.machine_id === selectedMachine && s.material_id === material.id
            )

            return (
              <button
                key={material.id}
                onClick={() => handleMaterialClick(material.id)}
                className={`relative aspect-square rounded-2xl overflow-hidden border transition-colors ${
                  hasSetting
                    ? 'border-line-strong hover:border-gold cursor-pointer'
                    : 'border-line opacity-50 cursor-pointer'
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
                  <div className="w-full h-full bg-surface flex items-center justify-center">
                    <svg className="w-10 h-10 text-white/15 -mt-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pt-8 pb-3 text-left">
                  <p className="text-sm font-semibold text-white">{material.label}</p>
                  {material.product_name && (
                    <p className="text-xs text-white/70 mt-0.5">{material.product_name}</p>
                  )}
                  {material.product_sku && (
                    <p className="text-[11px] text-white/50 mt-0.5 font-mono">SKU: {material.product_sku}</p>
                  )}
                </div>

                {/* "No settings" indicator */}
                {!hasSetting && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <p className="eyebrow text-white/60">No settings</p>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {data.materials.length === 0 && !showMaterialForm && (
          <div className="text-center py-16 text-white/55">
            <p className="mb-5">No materials configured yet.</p>
            <button
              onClick={() => setShowMaterialForm(true)}
              className="btn-primary px-6 py-3"
            >
              + Add Your First Material
            </button>
          </div>
        )}

        {/* Material Form */}
        {showMaterialForm && (
          <div className="card shadow-card mt-6 p-5">
            <h2 className="text-base font-semibold mb-4">Add Material</h2>
            <form onSubmit={handleMaterialSubmit} className="space-y-4">
              <div>
                <label className="label">Material Name *</label>
                <input
                  type="text"
                  value={materialLabel}
                  onChange={(e) => setMaterialLabel(e.target.value)}
                  className="input"
                  placeholder="e.g., Leather, Wood, Acrylic"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="label">Product Name</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="input"
                  placeholder="e.g., Premium Cowhide Leather"
                />
              </div>

              <div>
                <label className="label">SKU</label>
                <input
                  type="text"
                  value={productSku}
                  onChange={(e) => setProductSku(e.target.value)}
                  className="input"
                  placeholder="e.g., LTH-001"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMaterialForm(false)
                    setMaterialLabel('')
                    setProductName('')
                    setProductSku('')
                  }}
                  className="btn-secondary flex-1 py-3"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 py-3"
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
          className="fixed bottom-28 right-4 z-40 w-14 h-14 bg-gold text-black rounded-full shadow-pop flex items-center justify-center hover:bg-gold-hover transition-colors"
          title="Add Material"
          aria-label="Add Material"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
