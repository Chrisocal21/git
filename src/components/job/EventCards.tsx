'use client'

import { useEffect, useState } from 'react'
import type { Fldr, JobInfo, VenueInfo } from '@/types/fldr'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import {
  AddSectionButton,
  CallLink,
  ChoiceChips,
  CopyAction,
  DateTimeField,
  DirectionsLinks,
  EditButton,
  EmailLink,
  Field,
  FieldRow,
  FormGroup,
  InfoList,
  InfoRow,
  MapLink,
  Offer,
  SectionCard,
  SuggestInput,
  useEditMode,
} from './parts'
import { cityFromAddress, dayKey, fmtClock, fmtDateTime, fmtDay, fmtTimeSpan, jobTypeText } from '@/lib/jobFormat'
import { readQr } from '@/lib/qrImage'
import { contactFor, venueNamed } from '@/lib/jobSuggestions'
import type { JobSuggestions } from '@/lib/jobSuggestions'

// ── Client & Event ──────────────────────────────────────────────────────────

interface ClientEventCardProps {
  fldr: Fldr
  suggestions: JobSuggestions
  open: boolean
  onToggle: () => void
  onJobInfo: (field: keyof JobInfo, value: any) => void
  /** Several job info fields in one go */
  onJobInfoPatch: (patch: Partial<JobInfo>) => void
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
      placeholder="e.g. Austin, TX"
    />
  )
}

type TypeChoice = 'caricatures' | 'personalization' | 'other'

/**
 * One Job Type. The two usual ones are a tap; anything else is typed under "Other".
 * A job that already has something typed keeps showing it, whichever choice is picked.
 */
function JobTypeField({ info, onJobInfo }: { info: JobInfo | null; onJobInfo: (field: keyof JobInfo, value: any) => void }) {
  // Older jobs saved personalization under another name
  const saved = (info?.job_type as string) === 'names_monograms' ? 'personalization' : info?.job_type || null
  const typed = info?.event_type || ''
  const [otherOpen, setOtherOpen] = useState(false)
  const choice: TypeChoice | null = saved ?? (typed || otherOpen ? 'other' : null)

  return (
    <div className="min-w-0">
      <label className="label">Job Type</label>
      <ChoiceChips<TypeChoice>
        label="Job Type"
        value={choice}
        options={[
          { value: 'caricatures', label: 'Caricatures' },
          { value: 'personalization', label: 'Personalization' },
          { value: 'other', label: 'Other' },
        ]}
        onChange={next => {
          if (next === 'other') {
            setOtherOpen(true)
            onJobInfo('job_type', null)
          } else if (next === null && choice === 'other') {
            // Un-picking Other only folds the box away; what's typed in it is theirs to clear
            setOtherOpen(false)
          } else {
            setOtherOpen(false)
            onJobInfo('job_type', next)
          }
        }}
      />
      {(choice === 'other' || typed) && (
        <>
          <div className="mb-1.5 mt-3 text-[13px] font-medium text-white/60">{saved ? 'More about the type (optional)' : 'What kind of job is it?'}</div>
          <input
            type="text"
            value={typed}
            onChange={e => onJobInfo('event_type', e.target.value)}
            className="input"
            aria-label={saved ? 'More about the job type' : 'Other job type'}
            placeholder="e.g. Live engraving"
          />
        </>
      )}
    </div>
  )
}

