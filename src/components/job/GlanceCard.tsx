'use client'

import { useState } from 'react'
import type { Fldr } from '@/types/fldr'
import { AirplaneIcon, BoxIcon, BriefcaseIcon, BuildingIcon, CarIcon, ChevronDownIcon, FlagIcon } from '@/components/Icons'
import { CallLink, CopyAction, DirectionsLinks, EmailLink, InfoList, InfoRow, MapLink, SectionCard } from './parts'
import { STEP_LABELS, buildTimeline, missingEssentials, trackerProgress } from '@/lib/jobTracker'
import type { TimelineItem, TimelineKind } from '@/lib/jobTracker'
import { fmtDay, fmtDayRange, jobTypeText } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'

export interface DriveTime {
  /** "Hotel to Venue" */
  label: string
  duration: string
  distance: string
}

interface GlanceCardProps {
  fldr: Fldr
  jigsOut: number
  driveTimes: DriveTime[]
  driveTimesLoading: boolean
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
            {index < items.length - 1 && <span className="absolute bottom-0 left-[13px] top-7 w-px bg-line-strong" aria-hidden="true" />}
            <span
              className={`relative flex h-[27px] w-[27px] flex-shrink-0 items-center justify-center rounded-full border ${
                item.next
                  ? 'border-gold/70 bg-gold/15 text-gold'
                  : item.past
                  ? 'border-line bg-surface text-white/30'
                  : 'border-brand/50 bg-brand/15 text-brand-light'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`min-w-0 truncate text-base font-medium leading-[27px] ${item.past ? 'text-white/45' : 'text-white/90'}`}>
                  {item.title}
                </span>
                {item.next && <span className="badge flex-shrink-0 bg-gold/15 py-0.5 text-gold">Next</span>}
                <span className={`ml-auto flex-shrink-0 pl-1 text-sm tabular ${item.past ? 'text-white/35' : 'text-white/55'}`}>
                  {whenText(item)}
                </span>
              </div>
              {item.detail && <div className={`truncate text-sm ${item.past ? 'text-white/30' : 'text-white/45'}`}>{item.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** A quiet "show the rest" line under a short list */
function ShowMore({ open, onClick, more, less }: { open: boolean; onClick: () => void; more: string; less: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="-mx-2 mt-1 inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium text-brand-light transition-colors hover:bg-white/5 hover:text-white"
    >
      {open ? less : more}
      <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

/**
 * The job on one screen. It opens short: what's next, what's still missing, and the three
 * things people reach for (the contact, the venue, the hotel). The whole trip and the rest
 * of the details are a tap away.
 */
export default function GlanceCard({ fldr, jigsOut, driveTimes, driveTimesLoading, open, onToggle, onJump }: GlanceCardProps) {
  const [wholeTrip, setWholeTrip] = useState(false)
  const [moreDetails, setMoreDetails] = useState(false)

  const isJob = fldr.fldr_type !== 'time_off'
  // A job that's over doesn't need chasing: no "still missing", and no logistics list unless one was kept
  const wrapped = fldr.archived || fldr.job_status === 'complete'
  const info = fldr.job_info
  const progress = trackerProgress(fldr.tracker)
  const timeline = buildTimeline(fldr)
  const missing = isJob && !wrapped ? missingEssentials(fldr) : []
  const showLogistics = isJob && (!wrapped || !!fldr.tracker)
  const nextIndex = timeline.findIndex(item => item.next)
  const nextStop = nextIndex >= 0 ? timeline[nextIndex] : undefined
  const allDone = progress.total > 0 && progress.done === progress.total

  // Short by default: what's next and the two things after it (or the last few, once it's all behind)
  const shortTrip = timeline.length <= 4 ? timeline : nextIndex >= 0 ? timeline.slice(nextIndex, nextIndex + 3) : timeline.slice(-3)
  const shownTrip = wholeTrip ? timeline : shortTrip

  const staff = (fldr.people || []).filter(p => p.name && p.name.trim())
  const products = (fldr.products || []).filter(p => p.name)
  const checklist = fldr.checklist || []
  const checked = checklist.filter(item => item.completed).length
  const type = jobTypeText(info)

  // Every airport on the trip, once
  const airports = new Map<string, string>()
  for (const flight of Array.isArray(fldr.flight_info) ? fldr.flight_info : []) {
    if (flight.departure_code && flight.departure_address) airports.set(flight.departure_code, flight.departure_address)
    if (flight.arrival_code && flight.arrival_address) airports.set(flight.arrival_code, flight.arrival_address)
  }

  const hasContact = !!(info?.client_contact_name || info?.client_contact_phone || info?.client_contact_email)
  const hasVenue = !!(fldr.venue_info?.name || fldr.venue_info?.address)
  const hasHotel = !!(fldr.hotel_info?.name || fldr.hotel_info?.address)
  const hasEssentials = hasContact || hasVenue || hasHotel || jigsOut > 0
  const hasMore =
    !!info?.client_name ||
    !!info?.distributor_name ||
    !!info?.job_title ||
    !!type ||
    airports.size > 0 ||
    driveTimes.length > 0 ||
    staff.length > 0 ||
    products.length > 0 ||
    checklist.length > 0

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
        <div>
          <h3 className="section-title mb-3">{wholeTrip || timeline.length <= 4 || !nextStop ? 'Start to End' : 'Coming Up'}</h3>
          {timeline.length > 0 ? (
            <>
              <Timeline items={shownTrip} />
              {timeline.length > shortTrip.length && (
                <ShowMore
                  open={wholeTrip}
                  onClick={() => setWholeTrip(!wholeTrip)}
                  more={`Show the whole trip (${timeline.length})`}
                  less="Show less"
                />
              )}
            </>
          ) : (
            <p className="text-[15px] leading-relaxed text-white/45">Dates, flights and the hotel line up here once they&apos;re in.</p>
          )}
        </div>

        {missing.length > 0 && (
          <div>
            <h3 className="section-title mb-2.5">Still Missing</h3>
            <div className="flex flex-wrap gap-2">
              {missing.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onJump(item.card)}
                  className="inline-flex min-h-[2.5rem] items-center rounded-full border border-dashed border-line-strong px-3.5 text-[15px] font-medium text-white/65 transition-colors hover:border-brand/60 hover:text-white"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {showLogistics && (
          <button
            type="button"
            onClick={() => onJump('logistics')}
            className="block w-full rounded-xl border border-line bg-canvas/40 p-3.5 text-left transition-colors hover:border-line-strong"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="section-title">Logistics</span>
              <span className={`text-sm font-semibold tabular ${allDone ? 'text-emerald-300' : 'text-white/60'}`}>
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
              <div className="mt-2.5 text-[15px] leading-snug text-white/60">
                <span className="text-white/45">Up next </span>
                <span className="font-medium text-white/90">{STEP_LABELS[progress.upNext[0]]}</span>
                {progress.upNext.length > 1 && <span className="text-white/45"> · {progress.upNext.length - 1} more</span>}
              </div>
            )}
          </button>
        )}

        {(hasEssentials || hasMore) && (
          <div>
            <h3 className="section-title mb-0.5">Quick Info</h3>
            <InfoList>
              {hasContact && info && (
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
                  {info.client_contact_phone && <div className="text-sm text-white/55">{info.client_contact_phone}</div>}
                  {info.client_contact_email && <div className="break-all text-sm text-white/55">{info.client_contact_email}</div>}
                </InfoRow>
              )}
              {hasVenue && fldr.venue_info && (
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
                  {fldr.venue_info.address && <div className="text-sm text-white/55">{fldr.venue_info.address}</div>}
                  {fldr.venue_info.address && <DirectionsLinks to={fldr.venue_info.address} />}
                </InfoRow>
              )}
              {hasHotel && fldr.hotel_info && (
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
                  {fldr.hotel_info.address && <div className="text-sm text-white/55">{fldr.hotel_info.address}</div>}
                  {fldr.hotel_info.confirmation && (
                    <div className="text-sm text-white/55">Confirmation {fldr.hotel_info.confirmation}</div>
                  )}
                  {fldr.hotel_info.address && <DirectionsLinks to={fldr.hotel_info.address} />}
                </InfoRow>
              )}
              {jigsOut > 0 && (
                <InfoRow label="Jigs">
                  <span className="text-amber-200/90">{jigsOut} still out</span>
                </InfoRow>
              )}

              {moreDetails && (
                <>
                  {info?.client_name && <InfoRow label="Client">{info.client_name}</InfoRow>}
                  {info?.distributor_name && <InfoRow label="Distributor">{info.distributor_name}</InfoRow>}
                  {(info?.job_title || type) && (
                    <InfoRow label="Job">{[info?.job_title, type !== info?.job_title && type].filter(Boolean).join(' · ')}</InfoRow>
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
                      <span className="text-sm text-white/55">{address}</span>
                    </InfoRow>
                  ))}
                  {driveTimes.length > 0 && (
                    <InfoRow label="Drive Times">
                      {driveTimes.map(drive => (
                        <div key={drive.label} className="flex justify-between gap-3">
                          <span className="text-white/55">{drive.label}</span>
                          <span className="tabular">
                            {drive.duration} <span className="text-white/45">({drive.distance})</span>
                          </span>
                        </div>
                      ))}
                      {driveTimesLoading && <div className="text-sm text-white/40">Working out drive times...</div>}
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
                        <div className="mt-0.5 flex justify-between gap-3 text-sm text-white/45">
                          <span>Total</span>
                          <span className="tabular">×{products.reduce((sum, p) => sum + p.quantity, 0)}</span>
                        </div>
                      )}
                    </InfoRow>
                  )}
                  {checklist.length > 0 && (
                    <InfoRow label="Checklist">
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(checked / checklist.length) * 100}%` }} />
                        </div>
                        <span className="text-sm tabular text-white/55">
                          {checked} of {checklist.length}
                        </span>
                      </div>
                    </InfoRow>
                  )}
                </>
              )}
            </InfoList>
            {hasMore && (
              <ShowMore open={moreDetails} onClick={() => setMoreDetails(!moreDetails)} more="Show more details" less="Show fewer details" />
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
