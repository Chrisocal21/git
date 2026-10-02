'use client'

import { useCallback, useEffect, useState } from 'react'
import SheetFrame from './SheetFrame'
import UnavailableNote from './UnavailableNote'
import { jigsGet, jigsRequest, JigApiError } from '@/lib/jigsClient'
import { bookingLine, dateRange } from '@/lib/jigsFormat'
import type { JigJob } from './types'
import type { JigAllocation, JigAvailability, JigAvailabilityResponse, JigUnavailableDetails } from '@/types/jigs'

const MAX_AT_ONCE = 20

interface AddJigSheetProps {
  job: JigJob
  productId: string | null
  productName?: string
  userName: string | null
  onClose: () => void
  onAdded: (allocations: JigAllocation[]) => void
}

export default function AddJigSheet({ job, productId, productName, userName, onClose, onAdded }: AddJigSheetProps) {
  const [types, setTypes] = useState<JigAvailability[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [qty, setQty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<{ message: string; details: JigUnavailableDetails | null } | null>(null)

  const end = job.end || job.start

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ job_id: job.id, start: job.start.slice(0, 10), end: end.slice(0, 10) })
      const data = await jigsGet<JigAvailabilityResponse | unknown[]>(`/api/jigs/availability?${params}`)
      // Offline with nothing saved, the service worker answers API calls with []
      if (!data || Array.isArray(data) || !Array.isArray((data as JigAvailabilityResponse).types)) {
        setLoadError("You're offline.")
        return
      }
      setTypes((data as JigAvailabilityResponse).types)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof JigApiError ? e.message : "Couldn't check what's available.")
    }
  }, [job.id, job.start, end])

  useEffect(() => {
    load()
  }, [load])

  async function add(type: JigAvailability) {
    if (saving) return
    setSaving(true)
    setRefused(null)
    try {
      const res = await jigsRequest<{ allocations: JigAllocation[] }>('POST', '/api/jigs/allocations', {
        job_id: job.id,
        type_id: type.type_id,
        product_id: productId,
        qty,
        start: job.start.slice(0, 10),
        end: end.slice(0, 10),
        created_by: userName,
      })
      onAdded(res.allocations)
    } catch (e) {
      const err = e instanceof JigApiError ? e : null
      setRefused({ message: err?.message ?? 'Something went wrong. Try again.', details: err?.details ?? null })
      setSaving(false)
      // Someone may have just taken the last one; show the fresh count
      if (err?.code === 'unavailable') load()
    }
  }

  return (
    <SheetFrame
      title="Add a jig"
      subtitle={`${productName?.trim() || 'This product'} · ${dateRange(job.start, job.end)}`}
      onClose={onClose}
    >
      {types === null && !loadError && <p className="py-6 text-center text-sm text-white/50">Checking what’s free...</p>}

      {loadError && <p role="alert" className="py-4 text-sm text-red-300">{loadError}</p>}

      {types && types.length === 0 && (
        <p className="py-6 text-center text-sm text-white/55">No jigs in the inventory yet.</p>
      )}

      {types && types.length > 0 && (
        <ul className="space-y-2">
          {types.map(type => {
            const none = type.free === 0
            const open = selected === type.type_id
            const allOnThisJob = none && type.capacity > 0 && type.on_this_job >= type.capacity && type.bookings.length === 0
            return (
              <li key={type.type_id} className="rounded-xl border border-line bg-canvas/40">
                <button
                  type="button"
                  onClick={() => {
                    setSelected(open ? null : type.type_id)
                    setQty(1)
                    setRefused(null)
                  }}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{type.name}</span>
                    {type.tracking === 'bulk' && <span className="badge flex-shrink-0 bg-white/10 text-white/55">By count</span>}
                  </span>
                  <span className={`flex-shrink-0 text-xs font-semibold tabular ${none ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {none ? 'No more available' : `${type.free} available`}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-line px-3.5 py-3">
                    {none ? (
                      allOnThisJob ? (
                        <p className="text-xs text-white/60">All {type.capacity} are already on this job.</p>
                      ) : (
                        <UnavailableNote
                          message="No more available."
                          details={{ bookings: type.bookings, needs_repair: type.needs_repair }}
                        />
                      )
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2" role="group" aria-label="How many">
                            <button
                              type="button"
                              onClick={() => setQty(q => Math.max(1, q - 1))}
                              disabled={qty <= 1 || saving}
                              aria-label="One fewer"
                              className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-semibold tabular text-white" aria-live="polite">{qty}</span>
                            <button
                              type="button"
                              onClick={() => setQty(q => Math.min(type.free, MAX_AT_ONCE, q + 1))}
                              disabled={qty >= Math.min(type.free, MAX_AT_ONCE) || saving}
                              aria-label="One more"
                              className="h-9 w-9 rounded-lg border border-line-strong text-lg leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <button type="button" onClick={() => add(type)} disabled={saving} className="btn-primary px-5 py-2 text-sm">
                            {saving ? 'Adding...' : `Add ${qty}`}
                          </button>
                        </div>

                        {type.bookings.length > 0 && (
                          <div className="mt-3 text-xs leading-relaxed text-white/50">
                            <p className="font-medium text-white/60">Also held for these dates</p>
                            <ul className="mt-1 space-y-1">
                              {type.bookings.map(b => (
                                <li key={b.allocation_id}>{bookingLine(b)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}

                    {refused && <UnavailableNote message={refused.message} details={refused.details} />}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </SheetFrame>
  )
}
