'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  MailIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
} from '@/components/Icons'
import { linkHref, mapsUrl } from '@/lib/jobFormat'

// The pieces every card on the job page is built from, so they all read the same way.

/** The small label that starts a group of cards */
export function GroupHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="eyebrow font-sans px-1 pt-3">{children}</h2>
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
      <div className="relative flex min-h-[3.25rem] items-center gap-2 py-2.5 pl-4 pr-3">
        {/* The whole header opens and closes the card; the buttons on it sit above this */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={title}
          className={`absolute inset-0 transition-colors hover:bg-white/[0.03] ${open ? 'rounded-t-2xl' : 'rounded-2xl'}`}
        />
        <div className="pointer-events-none relative min-w-0 flex-1">
          <div className="font-display font-semibold leading-snug">{title}</div>
          {!open && summary && <div className="mt-0.5 truncate text-xs text-white/50">{summary}</div>}
        </div>
        {meta && <div className="pointer-events-none relative flex-shrink-0">{meta}</div>}
        {open && actions && <div className="relative flex flex-shrink-0 items-center gap-0.5">{actions}</div>}
        <ChevronDownIcon
          className={`pointer-events-none relative h-5 w-5 flex-shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`}
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
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Done
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-light transition-colors hover:bg-white/5 hover:text-white"
    >
      <PencilIcon className="h-3.5 w-3.5" />
      Edit
    </button>
  )
}

// ── Reading ─────────────────────────────────────────────────────────────────

export function InfoList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>
}

/** A label, what's saved for it, and the things you'd do with it (copy, call, open) */
export function InfoRow({ label, children, actions }: { label: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <dt className="w-[5.25rem] flex-shrink-0 text-xs leading-5 text-white/45">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-sm leading-5 text-white/90">{children}</dd>
      {actions && <div className="-my-1.5 -mr-2 flex flex-shrink-0 items-center">{actions}</div>}
    </div>
  )
}

const ICON_ACTION =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/5 hover:text-white'

export function CallLink({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone}`} title="Call" aria-label={`Call ${phone}`} className={`${ICON_ACTION} text-brand-light`}>
      <PhoneIcon className="h-4 w-4" />
    </a>
  )
}

export function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} title="Email" aria-label={`Email ${email}`} className={`${ICON_ACTION} text-brand-light`}>
      <MailIcon className="h-4 w-4" />
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
      <MapPinIcon className="h-4 w-4" />
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
      <ExternalLinkIcon className="h-4 w-4" />
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
      {copied ? <CheckIcon className="h-4 w-4 text-emerald-400" /> : <CopyIcon className="h-4 w-4" />}
    </button>
  )
}

// ── Filling in ──────────────────────────────────────────────────────────────

/** A labelled group of fields inside a form */
export function FormGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {title && <div className="eyebrow">{title}</div>}
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
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-white/40">{hint}</p>}
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

/** A small text button that sits above a form or under a list: "+ Add Person", "Parse Email" */
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
      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-40 ${color}`}
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
      className="rounded-xl border border-dashed border-line-strong px-3.5 py-2.5 text-sm font-medium text-white/60 transition-colors hover:border-brand/60 hover:bg-white/[0.03] hover:text-white"
    >
      + {label}
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
      className={`min-w-[2.75rem] rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
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
