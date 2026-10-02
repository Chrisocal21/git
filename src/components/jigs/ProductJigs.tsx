'use client'

import { useEffect, useMemo, useState } from 'react'
import JigPill from './JigPill'
import AddJigSheet from './AddJigSheet'
import CheckOutSheet from './CheckOutSheet'
import CheckInSheet from './CheckInSheet'
import UnavailableNote from './UnavailableNote'
import { lineName } from './types'
import type { JigJob, NeedGroup } from './types'
import type { JobJigs } from './useJobJigs'
import { jigsRequest, JigApiError } from '@/lib/jigsClient'
import { awaitingReturn, shortDate } from '@/lib/jigsFormat'
import { compareLabels } from '@/types/jigs'
import type { JigAllocation, JigUnavailableDetails } from '@/types/jigs'

interface ProductJigsProps {
  jigs: JobJigs
  job: JigJob
  // The product these jigs are for. null shows jigs that aren't tied to a product on the job any more.
  productId: string | null
  productName?: string
  // With productId null: the products that exist, so a jig whose product was removed still shows up
  knownProductIds?: string[]
}

type SheetState =
  | { kind: 'add' }
  | { kind: 'checkout'; typeIds: string[] | 'all' }
  | { kind: 'checkin'; ids: string[] | 'all' }

type LineProblem = { message: string; details: JigUnavailableDetails | null }

function groupNeeded(rows: JigAllocation[]): NeedGroup[] {
  const groups = new Map<string, NeedGroup>()
  for (const row of rows) {
    const group = groups.get(row.type_id) ?? {
      typeId: row.type_id,
      name: row.type_name,
      tracking: row.tracking,
      rows: [],
      qty: 0,
    }
    group.rows.push(row)
    group.qty += row.qty
    groups.set(row.type_id, group)
  }
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/** One line saying why jigs aren't available, shown once for the whole job rather than under every product */
export function JigsProblem({ jigs }: { jigs: JobJigs }) {
  if (!jigs.problem) return null
  return (
    <p className="rounded-lg border border-line bg-white/5 px-3 py-2 text-xs text-white/55">
      Jigs aren’t available right now. {jigs.problem}
    </p>
  )
}

function Stepper({
  value,
  onMinus,
  onPlus,
  disabled,
  label,
}: {
  value: number
  onMinus: () => void
  onPlus: () => void
  disabled: boolean
  label: string
}) {
  const button =
    'h-8 w-8 rounded-lg border border-line-strong text-base leading-none text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40'
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" onClick={onMinus} disabled={disabled} aria-label={`One fewer ${label}`} className={button}>
        −
      </button>
      <span className="w-6 text-center text-sm font-semibold tabular text-white" aria-live="polite">
        {value}
      </span>
      <button type="button" onClick={onPlus} disabled={disabled} aria-label={`One more ${label}`} className={button}>
        +
      </button>
    </div>
  )
}

const LINK = 'text-xs font-semibold transition-colors disabled:opacity-40'

