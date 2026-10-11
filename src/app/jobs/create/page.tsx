'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cacheFldr } from '@/lib/offlineStorage'
import PageHeader from '@/components/PageHeader'
import { toast } from '@/components/Dialogs'
import { SuggestInput } from '@/components/job/parts'
import { NO_SUGGESTIONS, buildJobSuggestions, readCachedJobs } from '@/lib/jobSuggestions'
import type { JobSuggestions } from '@/lib/jobSuggestions'
import { rememberJob } from '@/lib/jobsChanged'

export default function CreateFldrPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [location, setLocation] = useState('')
  const [saving, setSaving] = useState(false)
  // Clients and cities from earlier jobs, offered as you type
  const [suggestions, setSuggestions] = useState<JobSuggestions>(NO_SUGGESTIONS)

  useEffect(() => {
    setSuggestions(buildJobSuggestions(readCachedJobs()))
    // Coming from a day on the calendar: start on that day
    const day = new URLSearchParams(window.location.search).get('date')
    if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) setDateStart(day)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // A second tap while the first is still saving would make the job twice
    if (saving) return
    setSaving(true)

    const newFldr = {
      title: title.trim(),
      date_start: dateStart,
      date_end: dateEnd && dateEnd !== dateStart ? dateEnd : null,
      location: location.trim() || null,
    }

    try {
      const response = await fetch('/api/fldrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFldr),
      })
      if (!response.ok) throw new Error(`create failed: ${response.status}`)

      const fldr = await response.json()

      // Cache the new fldr for offline access
      cacheFldr(fldr)
      rememberJob(fldr)

      toast('Job created. Next, fill in what’s still missing.')
      // Navigate to the new fldr - it will fetch from D1/server on load
      router.push(`/jobs/${fldr.id}`)
    } catch (error) {
      console.error('[Create] Failed to create job:', error)
      toast("Couldn't create the job. Check your connection and try again.", 'error')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-page text-white">
      <PageHeader
        title="New Job"
        width="max-w-lg"
        actions={
          <button
            onClick={() => router.back()}
            className="inline-flex min-h-[2.75rem] items-center px-2 text-sm text-white/55 hover:text-white transition-colors"
          >
            Cancel
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="px-4 py-6 max-w-lg mx-auto">
        <p className="mb-4 px-1 text-sm leading-relaxed text-white/55">
          Just the basics to start. Flights, the hotel, the venue and everything else go in on the next screen.
        </p>
        <div className="card shadow-card p-5 space-y-5">
          <div>
            <label htmlFor="title" className="label">
              Job Name <span className="text-red-400">*</span>
            </label>
            <SuggestInput
              id="title"
              required
              value={title}
              onChange={setTitle}
              suggestions={suggestions.clients.map(value => ({ value }))}
              placeholder="e.g. Acme Corp"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-white/40">Usually the client&apos;s name. You can change it later.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dateStart" className="label">
                Start Date <span className="text-red-400">*</span>
              </label>
              <input
                id="dateStart"
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                required
                className="input min-h-[2.75rem]"
              />
            </div>

            <div>
              <label htmlFor="dateEnd" className="label">
                End Date <span className="text-white/35 font-normal">(optional)</span>
              </label>
              <input
                id="dateEnd"
                type="date"
                value={dateEnd}
                min={dateStart || undefined}
                onChange={(e) => setDateEnd(e.target.value)}
                className="input min-h-[2.75rem]"
              />
            </div>
          </div>
          <p className="!mt-1.5 text-xs leading-relaxed text-white/40">The day of the event. Leave End Date blank if it&apos;s one day.</p>

          <div>
            <label htmlFor="location" className="label">
              City <span className="text-white/35 font-normal">(optional)</span>
            </label>
            <SuggestInput
              id="location"
              value={location}
              onChange={setLocation}
              suggestions={suggestions.cities.map(value => ({ value }))}
              placeholder="e.g. Austin, TX"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-white/40">Weather, local time and the map all use this.</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary w-full min-h-[3rem] mt-5"
        >
          {saving ? 'Creating...' : 'Create Job'}
        </button>
      </form>
    </div>
  )
}
