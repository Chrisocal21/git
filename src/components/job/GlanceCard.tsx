'use client'

import type { Fldr } from '@/types/fldr'
import { AirplaneIcon, BoxIcon, BriefcaseIcon, BuildingIcon, CarIcon, FlagIcon } from '@/components/Icons'
import { CallLink, CopyAction, EmailLink, InfoList, InfoRow, MapLink, SectionCard } from './parts'
import { STEP_LABELS, buildTimeline, missingEssentials, trackerProgress } from '@/lib/jobTracker'
import type { TimelineItem, TimelineKind } from '@/lib/jobTracker'
import { fmtDay, fmtDayRange, jobTypeLabel } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'

interface GlanceCardProps {
  fldr: Fldr
  jigsOut: number
  // What /api/distance sends back for this job's addresses
  distances: { distances?: Array<{ destination: string; duration?: string; distance?: string; error?: string }> } | null
  distancesLoading: boolean
  open: boolean
  onToggle: () => void
  /** Opens a card further down the page and scrolls to it */
  onJump: (card: string) => void
}

const KIND_ICONS: Record<TimelineKind, (props: { className?: string }) => JSX.Element> = {
  date: FlagIcon,
  ship: BoxIcon,
  flight: AirplaneIcon,
  hotel: BuildingIcon,
  car: CarIcon,
  event: BriefcaseIcon,
}

function whenText(item: TimelineItem): string {
  if (item.endDay) return fmtDayRange(item.day, item.endDay)
  return item.day === todayKey() ? 'Today' : fmtDay(item.day, true)
}

