'use client'

import { useState } from 'react'
import type { JobTracker, StepState, TrackerStep, TrackerStepKey } from '@/types/fldr'
import { CheckIcon, ChevronDownIcon } from '@/components/Icons'
import { AutoTextarea, SectionCard, YesNoToggle } from './parts'
import { STEP_LABELS, readStep, trackerProgress } from '@/lib/jobTracker'
import { fmtDay, fmtDayRange } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'

interface LogisticsCardProps {
  tracker: JobTracker | null | undefined
  preEngraveDetails: string | null
  open: boolean
  onToggle: () => void
  /** A tick, a date, a Yes or No: saved right away */
  onChange: (patch: Partial<JobTracker>) => void
  /** Typing: saved along with the rest of the page */
  onType: (patch: Partial<JobTracker>) => void
  onPreEngraveChange: (value: string) => void
  /** Pushes whatever has been typed so far */
  onCommit: () => void
}

const STATE_LABELS: Record<StepState, string> = { todo: 'To Do', done: 'Done', na: 'N/A' }

function Group({ label, count, children }: { label: string; count?: { done: number; total: number }; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="eyebrow">{label}</span>
        {count && count.total > 0 && (
          <span className={`text-[11px] font-semibold tabular ${count.done === count.total ? 'text-emerald-300/90' : 'text-white/40'}`}>
            {count.done}/{count.total}
          </span>
        )}
      </div>
      <div className="divide-y divide-line rounded-xl border border-line bg-canvas/40 px-3">{children}</div>
    </div>
  )
}

/** The slot a step's tick sits in, kept on rows without one so every label lines up */
function Lead({ children }: { children?: React.ReactNode }) {
  return (
    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-xs font-semibold text-white/30" aria-hidden="true">
      {children}
    </span>
  )
}

function StepRow({
  label,
  step,
  isNext,
  expanded,
  onExpand,
  onChange,
  onType,
  onCommit,
}: {
  label: string
  step: TrackerStep
  isNext: boolean
  expanded: boolean
  onExpand: () => void
  onChange: (step: TrackerStep) => void
  onType: (step: TrackerStep) => void
  onCommit: () => void
}) {
  const done = step.state === 'done'
  const na = step.state === 'na'

  const setState = (state: StepState) => {
    if (state === step.state) return
    onChange({ state, date: state === 'done' ? step.date || todayKey() : null, note: step.note })
  }

  return (
    <div>
      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => setState(done || na ? 'todo' : 'done')}
          aria-pressed={done}
          aria-label={`${label}: ${done ? 'done' : na ? 'not needed' : 'to do'}`}
          className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
            done
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
              : na
              ? 'border-line-strong bg-white/5 text-white/40'
              : isNext
              ? 'border-gold/80 ring-2 ring-gold/15 hover:bg-gold/10'
              : 'border-white/25 hover:border-white/50'
          }`}
        >
          {done ? <CheckIcon className="h-4 w-4" /> : na ? <span className="text-sm leading-none">–</span> : null}
        </button>
        <button type="button" onClick={onExpand} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left">
          <span className="min-w-0 flex-1">
            <span className={`block text-sm leading-snug ${na ? 'text-white/40' : 'text-white/90'}`}>{label}</span>
            {step.note && !expanded && <span className="mt-0.5 block truncate text-xs text-white/45">{step.note}</span>}
          </span>
          <span className={`flex-shrink-0 text-xs tabular ${done ? 'text-emerald-300/90' : 'text-white/40'}`}>
            {done ? fmtDay(step.date) || 'Done' : na ? 'N/A' : ''}
          </span>
          <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-white/25 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pb-3 pl-10">
          <div role="group" aria-label={`${label} status`} className="flex gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
            {(['todo', 'done', 'na'] as const).map(state => (
              <button
                key={state}
                type="button"
                onClick={() => setState(state)}
                aria-pressed={step.state === state}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  step.state === state ? 'bg-brand text-white' : 'text-white/55 hover:text-white'
                }`}
              >
                {STATE_LABELS[state]}
              </button>
            ))}
          </div>
          {!na && (
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={step.date || ''}
                // Picking a day says it happened, so the step ticks itself
                onChange={e => onChange({ state: e.target.value ? 'done' : step.state, date: e.target.value || null, note: step.note })}
                className="input"
              />
            </div>
          )}
          <div>
            <label className="label">Note</label>
            <input
              type="text"
              value={step.note || ''}
              onChange={e => onType({ ...step, note: e.target.value || null })}
              onBlur={onCommit}
              className="input"
              placeholder="Anything worth noting"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionRow({ label, value, onChange }: { label: string; value: 'yes' | 'no' | null | undefined; onChange: (value: 'yes' | 'no' | null) => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Lead>?</Lead>
      <span className="min-w-0 flex-1 text-sm leading-snug text-white/90">{label}</span>
      <YesNoToggle label={label} value={value} onChange={onChange} />
    </div>
  )
}

function TextRow({
  label,
  value,
  placeholder,
  onChange,
  onCommit,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
  onCommit: () => void
}) {
  return (
    <div className="flex gap-3 py-2.5">
      <Lead />
      <div className="min-w-0 flex-1">
        <label className="label">{label}</label>
        <AutoTextarea value={value} onChange={onChange} onBlur={onCommit} placeholder={placeholder} />
      </div>
    </div>
  )
}

