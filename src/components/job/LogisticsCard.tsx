'use client'

import { useState } from 'react'
import type { JobTracker, StepState, TrackerStep, TrackerStepKey } from '@/types/fldr'
import { CheckIcon, ChevronDownIcon } from '@/components/Icons'
import { SectionCard } from './parts'
import { STEPS, STEP_HINTS, STEP_LABELS, arrivalText, earlierEntries, readStep, trackerProgress } from '@/lib/jobTracker'
import { fmtDay } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'

interface LogisticsCardProps {
  tracker: JobTracker | null | undefined
  open: boolean
  onToggle: () => void
  /** A tick, a date: saved right away */
  onChange: (patch: Partial<JobTracker>) => void
  /** Typing: saved along with the rest of the page */
  onType: (patch: Partial<JobTracker>) => void
  /** Pushes whatever has been typed so far */
  onCommit: () => void
}

const STATE_LABELS: Record<StepState, string> = { todo: 'To Do', done: 'Done', na: 'Not Needed' }

function StepRow({
  stepKey,
  step,
  tracker,
  isNext,
  expanded,
  onExpand,
  onChange,
  onType,
  onCommit,
}: {
  stepKey: TrackerStepKey
  step: TrackerStep
  tracker: JobTracker | null | undefined
  isNext: boolean
  expanded: boolean
  onExpand: () => void
  onChange: (patch: Partial<JobTracker>) => void
  onType: (patch: Partial<JobTracker>) => void
  onCommit: () => void
}) {
  const label = STEP_LABELS[stepKey]
  const hint = STEP_HINTS[stepKey]
  const done = step.state === 'done'
  const na = step.state === 'na'
  // Product Shipped also holds the days it's due to land
  const arrival = stepKey === 'product_shipped' ? arrivalText(tracker) : ''

  const setState = (state: StepState) => {
    if (state === step.state) return
    onChange({ [stepKey]: { state, date: state === 'done' ? step.date || todayKey() : null, note: step.note } })
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* The whole 48px square takes the tap; the circle inside is what's drawn */}
        <button
          type="button"
          onClick={() => setState(done || na ? 'todo' : 'done')}
          aria-pressed={done}
          aria-label={`${label}: ${done ? 'done' : na ? 'not needed' : 'to do'}`}
          className="group flex h-12 w-12 flex-shrink-0 items-center justify-center"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors ${
              done
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                : na
                ? 'border-line-strong bg-white/5 text-white/40'
                : isNext
                ? 'border-gold/80 ring-2 ring-gold/15 group-hover:bg-gold/10'
                : 'border-white/30 group-hover:border-white/55'
            }`}
          >
            {done ? <CheckIcon className="h-[18px] w-[18px]" /> : na ? <span className="text-base leading-none">–</span> : null}
          </span>
        </button>
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-2 py-2 text-left">
          <span className="min-w-0 flex-1">
            <span className={`block text-[17px] font-medium leading-snug ${na ? 'text-white/40' : done ? 'text-white/70' : 'text-white'}`}>{label}</span>
            {!expanded && (step.note || arrival) && (
              <span className="mt-0.5 block truncate text-sm text-white/50">{[arrival && `Arrives ${arrival}`, step.note].filter(Boolean).join(' · ')}</span>
            )}
          </span>
          <span className={`flex-shrink-0 text-sm tabular ${done ? 'text-emerald-300/90' : 'text-white/45'}`}>
            {done ? fmtDay(step.date) || 'Done' : na ? 'Not needed' : ''}
          </span>
          <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pb-4 pl-[3.25rem] pr-1">
          {hint && <p className="text-sm leading-relaxed text-white/55">{hint}</p>}
          <div role="group" aria-label={`${label} status`} className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
            {(['todo', 'done', 'na'] as const).map(state => (
              <button
                key={state}
                type="button"
                onClick={() => setState(state)}
                aria-pressed={step.state === state}
                className={`h-11 flex-1 rounded-md px-2 text-[15px] font-semibold transition-colors ${
                  step.state === state ? 'bg-brand text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                {STATE_LABELS[state]}
              </button>
            ))}
          </div>
          {!na && (
            <div>
              <label className="label">Date it happened</label>
              <input
                type="date"
                aria-label={`${label}: date`}
                value={step.date || ''}
                // Picking a day says it happened, so the step ticks itself
                onChange={e => onChange({ [stepKey]: { state: e.target.value ? 'done' : step.state, date: e.target.value || null, note: step.note } })}
                className="input"
              />
            </div>
          )}
          {stepKey === 'product_shipped' && !na && (
            <div>
              <label className="label">Arrives between</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label="Product arrives: earliest"
                  value={tracker?.product_arrival_start || ''}
                  onChange={e => onChange({ product_arrival_start: e.target.value || null })}
                  className="input"
                />
                <input
                  type="date"
                  aria-label="Product arrives: latest"
                  value={tracker?.product_arrival_end || ''}
                  min={tracker?.product_arrival_start || undefined}
                  onChange={e => onChange({ product_arrival_end: e.target.value || null })}
                  className="input"
                />
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">The days it should land. One day is fine. It shows on the Job Summary.</p>
            </div>
          )}
          <div>
            <label className="label">Note</label>
            <input
              type="text"
              aria-label={`${label}: note`}
              value={step.note || ''}
              onChange={e => onType({ [stepKey]: { ...step, note: e.target.value || null } })}
              onBlur={onCommit}
              className="input"
              placeholder="e.g. Tracking number, who approved it"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** The short list of things that have to be true before the trip */
