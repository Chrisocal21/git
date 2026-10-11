'use client'

import { useEffect, useState } from 'react'
import type { Fldr } from '@/types/fldr'
import { getTeamProfiles } from '@/lib/auth'
import { askConfirm, toast } from '@/components/Dialogs'
import { TrashIcon } from '@/components/Icons'
import { announceJobsChanged, forgetJob, rememberJob } from '@/lib/jobsChanged'
import { fmtDayRange } from '@/lib/jobFormat'

interface TimeOffFormProps {
  /** The entry being changed. Left out when adding a new one. */
  entry?: Fldr | null
  /** The day to start on when adding (the day that was tapped on the calendar) */
  defaultDay?: string | null
  /** Called once it's saved or deleted */
  onDone: () => void
}

/**
 * Who's off, and when. The same form adds a time off entry (from the dock's New button
 * or a day on the calendar) and changes or deletes one that's already there.
 */
export default function TimeOffForm({ entry, defaultDay, onDone }: TimeOffFormProps) {
  const teamProfiles = getTeamProfiles()
  const entryName = entry?.people?.[0]?.name || ''
  // Someone who isn't a profile on this phone still has to be selectable when editing their entry
  const names = teamProfiles.map(profile => profile.name)
  const options = entryName && !names.some(name => name.toLowerCase() === entryName.toLowerCase()) ? [entryName, ...names] : names

  const [person, setPerson] = useState(entryName)
  const [start, setStart] = useState(entry?.date_start || defaultDay || '')
  const [end, setEnd] = useState(entry?.date_end || '')
  const [note, setNote] = useState(entry?.notes || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!person && options.length > 0) setPerson(options[0])
  }, [person, options])

  const save = async () => {
    if (!person || !start || saving) return
    setSaving(true)
    const details = {
      title: `${person} – Time Off`,
      date_start: start,
      date_end: end && end !== start ? end : null,
      people: [{ name: person, role: null, phone: null, email: null }],
      notes: note || '',
    }
    // Nothing changed: nothing to send
    if (
      entry &&
      details.title === entry.title &&
      details.date_start === entry.date_start &&
      details.date_end === (entry.date_end || null) &&
      details.notes === (entry.notes || '') &&
      person === entryName
    ) {
      setSaving(false)
      onDone()
      return
    }
    try {
      const res = entry
        ? await fetch(`/api/fldrs/${entry.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(details),
          })
        : await fetch('/api/fldrs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...details, fldr_type: 'time_off' as const, location: null }),
          })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      const saved: Fldr = await res.json()
      rememberJob(saved)
      announceJobsChanged({ saved })
      toast(`Time off ${entry ? 'updated' : 'added'}: ${person}, ${fmtDayRange(details.date_start, details.date_end)}`)
      onDone()
    } catch (e) {
      console.error('[TimeOff] Save failed:', e)
      toast("Couldn't save the time off. Check your connection and try again.", 'error')
    }
    setSaving(false)
  }

  const remove = async () => {
    if (!entry || saving) return
    const confirmed = await askConfirm({
      title: 'Delete this time off?',
      body: `${entryName || 'This person'}, ${fmtDayRange(entry.date_start, entry.date_end)}. It comes off the calendar for everyone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) return
    setSaving(true)
    try {
      const res = await fetch(`/api/fldrs/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`delete failed: ${res.status}`)
      forgetJob(entry.id)
      announceJobsChanged({ deletedId: entry.id })
      toast('Time off deleted')
      onDone()
    } catch (e) {
      console.error('[TimeOff] Delete failed:', e)
      toast("Couldn't delete the time off. Check your connection and try again.", 'error')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="time-off-person" className="label">Who&apos;s off</label>
        <select id="time-off-person" value={person} onChange={e => setPerson(e.target.value)} className="input min-h-[2.75rem]">
          {options.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="time-off-start" className="label">First Day <span className="text-red-400">*</span></label>
          <input id="time-off-start" type="date" value={start} onChange={e => setStart(e.target.value)} className="input min-h-[2.75rem]" />
        </div>
        <div>
          <label htmlFor="time-off-end" className="label">Last Day</label>
          <input id="time-off-end" type="date" value={end} onChange={e => setEnd(e.target.value)} min={start || undefined} className="input min-h-[2.75rem]" />
        </div>
      </div>
      <p className="-mt-2 text-[13px] text-white/40">Leave Last Day blank for a single day.</p>
      <div>
        <label htmlFor="time-off-note" className="label">Note (optional)</label>
        <input
          id="time-off-note"
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Vacation, sick day"
          className="input min-h-[2.75rem]"
        />
      </div>
      <button onClick={save} disabled={!person || !start || saving} className="btn-primary w-full min-h-[3rem]">
        {saving ? 'Saving...' : entry ? 'Save Changes' : 'Add to Calendar'}
      </button>
      {entry && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="inline-flex min-h-[2.75rem] items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
          >
            <TrashIcon className="h-4 w-4" />
            Delete Time Off
          </button>
        </div>
      )}
    </div>
  )
}