export default function ProductJigs({ jigs, job, productId, productName, knownProductIds }: ProductJigsProps) {
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [lineProblems, setLineProblems] = useState<Record<string, LineProblem>>({})

  const knownKey = (knownProductIds ?? []).join('|')
  const start = job.start.slice(0, 10)
  const end = (job.end || job.start).slice(0, 10)

  const { needed, out, done, total } = useMemo(() => {
    const known = new Set(knownKey ? knownKey.split('|') : [])
    const mine = jigs.allocations.filter(a =>
      productId === null ? a.product_id == null || !known.has(a.product_id) : a.product_id === productId
    )
    const byName = (a: JigAllocation, b: JigAllocation) =>
      a.type_name.localeCompare(b.type_name) || compareLabels(a.unit_label ?? '', b.unit_label ?? '')
    return {
      needed: groupNeeded(mine.filter(a => a.status === 'needed')),
      out: mine.filter(a => a.status === 'out').sort(byName),
      done: mine
        .filter(a => a.status === 'returned' || a.status === 'lost')
        .sort((a, b) => (b.checked_in_at ?? '').localeCompare(a.checked_in_at ?? '')),
      total: mine.length,
    }
  }, [jigs.allocations, productId, knownKey])

  // The dialogs read their lines from the live list, so a line that's been dealt with drops out of them
  const checkoutGroups =
    sheet?.kind === 'checkout' ? needed.filter(g => sheet.typeIds === 'all' || sheet.typeIds.includes(g.typeId)) : []
  const checkinRows =
    sheet?.kind === 'checkin' ? out.filter(r => sheet.ids === 'all' || sheet.ids.includes(r.id)) : []

  useEffect(() => {
    if (sheet?.kind === 'checkout' && checkoutGroups.length === 0) setSheet(null)
    if (sheet?.kind === 'checkin' && checkinRows.length === 0) setSheet(null)
  }, [sheet, checkoutGroups.length, checkinRows.length])

  const canAct = jigs.online && !!jigs.userName
  const late = awaitingReturn({ job_end: end })

  async function changeQty(group: NeedGroup, direction: 1 | -1) {
    if (busyKey) return
    setBusyKey(group.typeId)
    setLineProblems(({ [group.typeId]: _gone, ...rest }) => rest)
    try {
      let res: { allocations: JigAllocation[] }
      if (direction === 1) {
        res = await jigsRequest('POST', '/api/jigs/allocations', {
          job_id: job.id,
          type_id: group.typeId,
          product_id: productId,
          qty: 1,
          start,
          end,
          created_by: jigs.userName,
        })
      } else {
        const row = group.rows[group.rows.length - 1]
        res =
          group.tracking === 'bulk' && row.qty > 1
            ? await jigsRequest('PUT', `/api/jigs/allocations/${row.id}`, { qty: row.qty - 1, start, end })
            : await jigsRequest('DELETE', `/api/jigs/allocations/${row.id}`)
      }
      jigs.replace(res.allocations)
    } catch (e) {
      const err = e instanceof JigApiError ? e : null
      setLineProblems(p => ({
        ...p,
        [group.typeId]: { message: err?.message ?? 'Something went wrong. Try again.', details: err?.details ?? null },
      }))
    } finally {
      setBusyKey(null)
    }
  }

  // Nothing to show for jigs that aren't tied to a product unless there are some
  if (productId === null && total === 0) return null
  // The reason is shown once for the whole job
  if (jigs.problem) return null

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{productId === null ? 'Other jigs on this job' : 'Jigs'}</span>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {needed.length > 1 && (
            <button
              type="button"
              onClick={() => setSheet({ kind: 'checkout', typeIds: 'all' })}
              disabled={!jigs.online}
              className={`${LINK} text-gold hover:text-gold-hover`}
            >
              Check out all
            </button>
          )}
          {out.length > 1 && (
            <button
              type="button"
              onClick={() => setSheet({ kind: 'checkin', ids: 'all' })}
              disabled={!jigs.online}
              className={`${LINK} text-white/70 hover:text-white`}
            >
              Check in all
            </button>
          )}
          {productId !== null && (
            <button
              type="button"
              onClick={() => setSheet({ kind: 'add' })}
              disabled={!jigs.online}
              title={jigs.online ? undefined : "You're offline"}
              className={`${LINK} text-brand-light hover:text-white`}
            >
              + Add jig
            </button>
          )}
        </div>
      </div>

      {!jigs.userName && (needed.length > 0 || out.length > 0) && (
        <p className="mt-2 text-xs text-amber-200/90">
          Pick your profile (menu on the Jobs page) to check jigs out or in.
        </p>
      )}

      {total === 0 ? (
        <p className="mt-2 text-xs text-white/40">{jigs.loading ? 'Loading jigs...' : 'No jigs yet.'}</p>
      ) : (
        <div className="mt-2.5 space-y-2">
          {needed.map(group => (
            <div key={group.typeId} className="rounded-lg border border-line bg-canvas/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-white">{group.name}</span>
                <JigPill tone="gray">Needed</JigPill>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Stepper
                  value={group.qty}
                  label={group.name}
                  disabled={!jigs.online || busyKey !== null}
                  onMinus={() => changeQty(group, -1)}
                  onPlus={() => changeQty(group, 1)}
                />
                <button
                  type="button"
                  onClick={() => setSheet({ kind: 'checkout', typeIds: [group.typeId] })}
                  disabled={!jigs.online || busyKey !== null}
                  className="btn-primary px-3.5 py-1.5 text-xs"
                >
                  Check out
                </button>
              </div>
              {lineProblems[group.typeId] && (
                <UnavailableNote
                  message={lineProblems[group.typeId].message}
                  details={lineProblems[group.typeId].details}
                />
              )}
            </div>
          ))}

          {out.map(row => (
            <div key={row.id} className="rounded-lg border border-line bg-canvas/40 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-white">{lineName(row)}</span>
                <JigPill tone={late ? 'amber' : 'blue'}>{late ? 'Awaiting return' : 'Out'}</JigPill>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0 text-xs text-white/50">
                  {row.checked_out_by ?? 'Someone'}
                  {row.checked_out_at ? ` · since ${shortDate(row.checked_out_at)}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => setSheet({ kind: 'checkin', ids: [row.id] })}
                  disabled={!jigs.online}
                  className="btn-secondary px-3.5 py-1.5 text-xs"
                >
                  Check in
                </button>
              </div>
            </div>
          ))}

          {done.map(row => (
            <div key={row.id} className="flex items-baseline justify-between gap-3 px-1 text-xs text-white/40">
              <span className="min-w-0 truncate">{lineName(row)}</span>
              <span
                className={`flex-shrink-0 ${
                  row.status === 'lost' ? 'text-red-300/80' : row.return_condition === 'needs_repair' ? 'text-amber-300/80' : ''
                }`}
              >
                {row.status === 'lost' ? 'Lost' : 'Back'}
                {row.checked_in_at ? ` ${shortDate(row.checked_in_at)}` : ''}
                {row.status === 'returned' && row.return_condition === 'needs_repair' ? ' · needs repair' : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      {sheet?.kind === 'add' && (
        <AddJigSheet
          job={job}
          productId={productId}
          productName={productName}
          userName={jigs.userName}
          onClose={() => setSheet(null)}
          onAdded={list => {
            jigs.replace(list)
            setSheet(null)
          }}
        />
      )}

      {sheet?.kind === 'checkout' && checkoutGroups.length > 0 && (
        <CheckOutSheet
          jobId={job.id}
          groups={checkoutGroups}
          userName={jigs.userName}
          online={jigs.online}
          onClose={() => setSheet(null)}
          onUpdated={jigs.replace}
        />
      )}

      {sheet?.kind === 'checkin' && checkinRows.length > 0 && (
        <CheckInSheet
          rows={checkinRows}
          userName={jigs.userName}
          online={jigs.online}
          onClose={() => setSheet(null)}
          onUpdated={jigs.replace}
        />
      )}
    </div>
  )
}
