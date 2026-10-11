'use client'

import { useState } from 'react'
import type { FlightSegment, HotelInfo, RentalCarInfo, TrackerStep } from '@/types/fldr'
import AirportAutocomplete from '@/components/AirportAutocomplete'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import FlightConnections from '@/components/FlightConnections'
import { AirplaneIcon, CheckIcon, MailIcon } from '@/components/Icons'
import {
  CallLink,
  CopyAction,
  EditButton,
  Field,
  FieldRow,
  InfoList,
  InfoRow,
  MapLink,
  SectionCard,
  TextAction,
  useEditMode,
} from './parts'
import { fmtDateTime, fmtDay, fmtDayRange, fmtTime } from '@/lib/jobFormat'

type Airport = { name: string; code: string; address: string }

const SEGMENT_LABELS: Record<string, string> = {
  outbound: 'Outbound',
  return: 'Return',
  connection: 'Connection',
  other: 'Flight',
}

function ParseEmailAction({ onClick }: { onClick: () => void }) {
  return (
    <TextAction onClick={onClick} tone="green">
      <MailIcon className="h-3.5 w-3.5" />
      Parse Email
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
  onDates: (start: string | null, end: string | null) => void
  onToggleBooked: () => void
}

/** The travel dates and whether travel is booked, always in view above the flights */
export function TravelDatesRow({ start, end, flightDates, booked, onDates, onToggleBooked }: TravelDatesRowProps) {
  const [editing, setEditing] = useState(false)
  const typed = fmtDayRange(start, end)
  const fromFlights = !typed && flightDates ? fmtDayRange(flightDates.start, flightDates.end) : ''
  const isBooked = booked?.state === 'done'

  return (
    <div className="card shadow-card px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} className="min-w-0 flex-1 text-left">
          <div className="text-xs text-white/45">Travel Dates</div>
          <div className={`mt-0.5 truncate text-sm ${typed || fromFlights ? 'text-white/90' : 'text-white/40'}`}>
            {typed || fromFlights || 'Not set'}
            {fromFlights && <span className="text-xs text-white/40"> · from flights</span>}
          </div>
        </button>
        {booked && booked.state !== 'na' && (
          <button
            type="button"
            onClick={onToggleBooked}
            aria-pressed={isBooked}
            className={`inline-flex flex-shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors ${
              isBooked
                ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                : 'border-line-strong text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                isBooked ? 'border-emerald-400/50 bg-emerald-500/20' : 'border-white/25'
              }`}
            >
              {isBooked && <CheckIcon className="h-3 w-3" />}
            </span>
            Travel Booked
          </button>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" value={start || ''} onChange={e => onDates(e.target.value || null, end)} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" value={end || ''} min={start || undefined} onChange={e => onDates(start, e.target.value || null)} className="input" />
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
  const count = `${segments.length} ${segments.length === 1 ? 'segment' : 'segments'}`
  return [route.length > 1 ? route.join(' → ') : count, dates].filter(Boolean).join(' · ')
}

/** One end of a flight on the ticket: the code big, the time under it */
function TicketEnd({ code, airport, time, align }: { code: string | null; airport: string | null; time: string | null; align: 'left' | 'right' }) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>
      <div className="font-display text-xl font-semibold leading-tight text-white">{code || '—'}</div>
      {!code && airport && <div className="truncate text-xs text-white/55">{airport}</div>}
      {time ? (
        <>
          <div className="mt-0.5 text-sm tabular text-white/85">{fmtTime(time)}</div>
          <div className="text-xs text-white/45">{fmtDay(time, true)}</div>
        </>
      ) : (
        <div className="mt-0.5 text-xs text-white/35">No time yet</div>
      )}
    </div>
  )
}

export function FlightsCard({
  segments,
  staffNames,
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

  const commitTraveler = (index: number, segmentId: string) => {
    const draft = travelerDrafts[segmentId]
    if (!draft || !draft.trim()) return
    onAddTraveler(index, draft)
    setTravelerDrafts(prev => ({ ...prev, [segmentId]: '' }))
  }

  return (
    <SectionCard
      id="flight"
      title="Flights"
      open={open}
      onToggle={onToggle}
      summary={flightsSummary(segments)}
      actions={
        <>
          {!editing && hasData && <CopyAction text={flightsCopyText(segments)} label="Copy all flight details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-white/45">
            {segments.length} {segments.length === 1 ? 'segment' : 'segments'}
          </span>
          <div className="flex items-center gap-4">
            <ParseEmailAction onClick={onParseEmail} />
            <TextAction
              onClick={() => {
                onAddSegment()
                startEditing()
              }}
            >
              + Add Flight Segment
            </TextAction>
          </div>
        </div>

        {segments.length > 0 && <FlightConnections segments={segments} />}

        {segments.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong p-5 text-center">
            <p className="mb-2 text-sm text-white/50">No flight segments yet</p>
            <TextAction
              onClick={() => {
                onAddSegment()
                startEditing()
              }}
            >
              Add First Segment
            </TextAction>
          </div>
        )}

        {editing ? (
          <>
            {segments.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white/5 p-3">
                <input
                  type="checkbox"
                  checked={roundTrip || segments.some(seg => seg.segment_type === 'return')}
                  onChange={e => onRoundTrip(e.target.checked)}
                  className="h-4 w-4 flex-shrink-0 rounded"
                />
                <span className="whitespace-nowrap text-sm text-white">Round Trip</span>
                <span className="ml-auto text-right text-xs text-white/45">Auto-creates return flight with reversed airports</span>
              </label>
            )}

            {staffNames.length > 0 && (
              <datalist id="flight-traveler-names">
                {staffNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}

            {segments.map((segment, index) => (
              <div key={segment.id} className="space-y-3 rounded-xl border border-line bg-white/5 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="whitespace-nowrap text-sm font-semibold text-brand-light">Segment {index + 1}</span>
                    <select
                      value={segment.segment_type || 'other'}
                      onChange={e => onField(index, 'segment_type', e.target.value)}
                      aria-label={`Segment ${index + 1} type`}
                      className="min-w-0 rounded-lg border border-line-strong bg-canvas px-2 py-1.5 text-xs focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                    >
                      <option value="outbound">Outbound</option>
                      <option value="return">Return</option>
                      <option value="connection">Connection/Layover</option>
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
                  <label className="label">Travelers</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(segment.travelers || []).map((traveler, tIdx) => (
                      <span key={tIdx} className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-brand/15 px-2 py-1 text-xs text-brand-light">
                        {traveler}
                        <button type="button" onClick={() => onRemoveTraveler(index, tIdx)} className="hover:text-red-400" title="Remove traveler" aria-label={`Remove ${traveler}`}>
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      list="flight-traveler-names"
                      value={travelerDrafts[segment.id] || ''}
                      onChange={e => setTravelerDrafts(prev => ({ ...prev, [segment.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault()
                          commitTraveler(index, segment.id)
                        }
                      }}
                      onBlur={() => commitTraveler(index, segment.id)}
                      placeholder="Add name, press Enter"
                      className="min-w-[140px] flex-1 rounded-full border border-line-strong bg-canvas px-3 py-1.5 text-xs placeholder:text-white/30 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                    />
                  </div>
                </div>

                <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-3">
                      <Field label="Departure Airport">
                        <AirportAutocomplete
                          type="name"
                          value={segment.departure_airport || ''}
                          onChange={value => onField(index, 'departure_airport', value)}
                          onAirportSelect={airport => onDepartureAirport(index, airport)}
                          className="input"
                          placeholder="Type airport name or code..."
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
                    <Field label="Departure Time">
                      <input type="datetime-local" value={segment.departure_time || ''} onChange={e => onField(index, 'departure_time', e.target.value)} className="input" />
                    </Field>
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_5.25rem] gap-3">
                      <Field label="Arrival Airport">
                        <AirportAutocomplete
                          type="name"
                          value={segment.arrival_airport || ''}
                          onChange={value => onField(index, 'arrival_airport', value)}
                          onAirportSelect={airport => onArrivalAirport(index, airport)}
                          className="input"
                          placeholder="Type airport name or code..."
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
                    <Field label="Arrival Time">
                      <input type="datetime-local" value={segment.arrival_time || ''} onChange={e => onField(index, 'arrival_time', e.target.value)} className="input" />
                    </Field>
                  </div>
                </div>

                {(segment.departure_address || segment.arrival_address) && (
                  <div className="divide-y divide-line rounded-lg border border-line bg-canvas/40 px-3">
                    {segment.departure_address && (
                      <div className="flex items-center gap-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-white/40">Departure Airport Address</div>
                          <div className="break-words text-xs text-white/70">{segment.departure_address}</div>
                        </div>
                        <div className="-mr-2 flex flex-shrink-0">
                          <CopyAction text={segment.departure_address} label="Copy address" />
                        </div>
                      </div>
                    )}
                    {segment.arrival_address && (
                      <div className="flex items-center gap-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-white/40">Arrival Airport Address</div>
                          <div className="break-words text-xs text-white/70">{segment.arrival_address}</div>
                        </div>
                        <div className="-mr-2 flex flex-shrink-0">
                          <CopyAction text={segment.arrival_address} label="Copy address" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <FieldRow always>
                  <Field label="Airline">
                    <input type="text" value={segment.airline || ''} onChange={e => onField(index, 'airline', e.target.value)} className="input" placeholder="Airline name" />
                  </Field>
                  <Field label="Flight Number">
                    <input type="text" value={segment.flight_number || ''} onChange={e => onField(index, 'flight_number', e.target.value)} className="input" placeholder="e.g. AA123" />
                  </Field>
                </FieldRow>

                <Field label="Confirmation Number">
                  <input type="text" value={segment.confirmation || ''} onChange={e => onField(index, 'confirmation', e.target.value)} className="input" placeholder="Confirmation code" />
                </Field>

                <Field label="Notes">
                  <textarea value={segment.notes || ''} onChange={e => onField(index, 'notes', e.target.value)} className="input resize-none" rows={2} placeholder="Additional flight notes..." />
                </Field>
              </div>
            ))}

            <div className="pt-1">
              <TextAction onClick={onRemoveSection} tone="danger">
                Remove Flights from this job
              </TextAction>
            </div>
          </>
        ) : (
          segments.map(segment => (
            <div key={segment.id} className="rounded-xl border border-line bg-canvas/40 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="eyebrow">{SEGMENT_LABELS[segment.segment_type || 'other'] || 'Flight'}</span>
                {segment.travelers && segment.travelers.length > 0 && (
                  <span className="min-w-0 truncate text-xs text-brand-light">{segment.travelers.join(', ')}</span>
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
                <div className="mt-3 flex items-center gap-2 border-t border-line pt-2">
                  <div className="min-w-0 flex-1 text-xs leading-relaxed text-white/60">
                    {[segment.airline, segment.flight_number].filter(Boolean).join(' ')}
                    {(segment.airline || segment.flight_number) && segment.confirmation && <span className="text-white/25"> · </span>}
                    {segment.confirmation && (
                      <>
                        Confirmation <span className="font-semibold tabular text-white/90">{segment.confirmation}</span>
                      </>
                    )}
                  </div>
                  {segment.confirmation && (
                    <div className="-my-1.5 -mr-2 flex flex-shrink-0">
                      <CopyAction text={segment.confirmation} label="Copy confirmation" />
                    </div>
                  )}
                </div>
              )}
              {segment.notes && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/50">{segment.notes}</p>}
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
  open: boolean
  onToggle: () => void
  onField: (field: keyof HotelInfo, value: string) => void
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

export function HotelCard({ hotel, open, onToggle, onField, onParseEmail, onRemoveSection, onDone }: HotelCardProps) {
  const hasData = !!(hotel.name || hotel.address || hotel.phone || hotel.confirmation || hotel.check_in || hotel.check_out || hotel.notes)
  const { editing, toggle } = useEditMode(hasData, open, onDone)

  return (
    <SectionCard
      id="hotel"
      title="Hotel"
      open={open}
      onToggle={onToggle}
      summary={[hotel.name || hotel.address, fmtDayRange(hotel.check_in, hotel.check_out)].filter(Boolean).join(' · ') || undefined}
      actions={
        <>
          {!editing && <CopyAction text={hotelCopyText(hotel)} label="Copy hotel details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      {editing ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ParseEmailAction onClick={onParseEmail} />
          </div>
          <Field label="Hotel Name">
            <input type="text" value={hotel.name || ''} onChange={e => onField('name', e.target.value)} className="input" placeholder="Hotel name" />
          </Field>
          <Field label="Address">
            <AddressAutocomplete value={hotel.address || ''} onChange={value => onField('address', value)} className="input" placeholder="Start typing hotel address..." />
          </Field>
          <FieldRow>
            <Field label="Phone">
              <input type="tel" value={hotel.phone || ''} onChange={e => onField('phone', e.target.value)} className="input" placeholder="Hotel phone number" />
            </Field>
            <Field label="Confirmation Number">
              <input type="text" value={hotel.confirmation || ''} onChange={e => onField('confirmation', e.target.value)} className="input" placeholder="Confirmation code" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Check-in">
              <input type="datetime-local" value={hotel.check_in || ''} onChange={e => onField('check_in', e.target.value)} className="input" />
            </Field>
            <Field label="Check-out">
              <input type="datetime-local" value={hotel.check_out || ''} onChange={e => onField('check_out', e.target.value)} className="input" />
            </Field>
          </FieldRow>
          <Field label="Notes">
            <textarea value={hotel.notes || ''} onChange={e => onField('notes', e.target.value)} className="input resize-none" rows={2} placeholder="Additional hotel notes..." />
          </Field>
          <div className="pt-1">
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
              label="Address"
              actions={
                <>
                  <CopyAction text={hotel.address} label="Copy address" />
                  <MapLink address={hotel.address} />
                </>
              }
            >
              {hotel.address}
            </InfoRow>
          )}
          {hotel.phone && (
            <InfoRow label="Phone" actions={<CallLink phone={hotel.phone} />}>
              {hotel.phone}
            </InfoRow>
          )}
          {hotel.check_in && <InfoRow label="Check-in">{fmtDateTime(hotel.check_in)}</InfoRow>}
          {hotel.check_out && <InfoRow label="Check-out">{fmtDateTime(hotel.check_out)}</InfoRow>}
          {hotel.confirmation && (
            <InfoRow label="Confirmation" actions={<CopyAction text={hotel.confirmation} label="Copy confirmation" />}>
              <span className="font-semibold tabular">{hotel.confirmation}</span>
            </InfoRow>
          )}
          {hotel.notes && (
            <InfoRow label="Notes">
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
  open: boolean
  onToggle: () => void
  onField: (field: keyof RentalCarInfo, value: string) => void
  onParseEmail: () => void
  onRemoveSection: () => void
  onDone: () => void
}

export function RentalCarCard({ car, open, onToggle, onField, onParseEmail, onRemoveSection, onDone }: RentalCarCardProps) {
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

  return (
    <SectionCard
      id="rentalCar"
      title="Rental Car"
      open={open}
      onToggle={onToggle}
      summary={[car.company, car.vehicle_type, fmtDayRange(car.pickup_time, car.dropoff_time)].filter(Boolean).join(' · ') || undefined}
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      {editing ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <ParseEmailAction onClick={onParseEmail} />
          </div>
          <FieldRow always>
            <Field label="Company">
              <input type="text" value={car.company || ''} onChange={e => onField('company', e.target.value)} className="input" placeholder="e.g. Hertz" />
            </Field>
            <Field label="Vehicle Type">
              <input type="text" value={car.vehicle_type || ''} onChange={e => onField('vehicle_type', e.target.value)} className="input" placeholder="e.g. SUV" />
            </Field>
          </FieldRow>
          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            <div className="space-y-3">
              <Field label="Pickup Location">
                <AddressAutocomplete value={car.pickup_location || ''} onChange={value => onField('pickup_location', value)} className="input" placeholder="Start typing pickup location..." />
              </Field>
              <Field label="Pickup Time">
                <input type="datetime-local" value={car.pickup_time || ''} onChange={e => onField('pickup_time', e.target.value)} className="input" />
              </Field>
            </div>
            <div className="space-y-3">
              <Field label="Dropoff Location">
                <AddressAutocomplete value={car.dropoff_location || ''} onChange={value => onField('dropoff_location', value)} className="input" placeholder="Start typing dropoff location..." />
              </Field>
              <Field label="Dropoff Time">
                <input type="datetime-local" value={car.dropoff_time || ''} onChange={e => onField('dropoff_time', e.target.value)} className="input" />
              </Field>
            </div>
          </div>
          <Field label="Confirmation Number">
            <input type="text" value={car.confirmation || ''} onChange={e => onField('confirmation', e.target.value)} className="input" placeholder="Confirmation code" />
          </Field>
          <FieldRow>
            <Field label="Insurance Policy Number">
              <input type="text" value={car.insurance_policy_number || ''} onChange={e => onField('insurance_policy_number', e.target.value)} className="input" placeholder="Insurance policy number" />
            </Field>
            <Field label="Travel Reservation">
              <input type="text" value={car.travel_reservation || ''} onChange={e => onField('travel_reservation', e.target.value)} className="input" placeholder="Travel reservation number" />
            </Field>
          </FieldRow>
          <Field label="Notes">
            <textarea value={car.notes || ''} onChange={e => onField('notes', e.target.value)} className="input resize-none" rows={2} placeholder="Additional rental car notes..." />
          </Field>
          <div className="pt-1">
            <TextAction onClick={onRemoveSection} tone="danger">
              Remove Rental Car from this job
            </TextAction>
          </div>
        </div>
      ) : (
        <InfoList>
          {(car.company || car.vehicle_type) && <InfoRow label="Car">{[car.company, car.vehicle_type].filter(Boolean).join(' · ')}</InfoRow>}
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
              {car.pickup_location && <div className={car.pickup_time ? 'text-xs text-white/55' : ''}>{car.pickup_location}</div>}
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
              {car.dropoff_location && <div className={car.dropoff_time ? 'text-xs text-white/55' : ''}>{car.dropoff_location}</div>}
            </InfoRow>
          )}
          {car.confirmation && (
            <InfoRow label="Confirmation" actions={<CopyAction text={car.confirmation} label="Copy confirmation" />}>
              <span className="font-semibold tabular">{car.confirmation}</span>
            </InfoRow>
          )}
          {car.insurance_policy_number && (
            <InfoRow label="Insurance" actions={<CopyAction text={car.insurance_policy_number} label="Copy policy number" />}>
              <span className="tabular">{car.insurance_policy_number}</span>
            </InfoRow>
          )}
          {car.travel_reservation && (
            <InfoRow label="Reservation" actions={<CopyAction text={car.travel_reservation} label="Copy reservation" />}>
              <span className="tabular">{car.travel_reservation}</span>
            </InfoRow>
          )}
          {car.notes && (
            <InfoRow label="Notes">
              <span className="whitespace-pre-wrap">{car.notes}</span>
            </InfoRow>
          )}
        </InfoList>
      )}
    </SectionCard>
  )
}
