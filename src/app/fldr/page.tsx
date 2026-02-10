'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr, FldrStatus } from '@/types/fldr'
import { PlusIcon } from '@/components/Icons'
import { FldrListSkeleton } from '@/components/SkeletonLoader'
import { checkStorageHealth, logStorageInfo } from '@/lib/storageHealth'

type FilterOption = 'all' | 'upcoming' | 'complete'

export default function FldrPage() {
  const router = useRouter()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterOption>('upcoming')
  const [showDeleteButtons, setShowDeleteButtons] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)

  useEffect(() => {
    // Check storage health first
    const health = checkStorageHealth()
    console.log('🏥 Storage Health Check:', health)
    logStorageInfo()
    
    // Try to load from localStorage first for instant display
    const cached = localStorage.getItem('git-fldrs')
    let cachedData: Fldr[] = []
    
    if (cached) {
      try {
        cachedData = JSON.parse(cached)
        console.log(`✅ Loaded ${cachedData.length} fldrs from cache`)
        setFldrs(cachedData)
        setLoading(false)
      } catch (e) {
        console.error('❌ Failed to parse cached fldrs:', e)
      }
    } else {
      console.log('⚠️ No cached data found in localStorage')
    }

    // Then fetch from API and merge with cache (don't overwrite on empty)
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => {
        console.log(`Server returned ${data.length} fldrs`)
        
        // CRITICAL: Never overwrite existing cache with empty data
        if (data.length === 0 && cachedData.length > 0) {
          console.log('⚠️ Server returned empty, keeping cached data')
          return // Don't update - keep cached data
        }
        
        // If we have cache and server data, merge them
        if (cachedData.length > 0 && data.length > 0) {
          console.log('Merging cache with server data')
          
          // Create a Map to deduplicate by ID, preferring server data (source of truth)
          const fldrMap = new Map<string, Fldr>()
          
          // Add cached data first (may have unsaved changes)
          cachedData.forEach((f: Fldr) => fldrMap.set(f.id, f))
          
          // Overwrite with server data (D1 is source of truth)
          data.forEach((f: Fldr) => fldrMap.set(f.id, f))
          
          const merged = Array.from(fldrMap.values())
          
          setFldrs(merged)
          // Only save to localStorage if we have data
          if (merged.length > 0) {
            localStorage.setItem('git-fldrs', JSON.stringify(merged))
            console.log(`💾 Saved ${merged.length} fldrs to cache (deduped)`)
          }
        } else if (data.length > 0) {
          // No cache but server has data - use server data
          console.log('📥 No cache, using server data')
          setFldrs(data)
          localStorage.setItem('git-fldrs', JSON.stringify(data))
        } else {
          // Both empty - this is fine for first-time users
          console.log('🆕 No data from cache or server (new user)')
          setFldrs([])
        }
        
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch fldrs:', err)
        // On error, keep whatever we have in state (from cache)
        setLoading(false)
      })
  }, [])

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].clientY)
      setIsPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || window.scrollY > 0) return
    
    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY
    
    if (distance > 0 && distance < 150) {
      setPullDistance(distance)
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setIsRefreshing(true)
      await handleRefresh()
    }
    setIsPulling(false)
    setPullDistance(0)
    setTouchStartY(0)
  }

  const handleRefresh = async () => {
    console.log('🔄 Pull-to-refresh triggered')
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
        console.log('✅ Service worker checked for updates')
        
        // If there's a waiting worker, activate it
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
          return
        }
      }
    }
    
    // Fetch fresh data
    try {
      const res = await fetch('/api/fldrs', { cache: 'no-store' })
      const data = await res.json()
      setFldrs(data)
      localStorage.setItem('git-fldrs', JSON.stringify(data))
      console.log('✅ Data refreshed')
    } catch (error) {
      console.error('❌ Refresh failed:', error)
    }
    
    setIsRefreshing(false)
  }

  const formatDate = (date: string) => {
    // Parse date string in local timezone to avoid day-off errors
    const [year, month, day] = date.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString('en-US', { 
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

  const filteredFldrs = fldrs
    .filter(fldr => {
      if (filter === 'all') return true
      if (filter === 'upcoming') {
        // Show upcoming AND active jobs by default
        return fldr.status === 'incomplete' || fldr.status === 'ready' || fldr.status === 'active'
      }
      return fldr.status === filter
    })
    .sort((a, b) => {
      // Sort by start date ascending (earliest first)
      const dateA = new Date(a.date_start).getTime()
      const dateB = new Date(b.date_start).getTime()
      return dateA - dateB
    })

  const handleDelete = async (fldrId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation
    
    if (!confirm('Delete this fldr? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/fldrs/${fldrId}`, { method: 'DELETE' })
      if (res.ok) {
        // Update local state
        const updated = fldrs.filter(f => f.id !== fldrId)
        setFldrs(updated)
        localStorage.setItem('git-fldrs', JSON.stringify(updated))
        console.log('✅ Fldr deleted:', fldrId)
      } else {
        alert('Failed to delete fldr')
      }
    } catch (err) {
      console.error('Delete error:', err)
      alert('Failed to delete fldr')
    }
  }

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
    <div 
      className="p-4 max-w-lg mx-auto pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center transition-all"
          style={{
            height: isRefreshing ? '60px' : `${pullDistance}px`,
            opacity: isRefreshing ? 1 : pullDistance / 100,
          }}
        >
          <div className="bg-gray-800 rounded-full p-3 shadow-lg">
            {isRefreshing ? (
              <svg className="animate-spin h-5 w-5 text-[#3b82f6]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">GIT</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteButtons(!showDeleteButtons)}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              showDeleteButtons
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
            }`}
          >
            {showDeleteButtons ? 'Done' : 'Delete'}
          </button>
          <button
            onClick={() => router.push('/fldr/create')}
            className="p-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg transition-colors"
            aria-label="Create new Fldr"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
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
          Current ({fldrs.filter(f => f.status === 'incomplete' || f.status === 'ready' || f.status === 'active').length})
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
            {filter === 'all' ? 'No folders yet' : filter === 'upcoming' ? 'No current jobs' : `No ${filter} folders`}
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
            <div key={fldr.id} className="relative">
              <button
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
                  {showDeleteButtons && (
                    <button
                      onClick={(e) => handleDelete(fldr.id, e)}
                      className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
