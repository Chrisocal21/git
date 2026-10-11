'use client'

import { useEffect, useState } from 'react'
import { AlertIcon, CheckIcon, CloseIcon } from '@/components/Icons'

// Burrow's own pop-ups, so no screen falls back to the browser's grey boxes.
// Any page can call these; <DialogHost /> in the layout draws them.
//
//   if (await askConfirm({ title: 'Delete job?', confirmLabel: 'Delete', tone: 'danger' })) ...
//   await showNotice({ title: 'Jigs are still out', body: '...' })
//   toast('Time off added')

interface AskOptions {
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button, for anything that deletes */
  tone?: 'default' | 'danger'
}

interface Ask extends AskOptions {
  /** A notice only has the one button */
  notice: boolean
  resolve: (confirmed: boolean) => void
}

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  text: string
  tone: ToastTone
}

let asks: Ask[] = []
let toasts: ToastItem[] = []
let nextToastId = 1
const listeners = new Set<() => void>()
const changed = () => listeners.forEach(listener => listener())

/** A question with two answers. Resolves true when confirmed. */
export function askConfirm(options: AskOptions): Promise<boolean> {
  return new Promise(resolve => {
    asks = [...asks, { ...options, notice: false, resolve }]
    changed()
  })
}

/** Something the person has to read before carrying on */
export function showNotice(options: { title: string; body?: string; confirmLabel?: string }): Promise<void> {
  return new Promise(resolve => {
    asks = [...asks, { ...options, notice: true, resolve: () => resolve() }]
    changed()
  })
}

/** A short line that shows for a few seconds: "Saved", "Couldn't delete the job" */
export function toast(text: string, tone: ToastTone = 'success') {
  const id = nextToastId++
  toasts = [...toasts, { id, text, tone }]
  changed()
  // Problems stay up longer than good news
  setTimeout(() => dismissToast(id), tone === 'error' ? 6000 : 3200)
}

function dismissToast(id: number) {
  if (!toasts.some(item => item.id === id)) return
  toasts = toasts.filter(item => item.id !== id)
  changed()
}

function answer(confirmed: boolean) {
  const [current, ...rest] = asks
  if (!current) return
  asks = rest
  changed()
  current.resolve(confirmed)
}

export default function DialogHost() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick(tick => tick + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  const ask = asks[0]

  useEffect(() => {
    if (!ask) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') answer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ask])

  return (
    <>
      {toasts.length > 0 && (
        <div
          // Just under the page header, so Back and Save are never covered
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-[10001] flex flex-col items-center gap-2 px-4"
          aria-live="polite"
        >
          {toasts.map(item => (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border py-2 pl-3.5 pr-1.5 text-[15px] font-medium shadow-pop animate-slide-in ${
                item.tone === 'error'
                  ? 'border-red-400/40 bg-surface-raised text-red-200'
                  : item.tone === 'info'
                  ? 'border-line-strong bg-surface-raised text-white/90'
                  : 'border-emerald-400/35 bg-surface-raised text-emerald-200'
              }`}
            >
              {item.tone === 'error' ? (
                <AlertIcon className="h-4 w-4 flex-shrink-0" />
              ) : item.tone === 'success' ? (
                <CheckIcon className="h-4 w-4 flex-shrink-0" />
              ) : null}
              <span className="min-w-0 flex-1 leading-snug">{item.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(item.id)}
                aria-label="Dismiss"
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {ask && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 px-6 animate-fade-in"
          onClick={() => answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={ask.title}
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop"
            onClick={event => event.stopPropagation()}
          >
            <div className="p-5 pb-4">
              <p className="text-center font-semibold text-white">{ask.title}</p>
              {ask.body && <p className="mt-1.5 whitespace-pre-line text-center text-[15px] leading-relaxed text-white/60">{ask.body}</p>}
            </div>
            <div className="flex border-t border-line">
              {!ask.notice && (
                <button
                  type="button"
                  onClick={() => answer(false)}
                  className="min-h-[3rem] flex-1 text-[15px] text-white/70 transition-colors hover:bg-white/5"
                >
                  {ask.cancelLabel || 'Cancel'}
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() => answer(true)}
                className={`min-h-[3rem] flex-1 text-[15px] font-semibold transition-colors ${ask.notice ? '' : 'border-l border-line'} ${
                  ask.tone === 'danger' ? 'text-red-400 hover:bg-red-500/10' : 'text-brand-light hover:bg-brand/10'
                }`}
              >
                {ask.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
