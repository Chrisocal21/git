'use client'

import { useEffect, useState } from 'react'
import type { Person } from '@/types/fldr'
import { getTeamProfiles } from '@/lib/auth'
import { CallLink, EditButton, EmailLink, Field, FieldRow, InfoList, InfoRow, SectionCard, TextAction, useEditMode } from './parts'

interface StaffCardProps {
  people: Person[] | null
  wardrobe: string | null
  open: boolean
  onToggle: () => void
  onAddPerson: (name?: string) => void
  onPersonField: (index: number, field: keyof Person, value: string) => void
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
  open,
  onToggle,
  onAddPerson,
  onPersonField,
  onPersonNameBlur,
  onRemovePerson,
  onWardrobe,
  onDone,
}: StaffCardProps) {
  const list = people || []
  const named = list.filter(p => p.name && p.name.trim())
  const hasData = named.length > 0 || !!wardrobe
  const { editing, toggle } = useEditMode(hasData, open, onDone)

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
      summary={[named.map(p => p.name).join(', '), wardrobe && `Wardrobe: ${wardrobe}`].filter(Boolean).join(' · ') || undefined}
      meta={named.length > 0 && <span className="text-xs font-semibold tabular text-white/55">{named.length}</span>}
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      {editing ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/45">
              {list.length} {list.length === 1 ? 'person' : 'people'}
            </span>
            <TextAction onClick={() => onAddPerson()}>+ Add Person</TextAction>
          </div>

          {quickAdd.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {quickAdd.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onAddPerson(name)}
                  className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs font-medium text-white/60 transition-colors hover:border-brand/60 hover:text-white"
                >
                  + {name}
                </button>
              ))}
            </div>
          )}

          {list.map((person, index) => (
            <div key={index} className="space-y-2 rounded-xl border border-line bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={person.name}
                  onChange={e => onPersonField(index, 'name', e.target.value)}
                  onBlur={e => onPersonNameBlur(e.target.value)}
                  className="input flex-1 font-medium"
                  placeholder="Name"
                />
                <button
                  type="button"
                  onClick={() => onRemovePerson(index)}
                  aria-label={`Remove ${person.name || 'person'}`}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg leading-none text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  ×
                </button>
              </div>
              <input type="text" value={person.role || ''} onChange={e => onPersonField(index, 'role', e.target.value)} className="input" placeholder="Role" />
              <FieldRow always>
                <input type="tel" value={person.phone || ''} onChange={e => onPersonField(index, 'phone', e.target.value)} className="input" placeholder="Phone" />
                <input type="email" value={person.email || ''} onChange={e => onPersonField(index, 'email', e.target.value)} className="input" placeholder="Email" />
              </FieldRow>
            </div>
          ))}
          {list.length === 0 && <p className="text-xs text-white/40">No people yet</p>}

          <Field label="Wardrobe">
            <textarea value={wardrobe || ''} onChange={e => onWardrobe(e.target.value)} className="input resize-none" rows={2} placeholder="What the team wears on site" />
          </Field>
        </div>
      ) : (
        <>
          {named.length > 0 && (
            <ul className="divide-y divide-line">
              {named.map((person, index) => (
                <li key={index} className="flex items-center gap-3 py-2.5">
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-line bg-white/5 text-[11px] font-semibold text-white/70"
                    aria-hidden="true"
                  >
                    {initials(person.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm leading-5 text-white/90">
                      {person.name}
                      {person.role && <span className="text-white/45"> · {person.role}</span>}
                    </div>
                    {(person.phone || person.email) && (
                      <div className="break-all text-xs text-white/55">{[person.phone, person.email].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  {(person.phone || person.email) && (
                    <div className="-mr-2 flex flex-shrink-0 items-center">
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
