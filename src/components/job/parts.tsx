'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon,
  ChevronRightIcon,
  CopyIcon,
  DirectionsIcon,
  ExternalLinkIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  SparkIcon,
} from '@/components/Icons'
import { directionsUrl, linkHref, mapsUrl, splitDateTime } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'

// The pieces every card on the job page is built from, so they all read the same way.
// Anything you tap is at least 44px tall: this page gets used one-handed, in a hurry.

/** The heading that starts a group of cards. Large, so the page can be found your way around at a glance. */
export function GroupHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="px-1 pt-5 text-xl font-semibold leading-tight text-white">{children}</h2>
}

interface SectionCardProps {
  /** Also the scroll target: the card renders as #card-<id> */
  id: string
  title: string
  /** One line of what's inside, shown while the card is closed */
  summary?: React.ReactNode
  /** Sits beside the title whether the card is open or not (a count, a temperature) */
  meta?: React.ReactNode
  /** Buttons that only make sense once the card is open */
  actions?: React.ReactNode
  /** 0 to 1. Draws a hairline of progress along the bottom of the closed card. */
  progress?: number
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}

export function SectionCard({ id, title, summary, meta, actions, progress, open, onToggle, children }: SectionCardProps) {
  return (
    <div id={`card-${id}`} className="card shadow-card relative scroll-mt-28">
      <div className="relative flex min-h-[3.5rem] items-center gap-2 py-2 pl-4 pr-3">
        {/* The whole header opens and closes the card; the buttons on it sit above this */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={title}
          className={`absolute inset-0 transition-colors hover:bg-white/[0.03] active:bg-white/[0.07] ${open ? 'rounded-t-2xl' : 'rounded-2xl'}`}
        />
        <div className="pointer-events-none relative min-w-0 flex-1">
          <div className="font-display text-lg font-semibold leading-snug">{title}</div>
          {!open && summary && <div className="mt-0.5 truncate text-sm text-white/50">{summary}</div>}
        </div>
        {meta && <div className="pointer-events-none relative flex-shrink-0">{meta}</div>}
        {open && actions && <div className="relative flex flex-shrink-0 items-center gap-0.5">{actions}</div>}
        {/* A closed card points to the right, like a row in a list; open, it points down */}
        <ChevronRightIcon
          className={`pointer-events-none relative h-5 w-5 flex-shrink-0 text-white/35 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </div>
      {open && <div className="px-4 pb-4">{children}</div>}
      {!open && progress !== undefined && progress > 0 && (
        <div className="pointer-events-none absolute inset-x-4 bottom-0 h-0.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(1, progress) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

/**
 * Whether a card is showing its form. A card with nothing saved always shows the form;
 * one with something saved opens to read. Closing the card ends the edit, and ending
 * an edit (either way) saves what was typed.
 */
export function useEditMode(hasData: boolean, open: boolean, onDone: () => void) {
  const [editing, setEditing] = useState(!hasData)
  const wasOpen = useRef(open)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (wasOpen.current && !open && editing) done.current()
    wasOpen.current = open
    if (!open) setEditing(!hasData)
    // Emptied out while open: there's nothing to read, so it's the form again
    else if (!hasData) setEditing(true)
  }, [open, hasData, editing])

  const toggle = () => {
    if (editing) done.current()
    setEditing(!editing)
  }
  return { editing, toggle, startEditing: () => setEditing(true) }
}

/** Switches a card between reading and filling in */
export function EditButton({ editing, onClick }: { editing: boolean; onClick: () => void }) {
  if (editing) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Done
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold text-brand-light transition-colors hover:bg-white/5 hover:text-white"
    >
      <PencilIcon className="h-4 w-4" />
      Edit
    </button>
  )
}

// ── Reading ─────────────────────────────────────────────────────────────────

export function InfoList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line">{children}</div>
}

/** A label, what's saved for it, and the things you'd do with it (copy, call, open) */
export function InfoRow({ label, children, actions }: { label: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] leading-4 text-white/45">{label}</div>
        <div className="mt-0.5 break-words text-base leading-snug text-white/90">{children}</div>
      </div>
      {actions && <div className="-mr-2.5 flex flex-shrink-0 items-center">{actions}</div>}
    </div>
  )
}

const ICON_ACTION =
  'inline-flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-white/5 hover:text-white'

export function CallLink({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`} title="Call" aria-label={`Call ${phone}`} className={`${ICON_ACTION} text-brand-light`}>
      <PhoneIcon className="h-[18px] w-[18px]" />
    </a>
  )
}

export function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} title="Email" aria-label={`Email ${email}`} className={`${ICON_ACTION} text-brand-light`}>
      <MailIcon className="h-[18px] w-[18px]" />
    </a>
  )
}

