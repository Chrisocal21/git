'use client'

import type { JobInfo, ReferenceLink } from '@/types/fldr'
import { CopyAction, EditButton, Field, FormGroup, OpenLink, SectionCard, TextAction, useEditMode } from './parts'
import { linkHost, linkHref } from '@/lib/jobFormat'

interface LinksCardProps {
  jobInfo: JobInfo | null
  open: boolean
  onToggle: () => void
  onJobInfo: (field: keyof JobInfo, value: any) => void
  onDone: () => void
}

/** A list of labelled links being filled in: label, URL, and a way to drop the row */
function LinkListEditor({
  title,
  links,
  onChange,
  empty,
}: {
  title: string
  links: ReferenceLink[]
  onChange: (links: ReferenceLink[]) => void
  empty: string
}) {
  const update = (index: number, field: 'label' | 'url', value: string) => {
    const next = [...links]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs font-medium text-white/60">{title}</label>
        <TextAction onClick={() => onChange([...links, { label: '', url: '' }])}>+ Add</TextAction>
      </div>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={index} className="space-y-2 rounded-xl border border-line bg-white/5 p-3">
            <input type="text" value={link.label} onChange={e => update(index, 'label', e.target.value)} className="input" placeholder="Label" />
            <div className="flex items-center gap-2">
              <input type="url" value={link.url} onChange={e => update(index, 'url', e.target.value)} className="input flex-1" placeholder="URL" />
              <button
                type="button"
                onClick={() => onChange(links.filter((_, i) => i !== index))}
                aria-label={`Remove ${link.label || 'link'}`}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-lg leading-none text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {links.length === 0 && <p className="text-xs text-white/40">{empty}</p>}
      </div>
    </div>
  )
}

/** A saved link to read: its name, where it goes, and buttons to copy or open it */
function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <a href={linkHref(url)} target="_blank" rel="noopener noreferrer" className="group min-w-0 flex-1">
        <div className="truncate text-sm text-white/90 transition-colors group-hover:text-white">{label}</div>
        <div className="truncate text-xs text-brand-light">{linkHost(url)}</div>
      </a>
      <div className="-mr-2 flex flex-shrink-0 items-center">
        <CopyAction text={url} label="Copy link" />
        <OpenLink url={url} />
      </div>
    </div>
  )
}

export default function LinksCard({ jobInfo, open, onToggle, onJobInfo, onDone }: LinksCardProps) {
  const feeLinks = jobInfo?.asana_fee_links || []
  const refLinks = jobInfo?.reference_links || []
  const savedFees = feeLinks.filter(link => link.url)
  const savedRefs = refLinks.filter(link => link.url)
  const hasData = !!jobInfo?.asana_link || savedFees.length > 0 || savedRefs.length > 0
  const { editing, toggle } = useEditMode(hasData, open, onDone)

  const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

  return (
    <SectionCard
      id="links"
      title="Links"
      open={open}
      onToggle={onToggle}
      summary={
        [
          jobInfo?.asana_link && 'Asana',
          savedFees.length > 0 && plural(savedFees.length, 'event fee link'),
          savedRefs.length > 0 && plural(savedRefs.length, 'reference link'),
        ]
          .filter(Boolean)
          .join(' · ') || undefined
      }
      actions={<EditButton editing={editing} onClick={toggle} />}
    >
      {editing ? (
        <div className="space-y-5">
          <FormGroup title="Asana">
            <Field label="Asana Link">
              <input
                type="url"
                value={jobInfo?.asana_link || ''}
                onChange={e => onJobInfo('asana_link', e.target.value || null)}
                className="input"
                placeholder="Paste the Asana link"
              />
            </Field>
            <LinkListEditor
              title="Asana Event Fee Links"
              links={feeLinks}
              onChange={links => onJobInfo('asana_fee_links', links)}
              empty="No event fee links yet"
            />
          </FormGroup>
          <FormGroup title="Reference">
            <LinkListEditor
              title="Reference Links"
              links={refLinks}
              onChange={links => onJobInfo('reference_links', links)}
              empty="No reference links yet"
            />
          </FormGroup>
        </div>
      ) : (
        <div className="space-y-4">
          {(jobInfo?.asana_link || savedFees.length > 0) && (
            <div>
              <div className="eyebrow">Asana</div>
              <div className="divide-y divide-line">
                {jobInfo?.asana_link && <LinkRow label="Asana Link" url={jobInfo.asana_link} />}
                {savedFees.map((link, index) => (
                  <LinkRow
                    key={index}
                    label={link.label || `Event Fee Link${savedFees.length > 1 ? ` ${index + 1}` : ''}`}
                    url={link.url}
                  />
                ))}
              </div>
            </div>
          )}
          {savedRefs.length > 0 && (
            <div>
              <div className="eyebrow">Reference</div>
              <div className="divide-y divide-line">
                {savedRefs.map((link, index) => (
                  <LinkRow key={index} label={link.label || linkHost(link.url)} url={link.url} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
