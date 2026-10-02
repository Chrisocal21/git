'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PageHeader from '@/components/PageHeader'
import Pill from '@/components/jigs/JigPill'
import type { PillTone } from '@/components/jigs/JigPill'
import { lineName } from '@/components/jigs/types'
import { dayHeading, localDayKey, timeOfDay } from '@/lib/jigsFormat'
import type { JigEvent, JigHistoryResponse, JigInventoryResponse, JigType } from '@/types/jigs'

const PAGE = 40

type LoadError = 'not_migrated' | 'no_db' | 'offline' | 'failed'

const ERROR_COPY: Record<LoadError, string> = {
  not_migrated: "Inventory isn't set up in the database yet.",
  no_db: "The database isn't connected, so there's nothing to show yet.",
  offline: "You're offline and this phone hasn't saved this list yet.",
  failed: "Couldn't load the history.",
}

function pillFor(event: JigEvent): { tone: PillTone; label: string } {
  if (event.kind === 'out') return { tone: 'blue', label: 'Out' }
  if (event.kind === 'lost') return { tone: 'red', label: 'Lost' }
  if (event.condition === 'needs_repair') return { tone: 'amber', label: 'Needs repair' }
  return { tone: 'green', label: 'Back' }
}

const ACTOR: Record<JigEvent['kind'], string> = {
  out: 'taken by',
  back: 'checked in by',
  lost: 'marked lost by',
}

function EventRow({ event }: { event: JigEvent }) {
  const pill = pillFor(event)
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{lineName(event)}</div>
        <div className="mt-0.5 text-xs leading-snug text-white/50">
          {event.job_title ? (
            <Link href={`/jobs/${event.job_id}`} className="text-white/70 underline-offset-2 hover:text-white hover:underline">
              {event.job_title}
            </Link>
          ) : (
            'A job that was deleted'
          )}
          {' · '}
          {ACTOR[event.kind]} {event.by ?? 'someone'}
          {' · '}
          <span className="tabular">{timeOfDay(event.at)}</span>
        </div>
        {event.notes && <div className="mt-1 text-xs italic leading-snug text-white/45">“{event.notes}”</div>}
      </div>
      <Pill tone={pill.tone}>{pill.label}</Pill>
    </li>
  )
}

