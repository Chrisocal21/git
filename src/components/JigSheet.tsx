'use client'

import { useEffect, useRef, useState } from 'react'
import { jigsRequest } from '@/lib/jigsClient'
import type { JigType, JigTracking, JigUnitStatus } from '@/types/jigs'

const MAX_UNITS = 60
const MAX_BULK = 10000

interface EditUnit {
  key: string
  id?: string
  label: string
  status: JigUnitStatus
  out: boolean // out on a job right now, so it can't be retired or removed
  removed: boolean
  saved: { label: string; status: JigUnitStatus } | null // what the server has; null for a new row
}

interface JigSheetProps {
  jig: JigType | null // null = adding a new jig
  createdBy: string | null
  onClose: () => void
  // Something was saved but the sheet stays open (a later step failed)
  onChanged: () => void
  onSaved: (jigId?: string) => void
}

function nextLabel(units: EditUnit[]): string {
  let highest = 0
  for (const u of units) {
    const match = /^#(\d+)$/.exec(u.label.trim())
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return `#${highest + 1}`
}

export default function JigSheet({ jig, createdBy, onClose, onChanged, onSaved }: JigSheetProps) {
  const isNew = jig === null
  const keyCounter = useRef(0)

  const [name, setName] = useState(jig?.name ?? '')
  const [notes, setNotes] = useState(jig?.notes ?? '')
  const [tracking, setTracking] = useState<JigTracking>(jig?.tracking ?? 'unit')
  const [quantity, setQuantity] = useState(jig ? String(jig.total_qty) : '1')
  const [units, setUnits] = useState<EditUnit[]>(() =>
    (jig?.units ?? []).map(u => ({
      key: u.id,
      id: u.id,
      label: u.label,
      status: u.status,
      out: !!u.holder,
      removed: false,
      saved: { label: u.label, status: u.status },
    }))
  )
  // What the server has for the jig itself, so a retry after a partial save only sends what's left
  const baseline = useRef({ name: jig?.name ?? '', notes: jig?.notes ?? '', total: jig?.total_qty ?? 0 })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const bulk = tracking === 'bulk'
  const outNow = jig?.counts.out ?? 0

  function updateUnit(key: string, patch: Partial<EditUnit>) {
    setUnits(list => list.map(u => (u.key === key ? { ...u, ...patch } : u)))
  }

  function addUnitRow() {
    setUnits(list => {
      if (list.filter(u => !u.removed).length >= MAX_UNITS) return list
      keyCounter.current += 1
      return [
        ...list,
        { key: `new-${keyCounter.current}`, label: nextLabel(list), status: 'ok', out: false, removed: false, saved: null },
      ]
    })
  }

  function removeUnitRow(unit: EditUnit) {
    // A row that was never saved just disappears; a saved one is marked and deleted on Save
    if (!unit.id) setUnits(list => list.filter(u => u.key !== unit.key))
    else updateUnit(unit.key, { removed: true })
  }

  function parseQuantity(): number | null {
    const n = Number(quantity)
    const max = bulk ? MAX_BULK : MAX_UNITS
    const min = isNew ? 1 : 0
    return Number.isInteger(n) && n >= min && n <= max ? n : null
  }

  async function save() {
    if (saving) return
    setError(null)

    if (!name.trim()) {
      setError('Give the jig a name.')
      return
    }
    const qty = isNew || bulk ? parseQuantity() : 0
    if ((isNew || bulk) && qty === null) {
      setError(`Quantity has to be a whole number${isNew ? ' from 1' : ''} up to ${(bulk ? MAX_BULK : MAX_UNITS).toLocaleString()}.`)
      return
    }
    if (!isNew && bulk && qty !== null && qty < outNow) {
      setError(`${outNow} are out right now, so the total can't go below ${outNow}.`)
      return
    }
    const live = units.filter(u => !u.removed)
    if (!isNew && !bulk) {
      if (live.some(u => !u.label.trim())) {
        setError('Every unit needs a number or name.')
        return
      }
      const labels = live.map(u => u.label.trim().toLowerCase())
      if (new Set(labels).size !== labels.length) {
        setError('Two units have the same number.')
        return
      }
    }

    setSaving(true)

    if (isNew) {
      try {
        const created = await jigsRequest<JigType>('POST', '/api/jigs', {
          name,
          tracking,
          quantity: qty,
          notes,
          created_by: createdBy,
        })
        onSaved(created.id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
        setSaving(false)
      }
      return
    }

    // Editing: apply each change in turn, remembering what went through so a retry can't repeat it
    let working = units
    try {
      const patch: Record<string, unknown> = {}
      if (name.trim() !== baseline.current.name) patch.name = name
      if (notes.trim() !== baseline.current.notes) patch.notes = notes
      if (bulk && qty !== baseline.current.total) patch.total_qty = qty
      if (Object.keys(patch).length > 0) {
        await jigsRequest('PUT', `/api/jigs/${jig!.id}`, patch)
        baseline.current = {
          name: name.trim().replace(/\s+/g, ' '),
          notes: notes.trim(),
          total: bulk ? (qty as number) : baseline.current.total,
        }
      }

      for (const unit of working.filter(u => u.id && u.removed)) {
        await jigsRequest('DELETE', `/api/jigs/units/${unit.id}`)
        working = working.filter(u => u.key !== unit.key)
      }

      for (const unit of working.filter(u => u.id && !u.removed)) {
        const changed = unit.saved && (unit.saved.label !== unit.label.trim() || unit.saved.status !== unit.status)
        if (!changed) continue
        await jigsRequest('PUT', `/api/jigs/units/${unit.id}`, { label: unit.label, status: unit.status })
        working = working.map(u =>
          u.key === unit.key ? { ...u, label: u.label.trim(), saved: { label: u.label.trim(), status: u.status } } : u
        )
      }

      for (const unit of working.filter(u => !u.id)) {
        const result = await jigsRequest<JigType>('POST', `/api/jigs/${jig!.id}/units`, { label: unit.label })
        const label = unit.label.trim().replace(/\s+/g, ' ')
        const created = result.units.find(u => u.label === label)
        working = working.map(u =>
          u.key === unit.key ? { ...u, id: created?.id, label, saved: { label, status: 'ok' } } : u
        )
        // A new unit can be saved as needing repair straight away
        if (created && unit.status !== 'ok') {
          await jigsRequest('PUT', `/api/jigs/units/${created.id}`, { status: unit.status })
          working = working.map(u => (u.key === unit.key ? { ...u, saved: { label, status: unit.status } } : u))
        }
      }

      onSaved(jig!.id)
    } catch (e) {
      setUnits(working)
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setSaving(false)
      onChanged()
    }
  }

  async function toggleArchive() {
    if (!jig || saving) return
    setSaving(true)
    setError(null)
    try {
      await jigsRequest('PUT', `/api/jigs/${jig.id}`, { archived: !jig.archived })
      onSaved(jig.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setSaving(false)
    }
  }

  async function deleteJig() {
    if (!jig || saving) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await jigsRequest('DELETE', `/api/jigs/${jig.id}`)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
      setConfirmDelete(false)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="jig-sheet-title"
        className="w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-surface border border-line-strong border-b-0 rounded-t-3xl p-6 pb-8 shadow-pop animate-sheet-up"
      >
        <div className="w-10 h-1 bg-white/15 rounded-full mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h2 id="jig-sheet-title" className="text-lg font-semibold text-white">
            {isNew ? 'Add a jig' : 'Edit jig'}
          </h2>
          <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          noValidate
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="jig-name" className="label">Name <span className="text-red-400">*</span></label>
            <input
              id="jig-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
              placeholder="e.g., Tumbler jig"
              maxLength={80}
              autoFocus={isNew}
            />
          </div>

          {isNew && (
            <div>
              <span className="label">How do you track it?</span>
              <div className="segmented" role="radiogroup" aria-label="How do you track it?">
                <button
                  type="button"
                  role="radio"
                  aria-checked={tracking === 'unit'}
                  onClick={() => setTracking('unit')}
                  className={`segment ${tracking === 'unit' ? 'segment-active' : ''}`}
                >
                  One by one
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tracking === 'bulk'}
                  onClick={() => setTracking('bulk')}
                  className={`segment ${tracking === 'bulk' ? 'segment-active' : ''}`}
                >
                  By count
                </button>
              </div>
              <p className="mt-2 text-xs text-white/45 leading-relaxed">
                {tracking === 'unit'
                  ? 'Every jig gets its own number, so you can see exactly which one is where.'
                  : 'For interchangeable ones, like luggage tags. It’s just a count.'}
              </p>
            </div>
          )}

          {(isNew || bulk) && (
            <div>
              <label htmlFor="jig-qty" className="label">
                {isNew ? 'How many do you have?' : 'Total quantity'}
              </label>
              <input
                id="jig-qty"
                type="number"
                inputMode="numeric"
                min={isNew ? 1 : outNow}
                max={bulk ? MAX_BULK : MAX_UNITS}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="input tabular"
              />
              {!isNew && outNow > 0 && (
                <p className="mt-2 text-xs text-white/45">{outNow} out on jobs right now.</p>
              )}
            </div>
          )}

          {!isNew && !bulk && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="label !mb-0">Units</span>
                <button
                  type="button"
                  onClick={addUnitRow}
                  disabled={units.filter(u => !u.removed).length >= MAX_UNITS}
                  className="text-xs font-semibold text-brand-light hover:text-white transition-colors disabled:opacity-40"
                >
                  + Add unit
                </button>
              </div>
              {units.length === 0 && <p className="text-xs text-white/45 py-2">No units yet.</p>}
              <ul className="space-y-2">
                {units.map(unit => (
                  <li key={unit.key} className={`flex items-center gap-2 ${unit.removed ? 'opacity-40' : ''}`}>
                    <input
                      type="text"
                      value={unit.label}
                      onChange={e => updateUnit(unit.key, { label: e.target.value })}
                      disabled={unit.removed}
                      aria-label="Unit number or name"
                      maxLength={30}
                      className={`input !w-28 !py-2 ${unit.removed ? 'line-through' : ''}`}
                    />
                    {unit.out ? (
                      // Can't be retired or repaired while it's on a job, so say where it is instead of showing a dead "OK"
                      <div className="input flex flex-1 cursor-default select-none items-center !py-2 text-white/50">
                        Out on a job
                      </div>
                    ) : (
                      <select
                        value={unit.status}
                        onChange={e => updateUnit(unit.key, { status: e.target.value as JigUnitStatus })}
                        disabled={unit.removed}
                        aria-label={`Status of ${unit.label}`}
                        className="input flex-1 !py-2"
                      >
                        <option value="ok">OK</option>
                        <option value="needs_repair">Needs repair</option>
                        <option value="retired">Retired</option>
                      </select>
                    )}
                    {unit.removed ? (
                      <button
                        type="button"
                        onClick={() => updateUnit(unit.key, { removed: false })}
                        className="text-xs font-semibold text-brand-light hover:text-white px-1"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeUnitRow(unit)}
                        disabled={unit.out}
                        className="icon-btn disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label={`Remove ${unit.label}`}
                        title={unit.out ? 'Out on a job right now' : 'Remove'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-white/45 leading-relaxed">
                Retire a unit instead of removing it once it’s been on a job. Removing is for mistakes.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="jig-notes" className="label">Notes (optional)</label>
            <textarea
              id="jig-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input min-h-[84px] resize-y"
              placeholder="What it fits, how it’s packed…"
              maxLength={1000}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-300">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 py-3" disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : isNew ? 'Add jig' : 'Save changes'}
            </button>
          </div>
        </form>

        {!isNew && (
          <div className="mt-6 pt-4 border-t border-line flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={toggleArchive}
              disabled={saving}
              className="text-sm text-white/60 hover:text-white transition-colors disabled:opacity-40"
            >
              {jig!.archived ? 'Restore jig' : 'Archive jig'}
            </button>
            <button
              type="button"
              onClick={deleteJig}
              disabled={saving}
              className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
            >
              {confirmDelete ? 'Tap again to delete for good' : 'Delete jig'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
