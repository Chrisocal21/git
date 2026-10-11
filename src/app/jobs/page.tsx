'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Fldr } from '@/types/fldr'
import { AlertIcon, ArchiveIcon } from '@/components/Icons'
import { FldrListSkeleton } from '@/components/SkeletonLoader'
import { checkStorageHealth, logStorageInfo } from '@/lib/storageHealth'
import { isOnline, hasUnsyncedChanges, syncQueuedChanges } from '@/lib/offlineStorage'
import { getCurrentUser, filterJobsByUser, autoMarkInactiveProfiles } from '@/lib/auth'
import { fetchWeather, readCachedWeather } from '@/lib/weatherCache'
import { applyJobsChange, onJobsChanged } from '@/lib/jobsChanged'
import MenuButton from '@/components/MenuButton'
import { BurrowLogo } from '@/components/BurrowLogo'
import JobCard from '@/components/JobCard'
import { tripPhase } from '@/lib/tripDays'
import { toast } from '@/components/Dialogs'

type FilterOption = 'all' | 'upcoming'
type Temp = { temp: number; main: string }

/**
 * Works out each job's temperature. What the phone has saved is handed over at once; only cities
 * with nothing recent are asked about (all of them when `force` is set, for pull to refresh).
 */
function loadTemps(list: Fldr[], force: boolean, apply: (found: Record<string, Temp>) => void) {
  const instant: Record<string, Temp> = {}
  const toAsk = new Map<string, string[]>()
  for (const job of list) {
    if (job.archived || job.fldr_type === 'time_off') continue
    const city = job.location || job.venue_info?.address
    if (!city) continue
    const saved = readCachedWeather(city)
    if (saved?.data.current) instant[job.id] = { temp: saved.data.current.temp, main: saved.data.current.main }
    if (force || !saved?.fresh) toAsk.set(city, [...(toAsk.get(city) || []), job.id])
  }
  if (Object.keys(instant).length > 0) apply(instant)
  toAsk.forEach((ids, city) => {
    fetchWeather(city, { force }).then(reply => {
      if (!reply?.current) return
      const found: Record<string, Temp> = {}
      for (const id of ids) found[id] = { temp: reply.current.temp, main: reply.current.main }
      apply(found)
    })
  })
}

