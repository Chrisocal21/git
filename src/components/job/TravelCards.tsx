'use client'

import { useState } from 'react'
import type { FlightSegment, HotelInfo, RentalCarInfo, TrackerStep } from '@/types/fldr'
import AirportAutocomplete from '@/components/AirportAutocomplete'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import FlightConnections from '@/components/FlightConnections'
import { AirplaneIcon, CheckIcon, MailIcon } from '@/components/Icons'
import {
  AddSectionButton,
  CallLink,
  CopyAction,
  DateTimeField,
  DirectionsLinks,
  EditButton,
  Field,
  FieldRow,
  InfoList,
  InfoRow,
  MapLink,
  Offer,
  SectionCard,
  SuggestInput,
  TextAction,
  useEditMode,
} from './parts'
import { dayKey, fmtDateTime, fmtDay, fmtDayRange, fmtTime } from '@/lib/jobFormat'
import { hotelNamed } from '@/lib/jobSuggestions'
import type { JobSuggestions } from '@/lib/jobSuggestions'

type Airport = { name: string; code: string; address: string }

/** The days a trip runs between, used to start date pickers in the right place */
export interface TripDays {
  /** The day people travel out: the travel dates if they're set, else the job's first day */
  out: string | null
  /** The day people travel home */
  back: string | null
}

const SEGMENT_LABELS: Record<string, string> = {
  outbound: 'Outbound',
  return: 'Return',
  connection: 'Connection',
  other: 'Flight',
}

function FillFromEmailAction({ onClick }: { onClick: () => void }) {
  return (
    <TextAction onClick={onClick} tone="green">
      <MailIcon className="h-4 w-4" />
      Fill from Email
    </TextAction>
  )
}

// ── Travel dates ────────────────────────────────────────────────────────────

interface TravelDatesRowProps {
  start: string | null
  end: string | null
  /** First departure to last arrival on the flights, used until dates are typed in */
  flightDates: { start: string; end: string } | null
  /** The "Travel Booked" line of the logistics list; left out where there is no list (time off) */
  booked: TrackerStep | null
  /** Flights and a hotel are both in, so it's probably time to tick Travel Booked */
  readyToBook: boolean
  onDates: (start: string | null, end: string | null) => void
  onToggleBooked: () => void
}