function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol>
      {items.map((item, index) => {
        const Icon = KIND_ICONS[item.kind]
        return (
          <li key={item.id} className="relative flex gap-3 pb-3.5 last:pb-0">
            {index < items.length - 1 && <span className="absolute bottom-0 left-[11px] top-6 w-px bg-line-strong" aria-hidden="true" />}
            <span
              className={`relative flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded-full border ${
                item.next
                  ? 'border-gold/70 bg-gold/15 text-gold'
                  : item.past
                  ? 'border-line bg-surface text-white/30'
                  : 'border-brand/50 bg-brand/15 text-brand-light'
              }`}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`min-w-0 truncate text-sm font-medium leading-[23px] ${item.past ? 'text-white/45' : 'text-white/90'}`}>
                  {item.title}
                </span>
                {item.next && <span className="badge flex-shrink-0 bg-gold/15 py-0.5 text-gold">Next</span>}
                <span className={`ml-auto flex-shrink-0 pl-1 text-xs tabular ${item.past ? 'text-white/35' : 'text-white/55'}`}>
                  {whenText(item)}
                </span>
              </div>
              {item.detail && <div className={`truncate text-xs ${item.past ? 'text-white/30' : 'text-white/45'}`}>{item.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** The job on one screen: what's left to do, the trip from start to end, and the details you reach for most */
export default function GlanceCard({ fldr, jigsOut, distances, distancesLoading, open, onToggle, onJump }: GlanceCardProps) {
  const isJob = fldr.fldr_type !== 'time_off'
  // A job that's over doesn't need chasing: no "still missing", and no logistics list unless one was kept
  const wrapped = fldr.archived || fldr.job_status === 'complete'
  const info = fldr.job_info
  const progress = trackerProgress(fldr.tracker)
  const timeline = buildTimeline(fldr)
  const missing = isJob && !wrapped ? missingEssentials(fldr) : []
  const showLogistics = isJob && (!wrapped || !!fldr.tracker)
  const nextStop = timeline.find(item => item.next)
  const allDone = progress.total > 0 && progress.done === progress.total

  const staff = (fldr.people || []).filter(p => p.name && p.name.trim())
  const products = (fldr.products || []).filter(p => p.name)
  const checklist = fldr.checklist || []
  const checked = checklist.filter(item => item.completed).length
  const type = jobTypeLabel(info?.job_type)
  const driveTimes = (distances?.distances || []).filter(d => !d.error)

  // Every airport on the trip, once
  const airports = new Map<string, string>()
  for (const flight of Array.isArray(fldr.flight_info) ? fldr.flight_info : []) {
    if (flight.departure_code && flight.departure_address) airports.set(flight.departure_code, flight.departure_address)
    if (flight.arrival_code && flight.arrival_address) airports.set(flight.arrival_code, flight.arrival_address)
  }

  const hasQuickInfo =
    !!info?.client_name ||
    !!info?.distributor_name ||
    !!info?.client_contact_name ||
    !!info?.client_contact_phone ||
    !!info?.client_contact_email ||
    !!info?.job_title ||
    !!type ||
    !!fldr.venue_info?.name ||
    !!fldr.venue_info?.address ||
    !!fldr.hotel_info?.name ||
    !!fldr.hotel_info?.address ||
    airports.size > 0 ||
    staff.length > 0 ||
    products.length > 0 ||
    driveTimes.length > 0 ||
    checklist.length > 0 ||
    jigsOut > 0

  return (
    <SectionCard
      id="summary"
      title="Job Summary"
      open={open}
      onToggle={onToggle}
      summary={
        nextStop
          ? `Next: ${nextStop.title} · ${whenText(nextStop)}`
          : showLogistics && progress.total > 0
          ? `Logistics ${progress.done} of ${progress.total} done`
          : undefined
      }
    >
      <div className="space-y-5">
        {showLogistics && (
          <button
            type="button"
            onClick={() => onJump('logistics')}
            className="block w-full rounded-xl border border-line bg-canvas/40 p-3 text-left transition-colors hover:border-line-strong"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Logistics</span>
              <span className={`text-xs font-semibold tabular ${allDone ? 'text-emerald-300' : 'text-white/60'}`}>
                {progress.done} of {progress.total} done
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div
                className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-400' : 'bg-brand'}`}
                style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : '0%' }}
              />
            </div>
            {progress.upNext.length > 0 && (
              <div className="mt-2.5 text-sm leading-snug text-white/60">
                <span className="text-white/45">Up next </span>
                <span className="font-medium text-white/90">{STEP_LABELS[progress.upNext[0]]}</span>
                {progress.upNext.slice(1, 3).map(key => (
                  <span key={key}> · {STEP_LABELS[key]}</span>
                ))}
                {progress.upNext.length > 3 && <span className="text-white/45"> · {progress.upNext.length - 3} more</span>}
              </div>
            )}
          </button>
        )}

        {missing.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Still Missing</div>
            <div className="flex flex-wrap gap-1.5">
              {missing.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onJump(item.card)}
                  className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs font-medium text-white/60 transition-colors hover:border-brand/60 hover:text-white"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="eyebrow mb-2.5">Start to End</div>
          {timeline.length > 0 ? (
            <Timeline items={timeline} />
          ) : (
            <p className="text-sm text-white/45">Dates, flights and the hotel line up here once they&apos;re in.</p>
          )}
        </div>

        {hasQuickInfo && (
          <div>
            <div className="eyebrow mb-0.5">Quick Info</div>
            <InfoList>
              {info?.client_name && <InfoRow label="Client">{info.client_name}</InfoRow>}
              {info?.distributor_name && <InfoRow label="Distributor">{info.distributor_name}</InfoRow>}
              {(info?.client_contact_name || info?.client_contact_phone || info?.client_contact_email) && (
                <InfoRow
                  label="Contact"
                  actions={
                    <>
                      {info.client_contact_phone && <CallLink phone={info.client_contact_phone} />}
                      {info.client_contact_email && <EmailLink email={info.client_contact_email} />}
                    </>
                  }
                >
                  {info.client_contact_name && <div>{info.client_contact_name}</div>}
                  {info.client_contact_phone && <div className="text-xs text-white/55">{info.client_contact_phone}</div>}
                  {info.client_contact_email && <div className="break-all text-xs text-white/55">{info.client_contact_email}</div>}
                </InfoRow>
              )}
              {(info?.job_title || type) && (
                <InfoRow label="Job">{[info?.job_title, type !== info?.job_title && type].filter(Boolean).join(' · ')}</InfoRow>
              )}
              {(fldr.venue_info?.name || fldr.venue_info?.address) && (
                <InfoRow
                  label="Venue"
                  actions={
                    fldr.venue_info.address && (
                      <>
                        <CopyAction text={fldr.venue_info.address} label="Copy address" />
                        <MapLink address={fldr.venue_info.address} />
                      </>
                    )
                  }
                >
                  {fldr.venue_info.name && <div>{fldr.venue_info.name}</div>}
                  {fldr.venue_info.address && <div className="text-xs text-white/55">{fldr.venue_info.address}</div>}
                </InfoRow>
              )}
              {(fldr.hotel_info?.name || fldr.hotel_info?.address) && (
                <InfoRow
                  label="Hotel"
                  actions={
                    fldr.hotel_info.address && (
                      <>
                        <CopyAction text={fldr.hotel_info.address} label="Copy address" />
                        <MapLink address={fldr.hotel_info.address} />
                      </>
                    )
                  }
                >
                  {fldr.hotel_info.name && <div>{fldr.hotel_info.name}</div>}
                  {fldr.hotel_info.address && <div className="text-xs text-white/55">{fldr.hotel_info.address}</div>}
                  {fldr.hotel_info.confirmation && (
                    <div className="text-xs text-white/55">Confirmation {fldr.hotel_info.confirmation}</div>
                  )}
                </InfoRow>
              )}
              {Array.from(airports.entries()).map(([code, address]) => (
                <InfoRow
                  key={code}
                  label={`${code} Airport`}
                  actions={
                    <>
                      <CopyAction text={address} label="Copy address" />
                      <MapLink address={address} />
                    </>
                  }
                >
                  <span className="text-xs text-white/55">{address}</span>
                </InfoRow>
              ))}
              {driveTimes.length > 0 && (
                <InfoRow label="Travel Times">
                  {driveTimes.map((dist, index) => {
                    const destination = dist.destination.toLowerCase()
                    const label =
                      destination.includes('venue') || fldr.venue_info?.address?.includes(dist.destination)
                        ? 'to Venue'
                        : destination.includes('airport') || destination.includes('san')
                        ? 'to Airport'
                        : 'Destination'
                    return (
                      <div key={index} className="flex justify-between gap-3">
                        <span className="text-white/55">{label}</span>
                        <span className="tabular">
                          {dist.duration} <span className="text-white/45">({dist.distance})</span>
                        </span>
                      </div>
                    )
                  })}
                  {distancesLoading && <div className="text-xs text-white/40">Calculating distances...</div>}
                </InfoRow>
              )}
              {staff.length > 0 && (
                <InfoRow label="Staff">{staff.map(p => (p.role ? `${p.name} (${p.role})` : p.name)).join(', ')}</InfoRow>
              )}
              {products.length > 0 && (
                <InfoRow label="Products">
                  {products.map(product => (
                    <div key={product.id} className="flex justify-between gap-3">
                      <span className="min-w-0 break-words">{product.name}</span>
                      <span className="flex-shrink-0 tabular text-white/55">×{product.quantity}</span>
                    </div>
                  ))}
                  {products.length > 1 && (
                    <div className="mt-0.5 flex justify-between gap-3 text-xs text-white/45">
                      <span>Total</span>
                      <span className="tabular">×{products.reduce((sum, p) => sum + p.quantity, 0)}</span>
                    </div>
                  )}
                </InfoRow>
              )}
              {jigsOut > 0 && (
                <InfoRow label="Jigs">
                  <span className="text-amber-200/90">{jigsOut} still out</span>
                </InfoRow>
              )}
              {checklist.length > 0 && (
                <InfoRow label="Checklist">
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(checked / checklist.length) * 100}%` }} />
                    </div>
                    <span className="text-xs tabular text-white/55">
                      {checked}/{checklist.length}
                    </span>
                  </div>
                </InfoRow>
              )}
            </InfoList>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
