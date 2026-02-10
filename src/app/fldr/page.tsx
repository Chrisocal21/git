'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr, FldrStatus } from '@/types/fldr'
import { PlusIcon } from '@/components/Icons'
import { FldrListSkeleton } from '@/components/SkeletonLoader'

type FilterOption = 'all' | 'upcoming' | 'active' | 'complete'

export default function FldrPage() {
  const router = useRouter()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterOption>('all')

  useEffect(() => {
    // Try to load from localStorage first for instant display
    const cached = localStorage.getItem('git-fldrs')
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setFldrs(parsed)
        setLoading(false)
      } catch (e) {
        console.error('Failed to parse cached fldrs:', e)
      }
    }

    // Then fetch from API and update
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => {
        setFldrs(data)
        setLoading(false)
        // Cache for next time
        localStorage.setItem('git-fldrs', JSON.stringify(data))
      })
      .catch(err => {
        console.error('Failed to fetch fldrs:', err)
        setLoading(false)
      })
  }, [])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: FldrStatus) => {
    switch (status) {
      case 'incomplete': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500'
      case 'ready': return 'bg-blue-900/30 text-blue-400 border-blue-500'
      case 'active': return 'bg-green-900/30 text-green-400 border-green-500'
      case 'complete': return 'bg-gray-700/30 text-gray-400 border-gray-600'
    }
  }

  const filteredFldrs = fldrs.filter(fldr => {
    if (filter === 'all') return true
    if (filter === 'upcoming') {
      return fldr.status === 'incomplete' || fldr.status === 'ready'
    }
    return fldr.status === filter
  })

  if (loading) {
    return (
      <div className="p-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">GIT</h1>
          <button
            disabled
            className="p-2 bg-gray-700 rounded-lg opacity-50 cursor-not-allowed"
            aria-label="Create new Fldr"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        <FldrListSkeleton />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">GIT</h1>
        <button
          onClick={() => router.push('/fldr/create')}
          className="p-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg transition-colors"
          aria-label="Create new Fldr"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filter === 'all'
              ? 'bg-[#3b82f6] text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          All ({fldrs.length})
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filter === 'upcoming'
              ? 'bg-[#3b82f6] text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Upcoming ({fldrs.filter(f => f.status === 'incomplete' || f.status === 'ready').length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filter === 'active'
              ? 'bg-[#3b82f6] text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Active ({fldrs.filter(f => f.status === 'active').length})
        </button>
        <button
          onClick={() => setFilter('complete')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            filter === 'complete'
              ? 'bg-[#3b82f6] text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Complete ({fldrs.filter(f => f.status === 'complete').length})
        </button>
      </div>

      {filteredFldrs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">
            {filter === 'all' ? 'No folders yet' : `No ${filter} folders`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => router.push('/fldr/create')}
              className="px-6 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg transition-colors"
            >
              Create Your First Fldr
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFldrs.map((fldr) => (
            <button
              key={fldr.id}
              onClick={() => router.push(`/fldr/${fldr.id}`)}
              className="w-full p-4 rounded-lg text-left transition-all bg-[#1a1a1a] border-2 border-transparent hover:border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">{fldr.title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(fldr.status)}`}>
                      {fldr.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400">
                    {formatDate(fldr.date_start)}
                    {fldr.date_end && ` - ${formatDate(fldr.date_end)}`}
                  </div>
                  {fldr.location && (
                    <div className="text-sm text-gray-500 mt-1">
                      {fldr.location}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
