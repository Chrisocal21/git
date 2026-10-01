'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr, FldrStatus } from '@/types/fldr'
import { AirplaneIcon, HomeIcon } from '@/components/Icons'
import { FldrListSkeleton } from '@/components/SkeletonLoader'
import { checkStorageHealth, logStorageInfo } from '@/lib/storageHealth'
import { isOnline, hasUnsyncedChanges, syncQueuedChanges } from '@/lib/offlineStorage'
import { getCurrentUser, canEditJob, filterJobsByUser, autoMarkInactiveProfiles } from '@/lib/auth'
import MenuButton from '@/components/MenuButton'
import { BurrowLogo } from '@/components/BurrowLogo'
import { WeatherSVG } from '@/components/WeatherIcon'

type FilterOption = 'all' | 'upcoming'

export default function JobsPage() {
  const router = useRouter()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterOption>('all')
  const [showDeleteButtons, setShowDeleteButtons] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [online, setOnline] = useState(true)
  const [viewMode, setViewMode] = useState<'team' | 'my'>('team') // team = all jobs, my = assigned to me
  const [showArchived, setShowArchived] = useState(false) // Show/hide archived jobs
  const [jobTemps, setJobTemps] = useState<Record<string, { temp: number; main: string }>>({})

  // Get current user for permission checks
  const currentUser = getCurrentUser()

  // Auto-switch to "My Jobs" view when a profile is selected
  useEffect(() => {
    if (currentUser) {
      // User selected a profile - switch to "my" view to show only their jobs
      setViewMode('my')
    } else {
      // No profile selected (All) - switch to "team" view to show all jobs
      setViewMode('team')
    }
  }, [currentUser?.id]) // Re-run when profile changes

  // Check online status and auto-sync when coming back online
  useEffect(() => {
    const updateOnlineStatus = () => {
      setOnline(isOnline())
    }
    
    const handleOnline = async () => {
      console.log('[Network] Connection restored - checking for queued changes...')
      setOnline(true)
      
      if (hasUnsyncedChanges()) {
        console.log('[Sync] Auto-syncing queued changes from list page...')
        const success = await syncQueuedChanges()
        if (success) {
          console.log('[Sync] Auto-sync complete! Refreshing list...')
          // Refresh the list after syncing
          try {
            const res = await fetch('/api/fldrs', { cache: 'no-store' })
            if (res.ok) {
              const data = await res.json()
              setFldrs(data)
              localStorage.setItem('git-fldrs', JSON.stringify(data))
            }
          } catch (error) {
            console.error('Failed to refresh after auto-sync:', error)
          }
        }
      } else {
        console.log('[Sync] No queued changes to sync')
      }
    }
    
    const handleOffline = () => {
      console.log('[Network] Connection lost')
      setOnline(false)
    }
    
    updateOnlineStatus()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    // Check storage health first
    const health = checkStorageHealth()
    console.log('[Storage] Storage Health Check:', health)
    logStorageInfo()
    
    // Try to load from localStorage first for instant display
    const cached = localStorage.getItem('git-fldrs')
    let cachedData: Fldr[] = []
    
    if (cached) {
      try {
        cachedData = JSON.parse(cached)
        console.log(`[Cache] Loaded ${cachedData.length} fldrs from cache`)
        setFldrs(cachedData)
        setLoading(false)
        
        // Auto-mark profiles as inactive if they're not in any jobs
        autoMarkInactiveProfiles()
      } catch (e) {
        console.error('[Cache] Failed to parse cached fldrs:', e)
      }
    } else {
      console.log('[Cache] No cached data found in localStorage')
    }

    // Then fetch from API and merge with cache (don't overwrite on empty)
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => {
        console.log(`Server returned ${data.length} fldrs`)
        
        // CRITICAL: Never overwrite existing cache with empty data
        if (data.length === 0 && cachedData.length > 0) {
          console.log('[Cache] Server returned empty, keeping cached data')
          return // Don't update - keep cached data
        }
        
        // If we have cache and server data, use server as source of truth
        if (cachedData.length > 0 && data.length > 0) {
          console.log('Server data received, using as source of truth (D1 enabled)')
          
          // When D1 is enabled, server is the authoritative source
          // Don't merge - use server data directly to avoid orphaned cache entries
          setFldrs(data)
          localStorage.setItem('git-fldrs', JSON.stringify(data))
          console.log(`[Cache] Saved ${data.length} fldrs to cache (server is source of truth)`)
          
          // Auto-mark profiles as inactive if they're not in any jobs
          autoMarkInactiveProfiles()
        } else if (data.length > 0) {
          // No cache but server has data - use server data
          console.log('[Cache] No cache, using server data')
          setFldrs(data)
          localStorage.setItem('git-fldrs', JSON.stringify(data))
          
          // Auto-mark profiles as inactive if they're not in any jobs
          autoMarkInactiveProfiles()
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

  // Fetch current temp for each job's location (once, when the list first has data)
  useEffect(() => {
    if (fldrs.length === 0) return

    const jobs = fldrs.filter(f => !f.archived && f.fldr_type !== 'time_off' && (f.location || f.venue_info?.address))
    const toFetch = jobs.filter(f => !(f.id in jobTemps))
    if (toFetch.length === 0) return

    toFetch.forEach(f => {
      const location = f.location || f.venue_info?.address
      if (!location) return
      fetch(`/api/weather?location=${encodeURIComponent(location)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.current && typeof d.current.temp === 'number') {
            setJobTemps(prev => ({ ...prev, [f.id]: { temp: d.current.temp, main: d.current.main } }))
          }
        })
        .catch(() => {})
    })
  }, [fldrs])

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
    console.log('[Refresh] Pull-to-refresh triggered')
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
        console.log('[ServiceWorker] Service worker checked for updates')
        
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
      console.log('[Refresh] Data refreshed')
    } catch (error) {
      console.error('[Refresh] Refresh failed:', error)
    }
    
    setIsRefreshing(false)
  }

  const formatDate = (date: string) => {
    // Parse date string in local timezone to avoid day-off errors
    // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm" formats
    const dateOnly = date.split('T')[0] // Extract date part if datetime string
    const [year, month, day] = dateOnly.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const isCurrentEvent = (fldr: Fldr) => {
    if (!fldr.date_start) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const [startYear, startMonth, startDay] = fldr.date_start.split('-').map(Number)
    const startDate = new Date(startYear, startMonth - 1, startDay)
    startDate.setHours(0, 0, 0, 0)
    
    if (fldr.date_end) {
      const [endYear, endMonth, endDay] = fldr.date_end.split('-').map(Number)
      const endDate = new Date(endYear, endMonth - 1, endDay)
      endDate.setHours(0, 0, 0, 0)
      return today >= startDate && today <= endDate
    }
    
    return today.getTime() === startDate.getTime()
  }

  const getStatusColor = (status: FldrStatus) => {
    switch (status) {
      case 'incomplete': return 'bg-yellow-900/30 text-yellow-400 border-yellow-500'
      case 'ready': return 'bg-blue-900/30 text-blue-400 border-blue-500'
      case 'active': return 'bg-green-900/30 text-green-400 border-green-500'
      case 'complete': return 'bg-gray-700/30 text-gray-400 border-gray-600'
    }
  }

  // Helper function to calculate days until job starts
  const getDaysUntilJob = (dateStart: string) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [year, month, day] = dateStart.split('-').map(Number)
    const jobDate = new Date(year, month - 1, day)
    const diffTime = jobDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Helper function to calculate days until first flight
  const getDaysUntilFlight = (fldr: Fldr) => {
    if (!fldr.flight_info || fldr.flight_info.length === 0) return null
    // Find the earliest departure
    const departures = fldr.flight_info
      .filter(f => f.departure_time)
      .map(f => new Date(f.departure_time!))
    if (departures.length === 0) return null
    
    const earliestFlight = new Date(Math.min(...departures.map(d => d.getTime())))
    earliestFlight.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const diffTime = earliestFlight.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const filteredFldrs = fldrs
    .filter(fldr => {
      // Never show time-off entries on the jobs list
      if (fldr.fldr_type === 'time_off') return false

      // Filter out archived jobs unless showArchived is true
      if (!showArchived && fldr.archived) return false
      
      // IMPORTANT: Filter out completed jobs from main view (they go to Completed Archive)
      // Check job_status field (pending/confirmed/in_progress/complete)
      if (!showArchived && fldr.job_status === 'complete') return false
      
      if (filter === 'all') return true
      if (filter === 'upcoming') {
        // Show upcoming AND active jobs by default
        return fldr.status === 'incomplete' || fldr.status === 'ready' || fldr.status === 'active'
      }
      return true
    })
    .sort((a, b) => {
      // Smart sort: CURRENT jobs at top, then upcoming, then past
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // Guard against missing date_start
      if (!a.date_start && !b.date_start) return 0
      if (!a.date_start) return 1
      if (!b.date_start) return -1
      
      // Check if each job is currently happening
      const aIsCurrent = isCurrentEvent(a)
      const bIsCurrent = isCurrentEvent(b)
      
      // CURRENT jobs always go to the top
      if (aIsCurrent && !bIsCurrent) return -1 // a goes up
      if (!aIsCurrent && bIsCurrent) return 1  // b goes up
      
      // If both are current, sort by start date (earlier start first)
      if (aIsCurrent && bIsCurrent) {
        return new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
      }
      
      // For non-current jobs, determine if they're past or future
      const dateA = new Date(a.date_start)
      dateA.setHours(0, 0, 0, 0)
      const dateB = new Date(b.date_start)
      dateB.setHours(0, 0, 0, 0)
      
      const aIsPast = dateA < today
      const bIsPast = dateB < today
      
      // If one is past and one is future, future comes first
      if (aIsPast && !bIsPast) return 1  // a goes down
      if (!aIsPast && bIsPast) return -1 // a goes up
      
      // If both are future, sort ascending (soonest first)
      if (!aIsPast && !bIsPast) {
        return dateA.getTime() - dateB.getTime()
      }
      
      // If both are past, sort descending (most recent past first)
      return dateB.getTime() - dateA.getTime()
    })

  // Apply user-based filtering (prepared for auth - currently shows all)
  const userFilteredFldrs = filterJobsByUser(filteredFldrs, viewMode)

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
        console.log('[API] Fldr deleted:', fldrId)
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
      <div className="min-h-page">
        <div className="flex items-center justify-between px-4 pt-5 pb-5 max-w-2xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <BurrowLogo className="w-9 h-9" />
            <h1 className="text-[22px] font-semibold text-white">Burrow</h1>
          </div>
          <div className="h-10 w-10 rounded-xl border border-line bg-surface" />
        </div>
        <div className="px-4 max-w-2xl mx-auto">
          <FldrListSkeleton />
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className="min-h-page"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 z-40 flex justify-center items-center transition-all"
          style={{
            height: isRefreshing ? '60px' : `${pullDistance}px`,
            opacity: isRefreshing ? 1 : pullDistance / 100,
          }}
        >
          <div className="bg-surface-raised border border-line-strong rounded-full p-3 shadow-pop">
            {isRefreshing ? (
              <svg className="animate-spin h-5 w-5 text-brand-light" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="h-5 w-5 text-white/55" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            )}
          </div>
        </div>
      )}
      
      {/* Clean header - minimal single row */}
      <div className="flex items-center justify-between px-4 pt-5 pb-5 max-w-2xl mx-auto">
        <div
          className="flex items-center gap-3 cursor-pointer select-none hover:opacity-80 transition-opacity"
          onClick={() => window.location.reload()}
          title="Refresh"
        >
          {/* Logo */}
          <BurrowLogo className="w-9 h-9" />
          <h1 className="text-[22px] font-semibold text-white">Burrow</h1>
        </div>
        
        {/* Right side: Minimal actions */}
        <div className="flex items-center gap-3">
          <MenuButton />
        </div>
      </div>

      {/* Unified Filter Section */}
      <div className="space-y-3 mb-5 px-4 max-w-2xl mx-auto">
        {/* Job Stats Dashboard */}
        {fldrs.length > 0 && (() => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const oneWeekFromNow = new Date(today)
          oneWeekFromNow.setDate(today.getDate() + 7)
          
          // Filter based on viewMode first, and exclude archived AND completed jobs
          const visibleFldrs = filterJobsByUser(fldrs.filter(f => !f.archived && f.job_status !== 'complete' && f.fldr_type !== 'time_off'), viewMode)
          
          // Calculate stats
          const totalJobs = visibleFldrs.length
          const upcomingThisWeek = visibleFldrs.filter(f => {
            const startDate = new Date(f.date_start)
            startDate.setHours(0, 0, 0, 0)
            return startDate >= today && startDate <= oneWeekFromNow && f.job_status !== 'complete'
          }).length
          
          const pendingCount = visibleFldrs.filter(f => f.job_status === 'pending').length
          const confirmedCount = visibleFldrs.filter(f => f.job_status === 'confirmed').length
          const inProgressCount = visibleFldrs.filter(f => f.job_status === 'in_progress').length
          
          return (
            <div className="card shadow-card px-4 py-5">
              <div className="grid grid-cols-3">
                {/* Upcoming This Week */}
                <div className="text-center">
                  <div className="font-display text-[28px] leading-none font-semibold text-white tabular">{upcomingThisWeek}</div>
                  <div className="eyebrow mt-2">This Week</div>
                </div>

                {/* Total Active Jobs */}
                <div className="text-center border-x border-line">
                  <div className="font-display text-[28px] leading-none font-semibold text-white tabular">{totalJobs}</div>
                  <div className="eyebrow mt-2">Total Jobs</div>
                </div>

                {/* Pending Confirmation */}
                <div className="text-center">
                  <div className="font-display text-[28px] leading-none font-semibold text-white tabular">{pendingCount}</div>
                  <div className="eyebrow mt-2">Pending</div>
                </div>
              </div>
              
              {/* Secondary row for other statuses */}
              {(confirmedCount > 0 || inProgressCount > 0) && (
                <div className="flex gap-5 justify-center mt-4 pt-4 border-t border-line">
                  {confirmedCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-semibold text-white tabular">{confirmedCount}</span>
                      <span className="text-xs text-white/55">Confirmed</span>
                    </div>
                  )}
                  {inProgressCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-sm font-semibold text-white tabular">{inProgressCount}</span>
                      <span className="text-xs text-white/55">In Progress</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
        
        {/* Combined filters */}
        <div className="space-y-2">
          <div className="segmented" role="tablist" aria-label="Job view">
            <button
              onClick={() => setViewMode('team')}
              role="tab"
              aria-selected={viewMode === 'team'}
              className={`segment ${viewMode === 'team' ? 'segment-active' : ''}`}
            >
              All ({fldrs.filter(f => !f.archived && f.job_status !== 'complete').length})
            </button>
            <button
              onClick={() => setViewMode('my')}
              role="tab"
              aria-selected={viewMode === 'my'}
              className={`segment ${viewMode === 'my' ? 'segment-active' : ''}`}
            >
              My Jobs
            </button>
          </div>
          
          {/* Archived toggle - compact */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            aria-pressed={showArchived}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
              showArchived
                ? 'bg-gold/10 text-gold'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Completed Archive ({fldrs.filter(f => f.archived || f.job_status === 'complete').length})
          </button>
        </div>
      </div>

      {userFilteredFldrs.length === 0 ? (
        <div className="text-center py-16 px-4 max-w-2xl mx-auto">
          <p className="text-white/55 mb-6">
            {filter === 'all' ? 'No jobs yet' : 'No current jobs'}
          </p>
          {filter === 'all' && viewMode === 'team' && (
            <button
              onClick={() => router.push('/jobs/create')}
              className="btn-primary px-6 py-3"
            >
              Create Your First Job
            </button>
          )}
          {viewMode === 'my' && (
            <p className="text-white/45 text-sm mt-2">
              No jobs assigned to you yet. Switch to All view to see team jobs.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4 px-4 max-w-2xl mx-auto">
          {userFilteredFldrs.map((fldr) => {
            const isCurrent = isCurrentEvent(fldr)
            return (
              <div key={fldr.id} className="relative">
                <button
                  onClick={() => router.push(`/jobs/${fldr.id}`)}
                  className={`w-full rounded-2xl text-left transition-colors bg-surface border shadow-card ${
                    isCurrent
                      ? 'border-brand ring-1 ring-brand/40'
                      : 'border-line hover:border-line-strong hover:bg-surface-raised'
                  }`}
                >
                  <div className="p-5">
                    {/* Top Row: Location & Days Until */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg text-white leading-tight truncate">{fldr.location || fldr.title}</h3>
                        <div className="text-sm text-white/60 font-normal mt-1 truncate">
                          {fldr.title}
                          {fldr.job_info?.distributor_name && fldr.job_info.distributor_name !== fldr.title && (
                            <span className="text-white/40 ml-1.5">· {fldr.job_info.distributor_name}</span>
                          )}
                        </div>
                      </div>
                      {/* Countdown with Border */}
                      {(() => {
                        const daysUntilFlight = getDaysUntilFlight(fldr)
                        const daysUntilJob = getDaysUntilJob(fldr.date_start)
                        const soonest = daysUntilFlight !== null && daysUntilFlight >= 0 ? daysUntilFlight : daysUntilJob

                        if ((daysUntilFlight !== null && daysUntilFlight >= 0) || (daysUntilJob >= 0)) {
                          const badgeColor = soonest <= 2 ? 'bg-red-500/10 text-red-400 border-red-500/30' : soonest <= 7 ? 'bg-orange-500/10 text-orange-400 border-orange-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          return (
                            <div className={`px-2.5 py-1.5 rounded-lg border ${badgeColor} flex items-baseline gap-1 flex-shrink-0`}>
                              <div className="font-display text-base font-semibold leading-none tabular">{soonest}</div>
                              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{soonest === 1 ? 'day' : 'days'}</div>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>

                    {/* Middle Row: Dates & Weather */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-white/55 leading-snug flex-1 tabular">
                        {(() => {
                          const flights = fldr.flight_info || []
                          
                          if (flights.length > 0 && flights.some(f => f.departure_time || f.arrival_time)) {
                            // Find earliest departure (leaving home)
                            const departureFlights = flights.filter(f => f.departure_time)
                            const earliestDeparture = departureFlights.length > 0
                              ? departureFlights.sort((a, b) => new Date(a.departure_time!).getTime() - new Date(b.departure_time!).getTime())[0]
                              : null
                            
                            // Find latest arrival (returning home)
                            const arrivalFlights = flights.filter(f => f.arrival_time)
                            const latestArrival = arrivalFlights.length > 0
                              ? arrivalFlights.sort((a, b) => new Date(b.arrival_time!).getTime() - new Date(a.arrival_time!).getTime())[0]
                              : null
                            
                            // Determine the complete travel span
                            const tripStart = earliestDeparture ? formatDate(earliestDeparture.departure_time!) : formatDate(fldr.date_start)
                            const tripEnd = latestArrival ? formatDate(latestArrival.arrival_time!) : (fldr.date_end ? formatDate(fldr.date_end) : tripStart)
                            
                            // Show the full travel duration
                            return tripStart === tripEnd ? tripStart : `${tripStart} – ${tripEnd}`
                          }
                          
                          // No flights - just show event dates
                          return `${formatDate(fldr.date_start)}${fldr.date_end && formatDate(fldr.date_end) !== formatDate(fldr.date_start) ? ` – ${formatDate(fldr.date_end)}` : ''}`
                        })()}
                      </div>
                      {jobTemps[fldr.id] && (
                        <div className="flex items-center gap-1.5 text-white/55 flex-shrink-0">
                          <WeatherSVG condition={jobTemps[fldr.id].main} size="xs" />
                          <span className="text-sm font-medium tabular">{Math.round(jobTemps[fldr.id].temp)}°</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Team/Type on their own line, Status/Attending on a separate row */}
                    <div className="space-y-2">
                      {(fldr.people && fldr.people.length > 0) || fldr.job_info?.job_type ? (
                        <div className="text-sm text-white/70 leading-snug">
                          {fldr.people && fldr.people.length > 0 && (
                            <span>{fldr.people.map(p => p.name).join(', ')}</span>
                          )}
                          {fldr.job_info?.job_type && (
                            <span className="text-white/40 text-xs">
                              {fldr.people && fldr.people.length > 0 ? ' · ' : ''}
                              {fldr.job_info.job_type === 'caricatures' ? 'Caricatures' : fldr.job_info.job_type === 'personalization' ? 'Personalization' : fldr.job_info.job_type === 'names_monograms' ? 'Personalization' : ''}
                            </span>
                          )}
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Job Status Badge */}
                        {fldr.job_status && (
                          <span className={`badge ${
                            fldr.job_status === 'pending' ? 'bg-yellow-500/15 text-yellow-300' :
                            fldr.job_status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-300' :
                            fldr.job_status === 'in_progress' ? 'bg-blue-500/15 text-blue-300' :
                            fldr.job_status === 'complete' ? 'bg-white/10 text-white/60' :
                            'bg-white/10 text-white/60'
                          }`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                            {fldr.job_status.replace('_', ' ')}
                          </span>
                        )}
                        {/* Show airplane if current user is on this job */}
                        {(fldr.people && fldr.people.some(p => p.name.toLowerCase() === currentUser?.name.toLowerCase())) && (
                          <AirplaneIcon className="w-4 h-4 text-brand-light flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}
      </div>
    </>
  )
}