/** The travel dates and whether travel is booked, always in view above the flights */
export function TravelDatesRow({ start, end, flightDates, booked, readyToBook, onDates, onToggleBooked }: TravelDatesRowProps) {
  const [editing, setEditing] = useState(false)
  const typed = fmtDayRange(start, end)
  const fromFlights = !typed && flightDates ? fmtDayRange(flightDates.start, flightDates.end) : ''
  const isBooked = booked?.state === 'done'
  const nudge = !!booked && booked.state === 'todo' && readyToBook

  return (
    <div className="card shadow-card px-4 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          aria-expanded={editing}
          className="min-h-[2.75rem] min-w-0 flex-1 text-left"
        >
          <div className="text-[13px] text-white/45">Travel Dates</div>
          <div className={`mt-0.5 truncate text-base ${typed || fromFlights ? 'text-white/90' : 'text-brand-light'}`}>
            {typed || fromFlights || 'Add dates'}
            {fromFlights && <span className="text-[13px] text-white/40"> · from flights</span>}
          </div>
        </button>
        {booked && booked.state !== 'na' && (
          <button
            type="button"
            onClick={onToggleBooked}
            aria-pressed={isBooked}
            className={`inline-flex min-h-[2.75rem] flex-shrink-0 items-center gap-2 rounded-full border py-1 pl-2 pr-3.5 text-[15px] font-semibold transition-colors ${
              isBooked
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : nudge
                ? 'border-gold/60 text-gold hover:bg-gold/10'
                : 'border-line-strong text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                isBooked ? 'border-emerald-400/50 bg-emerald-500/20' : nudge ? 'border-gold/60' : 'border-white/25'
              }`}
            >
              {isBooked && <CheckIcon className="h-3.5 w-3.5" />}
            </span>
            Travel Booked
          </button>
        )}
      </div>
      {nudge && <p className="pb-1.5 pt-0.5 text-[13px] text-white/50">Flights and a hotel are in. Tap Travel Booked once it&apos;s all confirmed.</p>}
      {editing && (
        <div className="grid grid-cols-2 gap-3 pb-2 pt-2">
          <div>
            <label className="label">Leaving</label>
            <input type="date" aria-label="Travel dates: leaving" value={start || ''} onChange={e => onDates(e.target.value || null, end)} className="input" />
          </div>
          <div>
            <label className="label">Coming back</label>
            <input
              type="date"
              aria-label="Travel dates: coming back"
              value={end || ''}
              min={start || undefined}
              onChange={e => onDates(start, e.target.value || null)}
              className="input"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Flights ─────────────────────────────────────────────────────────────────

interface FlightsCardProps {
  segments: FlightSegment[]
  /** Who's on the job, offered when adding travelers */
  staffNames: string[]
  trip: TripDays
  open: boolean
  onToggle: () => void
  onField: (index: number, field: keyof FlightSegment, value: string) => void
  onDepartureAirport: (index: number, airport: Airport) => void
  onArrivalAirport: (index: number, airport: Airport) => void
  onAddTraveler: (index: number, name: string) => void
  onRemoveTraveler: (index: number, travelerIndex: number) => void
  onAddSegment: () => void
  onRemoveSegment: (index: number) => void
  roundTrip: boolean
  onRoundTrip: (checked: boolean) => void
  onParseEmail: () => void
  onRemoveSection: () => void
  onDone: () => void
}

function flightsCopyText(segments: FlightSegment[]): string {
  const when = (time: string) =>
    new Date(time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return segments
    .map((segment, idx) =>
      [
        `Flight ${idx + 1} - ${segment.segment_type || 'Flight'}`,
        segment.airline && segment.flight_number ? `${segment.airline} ${segment.flight_number}` : segment.airline || segment.flight_number || '',
        segment.confirmation ? `Confirmation: ${segment.confirmation}` : '',
        '',
        segment.departure_airport ? `Depart: ${segment.departure_airport}${segment.departure_code ? ` (${segment.departure_code})` : ''}` : '',
        segment.departure_time ? when(segment.departure_time) : '',
        '',
        segment.arrival_airport ? `Arrive: ${segment.arrival_airport}${segment.arrival_code ? ` (${segment.arrival_code})` : ''}` : '',
        segment.arrival_time ? when(segment.arrival_time) : '',
        segment.notes ? `\nNotes: ${segment.notes}` : '',
      ]
        .filter(p => p)
        .join('\n')
    )
    .join('\n\n---\n\n')
}

function segmentHasData(segment: FlightSegment): boolean {
  return !!(segment.departure_airport || segment.arrival_airport || segment.airline || segment.flight_number || segment.departure_time)
}

const flightCount = (n: number) => `${n} ${n === 1 ? 'flight' : 'flights'}`

function flightsSummary(segments: FlightSegment[]): string | undefined {
  if (segments.length === 0) return undefined
  const route: string[] = []
  for (const seg of segments) {
    const from = seg.departure_code || ''
    const to = seg.arrival_code || ''
    if (from && route[route.length - 1] !== from) route.push(from)
    if (to) route.push(to)
  }
  const days = segments.map(s => s.departure_time || s.arrival_time).filter(Boolean).sort() as string[]
  const dates = days.length > 0 ? fmtDayRange(days[0], days[days.length - 1]) : ''
  return [route.length > 1 ? route.join(' → ') : flightCount(segments.length), dates].filter(Boolean).join(' · ')
}

/** One end of a flight on the ticket: the code big, the time under it */
function TicketEnd({ code, airport, time, align }: { code: string | null; airport: string | null; time: string | null; align: 'left' | 'right' }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <div className="font-display text-xl font-semibold leading-tight text-white">{code || '—'}</div>
      {!code && airport && <div className="truncate text-[13px] text-white/55">{airport}</div>}
      {time ? (
        <>
          <div className="mt-0.5 text-base tabular text-white/85">{fmtTime(time)}</div>
          <div className="text-[13px] text-white/45">{fmtDay(time, true)}</div>
        </>
      ) : (
        <div className="mt-0.5 text-[13px] text-white/35">No time yet</div>
      )}
    </div>
  )
}

export function FlightsCard({
  segments,
  staffNames,
  trip,
  open,
  onToggle,
  onField,
  onDepartureAirport,
  onArrivalAirport,
  onAddTraveler,
  onRemoveTraveler,
  onAddSegment,
  onRemoveSegment,
  roundTrip,
  onRoundTrip,
  onParseEmail,
  onRemoveSection,
  onDone,
}: FlightsCardProps) {
  const hasData = segments.some(segmentHasData)
  const { editing, toggle, startEditing } = useEditMode(hasData, open, onDone)
  const [travelerDrafts, setTravelerDrafts] = useState<Record<string, string>>({})
  const [notesOpen, setNotesOpen] = useState<Record<string, boolean>>({})

  const commitTraveler = (index: number, segmentId: string) => {
    const draft = travelerDrafts[segmentId]
    if (!draft || !draft.trim()) return
    onAddTraveler(index, draft)
    setTravelerDrafts(prev => ({ ...prev, [segmentId]: '' }))
  }

  const addFlight = () => {
    onAddSegment()
    startEditing()
  }

  /** The day a flight most likely leaves: after the one before it, or on the trip's own dates */
  const departureDay = (index: number): string | null => {
    const segment = segments[index]
    if (segment.segment_type === 'return') return trip.back || trip.out
    const before = segments[index - 1]
    return dayKey(before?.arrival_time) || dayKey(before?.departure_time) || trip.out
  }

  return (
    <SectionCard
      id="flight"
      title="Flights"
      open={open}
      onToggle={onToggle}
      summary={flightsSummary(segments) || 'No flights yet'}
      actions={
        <>
          {!editing && hasData && <CopyAction text={flightsCopyText(segments)} label="Copy all flight details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      <div className="space-y-4">
        {segments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
            <p className="mb-3 text-[15px] text-white/55">No flights yet. Paste the confirmation email and Burrow fills them in, or add one by hand.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={onParseEmail} className="btn-brand min-h-[2.75rem]">
                <MailIcon className="h-4 w-4" />
                Fill from Email
              </button>
              <button type="button" onClick={addFlight} className="btn-secondary min-h-[2.75rem]">
                Add a Flight
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-white/45">{flightCount(segments.length)}</span>
            <div className="flex items-center gap-4">
              <FillFromEmailAction onClick={onParseEmail} />
              <TextAction onClick={addFlight}>+ Add Flight</TextAction>
            </div>
          </div>
        )}

        {segments.length > 0 && <FlightConnections segments={segments} />}

        {editing ? (
          <>
            {segments.length > 0 && (
              <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-line bg-white/5 px-3.5 py-2.5">
                <input
                  type="checkbox"
                  checked={roundTrip || segments.some(seg => seg.segment_type === 'return')}
                  onChange={e => onRoundTrip(e.target.checked)}
                  className="h-5 w-5 flex-shrink-0 rounded"
                />
                <span className="min-w-0">
                  <span className="block text-[15px] text-white">Round Trip</span>
                  <span className="block text-[13px] text-white/45">Adds the return flight with the airports swapped</span>
                </span>
              </label>
            )}

            {segments.map((segment, index) => {
              const travelers = segment.travelers || []
              const onFlight = new Set(travelers.map(name => name.trim().toLowerCase()))
              const notOn = staffNames.filter(name => !onFlight.has(name.toLowerCase()))
              const leaves = departureDay(index)
              const showNotes = notesOpen[segment.id] || !!segment.notes
              return (
                <div key={segment.id} className="space-y-3 rounded-xl border border-line bg-white/5 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="section-title whitespace-nowrap">Flight {index + 1}</span>
                      <select
                        value={segment.segment_type || 'other'}
                        onChange={e => onField(index, 'segment_type', e.target.value)}
                        aria-label={`Flight ${index + 1} type`}
                        className="h-10 min-w-0 rounded-lg border border-line-strong bg-canvas px-2.5 text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                      >
                        <option value="outbound">Outbound</option>
                        <option value="return">Return</option>
                        <option value="connection">Connection / Layover</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    {segments.length > 1 && (
                      <TextAction onClick={() => onRemoveSegment(index)} tone="danger">
                        Remove
                      </TextAction>
                    )}
                  </div>

                  <div>
                    <label className="label">Who&apos;s on this flight</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {travelers.map((traveler, tIdx) => (
                        <span key={tIdx} className="inline-flex min-h-[2.5rem] items-center rounded-full border border-brand/30 bg-brand/15 pl-3.5 pr-0.5 text-[15px] text-brand-light">
                          {traveler}
                          <button
                            type="button"
                            onClick={() => onRemoveTraveler(index, tIdx)}
                            className="flex h-10 w-10 items-center justify-center rounded-full text-base leading-none hover:text-red-400"
                            title="Remove traveler"
                            aria-label={`Remove ${traveler}`}
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      {/* Everyone on the job who isn't on this flight yet is one tap away */}
                      {notOn.map(name => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => onAddTraveler(index, name)}
                          className="inline-flex min-h-[2.5rem] items-center rounded-full border border-dashed border-line-strong px-3.5 text-[15px] font-medium text-white/60 transition-colors hover:border-brand/60 hover:text-white"
                        >
                          + {name}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={travelerDrafts[segment.id] || ''}
                      onChange={e => setTravelerDrafts(prev => ({ ...prev, [segment.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          commitTraveler(index, segment.id)
                        }
                      }}
                      onBlur={() => commitTraveler(index, segment.id)}
                      aria-label={`Add someone else to flight ${index + 1}`}
                      placeholder={staffNames.length > 0 ? 'Someone else? Type a name' : 'Type a name'}
                      className="input mt-2"
                    />
                  </div>

                  <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-3">
                        <Field label="Leaving From">
                          <AirportAutocomplete
                            type="name"
                            value={segment.departure_airport || ''}
                            onChange={value => onField(index, 'departure_airport', value)}
                            onAirportSelect={airport => onDepartureAirport(index, airport)}
                            className="input"
                            placeholder="Airport or city"
                          />
                        </Field>
                        <Field label="Code">
                          <AirportAutocomplete
                            type="code"
                            value={segment.departure_code || ''}
                            onChange={value => onField(index, 'departure_code', value)}
                            onAirportSelect={airport => onDepartureAirport(index, airport)}
                            className="input"
                            placeholder="LAX"
                          />
                        </Field>
                      </div>
                      <DateTimeField
                        label="Departure Time"
                        value={segment.departure_time}
                        defaultDay={leaves}
                        onChange={value => onField(index, 'departure_time', value || '')}
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-3">
                        <Field label="Landing At">
                          <AirportAutocomplete
                            type="name"
                            value={segment.arrival_airport || ''}
                            onChange={value => onField(index, 'arrival_airport', value)}
                            onAirportSelect={airport => onArrivalAirport(index, airport)}
                            className="input"
                            placeholder="Airport or city"
                          />
                        </Field>
                        <Field label="Code">
                          <AirportAutocomplete
                            type="code"
                            value={segment.arrival_code || ''}
                            onChange={value => onField(index, 'arrival_code', value)}
                            onAirportSelect={airport => onArrivalAirport(index, airport)}
                            className="input"
                            placeholder="JFK"
                          />
                        </Field>
                      </div>
                      <DateTimeField
                        label="Arrival Time"
                        value={segment.arrival_time}
                        defaultDay={dayKey(segment.departure_time) || leaves}
                        onChange={value => onField(index, 'arrival_time', value || '')}
                      />
                    </div>
                  </div>

                  {(segment.departure_address || segment.arrival_address) && (
                    <div className="divide-y divide-line rounded-lg border border-line bg-canvas/40 pl-3 pr-1">
                      {segment.departure_address && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] text-white/40">Departure Airport Address</div>
                            <div className="break-words text-sm text-white/70">{segment.departure_address}</div>
                          </div>
                          <CopyAction text={segment.departure_address} label="Copy address" />
                        </div>
                      )}
                      {segment.arrival_address && (
                        <div className="flex items-center gap-2 py-1">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] text-white/40">Arrival Airport Address</div>
                            <div className="break-words text-sm text-white/70">{segment.arrival_address}</div>
                          </div>
                          <CopyAction text={segment.arrival_address} label="Copy address" />
                        </div>
                      )}
                    </div>
                  )}

                  <FieldRow always>
                    <Field label="Airline">
                      <input type="text" value={segment.airline || ''} onChange={e => onField(index, 'airline', e.target.value)} className="input" placeholder="e.g. Southwest" />
                    </Field>
                    <Field label="Flight Number">
                      <input type="text" value={segment.flight_number || ''} onChange={e => onField(index, 'flight_number', e.target.value)} className="input" placeholder="e.g. WN 1423" />
                    </Field>
                  </FieldRow>

                  <Field label="Confirmation Number">
                    <input type="text" value={segment.confirmation || ''} onChange={e => onField(index, 'confirmation', e.target.value)} className="input" placeholder="e.g. ABC123" />
                  </Field>

                  {showNotes ? (
                    <Field label="Flight Notes">
                      <textarea
                        value={segment.notes || ''}
                        onChange={e => onField(index, 'notes', e.target.value)}
                        className="input resize-none"
                        rows={2}
                        placeholder="e.g. Seats 14A and 14B, one checked bag each"
                      />
                    </Field>
                  ) : (
                    <AddSectionButton label="Flight Notes" onClick={() => setNotesOpen(prev => ({ ...prev, [segment.id]: true }))} />
                  )}
                </div>
              )
            })}

            <div>
              <TextAction onClick={onRemoveSection} tone="danger">
                Remove Flights from this job
              </TextAction>
            </div>
          </>
        ) : (
          segments.map(segment => (
            <div key={segment.id} className="rounded-xl border border-line bg-canvas/40 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="section-title">{SEGMENT_LABELS[segment.segment_type || 'other'] || 'Flight'}</span>
                {segment.travelers && segment.travelers.length > 0 && (
                  <span className="min-w-0 truncate text-sm text-brand-light">{segment.travelers.join(', ')}</span>
                )}
              </div>
              <div className="mt-2.5 flex items-start gap-3">
                <TicketEnd code={segment.departure_code} airport={segment.departure_airport} time={segment.departure_time} align="left" />
                <div className="mt-3 flex min-w-[3rem] flex-1 items-center gap-2 text-white/25" aria-hidden="true">
                  <span className="h-px flex-1 bg-line-strong" />
                  <AirplaneIcon className="h-3.5 w-3.5 rotate-90" />
                  <span className="h-px flex-1 bg-line-strong" />
                </div>
                <TicketEnd code={segment.arrival_code} airport={segment.arrival_airport} time={segment.arrival_time} align="right" />
              </div>
              {(segment.airline || segment.flight_number || segment.confirmation) && (
                <div className="mt-2.5 flex min-h-[2.75rem] items-center gap-2 border-t border-line pt-1">
                  <div className="min-w-0 flex-1 text-sm leading-relaxed text-white/60">
                    {[segment.airline, segment.flight_number].filter(Boolean).join(' ')}
                    {(segment.airline || segment.flight_number) && segment.confirmation && <span className="text-white/25"> · </span>}
                    {segment.confirmation && (
                      <>
                        Confirmation <span className="font-semibold tabular text-white/90">{segment.confirmation}</span>
                      </>
                    )}
                  </div>
                  {segment.confirmation && (
                    <div className="-mr-2.5 flex flex-shrink-0">
                      <CopyAction text={segment.confirmation} label="Copy confirmation" />
                    </div>
                  )}
                </div>
              )}
              {segment.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white/50">{segment.notes}</p>}
            </div>
          ))
        )}
      </div>
    </SectionCard>
  )
}

// ── Hotel ───────────────────────────────────────────────────────────────────

interface HotelCardProps {
  hotel: HotelInfo
  suggestions: JobSuggestions
  trip: TripDays
  /** Where the trip lands and where the event is, for directions */
  airportAddress: string | null
  venueAddress: string | null
  open: boolean
  onToggle: () => void
  onField: (field: keyof HotelInfo, value: string) => void
  /** Several hotel fields in one go */
  onPatch: (patch: Partial<HotelInfo>) => void
  onParseEmail: () => void
  onRemoveSection: () => void
  onDone: () => void
}

function hotelCopyText(hotel: HotelInfo): string {
  const when = (time: string) =>
    new Date(time).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return [
    hotel.name || '',
    hotel.address || '',
    hotel.phone || '',
    hotel.confirmation ? `Confirmation: ${hotel.confirmation}` : '',
    '',
    hotel.check_in ? `Check-in: ${when(hotel.check_in)}` : '',
    hotel.check_out ? `Check-out: ${when(hotel.check_out)}` : '',
    hotel.notes ? `\nNotes: ${hotel.notes}` : '',
  ]
    .filter(p => p)
    .join('\n')
}

export function HotelCard({
  hotel,
  suggestions,
  trip,
  airportAddress,
  venueAddress,
  open,
  onToggle,
  onField,
  onPatch,
  onParseEmail,
  onRemoveSection,
  onDone,
}: HotelCardProps) {
  const hasData = !!(hotel.name || hotel.address || hotel.phone || hotel.confirmation || hotel.check_in || hotel.check_out || hotel.notes)
  const { editing, toggle } = useEditMode(hasData, open, onDone)
  const [showNotes, setShowNotes] = useState(false)
  const notesShown = showNotes || !!hotel.notes

  // A hotel stayed at on an earlier job brings its address and phone with it
  const known = hotelNamed(suggestions, hotel.name)
  const knownFill: Partial<HotelInfo> = known
    ? {
        ...(!hotel.address && known.address ? { address: known.address } : {}),
        ...(!hotel.phone && known.phone ? { phone: known.phone } : {}),
      }
    : {}

  return (
    <SectionCard
      id="hotel"
      title="Hotel"
      open={open}
      onToggle={onToggle}
      summary={[hotel.name || hotel.address, fmtDayRange(hotel.check_in, hotel.check_out)].filter(Boolean).join(' · ') || 'No hotel details yet'}
      actions={
        <>
          {!editing && <CopyAction text={hotelCopyText(hotel)} label="Copy hotel details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/45">Have the confirmation email? Paste it in.</span>
            <FillFromEmailAction onClick={onParseEmail} />
          </div>
          <Field label="Hotel Name">
            <SuggestInput
              value={hotel.name || ''}
              onChange={value => onField('name', value)}
              suggestions={suggestions.hotels.map(h => ({ value: h.name, detail: h.address || undefined }))}
              placeholder="e.g. Hilton Austin Downtown"
            />
          </Field>
          {known && Object.keys(knownFill).length > 0 && (
            <Offer action="Fill in" onUse={() => onPatch(knownFill)}>
              {known.name} was on an earlier job: {[known.address, known.phone].filter(Boolean).join(' · ')}
            </Offer>
          )}
          <Field label="Hotel Address">
            <AddressAutocomplete value={hotel.address || ''} onChange={value => onField('address', value)} className="input" placeholder="Start typing the address" />
          </Field>
          <FieldRow>
            <Field label="Hotel Phone">
              <input type="tel" value={hotel.phone || ''} onChange={e => onField('phone', e.target.value)} className="input" placeholder="e.g. 555 123 4567" />
            </Field>
            <Field label="Confirmation Number">
              <input type="text" value={hotel.confirmation || ''} onChange={e => onField('confirmation', e.target.value)} className="input" placeholder="e.g. 84213377" />
            </Field>
          </FieldRow>
          <FieldRow>
            <DateTimeField label="Check-in" value={hotel.check_in} defaultDay={trip.out} onChange={value => onField('check_in', value || '')} />
            <DateTimeField label="Check-out" value={hotel.check_out} defaultDay={trip.back} onChange={value => onField('check_out', value || '')} />
          </FieldRow>
          {notesShown ? (
            <Field label="Hotel Notes">
              <textarea
                value={hotel.notes || ''}
                onChange={e => onField('notes', e.target.value)}
                className="input resize-none"
                rows={2}
                placeholder="e.g. 2 rooms, breakfast included, parking $30 a night"
              />
            </Field>
          ) : (
            <AddSectionButton label="Hotel Notes" onClick={() => setShowNotes(true)} />
          )}
          <div>
            <TextAction onClick={onRemoveSection} tone="danger">
              Remove Hotel from this job
            </TextAction>
          </div>
        </div>
      ) : (
        <InfoList>
          {hotel.name && <InfoRow label="Hotel">{hotel.name}</InfoRow>}
          {hotel.address && (
            <InfoRow
              label="Hotel Address"
              actions={
                <>
                  <CopyAction text={hotel.address} label="Copy address" />
                  <MapLink address={hotel.address} />
                </>
              }
            >
              {hotel.address}
              <DirectionsLinks
                to={hotel.address}
                from={[
                  { label: 'From airport', address: airportAddress },
                  { label: 'From venue', address: venueAddress },
                ]}
              />
            </InfoRow>
          )}
          {hotel.phone && (
            <InfoRow label="Hotel Phone" actions={<CallLink phone={hotel.phone} />}>
              {hotel.phone}
            </InfoRow>
          )}
          {hotel.check_in && <InfoRow label="Check-in">{fmtDateTime(hotel.check_in)}</InfoRow>}
          {hotel.check_out && <InfoRow label="Check-out">{fmtDateTime(hotel.check_out)}</InfoRow>}
          {hotel.confirmation && (
            <InfoRow label="Confirmation Number" actions={<CopyAction text={hotel.confirmation} label="Copy confirmation" />}>
              <span className="font-semibold tabular">{hotel.confirmation}</span>
            </InfoRow>
          )}
          {hotel.notes && (
            <InfoRow label="Hotel Notes">
              <span className="whitespace-pre-wrap">{hotel.notes}</span>
            </InfoRow>
          )}
        </InfoList>
      )}
    </SectionCard>
  )
}

// ── Rental car ──────────────────────────────────────────────────────────────

interface RentalCarCardProps {
  car: RentalCarInfo
  trip: TripDays
  /** The airport the trip lands at and the one it leaves from, offered as pickup and dropoff */
  arrival: { code: string | null; address: string; time: string | null } | null
  departure: { code: string | null; address: string; time: string | null } | null
  open: boolean
  onToggle: () => void
  onField: (field: keyof RentalCarInfo, value: string) => void
  onParseEmail: () => void
  onRemoveSection: () => void
  onDone: () => void
}

export function RentalCarCard({ car, trip, arrival, departure, open, onToggle, onField, onParseEmail, onRemoveSection, onDone }: RentalCarCardProps) {
  const hasData = !!(
    car.company ||
    car.vehicle_type ||
    car.confirmation ||
    car.pickup_location ||
    car.pickup_time ||
    car.dropoff_location ||
    car.dropoff_time ||
    car.insurance_policy_number ||
    car.travel_reservation ||
    car.notes
  )
  const { editing, toggle } = useEditMode(hasData, open, onDone)
  const [showMore, setShowMore] = useState(false)
  const moreShown = showMore || !!(car.insurance_policy_number || car.travel_reservation || car.notes)

  return (
    <SectionCard
      id="rentalCar"
      title="Rental Car"
      open={open}
      onToggle={onToggle}
      summary={[car.company, car.vehicle_type, fmtDayRange(car.pickup_time, car.dropoff_time)].filter(Boolean).join(' · ') || 'No rental car details yet'}
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-white/45">Have the confirmation email? Paste it in.</span>
            <FillFromEmailAction onClick={onParseEmail} />
          </div>
          <FieldRow always>
            <Field label="Rental Company">
              <input type="text" value={car.company || ''} onChange={e => onField('company', e.target.value)} className="input" placeholder="e.g. Hertz" />
            </Field>
            <Field label="Vehicle Type">
              <input type="text" value={car.vehicle_type || ''} onChange={e => onField('vehicle_type', e.target.value)} className="input" placeholder="e.g. SUV" />
            </Field>
          </FieldRow>
          {arrival && !car.pickup_location && (
            <Offer action="Use" onUse={() => onField('pickup_location', arrival.address)}>
              Pick up at the airport you land at{arrival.code ? ` (${arrival.code})` : ''}?
            </Offer>
          )}
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="space-y-3">
              <Field label="Pickup Location">
                <AddressAutocomplete value={car.pickup_location || ''} onChange={value => onField('pickup_location', value)} className="input" placeholder="Start typing the address" />
              </Field>
              <DateTimeField
                label="Pickup Time"
                value={car.pickup_time}
                defaultDay={dayKey(arrival?.time) || trip.out}
                onChange={value => onField('pickup_time', value || '')}
              />
            </div>
            <div className="space-y-3">
              {departure && !car.dropoff_location && (
                <Offer action="Use" onUse={() => onField('dropoff_location', departure.address)}>
                  Drop off at the airport you fly home from{departure.code ? ` (${departure.code})` : ''}?
                </Offer>
              )}
              <Field label="Dropoff Location">
                <AddressAutocomplete value={car.dropoff_location || ''} onChange={value => onField('dropoff_location', value)} className="input" placeholder="Start typing the address" />
              </Field>
              <DateTimeField
                label="Dropoff Time"
                value={car.dropoff_time}
                defaultDay={dayKey(departure?.time) || trip.back}
                onChange={value => onField('dropoff_time', value || '')}
              />
            </div>
          </div>
          <Field label="Confirmation Number">
            <input type="text" value={car.confirmation || ''} onChange={e => onField('confirmation', e.target.value)} className="input" placeholder="e.g. K4471902" />
          </Field>
          {moreShown ? (
            <>
              <FieldRow>
                <Field label="Insurance Policy Number">
                  <input type="text" value={car.insurance_policy_number || ''} onChange={e => onField('insurance_policy_number', e.target.value)} className="input" placeholder="If the rental has its own policy" />
                </Field>
                <Field label="Travel Reservation">
                  <input type="text" value={car.travel_reservation || ''} onChange={e => onField('travel_reservation', e.target.value)} className="input" placeholder="Reservation number from the travel booking" />
                </Field>
              </FieldRow>
              <Field label="Rental Car Notes">
                <textarea
                  value={car.notes || ''}
                  onChange={e => onField('notes', e.target.value)}
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Return with a full tank, Chris is the driver"
                />
              </Field>
            </>
          ) : (
            <AddSectionButton label="Insurance, Reservation and Notes" onClick={() => setShowMore(true)} />
          )}
          <div>
            <TextAction onClick={onRemoveSection} tone="danger">
              Remove Rental Car from this job
            </TextAction>
          </div>
        </div>
      ) : (
        <InfoList>
          {(car.company || car.vehicle_type) && <InfoRow label="Rental Car">{[car.company, car.vehicle_type].filter(Boolean).join(' · ')}</InfoRow>}
          {(car.pickup_time || car.pickup_location) && (
            <InfoRow
              label="Pickup"
              actions={
                car.pickup_location && (
                  <>
                    <CopyAction text={car.pickup_location} label="Copy address" />
                    <MapLink address={car.pickup_location} />
                  </>
                )
              }
            >
              {car.pickup_time && <div>{fmtDateTime(car.pickup_time)}</div>}
              {car.pickup_location && <div className={car.pickup_time ? 'text-sm text-white/55' : ''}>{car.pickup_location}</div>}
            </InfoRow>
          )}
          {(car.dropoff_time || car.dropoff_location) && (
            <InfoRow
              label="Dropoff"
              actions={
                car.dropoff_location && (
                  <>
                    <CopyAction text={car.dropoff_location} label="Copy address" />
                    <MapLink address={car.dropoff_location} />
                  </>
                )
              }
            >
              {car.dropoff_time && <div>{fmtDateTime(car.dropoff_time)}</div>}
              {car.dropoff_location && <div className={car.dropoff_time ? 'text-sm text-white/55' : ''}>{car.dropoff_location}</div>}
            </InfoRow>
          )}
          {car.confirmation && (
            <InfoRow label="Confirmation Number" actions={<CopyAction text={car.confirmation} label="Copy confirmation" />}>
              <span className="font-semibold tabular">{car.confirmation}</span>
            </InfoRow>
          )}
          {car.insurance_policy_number && (
            <InfoRow label="Insurance Policy Number" actions={<CopyAction text={car.insurance_policy_number} label="Copy policy number" />}>
              <span className="tabular">{car.insurance_policy_number}</span>
            </InfoRow>
          )}
          {car.travel_reservation && (
            <InfoRow label="Travel Reservation" actions={<CopyAction text={car.travel_reservation} label="Copy reservation" />}>
              <span className="tabular">{car.travel_reservation}</span>
            </InfoRow>
          )}
          {car.notes && (
            <InfoRow label="Rental Car Notes">
              <span className="whitespace-pre-wrap">{car.notes}</span>
            </InfoRow>
          )}
        </InfoList>
      )}
    </SectionCard>
  )
}
