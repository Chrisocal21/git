'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import JigSheet from '@/components/JigSheet'
import Pill from '@/components/jigs/JigPill'
import { getCurrentUser } from '@/lib/auth'
import { awaitingReturn, holderLine, lastReturnedLine } from '@/lib/jigsFormat'
import type { JigInventoryResponse, JigType, JigUnit } from '@/types/jigs'

type LoadError = 'not_migrated' | 'no_db' | 'offline' | 'failed'

// The profile picker lives in the hamburger menu on the Jobs page, not here
// History's back button pops to here when it was opened from here (instead of pushing Inventory again)
const FROM_KEY = 'jig-history-from-inventory'
const markFromInventory = () => {
  try { sessionStorage.setItem(FROM_KEY, '1') } catch {}
}

const ERROR_COPY: Record<LoadError, string> = {
  not_migrated: "Inventory isn't set up in the database yet.",
  no_db: "The database isn't connected, so there's nothing to show yet.",
  offline: "You're offline and this phone hasn't saved an inventory list yet.",
  failed: "Couldn't load the inventory.",
}

// ── Little pieces ───────────────────────────────────────────────────────────

function UnitPill({ unit }: { unit: JigUnit }) {
  if (unit.status === 'retired') return <Pill tone="gray">Retired</Pill>
  if (unit.holder) {
    return awaitingReturn(unit.holder) ? <Pill tone="amber">Awaiting return</Pill> : <Pill tone="blue">Out</Pill>
  }
  if (unit.status === 'needs_repair') return <Pill tone="red">Needs repair</Pill>
  return <Pill tone="green">In shop</Pill>
}

function unitDetail(unit: JigUnit): string {
  if (unit.holder) return holderLine(unit.holder)
  if (unit.last_returned) return lastReturnedLine(unit.last_returned)
  return 'Hasn’t been out yet'
}

function countsLine(jig: JigType): string {
  const { total, out, needs_repair } = jig.counts
  if (total === 0) return jig.tracking === 'unit' && jig.units.length > 0 ? 'All retired' : 'None yet'
  const parts = [`${total} total`]
  if (out > 0) parts.push(`${out} out`)
  if (needs_repair > 0) parts.push(`${needs_repair} needs repair`)
  return parts.join(' · ')
}

