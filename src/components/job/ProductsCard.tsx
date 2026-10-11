'use client'

import type { Product } from '@/types/fldr'
import type { JobJigs } from '@/components/jigs/useJobJigs'
import ProductJigs, { JigsProblem } from '@/components/jigs/ProductJigs'
import { EditButton, Field, FieldRow, Offer, RemoveButton, SectionCard, TextAction, useEditMode } from './parts'

interface ProductsCardProps {
  products: Product[]
  job: { id: string; start: string; end: string | null }
  jigs: JobJigs
  /** How many of this job's jigs are checked out */
  jigsOut: number
  /** Gift/s and Gift Qty from Client & Event, offered as the first product */
  gift: { name: string; quantity: number | null } | null
  open: boolean
  onToggle: () => void
  onAdd: (name?: string, quantity?: number) => void
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
  gift,
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
          .join(', ') || "What's being made, and the jigs it needs"
      }
      meta={jigsOut > 0 && <span className="badge bg-amber-500/15 text-amber-300">{jigsOut} out</span>}
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/45">
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

        {gift && !hasData && (
          <Offer
            action="Add"
            onUse={() => {
              onAdd(gift.name, gift.quantity ?? undefined)
              startEditing()
            }}
          >
            From Gift/s: {gift.name}
            {gift.quantity ? ` ×${gift.quantity}` : ''}
          </Offer>
        )}

        <JigsProblem jigs={jigs} />

        {products.map((product, index) => (
          <div key={product.id} className="rounded-xl border border-line bg-white/5 p-3">
            {editing ? (
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={product.name}
                    onChange={e => onField(index, 'name', e.target.value)}
                    className="input flex-1 font-medium"
                    aria-label="Product name"
                    placeholder="Product name, e.g. YETI Rambler 20oz"
                  />
                  <RemoveButton label={`Remove ${product.name || 'product'}`} onClick={() => onRemove(index)} />
                </div>
                <FieldRow always>
                  <Field label="Item Number (SKU)">
                    <input type="text" value={product.sku || ''} onChange={e => onField(index, 'sku', e.target.value)} className="input" placeholder="e.g. YRAM20-BLK" />
                  </Field>
                  <Field label="Quantity">
                    <input type="number" min="1" inputMode="numeric" value={product.quantity} onChange={e => onField(index, 'quantity', e.target.value)} className="input" />
                  </Field>
                </FieldRow>
                <Field label="Product Notes">
                  <input type="text" value={product.notes || ''} onChange={e => onField(index, 'notes', e.target.value)} className="input" placeholder="e.g. Engrave on the side opposite the logo" />
                </Field>
              </div>
            ) : (
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`min-w-0 break-words text-base font-medium ${product.name ? 'text-white' : 'text-white/40'}`}>
                    {product.name || 'Unnamed product'}
                  </span>
                  <span className="flex-shrink-0 text-base font-semibold tabular text-white/80">×{product.quantity}</span>
                </div>
                {(product.sku || product.notes) && (
                  <div className="mt-0.5 break-words text-sm text-white/50">
                    {[product.sku && `Item number ${product.sku}`, product.notes].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            )}
            <ProductJigs jigs={jigs} job={job} productId={product.id} productName={product.name} />
          </div>
        ))}

        {products.length === 0 && !gift && <p className="py-1 text-sm text-white/40">No products yet. Add each thing being personalized, then the jigs it needs.</p>}

        {/* Jigs whose product has since been removed stay on the job, so nothing that's out can vanish */}
        <div className="empty:hidden">
          <ProductJigs jigs={jigs} job={job} productId={null} knownProductIds={products.map(p => p.id)} />
        </div>

        {editing && !jigsOpen && (
          <div>
            <TextAction onClick={onRemoveSection} tone="danger">
              Remove Products from this job
            </TextAction>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