export default function LogisticsCard({
  tracker,
  preEngraveDetails,
  open,
  onToggle,
  onChange,
  onType,
  onPreEngraveChange,
  onCommit,
}: LogisticsCardProps) {
  // One row's details open at a time
  const [expanded, setExpanded] = useState<string | null>(null)
  const progress = trackerProgress(tracker)
  const nextKey = progress.upNext[0] ?? null
  const count = (key: string) => progress.groups.find(g => g.key === key)
  const allDone = progress.total > 0 && progress.done === progress.total

  const step = (key: TrackerStepKey) => (
    <StepRow
      key={key}
      label={STEP_LABELS[key]}
      step={readStep(tracker, key)}
      isNext={key === nextKey}
      expanded={expanded === key}
      onExpand={() => setExpanded(expanded === key ? null : key)}
      onChange={next => onChange({ [key]: next })}
      onType={next => onType({ [key]: next })}
      onCommit={onCommit}
    />
  )

  const arrival = fmtDayRange(tracker?.product_arrival_start, tracker?.product_arrival_end)
  const showPreEngrave = tracker?.pre_decoration_needed === 'yes' || !!preEngraveDetails

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
          <span className={`text-xs font-semibold tabular ${allDone ? 'text-emerald-300' : 'text-white/55'}`}>
            {progress.done}/{progress.total}
          </span>
        )
      }
    >
      <div className="space-y-4">
        {progress.total > 0 && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${allDone ? 'bg-emerald-400' : 'bg-brand'}`}
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs tabular text-white/50">
              {progress.done} of {progress.total} done
            </span>
          </div>
        )}

        <Group label="Paperwork" count={count('paperwork')}>
          {step('po_received')}
          {step('contract_sent')}
          {step('contract_signed')}
          {step('invoice_sent')}
          {step('deposit_paid')}
        </Group>

        <Group label="Travel" count={count('travel')}>
          {step('travel_booked')}
        </Group>

        <Group label="Product" count={count('product')}>
          <QuestionRow
            label="Pre-decoration Needed?"
            value={tracker?.pre_decoration_needed}
            onChange={value => onChange({ pre_decoration_needed: value })}
          />
          {showPreEngrave && (
            <TextRow
              label="Pre-engrave Details"
              value={preEngraveDetails || ''}
              placeholder="Pre-engrave prep notes..."
              onChange={onPreEngraveChange}
              onCommit={onCommit}
            />
          )}
          {step('mockups_sent')}
          {step('mockups_approved')}
          {step('product_shipped')}
          <div>
            <button
              type="button"
              onClick={() => setExpanded(expanded === 'arrival' ? null : 'arrival')}
              aria-expanded={expanded === 'arrival'}
              className="flex w-full items-center gap-3 py-2 text-left"
            >
              <Lead />
              <span className="min-w-0 flex-1 py-1 text-sm leading-snug text-white/90">Product Arrival Window</span>
              <span className={`flex-shrink-0 text-xs tabular ${arrival ? 'text-white/70' : 'text-white/35'}`}>{arrival || 'Not set'}</span>
              <ChevronDownIcon className={`h-4 w-4 flex-shrink-0 text-white/25 transition-transform ${expanded === 'arrival' ? 'rotate-180' : ''}`} />
            </button>
            {expanded === 'arrival' && (
              <div className="grid grid-cols-2 gap-3 pb-3 pl-10">
                <div>
                  <label className="label">From</label>
                  <input
                    type="date"
                    value={tracker?.product_arrival_start || ''}
                    onChange={e => onChange({ product_arrival_start: e.target.value || null })}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">To</label>
                  <input
                    type="date"
                    value={tracker?.product_arrival_end || ''}
                    min={tracker?.product_arrival_start || undefined}
                    onChange={e => onChange({ product_arrival_end: e.target.value || null })}
                    className="input"
                  />
                </div>
              </div>
            )}
          </div>
        </Group>

        <Group label="Event Builder" count={count('builder')}>
          {step('input_form_created')}
          <TextRow
            label="Required Fields"
            value={tracker?.required_fields || ''}
            placeholder="What the input form has to collect"
            onChange={value => onType({ required_fields: value || null })}
            onCommit={onCommit}
          />
        </Group>

        <Group label="Signage" count={count('signage')}>
          <QuestionRow
            label="Signage Required"
            value={tracker?.signage_required}
            onChange={value => onChange({ signage_required: value })}
          />
          {tracker?.signage_required !== 'no' && (
            <>
              <TextRow
                label="Signage Specifics"
                value={tracker?.signage_specifics || ''}
                placeholder="Sizes, wording, how many"
                onChange={value => onType({ signage_specifics: value || null })}
                onCommit={onCommit}
              />
              {step('signage_created')}
            </>
          )}
        </Group>

        <Group label="Custom SMS" count={count('sms')}>
          <QuestionRow
            label="Custom SMS Needed"
            value={tracker?.custom_sms_needed}
            onChange={value => onChange({ custom_sms_needed: value })}
          />
          {tracker?.custom_sms_needed !== 'no' && step('custom_sms_created')}
        </Group>
      </div>
    </SectionCard>
  )
}
