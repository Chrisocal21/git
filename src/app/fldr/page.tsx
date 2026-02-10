'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import { PlusIcon } from '@/components/Icons'

export default function FldrPage() {
  const router = useRouter()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => {
        setFldrs(data)
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

  const isIncomplete = (fldr: Fldr) => {
    return fldr.status === 'incomplete'
  }

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">GIT</h1>
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
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

      {fldrs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">No folders yet</p>
          <button
            onClick={() => router.push('/fldr/create')}
            className="px-6 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg transition-colors"
          >
            Create Your First Fldr
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {fldrs.map((fldr) => (
            <button
              key={fldr.id}
              onClick={() => router.push(`/fldr/${fldr.id}`)}
              className={`w-full p-4 rounded-lg text-left transition-all ${
                isIncomplete(fldr)
                  ? 'bg-[#1a1a1a] border-2 border-[#3b82f6]/50'
                  : 'bg-[#1a1a1a] border-2 border-transparent'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{fldr.title}</h3>
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
                {isIncomplete(fldr) && (
                  <div className="ml-2">
                    <div className="w-2 h-2 bg-[#3b82f6] rounded-full"></div>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