export default function LogisticsCard({ tracker, open, onToggle, onChange, onType, onCommit }: LogisticsCardProps) {
  // One row's details open at a time
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showEarlier, setShowEarlier] = useState(false)
  const progress = trackerProgress(tracker)
  const nextKey = progress.upNext[0] ?? null
  const allDone = progress.total > 0 && progress.done === progress.total
  const earlier = earlierEntries(tracker)

  return (
    <SectionCard
      id="logistics"
      title="Logistics"
      open={open}
      onToggle={onToggle}
      progress={progress.total > 0 ? progress.done / progress.total : undefined}
      summary={
        allDone
          ? 'Everything on the list is done'
          : nextKey
          ? `Up next: ${STEP_LABELS[nextKey]}${progress.upNext.length > 1 ? ` · ${progress.upNext.length - 1} more` : ''}`
          : undefined
      }
      meta={
        progress.total > 0 && (
          <span className={`text-[15px] font-semibold tabular ${allDone ? 'text-emerald-300' : 'text-white/60'}`}>
            {progress.done} of {progress.total}
          </span>
        )
      }
    >
      <div className="space-y-3">
        <p className="text-[15px] leading-relaxed text-white/55">
          The few things that have to be true before the trip. Tap a circle when one is done.
        </p>

        {progress.total > 0 && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-400' : 'bg-brand'}`}
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-sm tabular text-white/55">
              {progress.done} of {progress.total} done
            </span>
          </div>
        )}

        <div className="divide-y divide-line rounded-xl border border-line bg-canvas/40 pl-1 pr-3">
          {STEPS.map(key => (
            <StepRow
              key={key}
              stepKey={key}
              step={readStep(tracker, key)}
              tracker={tracker}
              isNext={key === nextKey}
              expanded={expanded === key}
              onExpand={() => setExpanded(expanded === key ? null : key)}
              onChange={onChange}
              onType={onType}
              onCommit={onCommit}
            />
          ))}
        </div>

        {/* A job that used the longer list keeps what was entered on it, to read */}
        {earlier.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowEarlier(!showEarlier)}
              aria-expanded={showEarlier}
              className="-mx-2 inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium text-brand-light transition-colors hover:bg-white/5 hover:text-white"
            >
              {showEarlier ? 'Hide' : 'Show'} earlier entries ({earlier.length})
              <ChevronDownIcon className={`h-4 w-4 transition-transform ${showEarlier ? 'rotate-180' : ''}`} />
            </button>
            {showEarlier && (
              <div className="mt-1 divide-y divide-line rounded-xl border border-line px-3.5">
                {earlier.map(entry => (
                  <div key={entry.label} className="py-2.5">
                    <div className="text-[13px] text-white/45">{entry.label}</div>
                    <div className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-white/80">{entry.text}</div>
                  </div>
                ))}
                <p className="py-2.5 text-[13px] leading-relaxed text-white/40">Saved before the list was shortened. Kept as it was; these now live in Asana.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}
