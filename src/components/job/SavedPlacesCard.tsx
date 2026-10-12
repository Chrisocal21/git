'use client'

import { useState } from 'react'
import type { SavedPlace } from '@/types/fldr'
import { CopyAction, RemoveButton, SectionCard } from './parts'
import { MAP_APPS } from '@/lib/jobFormat'

interface SavedPlacesCardProps {
  places: SavedPlace[]
  open: boolean
  onToggle: () => void
  onChange: (places: SavedPlace[]) => void
}

/** The full line to copy for a stop: "Target, 123 Main St" */
export function placeLine(place: SavedPlace): string {
  return place.name && !place.address.toLowerCase().startsWith(place.name.toLowerCase())
    ? `${place.name}, ${place.address}`
    : place.address
}

/** One saved stop: its name and address, copy, and a way to drive there in the map app of your choice */
export function PlaceRow({ place, onRemove }: { place: SavedPlace; onRemove: () => void }) {
  const [choosing, setChoosing] = useState(false)
  const destination = placeLine(place)
  return (
    <li className="py-1.5">
      <div className="flex min-h-[3.25rem] items-center gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base text-white/90">{place.name || place.address}</div>
          {place.name && <div className="truncate text-sm text-white/55">{place.address}</div>}
        </div>
        <CopyAction text={destination} label="Copy address" />
        <button
          type="button"
          onClick={() => setChoosing(open => !open)}
          aria-expanded={choosing}
          className="inline-flex min-h-[2.75rem] items-center rounded-lg px-2.5 text-sm font-medium text-brand-light transition-colors hover:bg-white/5 hover:text-white"
        >
          Go
        </button>
        <RemoveButton label={`Remove ${place.name || 'place'}`} onClick={onRemove} />
      </div>
      {choosing && (
        <div className="mb-1 flex flex-wrap items-center gap-2" role="group" aria-label="Open directions in">
          {MAP_APPS.map(app => (
            <a
              key={app.id}
              href={app.url(destination)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setChoosing(false)}
              className="inline-flex min-h-[2.5rem] items-center rounded-full bg-white/10 px-3.5 text-sm font-medium text-white transition-colors hover:bg-white/15"
            >
              {app.label}
            </a>
          ))}
        </div>
      )}
    </li>
  )
}

export default function SavedPlacesCard({ places, open, onToggle, onChange }: SavedPlacesCardProps) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')

  const add = () => {
    const trimmed = address.trim()
    if (!trimmed) return
    onChange([...places, { id: crypto.randomUUID(), name: name.trim(), address: trimmed }])
    setName('')
    setAddress('')
  }

  return (
    <SectionCard
      id="places"
      title="Saved Places"
      open={open}
      onToggle={onToggle}
      summary={places.length > 0 ? places.map(p => p.name || p.address).join(' · ') : 'Stops to copy or drive to, like a Target or gas station'}
      meta={places.length > 0 && <span className="text-sm font-semibold tabular text-white/55">{places.length}</span>}
    >
      {places.length > 0 && (
        <ul className="divide-y divide-line">
          {places.map(place => (
            <PlaceRow key={place.id} place={place} onRemove={() => onChange(places.filter(p => p.id !== place.id))} />
          ))}
        </ul>
      )}
      <div className={`space-y-2 ${places.length > 0 ? 'mt-3 border-t border-line pt-3' : ''}`}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="input"
          aria-label="Place name"
          placeholder="Name, e.g. Target"
        />
        <input
          type="text"
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') add()
          }}
          className="input"
          aria-label="Place address"
          placeholder="Address"
        />
        <button
          type="button"
          onClick={add}
          disabled={!address.trim()}
          className="inline-flex min-h-[2.75rem] w-full items-center justify-center rounded-xl border border-dashed border-brand/50 text-[15px] font-medium text-brand-light transition-colors hover:border-brand hover:text-white disabled:opacity-40"
        >
          + Save Place
        </button>
        <p className="text-[13px] leading-relaxed text-white/40">You can also save places from Map &amp; Nearby Places.</p>
      </div>
    </SectionCard>
  )
}