export function ClientEventCard({ fldr, suggestions, open, onToggle, onJobInfo, onJobInfoPatch, onLocation, onDone }: ClientEventCardProps) {
  const info = fldr.job_info
  const type = jobTypeText(info)
  const hasContact = !!(info?.client_contact_name || info?.client_contact_phone || info?.client_contact_email)
  const products = (fldr.products || []).filter(p => p.name)
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
      info.pre_engrave_details ||
      info.wardrobe ||
      info.event_builder_qr ||
      info.event_details)
  )
  const { editing, toggle } = useEditMode(hasData, open, onDone)
  const [showAttire, setShowAttire] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [qrError, setQrError] = useState<string | null>(null)
  const attireShown = showAttire || !!info?.wardrobe
  const qrShown = showQr || !!info?.event_builder_qr
  const pickQr = async (file: File | undefined) => {
    if (!file) return
    setQrError(null)
    try {
      onJobInfo('event_builder_qr', await readQr(file))
    } catch (err) {
      setQrError(err instanceof Error ? err.message : 'Could not use that file')
    }
  }
  // Fields most jobs fill in later stay folded away until they're wanted
  const [showDates, setShowDates] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showPreEngrave, setShowPreEngrave] = useState(false)
  const datesShown = showDates || !!info?.kickoff_date || !!info?.prepro_date
  const detailsShown = showDetails || !!info?.event_details
  const preEngraveShown = showPreEngrave || !!info?.pre_engrave_details

  const text = (field: keyof JobInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onJobInfo(field, e.target.value)
  const day = (field: keyof JobInfo) => (e: React.ChangeEvent<HTMLInputElement>) => onJobInfo(field, e.target.value || null)

  const lastContact = !hasContact ? contactFor(suggestions, info?.client_name) : null
  const productsText = products.map(p => `${p.name} ×${p.quantity}`).join(', ')
  const productsTotal = products.reduce((sum, p) => sum + (p.quantity || 0), 0)

  return (
    <SectionCard
      id="event"
      title="Client & Event"
      open={open}
      onToggle={onToggle}
      summary={[info?.client_name, info?.distributor_name && `via ${info.distributor_name}`, type].filter(Boolean).join(' · ') || 'Who the job is for and what it is'}
      actions={
        <>
          {!editing && <CopyAction text={clientCopyText(fldr)} label="Copy client details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      {editing ? (
        <div className="space-y-6">
          <FormGroup title="Client">
            {/* The job is usually named after its client, so the name is offered rather than typed twice */}
            {!info?.client_name && fldr.title && !/\(copy\)$/i.test(fldr.title.trim()) && (
              <Offer action="Use" onUse={() => onJobInfo('client_name', fldr.title.trim())}>
                Is the client &ldquo;{fldr.title.trim()}&rdquo;?
              </Offer>
            )}
            <FieldRow>
              <Field label="Client Name">
                <SuggestInput
                  value={info?.client_name || ''}
                  onChange={value => onJobInfo('client_name', value)}
                  suggestions={suggestions.clients.map(value => ({ value }))}
                  placeholder="e.g. Acme Corp"
                />
              </Field>
              <Field label="Distributor Name" hint="Leave blank if there isn't one.">
                <SuggestInput
                  value={info?.distributor_name || ''}
                  onChange={value => onJobInfo('distributor_name', value)}
                  suggestions={suggestions.distributors.map(value => ({ value }))}
                  placeholder="e.g. Proven Promotions"
                />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="Contact">
            {lastContact && (
              <Offer
                action="Fill in"
                onUse={() =>
                  onJobInfoPatch({
                    client_contact_name: lastContact.name,
                    client_contact_phone: lastContact.phone,
                    client_contact_email: lastContact.email,
                  })
                }
              >
                Last contact for {lastContact.client}: {[lastContact.name, lastContact.phone, lastContact.email].filter(Boolean).join(' · ')}
              </Offer>
            )}
            <Field label="Contact Name">
              <input type="text" value={info?.client_contact_name || ''} onChange={text('client_contact_name')} className="input" placeholder="e.g. Jordan Lee" />
            </Field>
            <FieldRow>
              <Field label="Phone">
                <input type="tel" value={info?.client_contact_phone || ''} onChange={text('client_contact_phone')} className="input" placeholder="e.g. 555 123 4567" />
              </Field>
              <Field label="Email">
                <input type="email" value={info?.client_contact_email || ''} onChange={text('client_contact_email')} className="input" placeholder="e.g. jordan@acme.com" />
              </Field>
            </FieldRow>
          </FormGroup>

          <FormGroup title="Event">
            <FieldRow>
              <Field label="Job Title">
                <input type="text" value={info?.job_title || ''} onChange={text('job_title')} className="input" placeholder="e.g. Spring Sales Kickoff" />
              </Field>
              <Field label="City" hint="Weather, local time and the map all use this.">
                <LocationInput value={fldr.location || ''} onCommit={onLocation} />
              </Field>
            </FieldRow>
            <JobTypeField info={info} onJobInfo={onJobInfo} />
          </FormGroup>

          <FormGroup title="Gifts">
            {products.length > 0 && !info?.item && (
              <Offer action="Use" onUse={() => onJobInfoPatch({ item: products.map(p => p.name).join(', '), quantity: productsTotal || null })}>
                From Products: {productsText}
              </Offer>
            )}
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
              <Field label="Gift/s">
                <input type="text" value={info?.item || ''} onChange={text('item')} className="input" placeholder="e.g. YETI Rambler 20oz" />
              </Field>
              <Field label="Gift Qty">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={info?.quantity ?? ''}
                  onChange={e => onJobInfo('quantity', e.target.value === '' ? null : Number(e.target.value))}
                  className="input"
                  placeholder="e.g. 150"
                />
              </Field>
            </div>
            <p className="text-[13px] leading-relaxed text-white/40">Item numbers and jigs for each gift go under Products.</p>
            {preEngraveShown && (
              <Field label="Pre-engrave Details" hint="Anything that gets engraved before the event.">
                <textarea
                  value={info?.pre_engrave_details || ''}
                  onChange={text('pre_engrave_details')}
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Logo on all 300 tumblers before they ship"
                />
              </Field>
            )}
          </FormGroup>

          {datesShown && (
            <FormGroup title="Key Dates">
              <FieldRow always>
                <Field label="Kick-off Date">
                  <input type="date" value={info?.kickoff_date || ''} onChange={day('kickoff_date')} className="input" />
                </Field>
                <Field label="Pre-Production Date">
                  <input type="date" value={info?.prepro_date || ''} onChange={day('prepro_date')} className="input" />
                </Field>
              </FieldRow>
            </FormGroup>
          )}

          {detailsShown && (
            <Field label="Event Details">
              <textarea
                value={info?.event_details || ''}
                onChange={text('event_details')}
                className="input resize-none"
                rows={3}
                placeholder="e.g. Outdoor patio, 300 guests, names only"
              />
            </Field>
          )}

          {attireShown && (
            <Field label="Work Attire">
              <textarea
                value={info?.wardrobe || ''}
                onChange={e => onJobInfo('wardrobe', e.target.value || null)}
                className="input resize-none"
                rows={2}
                placeholder="e.g. Black polo, dark jeans, closed-toe shoes"
              />
            </Field>
          )}

          {qrShown && (
            <Field label="Event Builder QR Code" hint="Upload the PNG of this job's Event Builder QR code.">
              {info?.event_builder_qr && (
                <div className="mb-2 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={info.event_builder_qr} alt="Event Builder QR code" className="h-28 w-28 rounded-lg bg-white p-1" />
                  <button type="button" onClick={() => onJobInfo('event_builder_qr', null)} className="text-sm font-medium text-red-300">
                    Remove
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/*"
                onChange={e => {
                  pickQr(e.target.files?.[0])
                  e.target.value = ''
                }}
                className="input"
                aria-label="Upload QR code PNG"
              />
              {qrError && <p className="mt-1 text-sm text-red-300">{qrError}</p>}
            </Field>
          )}

          {(!datesShown || !detailsShown || !preEngraveShown || !attireShown || !qrShown) && (
            <div className="flex flex-wrap gap-2">
              {!attireShown && <AddSectionButton label="Work Attire" onClick={() => setShowAttire(true)} />}
              {!qrShown && <AddSectionButton label="Event Builder QR" onClick={() => setShowQr(true)} />}
              {!preEngraveShown && <AddSectionButton label="Pre-engrave Details" onClick={() => setShowPreEngrave(true)} />}
              {!datesShown && <AddSectionButton label="Key Dates" onClick={() => setShowDates(true)} />}
              {!detailsShown && <AddSectionButton label="Event Details" onClick={() => setShowDetails(true)} />}
            </div>
          )}
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
              {info.client_contact_phone && <div className="text-sm text-white/55">{info.client_contact_phone}</div>}
              {info.client_contact_email && <div className="break-all text-sm text-white/55">{info.client_contact_email}</div>}
            </InfoRow>
          )}
          {info?.job_title && <InfoRow label="Job Title">{info.job_title}</InfoRow>}
          {type && <InfoRow label="Job Type">{type}</InfoRow>}
          {fldr.location && <InfoRow label="City">{fldr.location}</InfoRow>}
          {info?.item ? (
            <InfoRow label="Gift/s">{info.item}</InfoRow>
          ) : (
            products.length > 0 && (
              <InfoRow label="Gift/s">
                {productsText}
                <span className="text-sm text-white/45"> · from Products</span>
              </InfoRow>
            )
          )}
          {info?.quantity != null && <InfoRow label="Gift Qty"><span className="tabular">{info.quantity}</span></InfoRow>}
          {info?.pre_engrave_details && (
            <InfoRow label="Pre-engrave Details">
              <span className="whitespace-pre-wrap">{info.pre_engrave_details}</span>
            </InfoRow>
          )}
          {info?.kickoff_date && <InfoRow label="Kick-off Date">{fmtDay(info.kickoff_date, true)}</InfoRow>}
          {info?.prepro_date && <InfoRow label="Pre-Production Date">{fmtDay(info.prepro_date, true)}</InfoRow>}
          {info?.wardrobe && (
            <InfoRow label="Work Attire">
              <span className="whitespace-pre-wrap">{info.wardrobe}</span>
            </InfoRow>
          )}
          {info?.event_builder_qr && (
            <InfoRow label="Event Builder QR">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={info.event_builder_qr} alt="Event Builder QR code" className="mt-1 h-44 w-44 rounded-xl bg-white p-2" />
            </InfoRow>
          )}
          {info?.event_details && (
            <InfoRow label="Event Details">
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
  suggestions: JobSuggestions
  open: boolean
  onToggle: () => void
  onVenue: (field: keyof VenueInfo, value: string) => void
  /** Several venue fields in one go */
  onVenuePatch: (patch: Partial<VenueInfo>) => void
  onJobInfo: (field: keyof JobInfo, value: any) => void
  onLocation: (value: string) => void
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

export function VenueTimeCard({ fldr, suggestions, open, onToggle, onVenue, onVenuePatch, onJobInfo, onLocation, onDone }: VenueTimeCardProps) {
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
  const [showNotes, setShowNotes] = useState(false)
  const [showBreak, setShowBreak] = useState(false)
  const notesShown = showNotes || !!venue?.notes
  const breakShown = showBreak || !!breakTime

  const time = (field: keyof JobInfo) => (e: React.ChangeEvent<HTMLInputElement>) => onJobInfo(field, e.target.value || null)

  // The job's own dates, so a time only needs its time picked
  const firstDay = fldr.date_start
  const lastDay = fldr.date_end || fldr.date_start
  const startDay = dayKey(info?.job_start_time) || firstDay

  // A venue used on an earlier job brings its address and contact with it
  const known = venueNamed(suggestions, venue?.name)
  const knownFill: Partial<VenueInfo> = known
    ? {
        ...(!venue?.address && known.address ? { address: known.address } : {}),
        ...(!venue?.contact_name && known.contact_name ? { contact_name: known.contact_name } : {}),
        ...(!venue?.contact_phone && known.contact_phone ? { contact_phone: known.contact_phone } : {}),
      }
    : {}
  const city = !fldr.location ? cityFromAddress(venue?.address) : null

  return (
    <SectionCard
      id="venue"
      title="Venue & Time"
      open={open}
      onToggle={onToggle}
      summary={[venue?.name || venue?.address, eventTime || (info?.show_up_time && `Show up ${fmtDateTime(info.show_up_time)}`)].filter(Boolean).join(' · ') || 'Where it is and when to be there'}
      actions={
        <>
          {!editing && <CopyAction text={venueCopyText(venue)} label="Copy venue details" />}
          <EditButton editing={editing} onClick={toggle} />
        </>
      }
    >
      {editing ? (
        <div className="space-y-6">
          <FormGroup title="Venue">
            <Field label="Venue Name">
              <SuggestInput
                value={venue?.name || ''}
                onChange={value => onVenue('name', value)}
                suggestions={suggestions.venues.map(v => ({ value: v.name, detail: v.address || undefined }))}
                placeholder="e.g. JW Marriott Austin"
              />
            </Field>
            {known && Object.keys(knownFill).length > 0 && (
              <Offer action="Fill in" onUse={() => onVenuePatch(knownFill)}>
                {known.name} was on an earlier job: {[known.address, known.contact_name, known.contact_phone].filter(Boolean).join(' · ')}
              </Offer>
            )}
            <Field label="Event Address">
              <AddressAutocomplete
                value={venue?.address || ''}
                onChange={value => onVenue('address', value)}
                className="input"
                placeholder="Start typing the address"
              />
            </Field>
            {city && (
              <Offer action="Use" onUse={() => onLocation(city)}>
                This job has no city yet. Use {city}?
              </Offer>
            )}
            <FieldRow>
              <Field label="Venue Contact Name">
                <input type="text" value={venue?.contact_name || ''} onChange={e => onVenue('contact_name', e.target.value)} className="input" placeholder="e.g. Sam Rivera" />
              </Field>
              <Field label="Venue Contact Phone">
                <input type="tel" value={venue?.contact_phone || ''} onChange={e => onVenue('contact_phone', e.target.value)} className="input" placeholder="e.g. 555 123 4567" />
              </Field>
            </FieldRow>
            {notesShown ? (
              <Field label="Venue Notes">
                <textarea
                  value={venue?.notes || ''}
                  onChange={e => onVenue('notes', e.target.value)}
                  className="input resize-none"
                  rows={2}
                  placeholder="e.g. Load in through the back dock, ask for security"
                />
              </Field>
            ) : (
              <AddSectionButton label="Venue Notes" onClick={() => setShowNotes(true)} />
            )}
          </FormGroup>

          <FormGroup title="Event Schedule">
            <DateTimeField
              label="Show Up Time"
              hint="When the team needs to be on site."
              value={info?.show_up_time}
              defaultDay={firstDay}
              onChange={value => onJobInfo('show_up_time', value)}
            />

            <label className="flex min-h-[2.75rem] cursor-pointer items-center gap-3 rounded-xl border border-line bg-white/5 px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={info?.use_daily_schedule || false}
                onChange={e => onJobInfo('use_daily_schedule', e.target.checked)}
                className="h-5 w-5 flex-shrink-0 rounded"
              />
              <span className="text-[15px] text-white/85">Same times every day (for events longer than one day)</span>
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
                {breakShown && (
                  <FieldRow always>
                    <Field label="Daily Break Start">
                      <input type="time" value={info?.daily_break_start || ''} onChange={time('daily_break_start')} className="input" />
                    </Field>
                    <Field label="Daily Break End">
                      <input type="time" value={info?.daily_break_end || ''} onChange={time('daily_break_end')} className="input" />
                    </Field>
                  </FieldRow>
                )}
              </>
            ) : (
              <>
                <FieldRow>
                  <DateTimeField
                    label="Job Start Time"
                    value={info?.job_start_time}
                    defaultDay={firstDay}
                    onChange={value => onJobInfo('job_start_time', value)}
                  />
                  <DateTimeField
                    label="Job End Time"
                    value={info?.job_end_time}
                    defaultDay={fldr.date_end ? lastDay : startDay}
                    onChange={value => onJobInfo('job_end_time', value)}
                  />
                </FieldRow>
                {breakShown && (
                  <FieldRow>
                    <DateTimeField
                      label="Break Start"
                      value={info?.break_start_time}
                      defaultDay={startDay}
                      onChange={value => onJobInfo('break_start_time', value)}
                    />
                    <DateTimeField
                      label="Break End"
                      value={info?.break_end_time}
                      defaultDay={dayKey(info?.break_start_time) || startDay}
                      onChange={value => onJobInfo('break_end_time', value)}
                    />
                  </FieldRow>
                )}
              </>
            )}
            {!breakShown && <AddSectionButton label="Break Times" onClick={() => setShowBreak(true)} />}
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
              <DirectionsLinks to={venue.address} from={[{ label: 'From hotel', address: fldr.hotel_info?.address }]} />
            </InfoRow>
          )}
          {(venue?.contact_name || venue?.contact_phone) && (
            <InfoRow label="Venue Contact" actions={venue.contact_phone && <CallLink phone={venue.contact_phone} />}>
              {venue.contact_name && <div>{venue.contact_name}</div>}
              {venue.contact_phone && <div className="text-sm text-white/55">{venue.contact_phone}</div>}
            </InfoRow>
          )}
          {venue?.notes && (
            <InfoRow label="Venue Notes">
              <span className="whitespace-pre-wrap">{venue.notes}</span>
            </InfoRow>
          )}
          {info?.show_up_time && <InfoRow label="Show Up Time">{fmtDateTime(info.show_up_time)}</InfoRow>}
          {eventTime && <InfoRow label="Event Time">{eventTime}</InfoRow>}
          {breakTime && <InfoRow label="Break">{breakTime}</InfoRow>}
        </InfoList>
      )}
    </SectionCard>
  )
}
