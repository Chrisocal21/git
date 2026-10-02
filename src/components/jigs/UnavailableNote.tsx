'use client'

import { bookingLine, holderLine } from '@/lib/jigsFormat'
import type { JigHolder, JigUnavailableDetails } from '@/types/jigs'

interface UnavailableNoteProps {
  message: string
  details?: JigUnavailableDetails | null
  // When given, each physical holder gets a button for "it's actually back, nobody checked it in"
  onCheckIn?: (holder: JigHolder) => void
  disabled?: boolean
}

/** "No more available." plus where they are: never a suggestion to build more */
export default function UnavailableNote({ message, details, onCheckIn, disabled }: UnavailableNoteProps) {
  const bookings = details?.bookings ?? []
  const holders = details?.holders ?? []

  return (
    <div role="alert" className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100">
      <p className="font-semibold">{message}</p>

      {(bookings.length > 0 || holders.length > 0) && (
        <ul className="mt-1.5 space-y-2 text-amber-100/85">
          {bookings.map(b => (
            <li key={b.allocation_id}>{bookingLine(b)}</li>
          ))}
          {holders.map(h => (
            <li key={h.allocation_id}>
              <span>
                {h.unit_label ? `${h.unit_label} · ` : ''}
                {h.qty > 1 ? `${h.qty} out · ` : ''}
                {holderLine(h)}
              </span>
              {onCheckIn && (
                <button
                  type="button"
                  onClick={() => onCheckIn(h)}
                  disabled={disabled}
                  className="mt-1 block font-semibold text-gold underline-offset-2 hover:underline disabled:opacity-50"
                >
                  It’s actually back, check it in
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!!details?.needs_repair && (
        <p className="mt-1.5 text-amber-100/70">{details.needs_repair} waiting on repair.</p>
      )}
    </div>
  )
}