export function MapLink({ address }: { address: string }) {
  return (
    <a
      href={mapsUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title="Open in Maps"
      aria-label="Open in Maps"
      className={`${ICON_ACTION} text-brand-light`}
    >
      <MapPinIcon className="h-[18px] w-[18px]" />
    </a>
  )
}

export function OpenLink({ url }: { url: string }) {
  return (
    <a
      href={linkHref(url)}
      target="_blank"
      rel="noopener noreferrer"
      title="Open link"
      aria-label="Open link"
      className={`${ICON_ACTION} text-brand-light`}
    >
      <ExternalLinkIcon className="h-[18px] w-[18px]" />
    </a>
  )
}

/** Copies a value; the icon turns to a check for a moment so you know it took */
export function CopyAction({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  if (!text || !text.trim()) return null
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch (err) {
          console.error('Failed to copy:', err)
        }
      }}
      title={copied ? 'Copied!' : label}
      aria-label={copied ? 'Copied!' : label}
      className={`${ICON_ACTION} text-white/50`}
    >
      {copied ? <CheckIcon className="h-[18px] w-[18px] text-emerald-400" /> : <CopyIcon className="h-[18px] w-[18px]" />}
    </button>
  )
}

/**
 * Ways to drive to an address, as a row of links under it: from wherever the phone is,
 * and from the other places on the job (the hotel, the airport).
 */
export function DirectionsLinks({ to, from = [] }: { to: string; from?: Array<{ label: string; address: string | null | undefined }> }) {
  const origins = from.filter(origin => origin.address && origin.address !== to)
  const pill =
    'inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium text-brand-light transition-colors hover:border-brand/60 hover:text-white'
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a href={directionsUrl(to)} target="_blank" rel="noopener noreferrer" className={pill}>
        <DirectionsIcon className="h-4 w-4" />
        Directions
      </a>
      {origins.map(origin => (
        <a key={origin.label} href={directionsUrl(to, origin.address)} target="_blank" rel="noopener noreferrer" className={pill}>
          {origin.label}
        </a>
      ))}
    </div>
  )
}

// ── Filling in ──────────────────────────────────────────────────────────────

/** A labelled group of fields inside a form */
export function FormGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {title && <h3 className="section-title border-b border-line pb-1.5">{title}</h3>}
      {children}
    </div>
  )
}

