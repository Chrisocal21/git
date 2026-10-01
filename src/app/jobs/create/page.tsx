'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cacheFldr } from '@/lib/offlineStorage'
import PageHeader from '@/components/PageHeader'

export default function CreateFldrPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [location, setLocation] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newFldr = {
      title,
      date_start: dateStart,
      date_end: dateEnd || null,
      location: location || null,
    }

    const response = await fetch('/api/fldrs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFldr),
    })

    if (response.ok) {
      const fldr = await response.json()

      // Cache the new fldr for offline access
      cacheFldr(fldr)

      // Navigate to the new fldr - it will fetch from D1/server on load
      router.push(`/jobs/${fldr.id}`)
    } else {
      const error = await response.json()
      alert(`Failed to create fldr: ${error.error || 'Unknown error'}`)
    }
  }

  return (
    <div className="min-h-page text-white">
      <PageHeader
        title="Create Job"
        width="max-w-lg"
        actions={
          <button
            onClick={() => router.back()}
            className="px-2 py-1.5 text-sm text-white/55 hover:text-white transition-colors"
          >
            Cancel
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="px-4 py-6 max-w-lg mx-auto">
        <div className="card shadow-card p-5 space-y-4">
          <div>
            <label htmlFor="title" className="label">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input"
              placeholder="Client name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="input"
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
                onChange={(e) => setDateEnd(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="label">
              Location <span className="text-white/35 font-normal">(optional)</span>
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input"
              placeholder="City, State"
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full py-3 mt-5"
        >
          Create Job
        </button>
      </form>
    </div>
  )
}
