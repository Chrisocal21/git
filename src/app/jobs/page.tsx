'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr, FldrStatus } from '@/types/fldr'
import { PlusIcon, AirplaneIcon, HomeIcon } from '@/components/Icons'
import { FldrListSkeleton } from '@/components/SkeletonLoader'
import { checkStorageHealth, logStorageInfo } from '@/lib/storageHealth'
import { isOnline, hasUnsyncedChanges, syncQueuedChanges } from '@/lib/offlineStorage'
import { getCurrentUser, canEditJob, filterJobsByUser } from '@/lib/auth'
import MenuButton from '@/components/MenuButton'
import WeatherIcon from '@/components/WeatherIcon'

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
  
  // Get current user for permission checks
  const currentUser = getCurrentUser()

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
        } else if (data.length > 0) {
          // No cache but server has data - use server data
          console.log('[Cache] No cache, using server data')
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
      // Smart sort: upcoming/current jobs at top, past jobs at bottom
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const dateA = new Date(a.date_start)
      dateA.setHours(0, 0, 0, 0)
      const dateB = new Date(b.date_start)
      dateB.setHours(0, 0, 0, 0)
      
      const aIsPast = dateA < today
      const bIsPast = dateB < today
      
      // If one is past and one is future, future comes first
      if (aIsPast && !bIsPast) return 1  // a goes down
      if (!aIsPast && bIsPast) return -1 // a goes up
      
      // If both are future/current, sort ascending (soonest first)
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
      <div className="p-4 max-w-lg mx-auto pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-[#E8B44D]">Burrow</h1>
          <button
            disabled
            className="px-4 py-2 bg-gray-700 rounded-xl opacity-50 cursor-not-allowed text-sm font-semibold"
            aria-label="Create new Job"
          >
            <div className="flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4" />
              <span>New</span>
            </div>
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
      
      {/* Clean header - minimal single row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-[#E8B44D]">Burrow</h1>
        
        {/* Right side: Minimal actions */}
        <div className="flex items-center gap-3">
          <MenuButton />
          
          {/* Create button */}
          <button
            onClick={() => router.push('/jobs/create')}
            className="px-4 py-2 bg-[#E8B44D] hover:bg-[#D4A03C] rounded-xl transition-colors text-black font-semibold text-sm shadow-lg"
            aria-label="Create new Job"
          >
            <div className="flex items-center gap-1.5">
              <PlusIcon className="w-4 h-4" />
              <span>New</span>
            </div>
          </button>
        </div>
      </div>

      {/* Unified Filter Section */}
      <div className="space-y-1.5 mb-3">
        {/* Job Stats Dashboard */}
        {fldrs.length > 0 && (() => {
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const oneWeekFromNow = new Date(today)
          oneWeekFromNow.setDate(today.getDate() + 7)
          
          // Filter based on viewMode first, and exclude archived AND completed jobs
          const visibleFldrs = filterJobsByUser(fldrs.filter(f => !f.archived && f.job_status !== 'complete'), viewMode)
          
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
            <div className="bg-gradient-to-br from-[#3A6B86]/40 to-[#2F5F7F]/40 backdrop-blur-xl rounded-xl p-2.5 border border-[#E8B44D]/20">
              <div className="grid grid-cols-3 gap-2">
                {/* Upcoming This Week */}
                <div className="text-center">
                  <div className="text-xl font-bold text-[#E8B44D]">{upcomingThisWeek}</div>
                  <div className="text-[10px] text-white/60 mt-0.5">This Week</div>
                </div>
                
                {/* Total Active Jobs */}
                <div className="text-center border-x border-white/10">
                  <div className="text-xl font-bold text-white">{totalJobs}</div>
                  <div className="text-[10px] text-white/60 mt-0.5">Total Jobs</div>
                </div>
                
                {/* Pending Confirmation */}
                <div className="text-center">
                  <div className="text-xl font-bold text-white/90">{pendingCount}</div>
                  <div className="text-[10px] text-white/60 mt-0.5">Pending</div>
                </div>
              </div>
              
              {/* Secondary row for other statuses */}
              {(confirmedCount > 0 || inProgressCount > 0) && (
                <div className="flex gap-3 justify-center mt-2 pt-2 border-t border-white/10">
                  {confirmedCount > 0 && (
                    <div className="text-center">
                      <span className="text-xs font-semibold text-emerald-400">{confirmedCount}</span>
                      <span className="text-[10px] text-white/50 ml-1">Confirmed</span>
                    </div>
                  )}
                  {inProgressCount > 0 && (
                    <div className="text-center">
                      <span className="text-xs font-semibold text-blue-400">{inProgressCount}</span>
                      <span className="text-[10px] text-white/50 ml-1">In Progress</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })()}
        
        {/* Combined filters */}
        <div className="bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] backdrop-blur-xl shadow-[0_2px_10px_rgba(0,0,0,0.3)] rounded-xl p-2 space-y-1.5">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('team')}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'team'
                  ? 'bg-[#3A6B86] text-[#E8B44D]'
                  : 'text-white/50'
              }`}
            >
              All ({fldrs.filter(f => !f.archived && f.job_status !== 'complete').length})
            </button>
            <button
              onClick={() => setViewMode('my')}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'my'
                  ? 'bg-[#3A6B86] text-[#E8B44D]'
                  : 'text-white/50'
              }`}
            >
              My Jobs
            </button>
          </div>
          
          {/* Archived toggle - compact */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full px-2.5 py-1 rounded-lg text-[10px] text-white/50 hover:text-white/70 transition-all flex items-center justify-center gap-1.5 border border-white/10 hover:border-white/20"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            Completed Archive ({fldrs.filter(f => f.archived || f.job_status === 'complete').length})
          </button>
        </div>
      </div>

      {userFilteredFldrs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">
            {filter === 'all' ? 'No jobs yet' : 'No current jobs'}
          </p>
          {filter === 'all' && viewMode === 'team' && (
            <button
              onClick={() => router.push('/jobs/create')}
              className="px-6 py-2 bg-[#E8B44D] hover:bg-[#D4A03C] text-black rounded-lg transition-colors font-semibold"
            >
              Create Your First Job
            </button>
          )}
          {viewMode === 'my' && (
            <p className="text-gray-500 text-sm mt-2">
              No jobs assigned to you yet. Switch to Team view to see all jobs.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {userFilteredFldrs.map((fldr) => {
            const isCurrent = isCurrentEvent(fldr)
            return (
              <div key={fldr.id} className="relative">
                <button
                  onClick={() => router.push(`/jobs/${fldr.id}`)}
                  className={`w-full rounded-2xl text-left transition-all bg-gradient-to-br from-[#3A6B86] to-[#2F5F7F] backdrop-blur-xl ${
                    isCurrent 
                      ? 'shadow-[0_8px_30px_rgba(232,180,77,0.3)] ring-2 ring-[#E8B44D]/30' 
                      : 'shadow-[0_2px_10px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_20px_rgba(232,180,77,0.2)]'
                  }`}
                >
                  <div className="p-4">
                    {/* Top Row: Location & Days Until */}
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1">
                        <h3 className="font-bold text-[22px] text-[#E8B44D] tracking-tight leading-tight">{fldr.location || fldr.title}</h3>
                        <div className="text-[15px] text-white/90 font-medium mt-0.5">{fldr.title}</div>
                      </div>
                      {/* Countdown with Border */}
                      {(() => {
                        const daysUntilFlight = getDaysUntilFlight(fldr)
                        const daysUntilJob = getDaysUntilJob(fldr.date_start)
                        const soonest = daysUntilFlight !== null && daysUntilFlight >= 0 ? daysUntilFlight : daysUntilJob
                        
                        if ((daysUntilFlight !== null && daysUntilFlight >= 0) || (daysUntilJob >= 0)) {
                          const borderColor = soonest <= 2 ? 'ring-2 ring-red-400' : soonest <= 7 ? 'ring-2 ring-[#E8B44D]' : 'ring-2 ring-emerald-400'
                          return (
                            <div className={`px-3 py-1.5 rounded-xl bg-black/30 ${borderColor} flex items-baseline gap-1`}>
                              <div className="text-[16px] font-light text-[#E8B44D] tracking-tighter leading-none">{soonest}</div>
                              <div className="text-[8px] text-white/70 uppercase tracking-wide">{soonest === 1 ? 'day' : 'days'}</div>
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>

                    {/* Middle Row: Dates & Weather */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[15px] text-white/70 leading-snug flex-1">
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
                            return tripStart === tripEnd ? tripStart : `${tripStart} - ${tripEnd}`
                          }
                          
                          // No flights - just show event dates
                          return `${formatDate(fldr.date_start)}${fldr.date_end && formatDate(fldr.date_end) !== formatDate(fldr.date_start) ? ` - ${formatDate(fldr.date_end)}` : ''}`
                        })()}
                      </div>
                      {/* Weather with icon */}
                      <WeatherIcon location={fldr.location || fldr.title} />
                    </div>

                    {/* Bottom Row: Team/Type & Status/Attending */}
                    <div className="flex items-center justify-between text-[15px] text-white/70">
                      <div className="flex items-center gap-2">
                        <span>
                          {fldr.people && fldr.people.length > 0 
                            ? fldr.people.map(p => p.name).join(', ')
                            : fldr.job_info?.job_type === 'caricatures' ? 'Caricatures' : fldr.job_info?.job_type === 'names_monograms' ? 'Names/Monograms' : ''
                          }
                        </span>
                        {/* Job Status Badge */}
                        {fldr.job_status && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide ${
                            fldr.job_status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            fldr.job_status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                            fldr.job_status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                            fldr.job_status === 'complete' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' :
                            'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                          }`}>
                            {fldr.job_status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium uppercase tracking-wide">
                          {fldr.status}
                        </span>
                        {(fldr.attending ?? false) ? (
                          <AirplaneIcon className="w-5 h-5 text-[#E8B44D]" />
                        ) : (
                          <HomeIcon className="w-5 h-5 text-gray-500" />
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
  )
}
