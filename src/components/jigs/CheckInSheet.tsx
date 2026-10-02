'use client'

import { useState } from 'react'
import SheetFrame from './SheetFrame'
import UnavailableNote from './UnavailableNote'
import { lineName } from './types'
import { jigsRequest, JigApiError } from '@/lib/jigsClient'
import { shortDate } from '@/lib/jigsFormat'
import type { JigAllocation, JigReturnCondition, JigUnavailableDetails } from '@/types/jigs'

interface CheckInSheetProps {
  // Live: lines drop out of this list as they're checked in
  rows: JigAllocation[]
  userName: string | null
  online: boolean
  onClose: () => void
  // Called after every successful check-in with the job's fresh list
  onUpdated: (allocations: JigAllocation[]) => void
}

const OPTIONS: { value: JigReturnCondition; label: string }[] = [
  { value: 'ok', label: 'All good' },
  { value: 'needs_repair', label: 'Needs repair' },
  { value: 'lost', label: 'Lost' },
]

export default function CheckInSheet({ rows, userName, online, onClose, onUpdated }: CheckInSheetProps) {
  const [conditions, setConditions] = useState<Record<string, JigReturnCondition>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<{ message: string; details: JigUnavailableDetails | null } | null>(null)

  const conditionOf = (row: JigAllocation): JigReturnCondition => conditions[row.id] ?? 'ok'

  async function confirm() {
    if (!userName || working || rows.length === 0) return
    setWorking(true)
    setProblem(null)
    try {
      for (const row of rows) {
        const condition = conditionOf(row)
        const res = await jigsRequest<{ allocations: JigAllocation[] }>(
          'POST',
          `/api/jigs/allocations/${row.id}/checkin`,
          { by: userName, condition, notes: condition === 'ok' ? '' : notes[row.id] ?? '' }
        )
        onUpdated(res.allocations)
      }
    } catch (e) {
      const err = e instanceof JigApiError ? e : null
      setProblem({ message: err?.message ?? 'Something went wrong. Try again.', details: err?.details ?? null })
    } finally {
      setWorking(false)
    }
  }

  const blockedReason = !online
    ? "You're offline. Checking in needs a connection."
    : !userName
    ? 'Pick your profile first (menu on the Jobs page) so we know who checked it in.'
    : null

  return (
    <SheetFrame title="Check in" subtitle="Say what shape each one came back in" onClose={onClose}>
      <ul className="space-y-3">
        {rows.map(row => {
          const condition = conditionOf(row)
          // Counted jigs are either back or lost
          const options = row.tracking === 'bulk' ? OPTIONS.filter(o => o.value !== 'needs_repair') : OPTIONS
          return (
            <li key={row.id} className="rounded-xl border border-line bg-canvas/40 p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-white">{lineName(row)}</span>
                <span className="flex-shrink-0 text-xs text-white/45">
                  {row.checked_out_by ?? 'Someone'}
                  {row.checked_out_at ? ` · ${shortDate(row.checked_out_at)}` : ''}
                </span>
              </div>

              <div className="segmented mt-3" role="radiogroup" aria-label={`Condition of ${lineName(row)}`}>
                {options.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={condition === option.value}
                    onClick={() => setConditions(c => ({ ...c, [row.id]: option.value }))}
                    className={`segment !px-2 !py-1.5 text-xs ${condition === option.value ? 'segment-active' : ''}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {condition !== 'ok' && (
                <input
                  type="text"
                  value={notes[row.id] ?? ''}
                  onChange={e => setNotes(n => ({ ...n, [row.id]: e.target.value }))}
                  placeholder="What happened? (optional)"
                  aria-label={`What happened to ${lineName(row)}`}
                  maxLength={300}
                  className="input mt-2.5"
                />
              )}
            </li>
          )
        })}
      </ul>

      {problem && <UnavailableNote message={problem.message} details={problem.details} />}

      {blockedReason && <p className="mt-3 text-xs text-amber-200">{blockedReason}</p>}

      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
          Close
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={working || rows.length === 0 || !!blockedReason}
          className="btn-primary flex-1 py-3"
        >
          {working ? 'Checking in...' : `Check in ${rows.length}`}
        </button>
      </div>
    </SheetFrame>
  )
}
