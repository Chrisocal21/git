'use client'

import { useEffect, useRef } from 'react'
import type { ChecklistItem } from '@/types/fldr'
import { SectionCard, TextAction } from './parts'

interface ChecklistCardProps {
  items: ChecklistItem[]
  /** Days until the job starts, or null once it has */
  daysUntil: number | null
  open: boolean
  onToggle: () => void
  onAdd: () => void
  onText: (index: number, value: string) => void
  onCheck: (index: number) => void
  onRemove: (index: number) => void
  onRemoveSection: () => void
  /** Pushes what's been typed when a line is left */
  onCommit: () => void
}

export default function ChecklistCard({
  items,
  daysUntil,
  open,
  onToggle,
  onAdd,
  onText,
  onCheck,
  onRemove,
  onRemoveSection,
  onCommit,
}: ChecklistCardProps) {
  const done = items.filter(item => item.completed).length
  const listRef = useRef<HTMLDivElement>(null)
  const focusNewRef = useRef(false)

  // A line that was just added is ready to type into
  useEffect(() => {
    if (!focusNewRef.current) return
    focusNewRef.current = false
    const inputs = listRef.current?.querySelectorAll<HTMLInputElement>('input[type="text"]')
    inputs?.[inputs.length - 1]?.focus()
  }, [items.length])

  const urgency =
    daysUntil === null || daysUntil < 0
      ? null
      : daysUntil <= 2
      ? 'border-red-500/20 bg-red-500/10 text-red-400'
      : daysUntil <= 7
      ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
      : 'border-green-500/20 bg-green-500/10 text-green-400'

  return (
    <SectionCard
      id="checklist"
      title="Checklist"
      open={open}
      onToggle={onToggle}
      progress={items.length > 0 ? done / items.length : undefined}
      meta={
        items.length > 0 && (
          <span className={`text-xs font-semibold tabular ${done === items.length ? 'text-emerald-300' : 'text-white/55'}`}>
            {done}/{items.length}
          </span>
        )
      }
    >
      <div className="space-y-3">
        {urgency && daysUntil !== null && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${urgency}`}>
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium">
              {daysUntil === 0 ? 'Job is today!' : daysUntil === 1 ? '1 day until job' : `${daysUntil} days until job`}
            </p>
          </div>
        )}

        <div ref={listRef} className="divide-y divide-line">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => onCheck(index)}
                aria-label={item.item || 'Checklist item'}
                className="h-[18px] w-[18px] flex-shrink-0 rounded"
              />
              <input
                type="text"
                value={item.item}
                onChange={e => onText(index, e.target.value)}
                onBlur={onCommit}
                className={`-mx-2 min-w-0 flex-1 rounded-lg bg-transparent px-2 py-2 text-sm transition-colors placeholder:text-white/30 focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                  item.completed ? 'text-white/40 line-through' : 'text-white/90'
                }`}
                placeholder="Item"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item.item || 'item'}`}
                className="-mr-2 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-base leading-none text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {items.length === 0 && <p className="text-xs text-white/40">No items yet</p>}

        <div className="flex items-center justify-between gap-3">
          <TextAction
            onClick={() => {
              focusNewRef.current = true
              onAdd()
            }}
          >
            + Add Item
          </TextAction>
          <TextAction onClick={onRemoveSection} tone="danger">
            Remove Checklist from this job
          </TextAction>
        </div>
      </div>
    </SectionCard>
  )
}