/** Two fields side by side from tablet width up, stacked on a phone */
export function FieldRow({ children, always = false }: { children: React.ReactNode; always?: boolean }) {
  return <div className={`grid gap-3 ${always ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>{children}</div>
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">{hint}</p>}
    </div>
  )
}

/**
 * A day and a time, saved together the way the app has always saved them ("2026-03-14T08:05").
 * The day starts on `defaultDay` (the job's own date), so most of the time only the
 * time needs picking. Nothing is saved until there's a time.
 */
export function DateTimeField({
  label,
  hint,
  value,
  defaultDay,
  onChange,
}: {
  label: string
  hint?: string
  value: string | null | undefined
  defaultDay?: string | null
  onChange: (value: string | null) => void
}) {
  const saved = splitDateTime(value)
  // A day picked before there's a time to save it with
  const [draftDay, setDraftDay] = useState('')
  const day = saved.day || draftDay || splitDateTime(defaultDay).day

  const changeTime = (time: string) => {
    if (!time) {
      // Keep showing the day that was there
      setDraftDay(day)
      onChange(null)
      return
    }
    onChange(`${day || todayKey()}T${time}`)
  }

  const changeDay = (next: string) => {
    setDraftDay(next)
    if (saved.time) onChange(next ? `${next}T${saved.time}` : null)
  }

  return (
    <div className="min-w-0">
      <label className="label">{label}</label>
      <div className="grid grid-cols-[minmax(0,1fr)_7.75rem] gap-2">
        <input
          type="date"
          aria-label={`${label}: date`}
          value={day}
          onChange={e => changeDay(e.target.value)}
          // Dimmer while it's only the suggested day, with no time saved yet
          className={`input ${saved.day ? '' : 'text-white/50'}`}
        />
        <input type="time" aria-label={`${label}: time`} value={saved.time} onChange={e => changeTime(e.target.value)} className="input" />
      </div>
      {/* A day on its own isn't saved, so it says what's still needed */}
      {draftDay && !saved.time ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-amber-200/80">Pick a time too and this is saved.</p>
      ) : (
        hint && <p className="mt-1.5 text-[13px] leading-relaxed text-white/40">{hint}</p>
      )}
    </div>
  )
}

export interface Suggestion {
  value: string
  /** A second line: the address that goes with a venue, the phone that goes with a contact */
  detail?: string
}

/**
 * A text box that offers what Burrow already knows as you type: clients, venues and
 * hotels from earlier jobs. Picking one fills it in; typing something new works as always.
 */
export function SuggestInput({
  value,
  onChange,
  onPick,
  suggestions,
  placeholder,
  type = 'text',
  id,
  required,
}: {
  value: string
  onChange: (value: string) => void
  /** Called with the suggestion that was tapped, after its value has been filled in */
  onPick?: (suggestion: Suggestion) => void
  suggestions: Suggestion[]
  placeholder?: string
  type?: 'text' | 'tel' | 'email'
  id?: string
  required?: boolean
}) {
  const [focused, setFocused] = useState(false)
  // On some phones the text box loses focus the moment a suggestion is touched. Waiting a
  // beat before folding the list away means the tap still lands on it.
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (closing.current) clearTimeout(closing.current)
  }, [])
  const typed = value.trim().toLowerCase()
  const matches = focused
    ? suggestions
        .filter(s => s.value.toLowerCase().includes(typed) && s.value.toLowerCase() !== typed)
        // What starts with the typed letters comes first
        .sort((a, b) => Number(b.value.toLowerCase().startsWith(typed)) - Number(a.value.toLowerCase().startsWith(typed)))
        .slice(0, 4)
    : []

  return (
    <div>
      <input
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => {
          if (closing.current) clearTimeout(closing.current)
          setFocused(true)
        }}
        onBlur={() => {
          closing.current = setTimeout(() => setFocused(false), 180)
        }}
        className="input"
        placeholder={placeholder}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div role="listbox" aria-label="Suggestions from earlier jobs" className="mt-1.5 overflow-hidden rounded-lg border border-line-strong bg-surface-raised">
          {matches.map(suggestion => (
            <button
              key={`${suggestion.value}|${suggestion.detail || ''}`}
              type="button"
              role="option"
              aria-selected={false}
              // Keeps the text box focused, so the tap lands before the list closes
              onPointerDown={e => e.preventDefault()}
              onClick={() => {
                if (closing.current) clearTimeout(closing.current)
                onChange(suggestion.value)
                onPick?.(suggestion)
                setFocused(false)
              }}
              className="flex min-h-[2.75rem] w-full flex-col justify-center border-b border-line px-3.5 py-1.5 text-left transition-colors last:border-b-0 hover:bg-white/5"
            >
              <span className="text-[15px] text-white/90">{suggestion.value}</span>
              {suggestion.detail && <span className="truncate text-[13px] text-white/45">{suggestion.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Something Burrow could fill in from what it already has. It only ever offers:
 * nothing changes until the button is tapped, and what it fills in can be edited after.
 */
export function Offer({ children, action, onUse }: { children: React.ReactNode; action: string; onUse: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-gold/35 bg-gold/[0.06] py-1 pl-3 pr-1">
      <SparkIcon className="h-4 w-4 flex-shrink-0 text-gold" />
      <div className="min-w-0 flex-1 py-1.5 text-sm leading-snug text-white/75">{children}</div>
      <button
        type="button"
        onClick={onUse}
        className="inline-flex min-h-[2.5rem] flex-shrink-0 items-center rounded-lg px-3 text-[15px] font-semibold text-gold transition-colors hover:bg-gold/10"
      >
        {action}
      </button>
    </div>
  )
}

/** A handful of choices as buttons, one picked at a time. Tapping the picked one clears it. */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: Array<{ value: T; label: string }>
  value: T | null
  onChange: (value: T | null) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(option => {
        const picked = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(picked ? null : option.value)}
            aria-pressed={picked}
            className={`inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-xl border px-4 text-[15px] font-semibold transition-colors ${
              picked
                ? 'border-brand bg-brand text-white'
                : 'border-line-strong text-white/70 hover:border-white/30 hover:text-white'
            }`}
          >
            {picked && <CheckIcon className="h-4 w-4" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A text box that's as tall as what's in it: one line when empty, growing as you type */
export function AutoTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight leaves out the border
    el.style.height = `${el.scrollHeight + 2}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      rows={1}
      className="input resize-none overflow-hidden"
      placeholder={placeholder}
    />
  )
}