function JigCard({
  jig,
  open,
  onToggle,
  onEdit,
}: {
  jig: JigType
  open: boolean
  onToggle: () => void
  onEdit: () => void
}) {
  const { available, total } = jig.counts
  const none = total > 0 && available === 0
  // Retired units drop to the bottom of the list
  const units = [...jig.units].sort((a, b) => Number(a.status === 'retired') - Number(b.status === 'retired'))

  return (
    <div className={`card shadow-card overflow-hidden ${jig.archived ? 'opacity-60' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="line-clamp-2 break-words font-semibold leading-snug text-white">{jig.name}</h2>
            {jig.tracking === 'bulk' && <span className="badge flex-shrink-0 bg-white/10 text-white/55">By count</span>}
            {jig.archived && <span className="badge flex-shrink-0 bg-white/10 text-white/55">Archived</span>}
          </div>
          <p className="mt-1 truncate text-xs text-white/50 tabular">{countsLine(jig)}</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className={`font-display text-2xl font-semibold leading-none tabular ${none ? 'text-amber-300' : 'text-white'}`}>
            {available}
          </div>
          <div className="eyebrow mt-1 !text-[10px]">{none ? 'none available' : 'available'}</div>
        </div>

        <svg
          className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {jig.notes && <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">{jig.notes}</p>}

          {jig.tracking === 'unit' ? (
            units.length === 0 ? (
              <p className="py-1 text-sm text-white/45">No units yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {units.map(unit => (
                  <li
                    key={unit.id}
                    className={`flex items-start justify-between gap-3 py-2.5 ${unit.status === 'retired' ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white">{unit.label}</div>
                      <div className="mt-0.5 text-xs leading-snug text-white/50">
                        {unitDetail(unit)}
                        {(unit.holder || unit.last_returned) && (
                          <>
                            {' · '}
                            <Link
                              onClick={markFromInventory}
                              href={`/inventory/history?unit=${encodeURIComponent(unit.id)}`}
                              className="font-medium text-brand-light hover:text-white"
                            >
                              History
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                    <UnitPill unit={unit} />
                  </li>
                ))}
              </ul>
            )
          ) : jig.holders.length === 0 ? (
            <p className="py-1 text-sm text-white/55">All {jig.counts.total} are in the shop.</p>
          ) : (
            <ul className="divide-y divide-line">
              {jig.holders.map(holder => (
                <li key={holder.allocation_id} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white tabular">{holder.qty} out</div>
                    <div className="mt-0.5 text-xs leading-snug text-white/50">{holderLine(holder)}</div>
                  </div>
                  {awaitingReturn(holder) ? <Pill tone="amber">Awaiting return</Pill> : <Pill tone="blue">Out</Pill>}
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between pt-1">
            <Link
              onClick={markFromInventory}
              href={`/inventory/history?jig=${encodeURIComponent(jig.id)}`}
              className="text-xs font-semibold text-brand-light transition-colors hover:text-white"
            >
              History
            </Link>
            <button type="button" onClick={onEdit} className="btn-secondary px-3 py-1.5 text-xs">
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter()
  const [jigs, setJigs] = useState<JigType[]>([])
  const [asOf, setAsOf] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<LoadError | null>(null)
  const [online, setOnline] = useState(true)

  const [userName, setUserName] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showArchived, setShowArchived] = useState(false)
  const [sheet, setSheet] = useState<{ jig: JigType | null } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/jigs', { cache: 'no-store' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        setError(data?.code === 'not_migrated' ? 'not_migrated' : 'failed')
        return
      }
      // Offline with nothing saved, the service worker answers API calls with []
      if (!data || Array.isArray(data) || !Array.isArray((data as JigInventoryResponse).jigs)) {
        setError('offline')
        return
      }
      const body = data as JigInventoryResponse
      if (!body.d1) {
        setError('no_db')
        return
      }
      setJigs(body.jigs)
      setAsOf(body.as_of)
      setError(null)
    } catch {
      setError(navigator.onLine ? 'failed' : 'offline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setUserName(getCurrentUser()?.name ?? null)
    setOnline(navigator.onLine)
    load()

    const goOnline = () => {
      setOnline(true)
      load()
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [load])

  const active = useMemo(() => jigs.filter(j => !j.archived), [jigs])
  const archived = useMemo(() => jigs.filter(j => j.archived), [jigs])
  // Jigs with something out, not a sum of units: 50 luggage tags plus 2 tumbler jigs isn't "52"
  const outNow = active.filter(j => j.counts.out > 0).length

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = showArchived ? jigs : active
    return q ? list.filter(j => j.name.toLowerCase().includes(q)) : list
  }, [jigs, active, showArchived, query])

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSaved(jigId?: string) {
    setSheet(null)
    if (jigId) setExpanded(prev => new Set(prev).add(jigId))
    load()
  }

  return (
    <div className="min-h-page text-white">
      <PageHeader
        title="Inventory"
        subtitle="Jigs"
        onBack={() => router.push('/jobs')}
        actions={
          error ? undefined : (
            <>
              <Link href="/inventory/history" onClick={markFromInventory} className="icon-btn" aria-label="History" title="History">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>
              <button type="button" onClick={() => setSheet({ jig: null })} className="btn-primary ml-1 px-3 py-1.5 text-xs">
                + Add jig
              </button>
            </>
          )
        }
      />

      <div className="mx-auto max-w-2xl px-4 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-white/50">Loading inventory...</div>
        ) : error ? (
          <div className="card shadow-card px-5 py-8 text-center">
            <p className="text-sm text-white/70">{ERROR_COPY[error]}</p>
            {(error === 'failed' || error === 'offline') && (
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  load()
                }}
                className="btn-secondary mt-4 px-4 py-2 text-xs"
              >
                Try again
              </button>
            )}
          </div>
        ) : (
          <>
            {!online && (
              <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                You’re offline. This is the last list this phone saved, so counts may be out of date.
              </p>
            )}

            <div className="mb-3 flex items-baseline justify-between gap-3">
              <p className="eyebrow tabular">
                {active.length} {active.length === 1 ? 'jig' : 'jigs'}
                {outNow > 0 && ` · ${outNow} out`}
              </p>
              {asOf && (
                <p className="text-[11px] text-white/35 tabular">
                  Updated {new Date(asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              )}
            </div>

            {jigs.length >= 6 && (
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search jigs"
                aria-label="Search jigs"
                className="input mb-3"
              />
            )}

            {jigs.length === 0 ? (
              <div className="py-16 text-center text-white/55">
                <p className="mb-5">No jigs yet.</p>
                <button type="button" onClick={() => setSheet({ jig: null })} className="btn-primary px-6 py-3">
                  + Add your first jig
                </button>
              </div>
            ) : shown.length === 0 ? (
              <p className="py-10 text-center text-sm text-white/50">Nothing matches “{query.trim()}”.</p>
            ) : (
              <div className="space-y-3">
                {shown.map(jig => (
                  <JigCard
                    key={jig.id}
                    jig={jig}
                    open={expanded.has(jig.id)}
                    onToggle={() => toggle(jig.id)}
                    onEdit={() => setSheet({ jig })}
                  />
                ))}
              </div>
            )}

            {archived.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived(s => !s)}
                className="mt-5 w-full py-2 text-center text-xs text-white/45 transition-colors hover:text-white/70"
              >
                {showArchived ? 'Hide archived' : `Show archived (${archived.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {sheet && (
        <JigSheet
          // A fresh form for each jig, so one jig's edits never carry into the next
          key={sheet.jig?.id ?? 'new'}
          jig={sheet.jig}
          createdBy={userName}
          onClose={() => setSheet(null)}
          onChanged={load}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
