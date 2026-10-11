'use client'

import { useEffect, useState } from 'react'
import type { Fldr, JobInfo, VenueInfo } from '@/types/fldr'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import {
  CallLink,
  CopyAction,
  EditButton,
  EmailLink,
  Field,
  FieldRow,
  FormGroup,
  InfoList,
  InfoRow,
  MapLink,
  SectionCard,
  useEditMode,
} from './parts'
import { fmtClock, fmtDateTime, fmtDay, fmtTimeSpan, jobTypeLabel } from '@/lib/jobFormat'

// ── Client & Event ──────────────────────────────────────────────────────────

interface ClientEventCardProps {
  fldr: Fldr
  open: boolean
  onToggle: () => void
  onJobInfo: (field: keyof JobInfo, value: any) => void
  onLocation: (value: string) => void
  /** Saves what's been typed when the form is closed */
  onDone: () => void
}

function clientCopyText(fldr: Fldr): string {
  const info = fldr.job_info
  if (!info) return ''
  return [
    info.client_name ? `Client: ${info.client_name}` : '',
    info.distributor_name ? `Distributor: ${info.distributor_name}` : '',
    info.client_contact_name ? `Contact: ${info.client_contact_name}` : '',
    info.client_contact_phone || '',
    info.client_contact_email || '',
    '',
    info.job_title ? `Job: ${info.job_title}` : '',
    info.item ? `Item: ${info.item}` : '',
    info.quantity ? `Quantity: ${info.quantity}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * The job's city. Weather, local time and the map all look it up, so it's only
 * handed over once you've finished typing rather than on every letter.
 */
function LocationInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])

  return (
    <input
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        if (draft.trim() !== value.trim()) onCommit(draft.trim())
      }}
      className="input"
      placeholder="City, State"
    />
  )
}

export function ClientEventCard({ fldr, open, onToggle, onJobInfo, onLocation, onDone }: ClientEventCardProps) {
  const info = fldr.job_info
  const type = jobTypeLabel(info?.job_type)
  const hasContact = !!(info?.client_contact_name || info?.client_contact_phone || info?.client_contact_email)
  const hasData = !!(
    info &&
    (info.client_name ||
      info.distributor_name ||
      hasContact ||
      info.job_title ||
      info.job_type ||
      info.event_type ||
      info.item ||
      info.quantity ||
      info.kickoff_date ||
      info.prepro_date ||
      info.event_details)
  )
  const { editing, toggle } = useEditMode(hasData, open, onDone)

  const text = (field: keyof JobInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onJobInfo(field, e.target.value)
  const day = (field: keyof JobInfo) => (e: React.ChangeEvent<HTMLInputElement>) => onJobInfo(field, e.target.value || null)

  return (
    <SectionCard
      id="event"
      title="Client & Event"
      open={open}
      onToggle={onToggle}
      summary={[info?.client_name, info?.distributor_name && `via ${info.distributor_name}`, type || info?.event_type].filter(Boolean).join(' · ') || undefined}
      actions={
        <>
          {!editing && <CopyAction text={clientCopyText(fldr)} label="Copy client details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      {editing ? (
        <div className="space-y-5">
          <FormGroup title="Client">
            <FieldRow>
              <Field label="Client Name">
                <input type="text" value={info?.client_name || ''} onChange={text('client_name')} className="input" placeholder="Client/company name" />
              </Field>
              <Field label="Distributor Name">
                <input type="text" value={info?.distributor_name || ''} onChange={text('distributor_name')} className="input" placeholder="Distributor name (if applicable)" />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="Contact">
            <Field label="Contact Name">
              <input type="text" value={info?.client_contact_name || ''} onChange={text('client_contact_name')} className="input" placeholder="Contact person" />
            </Field>
            <FieldRow>
              <Field label="Phone">
                <input type="tel" value={info?.client_contact_phone || ''} onChange={text('client_contact_phone')} className="input" placeholder="Phone" />
              </Field>
              <Field label="Email">
                <input type="email" value={info?.client_contact_email || ''} onChange={text('client_contact_email')} className="input" placeholder="Email" />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="Event">
            <FieldRow>
              <Field label="Job Title">
                <input type="text" value={info?.job_title || ''} onChange={text('job_title')} className="input" placeholder="Job title or name" />
              </Field>
              <Field label="Location">
                <LocationInput value={fldr.location || ''} onCommit={onLocation} />
              </Field>
            </FieldRow>
            <FieldRow always>
              <Field label="Job Type">
                <select
                  // Older jobs saved personalization under another name
                  value={(info?.job_type as string) === 'names_monograms' ? 'personalization' : info?.job_type || ''}
                  onChange={e => onJobInfo('job_type', e.target.value || null)}
                  className="input"
                >
                  <option value="" className="bg-gray-800 text-white">Select type</option>
                  <option value="caricatures" className="bg-gray-800 text-white">Caricatures</option>
                  <option value="personalization" className="bg-gray-800 text-white">Personalization</option>
                </select>
              </Field>
              <Field label="Event Type">
                <input type="text" value={info?.event_type || ''} onChange={text('event_type')} className="input" placeholder="What kind of event it is" />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="Gifts">
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
              <Field label="Gift/s">
                <input type="text" value={info?.item || ''} onChange={text('item')} className="input" placeholder="What's being personalized" />
              </Field>
              <Field label="Gift Qty">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={info?.quantity ?? ''}
                  onChange={e => onJobInfo('quantity', e.target.value === '' ? null : Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>
            <p className="text-xs leading-relaxed text-white/40">SKUs and jigs for each gift go under Products.</p>
          </FormGroup>

          <FormGroup title="Key Dates">
            <FieldRow always>
              <Field label="Kick-off Date">
                <input type="date" value={info?.kickoff_date || ''} onChange={day('kickoff_date')} className="input" />
              </Field>
              <Field label="Pre-pro Date">
                <input type="date" value={info?.prepro_date || ''} onChange={day('prepro_date')} className="input" />
              </Field>
            </FieldRow>
          </FormGroup>

          <Field label="Event Details">
            <textarea value={info?.event_details || ''} onChange={text('event_details')} className="input resize-none" rows={3} placeholder="Event context, special instructions..." />
          </Field>
        </div>
      ) : (
        <InfoList>
          {info?.client_name && <InfoRow label="Client">{info.client_name}</InfoRow>}
          {info?.distributor_name && <InfoRow label="Distributor">{info.distributor_name}</InfoRow>}
          {hasContact && info && (
            <InfoRow
              label="Contact"
              actions={
                <>
                  {info.client_contact_phone && <CallLink phone={info.client_contact_phone} />}
                  {info.client_contact_email && <EmailLink email={info.client_contact_email} />}
                </>
              }
            >
              {info.client_contact_name && <div>{info.client_contact_name}</div>}
              {info.client_contact_phone && <div className="text-xs text-white/55">{info.client_contact_phone}</div>}
              {info.client_contact_email && <div className="break-all text-xs text-white/55">{info.client_contact_email}</div>}
            </InfoRow>
          )}
          {info?.job_title && <InfoRow label="Job Title">{info.job_title}</InfoRow>}
          {type && <InfoRow label="Job Type">{type}</InfoRow>}
          {info?.event_type && <InfoRow label="Event Type">{info.event_type}</InfoRow>}
          {fldr.location && <InfoRow label="Location">{fldr.location}</InfoRow>}
          {info?.item && <InfoRow label="Gift/s">{info.item}</InfoRow>}
          {info?.quantity != null && <InfoRow label="Gift Qty"><span className="tabular">{info.quantity}</span></InfoRow>}
          {info?.kickoff_date && <InfoRow label="Kick-off">{fmtDay(info.kickoff_date, true)}</InfoRow>}
          {info?.prepro_date && <InfoRow label="Pre-pro">{fmtDay(info.prepro_date, true)}</InfoRow>}
          {info?.event_details && (
            <InfoRow label="Details">
              <span className="whitespace-pre-wrap">{info.event_details}</span>
            </InfoRow>
          )}
        </InfoList>
      )}
    </SectionCard>
  )
}

// ── Venue & Time ────────────────────────────────────────────────────────────

interface VenueTimeCardProps {
  fldr: Fldr
  open: boolean
  onToggle: () => void
  onVenue: (field: keyof VenueInfo, value: string) => void
  onJobInfo: (field: keyof JobInfo, value: any) => void
  onDone: () => void
}

function venueCopyText(venue: VenueInfo | null): string {
  if (!venue) return ''
  return [
    venue.name || '',
    venue.address || '',
    venue.contact_name ? `Contact: ${venue.contact_name}` : '',
    venue.contact_phone || '',
    venue.notes ? `\nNotes: ${venue.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** "Sat, Mar 14 · 9:00 AM – 5:00 PM", or the daily hours on a multi-day job */
function eventTimeText(info: JobInfo | null): string {
  if (!info) return ''
  if (info.use_daily_schedule) {
    const hours = [fmtClock(info.daily_start_time), fmtClock(info.daily_end_time)].filter(Boolean).join(' – ')
    return hours ? `${hours} daily` : ''
  }
  const span = fmtTimeSpan(info.job_start_time, info.job_end_time)
  return [fmtDay(info.job_start_time || info.job_end_time, true), span].filter(Boolean).join(' · ')
}

function breakTimeText(info: JobInfo | null): string {
  if (!info) return ''
  if (info.use_daily_schedule) return [fmtClock(info.daily_break_start), fmtClock(info.daily_break_end)].filter(Boolean).join(' – ')
  return fmtTimeSpan(info.break_start_time, info.break_end_time)
}

export function VenueTimeCard({ fldr, open, onToggle, onVenue, onJobInfo, onDone }: VenueTimeCardProps) {
  const venue = fldr.venue_info
  const info = fldr.job_info
  const eventTime = eventTimeText(info)
  const breakTime = breakTimeText(info)
  const hasData = !!(
    venue?.name ||
    venue?.address ||
    venue?.contact_name ||
    venue?.contact_phone ||
    venue?.notes ||
    info?.show_up_time ||
    eventTime ||
    breakTime
  )
  const { editing, toggle } = useEditMode(hasData, open, onDone)

  const time = (field: keyof JobInfo) => (e: React.ChangeEvent<HTMLInputElement>) => onJobInfo(field, e.target.value || null)

  return (
    <SectionCard
      id="venue"
      title="Venue & Time"
      open={open}
      onToggle={onToggle}
      summary={[venue?.name || venue?.address, eventTime || (info?.show_up_time && `Show up ${fmtDateTime(info.show_up_time)}`)].filter(Boolean).join(' · ') || undefined}
      actions={
        <>
          {!editing && <CopyAction text={venueCopyText(venue)} label="Copy venue details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      {editing ? (
        <div className="space-y-5">
          <FormGroup title="Venue">
            <Field label="Venue Name">
              <input type="text" value={venue?.name || ''} onChange={e => onVenue('name', e.target.value)} className="input" placeholder="Event venue name" />
            </Field>
            <Field label="Event Address">
              <AddressAutocomplete
                value={venue?.address || ''}
                onChange={value => onVenue('address', value)}
                className="input"
                placeholder="Start typing venue address..."
              />
            </Field>
            <FieldRow>
              <Field label="Contact Name">
                <input type="text" value={venue?.contact_name || ''} onChange={e => onVenue('contact_name', e.target.value)} className="input" placeholder="Venue contact person" />
              </Field>
              <Field label="Contact Phone">
                <input type="tel" value={venue?.contact_phone || ''} onChange={e => onVenue('contact_phone', e.target.value)} className="input" placeholder="Venue contact phone" />
              </Field>
            </FieldRow>
            <Field label="Notes">
              <textarea value={venue?.notes || ''} onChange={e => onVenue('notes', e.target.value)} className="input resize-none" rows={2} placeholder="Additional venue notes..." />
            </Field>
          </FormGroup>

          <FormGroup title="Event Schedule">
            <Field label="Show Up Time (one-time)">
              <input type="datetime-local" value={info?.show_up_time || ''} onChange={time('show_up_time')} className="input" />
            </Field>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-white/5 px-3 py-2.5">
              <input
                type="checkbox"
                checked={info?.use_daily_schedule || false}
                onChange={e => onJobInfo('use_daily_schedule', e.target.checked)}
                className="h-4 w-4 flex-shrink-0 rounded"
              />
              <span className="text-sm text-white/85">Use same times daily (for multi-day events)</span>
            </label>

            {info?.use_daily_schedule ? (
              <>
                <FieldRow always>
                  <Field label="Daily Start Time">
                    <input type="time" value={info?.daily_start_time || ''} onChange={time('daily_start_time')} className="input" />
                  </Field>
                  <Field label="Daily End Time">
                    <input type="time" value={info?.daily_end_time || ''} onChange={time('daily_end_time')} className="input" />
                  </Field>
                </FieldRow>
                <FieldRow always>
                  <Field label="Daily Break Start">
                    <input type="time" value={info?.daily_break_start || ''} onChange={time('daily_break_start')} className="input" />
                  </Field>
                  <Field label="Daily Break End">
                    <input type="time" value={info?.daily_break_end || ''} onChange={time('daily_break_end')} className="input" />
                  </Field>
                </FieldRow>
              </>
            ) : (
              <>
                <FieldRow>
                  <Field label="Job Start Time">
                    <input type="datetime-local" value={info?.job_start_time || ''} onChange={time('job_start_time')} className="input" />
                  </Field>
                  <Field label="Job End Time">
                    <input type="datetime-local" value={info?.job_end_time || ''} onChange={time('job_end_time')} className="input" />
                  </Field>
                </FieldRow>
                <FieldRow>
                  <Field label="Break Start">
                    <input type="datetime-local" value={info?.break_start_time || ''} onChange={time('break_start_time')} className="input" />
                  </Field>
                  <Field label="Break End">
                    <input type="datetime-local" value={info?.break_end_time || ''} onChange={time('break_end_time')} className="input" />
                  </Field>
                </FieldRow>
              </>
            )}
          </FormGroup>
        </div>
      ) : (
        <InfoList>
          {venue?.name && <InfoRow label="Venue">{venue.name}</InfoRow>}
          {venue?.address && (
            <InfoRow
              label="Event Address"
              actions={
                <>
                  <CopyAction text={venue.address} label="Copy address" />
                  <MapLink address={venue.address} />
                </>
              }
            >
              {venue.address}
            </InfoRow>
          )}
          {(venue?.contact_name || venue?.contact_phone) && (
            <InfoRow label="Contact" actions={venue.contact_phone && <CallLink phone={venue.contact_phone} />}>
              {venue.contact_name && <div>{venue.contact_name}</div>}
              {venue.contact_phone && <div className="text-xs text-white/55">{venue.contact_phone}</div>}
            </InfoRow>
          )}
          {venue?.notes && (
            <InfoRow label="Notes">
              <span className="whitespace-pre-wrap">{venue.notes}</span>
            </InfoRow>
          )}
          {info?.show_up_time && <InfoRow label="Show Up">{fmtDateTime(info.show_up_time)}</InfoRow>}
          {eventTime && <InfoRow label="Time">{eventTime}</InfoRow>}
          {breakTime && <InfoRow label="Break">{breakTime}</InfoRow>}
        </InfoList>
      )}
    </SectionCard>
  )
}