/** A text button that sits above a form or under a list: "+ Add Person", "Fill from Email" */
export function TextAction({
  onClick,
  children,
  tone = 'brand',
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  tone?: 'brand' | 'green' | 'danger'
  disabled?: boolean
}) {
  const color =
    tone === 'green'
      ? 'text-emerald-400 hover:text-emerald-300'
      : tone === 'danger'
      ? 'text-red-400/80 hover:text-red-300'
      : 'text-brand-light hover:text-white'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`-mx-2 inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg px-2 text-[15px] font-medium transition-colors hover:bg-white/5 disabled:opacity-40 ${color}`}
    >
      {children}
    </button>
  )
}

/** A dashed button for a section this job doesn't have yet */
export function AddSectionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-dashed border-line-strong px-4 text-[15px] font-medium text-white/60 transition-colors hover:border-brand/60 hover:bg-white/[0.03] hover:text-white"
    >
      + {label}
    </button>
  )
}

/** The small round × that takes one thing off a list */
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-300"
    >
      <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

/** Yes or No. Tapping the one that's already picked clears the answer. */
export function YesNoToggle({
  value,
  onChange,
  label,
}: {
  value: 'yes' | 'no' | null | undefined
  onChange: (value: 'yes' | 'no' | null) => void
  label: string
}) {
  const option = (key: 'yes' | 'no', text: string) => (
    <button
      type="button"
      onClick={() => onChange(value === key ? null : key)}
      aria-pressed={value === key}
      className={`h-10 min-w-[3.25rem] rounded-md px-3 text-[15px] font-semibold transition-colors ${
        value === key ? 'bg-brand text-white' : 'text-white/55 hover:text-white'
      }`}
    >
      {text}
    </button>
  )
  return (
    <div role="group" aria-label={label} className="flex flex-shrink-0 gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
      {option('yes', 'Yes')}
      {option('no', 'No')}
    </div>
  )
}
