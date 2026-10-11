'use client'

import { useEffect, useState } from 'react'
import type { Person } from '@/types/fldr'
import { getTeamProfiles } from '@/lib/auth'
import {
  AddSectionButton,
  CallLink,
  EditButton,
  EmailLink,
  Field,
  FieldRow,
  InfoList,
  InfoRow,
  Offer,
  RemoveButton,
  SectionCard,
  useEditMode,
} from './parts'
import { personNamed } from '@/lib/jobSuggestions'
import type { JobSuggestions } from '@/lib/jobSuggestions'

interface StaffCardProps {
  people: Person[] | null
  wardrobe: string | null
  suggestions: JobSuggestions
  open: boolean
  onToggle: () => void
  /** Adds a person; their phone and email come along when Burrow has them from an earlier job */
  onAddPerson: (name?: string, known?: { phone: string | null; email: string | null }) => void
  onPersonField: (index: number, field: keyof Person, value: string) => void
  /** Phone and email together, for filling in from an earlier job */
  onPersonContact: (index: number, contact: { phone: string | null; email: string | null }) => void
  /** Run when a name is finished, so the person gets a profile */
  onPersonNameBlur: (name: string) => void
  onRemovePerson: (index: number) => void
  onWardrobe: (value: string) => void
  onDone: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function StaffCard({
  people,
  wardrobe,
  suggestions,
  open,
  onToggle,
  onAddPerson,
  onPersonField,
  onPersonContact,
  onPersonNameBlur,
  onRemovePerson,
  onWardrobe,
  onDone,
}: StaffCardProps) {
  const list = people || []
  const named = list.filter(p => p.name && p.name.trim())
  const hasData = named.length > 0 || !!wardrobe
  const { editing, toggle } = useEditMode(hasData, open, onDone)
  // Phone and email stay folded away per person until they're wanted
  const [contactOpen, setContactOpen] = useState<Record<number, boolean>>({})

  // Team profiles live on this device, so they're read after the page is up.
  // "Active" only means someone is on a current job, so everyone is offered, those people first.
  const [team, setTeam] = useState<string[]>([])
  useEffect(() => {
    const profiles = getTeamProfiles()
    setTeam([...profiles.filter(p => p.active !== false), ...profiles.filter(p => p.active === false)].map(p => p.name))
  }, [])
  const onJob = new Set(named.map(p => p.name.trim().toLowerCase()))
  const quickAdd = team.filter(name => !onJob.has(name.toLowerCase()))

  return (
    <SectionCard
      id="people"
      title="Staff"
      open={open}
      onToggle={onToggle}
      summary={[named.map(p => p.name).join(', '), wardrobe && `Wardrobe: ${wardrobe}`].filter(Boolean).join(' · ') || "Who's working the job and what to wear"}
      meta={named.length > 0 && <span className="text-sm font-semibold tabular text-white/55">{named.length}</span>}
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      {editing ? (
        <div className="space-y-4">
          <div>
            <div className="label">Tap to add someone</div>
            <div className="flex flex-wrap items-center gap-2">
              {quickAdd.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onAddPerson(name, personNamed(suggestions, name) || undefined)}
                  className="inline-flex min-h-[2.5rem] items-center rounded-full border border-dashed border-line-strong px-3.5 text-[15px] font-medium text-white/60 transition-colors hover:border-brand/60 hover:text-white"
                >
                  + {name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onAddPerson()}
                className="inline-flex min-h-[2.5rem] items-center rounded-full border border-dashed border-brand/50 px-3.5 text-[15px] font-medium text-brand-light transition-colors hover:border-brand hover:text-white"
              >
                + Someone else
              </button>
            </div>
          </div>

          {list.map((person, index) => {
            const known = !person.phone && !person.email ? personNamed(suggestions, person.name) : null
            const showContact = contactOpen[index] || !!person.phone || !!person.email
            return (
              <div key={index} className="space-y-2 rounded-xl border border-line bg-white/5 p-3">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={person.name}
                    onChange={e => onPersonField(index, 'name', e.target.value)}
                    onBlur={e => onPersonNameBlur(e.target.value)}
                    className="input flex-1 font-medium"
                    aria-label="Name"
                    placeholder="Name"
                  />
                  <RemoveButton label={`Remove ${person.name || 'person'}`} onClick={() => onRemovePerson(index)} />
                </div>
                <input
                  type="text"
                  value={person.role || ''}
                  onChange={e => onPersonField(index, 'role', e.target.value)}
                  className="input"
                  aria-label={`Role for ${person.name || 'this person'}`}
                  placeholder="Role on this job, e.g. Lead engraver"
                />
                {known && (
                  <Offer action="Fill in" onUse={() => onPersonContact(index, { phone: known.phone, email: known.email })}>
                    From an earlier job: {[known.phone, known.email].filter(Boolean).join(' · ')}
                  </Offer>
                )}
                {showContact ? (
                  <FieldRow>
                    <input
                      type="tel"
                      value={person.phone || ''}
                      onChange={e => onPersonField(index, 'phone', e.target.value)}
                      className="input"
                      aria-label={`Phone for ${person.name || 'this person'}`}
                      placeholder="Phone"
                    />
                    <input
                      type="email"
                      value={person.email || ''}
                      onChange={e => onPersonField(index, 'email', e.target.value)}
                      className="input"
                      aria-label={`Email for ${person.name || 'this person'}`}
                      placeholder="Email"
                    />
                  </FieldRow>
                ) : (
                  !known && <AddSectionButton label="Phone and Email" onClick={() => setContactOpen(prev => ({ ...prev, [index]: true }))} />
                )}
              </div>
            )
          })}

          <Field label="Wardrobe">
            <textarea
              value={wardrobe || ''}
              onChange={e => onWardrobe(e.target.value)}
              className="input resize-none"
              rows={2}
              placeholder="e.g. Black polo, dark jeans, closed-toe shoes"
            />
          </Field>
        </div>
      ) : (
        <>
          {named.length > 0 && (
            <ul className="divide-y divide-line">
              {named.map((person, index) => (
                <li key={index} className="flex min-h-[3.25rem] items-center gap-3 py-2">
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-line bg-white/5 text-[13px] font-semibold text-white/70"
                    aria-hidden="true"
                  >
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base leading-5 text-white/90">
                      {person.name}
                      {person.role && <span className="text-white/45"> · {person.role}</span>}
                    </div>
                    {(person.phone || person.email) && (
                      <div className="break-all text-sm text-white/55">{[person.phone, person.email].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  {(person.phone || person.email) && (
                    <div className="-mr-2.5 flex flex-shrink-0 items-center">
                      {person.phone && <CallLink phone={person.phone} />}
                      {person.email && <EmailLink email={person.email} />}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {wardrobe && (
            <div className={named.length > 0 ? 'border-t border-line' : ''}>
              <InfoList>
                <InfoRow label="Wardrobe">
                  <span className="whitespace-pre-wrap">{wardrobe}</span>
                </InfoRow>
              </InfoList>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}
