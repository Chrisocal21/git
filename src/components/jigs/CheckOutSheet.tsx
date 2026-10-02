'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SheetFrame from './SheetFrame'
import JigPill from './JigPill'
import UnavailableNote from './UnavailableNote'
import { jigsGet, jigsRequest, JigApiError } from '@/lib/jigsClient'
import { awaitingReturn, holderLine, lastReturnedLine } from '@/lib/jigsFormat'
import type { NeedGroup } from './types'
import type { JigAllocation, JigHolder, JigInventoryResponse, JigType, JigUnavailableDetails } from '@/types/jigs'

interface CheckOutSheetProps {
  jobId: string
  // Live: lines drop out of this list as they're checked out
  groups: NeedGroup[]
  userName: string | null
  online: boolean
  onClose: () => void
  // Called after every successful check-out with the job's fresh list
  onUpdated: (allocations: JigAllocation[]) => void
}

type Problem = { message: string; details: JigUnavailableDetails | null }

export default function CheckOutSheet({ jobId, groups, userName, online, onClose, onUpdated }: CheckOutSheetProps) {
  const [inventory, setInventory] = useState<JigType[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [working, setWorking] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  // Groups where the person has changed the suggested units themselves
  const touched = useRef(new Set<string>())

  const groupsKey = useMemo(
    () => groups.map(g => `${g.typeId}:${g.rows.map(r => r.id).join(',')}`).join('|'),
    [groups]
  )
  const groupsRef = useRef(groups)
  groupsRef.current = groups

  const loadInventory = useCallback(async () => {
    try {
      const data = await jigsGet<JigInventoryResponse | unknown[]>('/api/jigs')
      // Offline with nothing saved, the service worker answers API calls with []
      if (!data || Array.isArray(data) || !Array.isArray((data as JigInventoryResponse).jigs)) {
        setLoadError("You're offline.")
        return
      }
      setInventory((data as JigInventoryResponse).jigs)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof JigApiError ? e.message : "Couldn't check what's in the shop.")
    }
  }, [])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  // Suggest the first units that are actually in the shop, until the person picks their own
  useEffect(() => {
    if (!inventory) return
    setPicked(prev => {
      const next: Record<string, string[]> = {}
      for (const g of groupsRef.current) {
        if (g.tracking !== 'unit') continue
        const type = inventory.find(t => t.id === g.typeId)
        const free = (type?.units ?? []).filter(u => u.status === 'ok' && !u.holder).map(u => u.id)
        if (touched.current.has(g.typeId)) {
          next[g.typeId] = (prev[g.typeId] ?? []).filter(id => free.includes(id)).slice(0, g.rows.length)
        } else {
          next[g.typeId] = free.slice(0, g.rows.length)
        }
      }
      return next
    })
  }, [inventory, groupsKey])

  function toggle(group: NeedGroup, unitId: string) {
    touched.current.add(group.typeId)
    setPicked(prev => {
      const current = prev[group.typeId] ?? []
      if (current.includes(unitId)) return { ...prev, [group.typeId]: current.filter(id => id !== unitId) }
      if (current.length >= group.rows.length) return prev
      return { ...prev, [group.typeId]: [...current, unitId] }
    })
  }

  function refuse(e: unknown) {
    const err = e instanceof JigApiError ? e : null
    setProblem({ message: err?.message ?? 'Something went wrong. Try again.', details: err?.details ?? null })
  }

  // Somebody says it's physically back but nobody checked it in: do that now, so it can go out again
  async function checkInHolder(holder: JigHolder) {
    if (!userName || working) return
    setWorking(true)
    setProblem(null)
    try {
      const res = await jigsRequest<{ allocations: JigAllocation[] }>(
        'POST',
        `/api/jigs/allocations/${holder.allocation_id}/checkin`,
        { by: userName, condition: 'ok' }
      )
      if (res.allocations[0]?.job_id === jobId) onUpdated(res.allocations)
      await loadInventory()
    } catch (e) {
      refuse(e)
    } finally {
      setWorking(false)
    }
  }

  const typeFor = (typeId: string) => inventory?.find(t => t.id === typeId)

  // How many lines will go out: chosen units, plus counted jigs that are all in the shop
  const goingOut = groups.reduce((sum, g) => {
    if (g.tracking === 'unit') return sum + Math.min((picked[g.typeId] ?? []).length, g.rows.length)
    const type = typeFor(g.typeId)
    return type && g.qty <= type.counts.available ? sum + g.rows.length : sum
  }, 0)

  async function confirm() {
    if (!inventory || !userName || working || goingOut === 0) return
    setWorking(true)
    setProblem(null)
    try {
      for (const g of groups) {
        if (g.tracking === 'unit') {
          const ids = picked[g.typeId] ?? []
          for (let i = 0; i < ids.length && i < g.rows.length; i++) {
            const res = await jigsRequest<{ allocations: JigAllocation[] }>(
              'POST',
              `/api/jigs/allocations/${g.rows[i].id}/checkout`,
              { by: userName, unit_id: ids[i] }
            )
            onUpdated(res.allocations)
          }
        } else {
          const type = typeFor(g.typeId)
          if (!type || g.qty > type.counts.available) continue // explained on screen
          for (const row of g.rows) {
            const res = await jigsRequest<{ allocations: JigAllocation[] }>(
              'POST',
              `/api/jigs/allocations/${row.id}/checkout`,
              { by: userName }
            )
            onUpdated(res.allocations)
          }
        }
      }
      await loadInventory()
    } catch (e) {
      refuse(e)
      await loadInventory()
    } finally {
      setWorking(false)
    }
  }

  const blockedReason = !online
    ? "You're offline. Checking out needs a connection."
    : !userName
    ? 'Pick your profile first (menu on the Jobs page) so we know who has it.'
    : null

  return (
    <SheetFrame title="Check out" subtitle="Check what you’re taking" onClose={onClose}>
      {!inventory && !loadError && <p className="py-6 text-center text-sm text-white/50">Checking what’s in the shop...</p>}
      {loadError && <p role="alert" className="py-4 text-sm text-red-300">{loadError}</p>}

      {inventory && (
        <div className="space-y-5">
          {groups.map(group => {
            const type = typeFor(group.typeId)
            const chosen = picked[group.typeId] ?? []
            const units = (type?.units ?? []).filter(u => u.status !== 'retired')
            const freeCount = type?.counts.available ?? 0

            return (
              <section key={group.typeId} aria-label={group.name}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                  <span className="text-xs text-white/50 tabular">
                    {group.tracking === 'unit' ? `${chosen.length} of ${group.rows.length} chosen` : `Need ${group.qty}`}
                  </span>
                </div>

                {group.tracking === 'unit' ? (
                  <>
                    <ul className="divide-y divide-line rounded-xl border border-line bg-canvas/40">
                      {units.map(unit => {
                        const free = unit.status === 'ok' && !unit.holder
                        const isChosen = chosen.includes(unit.id)
                        const full = chosen.length >= group.rows.length
                        return (
                          <li key={unit.id} className="px-3.5 py-2.5">
                            <div className="flex items-start gap-3">
                              {free ? (
                                <input
                                  type="checkbox"
                                  id={`unit-${unit.id}`}
                                  checked={isChosen}
                                  disabled={!isChosen && full}
                                  onChange={() => toggle(group, unit.id)}
                                  className="mt-1 h-4 w-4 flex-shrink-0 accent-[#E8B44D]"
                                />
                              ) : (
                                <span className="w-4 flex-shrink-0" aria-hidden="true" />
                              )}
                              <label htmlFor={free ? `unit-${unit.id}` : undefined} className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-white">{unit.label}</span>
                                <span className="mt-0.5 block text-xs leading-snug text-white/50">
                                  {unit.holder
                                    ? holderLine(unit.holder)
                                    : unit.status === 'needs_repair'
                                    ? 'Waiting on repair'
                                    : unit.last_returned
                                    ? lastReturnedLine(unit.last_returned)
                                    : 'Hasn’t been out yet'}
                                </span>
                              </label>
                              {unit.holder ? (
                                <JigPill tone={awaitingReturn(unit.holder) ? 'amber' : 'blue'}>
                                  {awaitingReturn(unit.holder) ? 'Awaiting return' : 'Out'}
                                </JigPill>
                              ) : unit.status === 'needs_repair' ? (
                                <JigPill tone="red">Needs repair</JigPill>
                              ) : (
                                <JigPill tone="green">In shop</JigPill>
                              )}
                            </div>
                            {unit.holder && (
                              <button
                                type="button"
                                onClick={() => checkInHolder(unit.holder!)}
                                disabled={working || !userName || !online}
                                className="ml-7 mt-1.5 text-xs font-semibold text-gold underline-offset-2 hover:underline disabled:opacity-50"
                              >
                                It’s actually back, check it in
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {freeCount < group.rows.length && (
                      <p className="mt-2 text-xs text-amber-200">
                        {freeCount === 0 ? 'No more available.' : `Only ${freeCount} in the shop right now.`}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-line bg-canvas/40 px-3.5 py-3">
                    <p className="text-sm text-white/70 tabular">
                      In the shop: {freeCount} of {type?.counts.total ?? 0}
                    </p>
                    {group.qty > freeCount && (
                      <UnavailableNote
                        message="No more available."
                        details={{ holders: type?.holders ?? [], free: freeCount, requested: group.qty }}
                        onCheckIn={checkInHolder}
                        disabled={working || !userName || !online}
                      />
                    )}
                  </div>
                )}
              </section>
            )
          })}

          {problem && <UnavailableNote message={problem.message} details={problem.details} />}

          {blockedReason && <p className="text-xs text-amber-200">{blockedReason}</p>}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3">
              Close
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={working || goingOut === 0 || !!blockedReason}
              className="btn-primary flex-1 py-3"
            >
              {working ? 'Checking out...' : goingOut === 0 ? 'Check out' : `Check out ${goingOut}`}
            </button>
          </div>
        </div>
      )}
    </SheetFrame>
  )
}
