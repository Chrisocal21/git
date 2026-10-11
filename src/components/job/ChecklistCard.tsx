'use client'

import { useEffect, useRef } from 'react'
import type { ChecklistItem } from '@/types/fldr'
import { ClockIcon } from '@/components/Icons'
import { RemoveButton, SectionCard, TextAction } from './parts'

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
      ? 'border-red-500/20 bg-red-500/10 text-red-300'
      : daysUntil <= 7
      ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300'
      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'

  return (
    <SectionCard
      id="checklist"
      title="Checklist"
      open={open}
      onToggle={onToggle}
      progress={items.length > 0 ? done / items.length : undefined}
      summary={items.length === 0 ? 'Things to pack or do before the job' : undefined}
      meta={
        items.length > 0 && (
          <span className={`text-sm font-semibold tabular ${done === items.length ? 'text-emerald-300' : 'text-white/55'}`}>
            {done} of {items.length}
          </span>
        )
      }
    >
      <div className="space-y-3">
        {urgency && daysUntil !== null && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${urgency}`}>
            <ClockIcon className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm font-medium">
              {daysUntil === 0 ? 'Job is today!' : daysUntil === 1 ? '1 day until job' : `${daysUntil} days until job`}
            </p>
          </div>
        )}

        <div ref={listRef} className="divide-y divide-line">
          {items.map((item, index) => (
            <div key={index} className="flex items-center">
              {/* The label makes the whole 44px square tick the box */}
              <label className="-ml-2.5 flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => onCheck(index)}
                  aria-label={item.item || 'Checklist item'}
                  className="h-5 w-5 rounded"
                />
              </label>
              <input
                type="text"
                value={item.item}
                onChange={e => onText(index, e.target.value)}
                onBlur={onCommit}
                aria-label="Checklist item text"
                className={`min-h-[2.75rem] min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base transition-colors placeholder:text-white/30 focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-brand/40 ${
                  item.completed ? 'text-white/40 line-through' : 'text-white/90'
                }`}
                placeholder="e.g. Pack the spare laser lens"
              />
              <div className="-mr-2.5">
                <RemoveButton label={`Remove ${item.item || 'item'}`} onClick={() => onRemove(index)} />
              </div>
            </div>
          ))}
        </div>
        {items.length === 0 && <p className="text-sm text-white/40">Nothing on the list yet.</p>}

        <div className="flex flex-wrap items-center justify-between gap-x-3">
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