export default function JigHistoryPage() {
  const router = useRouter()

  const [jigs, setJigs] = useState<JigType[]>([])
  const [jigId, setJigId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [filtersReady, setFiltersReady] = useState(false)

  const [events, setEvents] = useState<JigEvent[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreFailed, setMoreFailed] = useState(false)
  const [error, setError] = useState<LoadError | null>(null)
  const [asOf, setAsOf] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  // Only the newest request is allowed to update the list, so quick filter changes can't show stale results
  const requestId = useRef(0)

  // Filters can arrive in the link: /inventory/history?jig=…&unit=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    setJigId(q.get('jig') ?? '')
    setUnitId(q.get('unit') ?? '')
    setOnline(navigator.onLine)
    setFiltersReady(true)

    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // The jig list fills the filters (and works out which jig a linked unit belongs to)
  useEffect(() => {
    fetch('/api/jigs', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then((data: JigInventoryResponse | unknown[] | null) => {
        if (data && !Array.isArray(data) && Array.isArray(data.jigs)) setJigs(data.jigs)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (jigs.length === 0) return
    if (unitId && !jigId) {
      const owner = jigs.find(j => j.units.some(u => u.id === unitId))
      if (owner) setJigId(owner.id)
      else setUnitId('')
    } else if (jigId && !jigs.some(j => j.id === jigId)) {
      setJigId('')
      setUnitId('')
    }
  }, [jigs, jigId, unitId])

  // Keep the address in step with the filters so the page can be shared and survives a refresh
  useEffect(() => {
    if (!filtersReady) return
    const q = new URLSearchParams()
    if (jigId) q.set('jig', jigId)
    if (unitId) q.set('unit', unitId)
    const qs = q.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }, [filtersReady, jigId, unitId])

  const fetchPage = useCallback(
    async (cursor?: { at: string; id: string }) => {
      const id = ++requestId.current
      const params = new URLSearchParams({ limit: String(PAGE) })
      if (jigId) params.set('jig', jigId)
      if (unitId) params.set('unit', unitId)
      if (cursor) {
        params.set('before', cursor.at)
        params.set('before_id', cursor.id)
      }

      try {
        const res = await fetch(`/api/jigs/history?${params}`, { cache: 'no-store' })
        const data = await res.json().catch(() => null)
        if (id !== requestId.current) return

        if (!res.ok) {
          if (cursor) setMoreFailed(true)
          else setError(data?.code === 'not_migrated' ? 'not_migrated' : 'failed')
          return
        }
        // Offline with nothing saved, the service worker answers API calls with []
        if (!data || Array.isArray(data) || !Array.isArray((data as JigHistoryResponse).events)) {
          if (cursor) setMoreFailed(true)
          else setError('offline')
          return
        }
        const body = data as JigHistoryResponse
        if (!body.d1) {
          setError('no_db')
          return
        }
        setEvents(prev => (cursor ? [...prev, ...body.events] : body.events))
        setHasMore(body.has_more)
        setAsOf(body.as_of)
        setError(null)
        setMoreFailed(false)
      } catch {
        if (id !== requestId.current) return
        if (cursor) setMoreFailed(true)
        else setError(navigator.onLine ? 'failed' : 'offline')
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [jigId, unitId]
  )

  // First page, and again whenever a filter changes
  useEffect(() => {
    if (!filtersReady) return
    setLoading(true)
    fetchPage()
  }, [filtersReady, fetchPage])

  function loadMore() {
    const last = events[events.length - 1]
    if (!last || loadingMore) return
    setLoadingMore(true)
    setMoreFailed(false)
    fetchPage({ at: last.at, id: last.id })
  }

  const days = useMemo(() => {
    const out: { key: string; events: JigEvent[] }[] = []
    for (const event of events) {
      const key = localDayKey(event.at)
      const last = out[out.length - 1]
      if (last && last.key === key) last.events.push(event)
      else out.push({ key, events: [event] })
    }
    return out
  }, [events])

  const selectedJig = jigs.find(j => j.id === jigId)
  const unitOptions = selectedJig?.tracking === 'unit' ? selectedJig.units : []
  const filtered = !!(jigId || unitId)

  return (
    <div className="min-h-page text-white">
      <PageHeader
        title="History"
        subtitle="Where the jigs have been"
        onBack={() => {
          // Opened from Inventory: go back to it. Opened from a link: go to it.
          let fromInventory = false
          try {
            fromInventory = sessionStorage.getItem('jig-history-from-inventory') === '1'
            sessionStorage.removeItem('jig-history-from-inventory')
          } catch {}
          if (fromInventory) router.back()
          else router.push('/inventory')
        }}
      />

      <div className="mx-auto max-w-2xl px-4 py-5">
        {jigs.length > 0 && !error && (
          <div className={`mb-4 grid gap-2 ${unitOptions.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label htmlFor="history-jig" className="label">Jig</label>
              <select
                id="history-jig"
                value={jigId}
                onChange={e => {
                  setJigId(e.target.value)
                  setUnitId('')
                }}
                className="input"
              >
                <option value="">All jigs</option>
                {jigs.map(jig => (
                  <option key={jig.id} value={jig.id}>
                    {jig.name}
                    {jig.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {unitOptions.length > 0 && (
              <div>
                <label htmlFor="history-unit" className="label">Unit</label>
                <select id="history-unit" value={unitId} onChange={e => setUnitId(e.target.value)} className="input">
                  <option value="">All units</option>
                  {unitOptions.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                      {unit.status === 'retired' ? ' (retired)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-white/50">Loading history...</div>
        ) : error ? (
          <div className="card shadow-card px-5 py-8 text-center">
            <p className="text-sm text-white/70">{ERROR_COPY[error]}</p>
            {(error === 'failed' || error === 'offline') && (
              <button
                type="button"
                onClick={() => {
                  setLoading(true)
                  fetchPage()
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
                You’re offline. This is the last list this phone saved, so it may be missing recent moves.
              </p>
            )}

            {asOf && (
              <p className="mb-3 text-right text-[11px] text-white/35 tabular">
                Updated {new Date(asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}

            {events.length === 0 ? (
              <div className="py-16 text-center text-white/55">
                <p>{filtered ? 'Nothing has moved for that yet.' : 'Nothing has moved yet.'}</p>
                <p className="mt-2 text-xs text-white/40">When a jig goes out or comes back, it shows up here.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {days.map(day => (
                  <section key={day.key} aria-label={dayHeading(day.key)}>
                    <h2 className="eyebrow mb-2 px-1">{dayHeading(day.key)}</h2>
                    <ul className="card shadow-card divide-y divide-line overflow-hidden">
                      {day.events.map(event => (
                        <EventRow key={event.id} event={event} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-5">
                <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-secondary w-full py-3 text-sm">
                  {loadingMore ? 'Loading...' : 'Show more'}
                </button>
                {moreFailed && (
                  <p role="alert" className="mt-2 text-center text-xs text-red-300">
                    Couldn’t load more. Try again.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
