'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cacheFldr } from '@/lib/offlineStorage'

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
      
      // Cache the new fldr
      cacheFldr(fldr)
      
      // Update localStorage cache
      try {
        const cached = localStorage.getItem('git-fldrs')
        if (cached) {
          const allFldrs = JSON.parse(cached)
          allFldrs.push(fldr)
          localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
        } else {
          localStorage.setItem('git-fldrs', JSON.stringify([fldr]))
        }
      } catch (e) {
        console.error('Failed to update cache:', e)
      }
      
      router.push(`/fldr/${fldr.id}`)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">GIT</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-300"
        >
          Cancel
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-6">Create Fldr</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            placeholder="Trip or event name"
          />
        </div>

        <div>
          <label htmlFor="dateStart" className="block text-sm font-medium mb-2">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            id="dateStart"
            type="date"
            value={dateStart}
            onChange={(e) => setDateStart(e.target.value)}
            required
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          />
        </div>

        <div>
          <label htmlFor="dateEnd" className="block text-sm font-medium mb-2">
            End Date <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <input
            id="dateEnd"
            type="date"
            value={dateEnd}
            onChange={(e) => setDateEnd(e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          />
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-2">
            Location <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
            placeholder="City, State"
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg font-medium transition-colors mt-8"
        >
          Create Fldr
        </button>
      </form>
    </div>
  )
}
