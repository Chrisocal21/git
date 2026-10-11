'use client'

import type { Product } from '@/types/fldr'
import type { JobJigs } from '@/components/jigs/useJobJigs'
import ProductJigs, { JigsProblem } from '@/components/jigs/ProductJigs'
import { EditButton, Field, FieldRow, SectionCard, TextAction, useEditMode } from './parts'

interface ProductsCardProps {
  products: Product[]
  job: { id: string; start: string; end: string | null }
  jigs: JobJigs
  /** How many of this job's jigs are checked out */
  jigsOut: number
  open: boolean
  onToggle: () => void
  onAdd: () => void
  onField: (index: number, field: keyof Product, value: any) => void
  onRemove: (index: number) => void
  onRemoveSection: () => void
  onDone: () => void
}

/** What's being made on the job, with the jigs each product needs underneath it */
export default function ProductsCard({
  products,
  job,
  jigs,
  jigsOut,
  open,
  onToggle,
  onAdd,
  onField,
  onRemove,
  onRemoveSection,
  onDone,
}: ProductsCardProps) {
  const hasData = products.some(p => p.name)
  const { editing, toggle, startEditing } = useEditMode(hasData, open, onDone)
  const total = products.reduce((sum, p) => sum + (p.quantity || 0), 0)
  // Jigs live under the products, so the section stays while any are planned or out
  const jigsOpen = jigs.allocations.some(a => a.status === 'needed' || a.status === 'out')

  return (
    <SectionCard
      id="products"
      title="Products"
      open={open}
      onToggle={onToggle}
      summary={
        products
          .filter(p => p.name)
          .map(p => `${p.name} ×${p.quantity}`)
          .join(', ') || undefined
      }
      meta={jigsOut > 0 && <span className="badge bg-amber-500/15 text-amber-300">{jigsOut} out</span>}
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/45">
            {products.length} {products.length === 1 ? 'product' : 'products'}
            {products.length > 1 && total > 0 && <span className="tabular"> · {total} total</span>}
          </span>
          <TextAction
            onClick={() => {
              onAdd()
              startEditing()
            }}
          >
            + Add Product
          </TextAction>
        </div>

        <JigsProblem jigs={jigs} />

        {products.map((product, index) => (
          <div key={product.id} className="rounded-xl border border-line bg-white/5 p-3">
            {editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={product.name}
                    onChange={e => onField(index, 'name', e.target.value)}
                    className="input flex-1 font-medium"
                    placeholder="Product name"
                  />
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove ${product.name || 'product'}`}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg leading-none text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
                <FieldRow always>
                  <Field label="SKU">
                    <input type="text" value={product.sku || ''} onChange={e => onField(index, 'sku', e.target.value)} className="input" placeholder="SKU" />
                  </Field>
                  <Field label="Quantity">
                    <input type="number" min="1" value={product.quantity} onChange={e => onField(index, 'quantity', e.target.value)} className="input" />
                  </Field>
                </FieldRow>
                <Field label="Notes">
                  <input type="text" value={product.notes || ''} onChange={e => onField(index, 'notes', e.target.value)} className="input" placeholder="Notes (optional)" />
                </Field>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 break-words text-sm font-medium ${product.name ? 'text-white' : 'text-white/40'}`}>
                    {product.name || 'Unnamed product'}
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold tabular text-white/80">×{product.quantity}</span>
                </div>
                {(product.sku || product.notes) && (
                  <div className="mt-0.5 break-words text-xs text-white/50">
                    {[product.sku && `SKU ${product.sku}`, product.notes].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}
            <ProductJigs jigs={jigs} job={job} productId={product.id} productName={product.name} />
          </div>
        ))}

        {products.length === 0 && <p className="py-1 text-xs text-white/40">No products yet</p>}

        {/* Jigs whose product has since been removed stay on the job, so nothing that's out can vanish */}
        <div className="empty:hidden">
          <ProductJigs jigs={jigs} job={job} productId={null} knownProductIds={products.map(p => p.id)} />
        </div>

        {editing && !jigsOpen && (
          <div className="pt-1">
            <TextAction onClick={onRemoveSection} tone="danger">
              Remove Products from this job
            </TextAction>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