export default function JobsPage() {
  const router = useRouter()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterOption>('all')
  // The server couldn't be reached and this phone has no jobs saved to fall back on
  const [loadFailed, setLoadFailed] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [online, setOnline] = useState(true)
  const [viewMode, setViewMode] = useState<'team' | 'my'>('team') // team = all jobs, my = assigned to me
  const [showArchived, setShowArchived] = useState(false) // Show/hide archived jobs
  const [jobTemps, setJobTemps] = useState<Record<string, Temp>>({})

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
        const parsed = JSON.parse(cached)
        // Anything but a list here is a damaged copy; the server's list replaces it
        if (!Array.isArray(parsed)) throw new Error('saved jobs list is not a list')
        cachedData = parsed
        console.log(`[Cache] Loaded ${cachedData.length} fldrs from cache`)
        setFldrs(cachedData)
        setLoading(false)
        
        // Auto-mark profiles as inactive if they're not in any jobs
        autoMarkInactiveProfiles()
      } catch (e) {
        console.error('[Cache] Failed to parse cached fldrs:', e)
        localStorage.removeItem('git-fldrs')
      }
    } else {
      console.log('[Cache] No cached data found in localStorage')
    }

    // Then fetch from API and merge with cache (don't overwrite on empty)
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => {
        // Not a list: the server said no (signed out, or something went wrong on its side)
        if (!Array.isArray(data)) {
          if (cachedData.length === 0) setLoadFailed(true)
          setLoading(false)
          return
        }
        console.log(`Server returned ${data.length} fldrs`)
        
        setLoadFailed(false)
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
          console.log('[Cache] No data from cache or server (new user)')
          setFldrs([])
        }
        
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch fldrs:', err)
        // On error, keep whatever we have in state (from cache)
        if (cachedData.length === 0) setLoadFailed(true)
        setLoading(false)
      })
  }, [])

  // Something was added or changed from the dock (a new job, time off): load the list again
  useEffect(() => {
    return onJobsChanged(change => {
      setFldrs(current => applyJobsChange(current, change))
      fetch('/api/fldrs', { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          // Same rule as the first load: an empty answer never replaces the jobs already here
          if (!Array.isArray(data) || data.length === 0) return
          setFldrs(data)
          localStorage.setItem('git-fldrs', JSON.stringify(data))
        })
        .catch(() => {})
    })
  }, [])

  // Each job's current temperature. A saved answer is used as it is (weather is only asked for
  // again once it is three hours old), and jobs in the same city share one request.
  useEffect(() => {
    if (fldrs.length === 0) return
    loadTemps(fldrs, false, found => setJobTemps(prev => ({ ...prev, ...found })))
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
      if (!res.ok) throw new Error(`refresh failed: ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('refresh returned something that is not a list')
      // With no signal an empty list can come back in place of the real one
      if (data.length === 0 && fldrs.length > 0) throw new Error('refresh returned an empty list')
      setFldrs(data)
      setLoadFailed(false)
      localStorage.setItem('git-fldrs', JSON.stringify(data))
      // Asking for a refresh is asking for the weather again too
      loadTemps(data, true, found => setJobTemps(prev => ({ ...prev, ...found })))
      console.log('[Refresh] Data refreshed')
    } catch (error) {
      console.error('[Refresh] Refresh failed:', error)
      toast("Couldn't refresh. Check your connection and try again.", 'error')
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
  // Jobs waiting on jigs sit at the bottom of the list, under their own heading
  const userFilteredFldrs = (() => {
    const list = filterJobsByUser(filteredFldrs, viewMode)
    return [
      ...list.filter(f => f.job_status !== 'awaiting_return'),
      ...list.filter(f => f.job_status === 'awaiting_return'),
    ]
  })()

  // The jobs still on the go and the ones put away, counted the way the list shows them (time off is never a job)
  const realJobs = fldrs.filter(f => f.fldr_type !== 'time_off')
  const openCount = realJobs.filter(f => !f.archived && f.job_status !== 'complete').length
  const archivedCount = realJobs.filter(f => f.archived || f.job_status === 'complete').length

  if (loading) {
    return (
      <div className="min-h-page">
        <div className="flex items-center justify-between px-4 pt-5 pb-5 max-w-2xl mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <BurrowLogo className="w-12 h-12" />
            <h1 className="text-[30px] font-semibold leading-none tracking-tight text-white">Burrow</h1>
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
          <BurrowLogo className="w-12 h-12" />
          <h1 className="text-[30px] font-semibold leading-none tracking-tight text-white">Burrow</h1>
        </div>
        
        {/* New jobs are started from the dock's New button, on every screen */}
        <MenuButton />
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
            <div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: upcomingThisWeek, label: 'This Week' },
                  { value: totalJobs, label: 'Total Jobs' },
                  { value: pendingCount, label: 'Pending' },
                ].map(tile => (
                  <div key={tile.label} className="card shadow-card px-2 py-4 text-center">
                    <div className="text-[30px] font-semibold leading-none text-white tabular">{tile.value}</div>
                    <div className="eyebrow mt-2">{tile.label}</div>
                  </div>
                ))}
              </div>

              {/* The other statuses, as a quiet line under the tiles */}
              {(confirmedCount > 0 || inProgressCount > 0) && (
                <div className="mt-3 flex justify-center gap-5">
                  {confirmedCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-sm font-semibold text-white tabular">{confirmedCount}</span>
                      <span className="text-sm text-white/55">Confirmed</span>
                    </div>
                  )}
                  {inProgressCount > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-blue-400" />
                      <span className="text-sm font-semibold text-white tabular">{inProgressCount}</span>
                      <span className="text-sm text-white/55">In Progress</span>
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
              className={`segment min-h-[2.75rem] ${viewMode === 'team' ? 'segment-active' : ''}`}
            >
              All ({openCount})
            </button>
            <button
              onClick={() => setViewMode('my')}
              role="tab"
              aria-selected={viewMode === 'my'}
              className={`segment min-h-[2.75rem] ${viewMode === 'my' ? 'segment-active' : ''}`}
            >
              My Jobs
            </button>
          </div>
          
          {/* Archived toggle - compact */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            aria-pressed={showArchived}
            className={`w-full min-h-[2.75rem] px-3 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-2 ${
              showArchived
                ? 'bg-gold/10 text-gold'
                : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            <ArchiveIcon className="w-4 h-4" />
            {showArchived ? 'Hide' : 'Show'} Completed Archive ({archivedCount})
          </button>
        </div>
      </div>

      {loadFailed && fldrs.length === 0 ? (
        <div className="text-center py-16 px-6 max-w-2xl mx-auto">
          <AlertIcon className="w-7 h-7 text-amber-300 mx-auto mb-3" />
          <p className="text-white font-semibold">Couldn&apos;t load your jobs</p>
          <p className="text-white/55 text-sm mt-1.5 mb-6 leading-relaxed">Check your connection, then try again.</p>
          <button onClick={() => window.location.reload()} className="btn-brand min-h-[2.75rem] px-6">
            Try Again
          </button>
        </div>
      ) : userFilteredFldrs.length === 0 ? (
        <div className="text-center py-16 px-6 max-w-2xl mx-auto">
          {viewMode === 'my' && openCount > 0 ? (
            <>
              <p className="text-white/70">You&apos;re not on any jobs right now.</p>
              <p className="text-white/45 text-sm mt-2 mb-6 leading-relaxed">
                Jobs show up here once you&apos;re added to their Staff. Tap All to see the whole team&apos;s jobs.
              </p>
              <button onClick={() => setViewMode('team')} className="btn-secondary min-h-[2.75rem] px-6">
                Show All Jobs
              </button>
            </>
          ) : (
            <>
              <p className="text-white/70 mb-1">{showArchived ? 'Nothing here yet' : 'No jobs yet'}</p>
              <p className="text-white/45 text-sm mb-6 leading-relaxed">
                A job holds everything for one trip: the client, the venue, flights, hotel and who&apos;s going.
              </p>
              <button
                onClick={() => router.push('/jobs/create')}
                className="btn-primary px-6 py-3"
              >
                Create Your First Job
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 px-4 max-w-2xl mx-auto">
          {userFilteredFldrs.map((fldr) => {
            const firstAwaiting =
              fldr.job_status === 'awaiting_return' && userFilteredFldrs.find(f => f.job_status === 'awaiting_return')?.id === fldr.id
            return (
              <div key={fldr.id} className="relative">
                {firstAwaiting && <h2 className="eyebrow mb-2 px-1 pt-2">Awaiting return of items</h2>}
                <JobCard
                  job={fldr}
                  phase={tripPhase(fldr)}
                  temp={jobTemps[fldr.id]}
                  me={currentUser?.name}
                  onOpen={() => router.push(`/jobs/${fldr.id}`)}
                />
              </div>
            )
          })}
        </div>
      )}
      </div>
    </>
  )
}
