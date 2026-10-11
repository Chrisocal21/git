'use client'

import type { Fldr } from '@/types/fldr'
import { AirplaneIcon, BuildingIcon, CarIcon, CheckIcon, ChevronRightIcon, MapPinIcon } from '@/components/Icons'
import { WeatherSVG } from '@/components/WeatherIcon'
import { jobTypeText } from '@/lib/jobFormat'
import { STEP_LABELS, trackerProgress } from '@/lib/jobTracker'
import type { TripPhase } from '@/lib/tripDays'

export interface JobCardProps {
  job: Fldr
  /** Where the job is in its run-up (the countdown counts to the travel day) */
  phase: TripPhase
  temp?: { temp: number; main: string }
  /** The signed-in person's name, to light up their own avatar */
  me?: string | null
  onOpen: () => void
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-300',
  confirmed: 'bg-emerald-500/15 text-emerald-300',
  in_progress: 'bg-blue-500/15 text-blue-300',
  awaiting_return: 'bg-amber-500/15 text-amber-300',
  complete: 'bg-white/10 text-white/60',
}

function formatDay(date: string): string {
  const [year, month, day] = date.split('T')[0].split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const NOW_TONE = 'bg-brand/20 border-brand/40 text-brand-light'

function urgency(days: number): string {
  return days <= 2
    ? 'bg-red-500/10 border-red-500/30 text-red-300'
    : days <= 7
    ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
}

/**
 * How far off, in plain words. It counts to the day you leave ("In 2 days" is two days until you
 * travel); on that day it says Travel day, and once the job is on, Job day.
 */
function countdown(phase: TripPhase): { text: string; tone: string; hint: string } | null {
  switch (phase.kind) {
    case 'before':
      return {
        text: phase.days === 1 ? 'Tomorrow' : `In ${phase.days} days`,
        tone: urgency(phase.days),
        hint: phase.hasTravel ? 'Until the travel day' : 'Until the job',
      }
    case 'travel-day':
      return { text: 'Travel day', tone: NOW_TONE, hint: 'Today is the travel day' }
    case 'between':
      return { text: phase.days === 1 ? 'Job tomorrow' : `Job in ${phase.days} days`, tone: urgency(phase.days), hint: 'Until the job starts' }
    case 'job-day':
      return { text: 'Job day', tone: NOW_TONE, hint: 'The job is on today' }
    default:
      return null
  }
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?'
}

/**
 * One job on the list, as a small dashboard of its own: how soon, the weather there, how far along
 * the Logistics checklist is, whether the trip pieces are in, and who's going. Everything shown is
 * already saved on the job; the card only reads it.
 */
export default function JobCard({ job, phase, temp, me, onOpen }: JobCardProps) {
  const happeningNow = phase.kind === 'job-day' || phase.kind === 'travel-day'
  const finished = job.archived || job.job_status === 'complete'
  // A job with its items still out has been worked; it's waiting on the return, so it has no checklist to show
  const working = !finished && job.job_status !== 'awaiting_return'

  const badge = finished ? null : countdown(phase)
  const typeText = jobTypeText(job.job_info)
  const people = (job.people || []).filter(p => p.name)
  const names = people.map(p => p.name).join(', ')
  const onThisJob = !!me && people.some(p => p.name.toLowerCase() === me.toLowerCase())

  const progress = trackerProgress(job.tracker)
  const nextStep = progress.upNext[0] ? STEP_LABELS[progress.upNext[0]] : null

  const trip = [
    job.flight_info != null && {
      key: 'flights',
      label: 'Flights',
      icon: AirplaneIcon,
      done: Array.isArray(job.flight_info) && job.flight_info.some(s => s.departure_airport || s.arrival_airport || s.departure_code || s.arrival_code),
    },
    job.hotel_info != null && { key: 'hotel', label: 'Hotel', icon: BuildingIcon, done: !!(job.hotel_info.name || job.hotel_info.address) },
    job.rental_car_info != null && { key: 'car', label: 'Car', icon: CarIcon, done: !!(job.rental_car_info.company || job.rental_car_info.pickup_location) },
    { key: 'venue', label: 'Venue', icon: MapPinIcon, done: !!(job.venue_info?.name || job.venue_info?.address) },
  ].filter(Boolean) as { key: string; label: string; icon: (props: { className?: string }) => JSX.Element; done: boolean }[]

  const subtitle = job.location
    ? job.title
    : job.job_info?.distributor_name !== job.title
    ? job.job_info?.distributor_name
    : null

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full rounded-2xl border bg-surface p-4 text-left shadow-card transition-[transform,background-color] active:scale-[0.99] active:bg-surface-raised ${
        happeningNow ? 'border-brand ring-1 ring-brand/40' : 'border-line'
      } ${finished ? 'opacity-90' : ''}`}
    >
      {/* Where, and how soon */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-xl font-semibold leading-tight text-white">{job.location || job.title}</h3>
          <div className="mt-1 truncate text-[15px] text-white/60">
            {subtitle}
            {job.location && job.job_info?.distributor_name && job.job_info.distributor_name !== job.title && (
              <span className="ml-1.5 text-white/40">· {job.job_info.distributor_name}</span>
            )}
          </div>
        </div>
        {badge && (
          <span title={badge.hint} className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-sm font-semibold ${badge.tone}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* When, and the weather there */}
      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-[15px] tabular text-white/65">
          {formatDay(job.date_start)}
          {job.date_end && formatDay(job.date_end) !== formatDay(job.date_start) ? ` – ${formatDay(job.date_end)}` : ''}
        </div>
        {temp && (
          <div className="flex flex-shrink-0 items-center gap-1.5 text-white/65" title="The weather there now">
            <WeatherSVG condition={temp.main} size="xs" />
            <span className="text-[15px] font-medium tabular">{Math.round(temp.temp)}°</span>
          </div>
        )}
      </div>

      {/* The job's own dashboard: how far along, and which trip pieces are in */}
      {working && (
        <div className="mt-3.5 space-y-3 rounded-xl bg-white/[0.04] p-3">
          {progress.total > 0 && (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-white/80">Logistics</span>
                <span className="text-sm tabular text-white/60">
                  {progress.done} of {progress.total} done
                </span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Logistics done"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.done}
              >
                <div
                  className={`h-full rounded-full ${progress.done === progress.total ? 'bg-emerald-400' : 'bg-brand'}`}
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <div className="mt-1.5 truncate text-sm text-white/50">
                {nextStep ? `Next: ${nextStep}` : 'Everything on the list is done'}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {trip.map(item => (
              <span
                key={item.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium ${
                  item.done ? 'bg-brand/15 text-brand-light' : 'bg-white/[0.05] text-white/40'
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
                {item.done ? <CheckIcon className="h-3 w-3" /> : null}
                <span className="sr-only">{item.done ? ' is in' : ' is not in yet'}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Who's going, and where the job stands */}
      <div className="mt-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {people.length > 0 || typeText ? (
            <div className="flex items-center gap-2.5">
              {people.length > 0 && (
                <div className="flex flex-shrink-0 items-center" aria-hidden="true">
                  {people.slice(0, 4).map((person, index) => (
                    <span
                      key={`${person.name}-${index}`}
                      className={`-ml-1.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-surface first:ml-0 ${
                        me && person.name.toLowerCase() === me.toLowerCase() ? 'bg-gold text-black' : 'bg-brand/25 text-brand-light'
                      }`}
                    >
                      {initial(person.name)}
                    </span>
                  ))}
                  {people.length > 4 && (
                    <span className="-ml-1.5 flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-white/10 px-1 text-xs font-semibold text-white/70 ring-2 ring-surface">
                      +{people.length - 4}
                    </span>
                  )}
                </div>
              )}
              <div className="min-w-0 truncate text-[15px] leading-snug text-white/70">
                {names}
                {typeText && (
                  <span className="text-[13px] text-white/45">
                    {names ? ' · ' : ''}
                    {typeText}
                  </span>
                )}
              </div>
            </div>
          ) : null}
          <div className={`flex flex-wrap items-center gap-2 ${people.length > 0 || typeText ? 'mt-2.5' : ''}`}>
            {job.job_status && (
              <span className={`badge ${STATUS_STYLE[job.job_status] || 'bg-white/10 text-white/60'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {job.job_status === 'awaiting_return' ? 'waiting on return' : job.job_status.replace('_', ' ')}
              </span>
            )}
            {onThisJob && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-light">
                <AirplaneIcon className="h-4 w-4 flex-shrink-0" />
                You&apos;re on this job
              </span>
            )}
          </div>
        </div>
        <ChevronRightIcon className="h-5 w-5 flex-shrink-0 text-white/30" />
      </div>
    </button>
  )
}
