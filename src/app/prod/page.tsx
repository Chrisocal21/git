'use client';

import { useState, useEffect } from 'react'
import { Fldr, Product, ChecklistItem } from '@/types/fldr'
import { useRouter } from 'next/navigation'
import { isOnline, hasUnsyncedChanges, syncQueuedChanges } from '@/lib/offlineStorage'
import PageHeader from '@/components/PageHeader'
import { askConfirm, toast } from '@/components/Dialogs'
import { CloseIcon } from '@/components/Icons'
import { trackerProgress } from '@/lib/jobTracker'

/** "Today", "1 day", "6 days" */
const daysLabel = (days: number) => (days === 0 ? 'Today' : `${days} ${days === 1 ? 'day' : 'days'}`)

type ProductWithJob = Product & { 
  fldrId: string
  fldrTitle: string
  jobDate: string
  daysUntil: number
}

type TaskWithJob = ChecklistItem & { 
  /** Where the task sits in its job's checklist, so two tasks with the same wording stay two tasks */
  index: number
  fldrId: string
  fldrTitle: string
  jobDate: string
  daysUntil: number
}

type JobCard = {
  fldr: Fldr
  daysUntil: number
  productCount: number
  taskCount: number
  tasksDone: number
  /** Logistics steps, once someone has started the job's list */
  stepCount: number
  stepsDone: number
  /** Null when the job has no tasks or logistics steps to measure yet */
  readinessPercent: number | null
}

export default function ProdPage() {
  const router = useRouter()
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [loading, setLoading] = useState(true)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    loadFldrs()
  }, [])

  // Check online status and auto-sync when coming back online
  useEffect(() => {
    const updateOnlineStatus = () => {
      setOnline(isOnline())
    }
    
    const handleOnline = async () => {
      console.log('[Network] Connection restored - checking for queued changes...')
      setOnline(true)
      
      if (hasUnsyncedChanges()) {
        console.log('[Sync] Auto-syncing queued changes from prod page...')
        const success = await syncQueuedChanges()
        if (success) {
          console.log('[Sync] Auto-sync complete! Refreshing prod page...')
          await loadFldrs()
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

  const loadFldrs = async () => {
    try {
      // Load from cache immediately for instant display
      const cached = localStorage.getItem('git-fldrs')
      if (cached) {
        const cachedData = JSON.parse(cached)
        // Anything but a list here is a damaged copy; wait for the server's instead
        if (Array.isArray(cachedData)) {
          setFldrs(cachedData)
          setLoading(false)
        }
      }

      // Then fetch from API (D1 as source of truth)
      const res = await fetch('/api/fldrs', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        console.log('[D1] Loaded from D1:', data.length, 'fldrs')
        // With no signal an empty list can come back in place of the real one
        if (Array.isArray(data) && (data.length > 0 || !cached)) {
          setFldrs(data)
          localStorage.setItem('git-fldrs', JSON.stringify(data))
        }
      }
    } catch (error) {
      console.error('[Error] Failed to load from API, using offline cache:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate days between dates
  const daysUntil = (dateStr: string): number => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [year, month, day] = dateStr.split('-').map(Number)
    const targetDate = new Date(year, month - 1, day)
    const diffTime = targetDate.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  // Get upcoming jobs (incomplete, ready, or active) within next 30 days
  const upcomingJobs = fldrs
    .filter(f => {
      // Time off isn't a job, and a job that's archived or complete has nothing left to prep
      if (f.fldr_type === 'time_off' || f.archived) return false
      if (f.status === 'complete' || f.job_status === 'complete') return false
      const days = daysUntil(f.date_start)
      return days >= -7 && days <= 30 // Include jobs from 7 days ago to 30 days ahead
    })
    .sort((a, b) => daysUntil(a.date_start) - daysUntil(b.date_start))

  // Get production-only tasks (exclude travel/packing/personal)
  const productionTasks: TaskWithJob[] = upcomingJobs.flatMap(fldr => {
    if (!fldr.checklist || fldr.checklist.length === 0) return []
    
    return fldr.checklist
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => {
        // Only include production, onsite, teardown, or general (not packing/travel)
        const cat = task.category || 'general'
        return cat === 'production' || cat === 'onsite' || cat === 'teardown' || cat === 'general'
      })
      .map(({ task, index }) => ({
        ...task,
        index,
        fldrId: fldr.id,
        fldrTitle: fldr.title,
        jobDate: fldr.date_start,
        daysUntil: daysUntil(fldr.date_start)
      }))
  })

  // Get products grouped by job with urgency
  const productsByJob: ProductWithJob[] = upcomingJobs.flatMap(fldr => {
    if (!fldr.products || fldr.products.length === 0) return []
    
    return fldr.products.map(product => ({
      ...product,
      fldrId: fldr.id,
      fldrTitle: fldr.title,
      jobDate: fldr.date_start,
      daysUntil: daysUntil(fldr.date_start)
    }))
  })

  // Build job cards with readiness metrics
  const jobCards: JobCard[] = upcomingJobs.map(fldr => {
    const products = fldr.products || []
    const tasks = fldr.checklist?.filter(t => {
      const cat = t.category || 'general'
      return cat === 'production' || cat === 'onsite' || cat === 'teardown' || cat === 'general'
    }) || []
    
    const tasksDone = tasks.filter(t => t.completed).length

    // How ready a job is comes from what can actually be ticked off: its production tasks,
    // and its Logistics list once someone has started it. Products have nothing to tick,
    // so they're listed but not counted (they used to count as done, which made every job read 100%).
    const steps = fldr.tracker ? trackerProgress(fldr.tracker) : { done: 0, total: 0 }
    const totalItems = tasks.length + steps.total
    const doneItems = tasksDone + steps.done
    const readinessPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : null
    
    return {
      fldr,
      daysUntil: daysUntil(fldr.date_start),
      productCount: products.length,
      taskCount: tasks.length,
      tasksDone,
      stepCount: steps.total,
      stepsDone: steps.done,
      readinessPercent
    }
  })

  // Urgent items (jobs starting in <= 3 days with incomplete prep)
  const urgentJobs = jobCards.filter(job => job.daysUntil <= 3 && job.readinessPercent !== null && job.readinessPercent < 100)
  const nextJobDays = jobCards.length > 0 ? jobCards[0].daysUntil : null

  // Stats
  const completedProductionTasks = productionTasks.filter(t => t.completed).length
  const totalProducts = productsByJob.reduce((sum, p) => sum + p.quantity, 0)

  // Update product
  const updateProduct = async (fldrId: string, productId: string, updates: Partial<Product>) => {
    const fldr = fldrs.find(f => f.id === fldrId)
    if (!fldr || !fldr.products) return

    const updatedProducts = fldr.products.map(p => 
      p.id === productId ? { ...p, ...updates } : p
    )

    try {
      await fetch(`/api/fldrs/${fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: updatedProducts })
      })
      
      // Update local state
      const updatedFldrs = fldrs.map(f => 
        f.id === fldrId ? { ...f, products: updatedProducts } : f
      )
      setFldrs(updatedFldrs)
      localStorage.setItem('git-fldrs', JSON.stringify(updatedFldrs))
    } catch (error) {
      console.error('Failed to update product:', error)
    }
  }

  // Delete product
  const deleteProduct = async (fldrId: string, productId: string) => {
    const fldr = fldrs.find(f => f.id === fldrId)
    if (!fldr || !fldr.products) return

    const updatedProducts = fldr.products.filter(p => p.id !== productId)

    try {
      await fetch(`/api/fldrs/${fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: updatedProducts })
      })
      
      const updatedFldrs = fldrs.map(f => 
        f.id === fldrId ? { ...f, products: updatedProducts } : f
      )
      setFldrs(updatedFldrs)
      localStorage.setItem('git-fldrs', JSON.stringify(updatedFldrs))
    } catch (error) {
      console.error('Failed to delete product:', error)
    }
  }

  // Toggle task completion
  const toggleTask = async (fldrId: string, index: number, taskItem: string) => {
    const fldr = fldrs.find(f => f.id === fldrId)
    if (!fldr || !fldr.checklist || fldr.checklist[index]?.item !== taskItem) return

    const updatedChecklist = fldr.checklist.map((t, i) => 
      i === index ? { ...t, completed: !t.completed } : t
    )

    // The tick shows straight away; if the save doesn't go through it's put back
    const before = fldrs
    const updatedFldrs = fldrs.map(f => 
      f.id === fldrId ? { ...f, checklist: updatedChecklist } : f
    )
    setFldrs(updatedFldrs)

    try {
      const res = await fetch(`/api/fldrs/${fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: updatedChecklist })
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      localStorage.setItem('git-fldrs', JSON.stringify(updatedFldrs))
    } catch (error) {
      console.error('Failed to toggle task:', error)
      setFldrs(before)
      toast("Couldn't save that tick. Check your connection and try again.", 'error')
    }
  }

  // Delete task
  const deleteTask = async (fldrId: string, index: number, taskItem: string) => {
    const fldr = fldrs.find(f => f.id === fldrId)
    if (!fldr || !fldr.checklist || fldr.checklist[index]?.item !== taskItem) return

    const updatedChecklist = fldr.checklist.filter((_, i) => i !== index)

    try {
      const res = await fetch(`/api/fldrs/${fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: updatedChecklist })
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      
      const updatedFldrs = fldrs.map(f => 
        f.id === fldrId ? { ...f, checklist: updatedChecklist } : f
      )
      setFldrs(updatedFldrs)
      localStorage.setItem('git-fldrs', JSON.stringify(updatedFldrs))
    } catch (error) {
      console.error('Failed to delete task:', error)
      toast("Couldn't delete the task. Check your connection and try again.", 'error')
    }
  }

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
    console.log('[Refresh] Pull-to-refresh triggered on prod page')
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
        
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
          return
        }
      }
    }
    
    await loadFldrs()
    setIsRefreshing(false)
  }

  // Format date nicely
  const formatJobDate = (dateStr: string): string => {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Get urgency color
  const getUrgencyColor = (days: number): string => {
    if (days < 0) return 'text-white/45' // Past
    if (days === 0) return 'text-red-400' // Today
    if (days <= 3) return 'text-orange-400' // Urgent
    if (days <= 7) return 'text-yellow-400' // Soon
    return 'text-brand-light' // Future
  }

  // Get readiness color
  const getReadinessColor = (percent: number | null): string => {
    if (percent === null) return 'text-white/35'
    if (percent === 100) return 'text-emerald-400'
    if (percent >= 75) return 'text-brand-light'
    if (percent >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="min-h-page text-white">
        <PageHeader title="Production Dashboard" width="max-w-4xl" />
        <div className="px-4 py-5 max-w-4xl mx-auto text-sm text-white/50">Loading...</div>
      </div>
    )
  }

  return (
    <div
      className="min-h-page text-white"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-canvas z-50 transition-all"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(pullDistance, 80)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1)
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-brand-light">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="text-brand-light text-sm font-medium">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}
        </div>
      )}

      <PageHeader
        title="Production Dashboard"
        width="max-w-4xl"
        actions={
          <div className="flex items-center gap-2 pr-1">
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-xs text-white/55">{online ? 'Online' : 'Offline'}</span>
          </div>
        }
      />

      <div className="px-4 py-5 max-w-4xl mx-auto">
      {/* Office Location Banner */}
      <div className="card mb-5 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <svg className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1">
            <div className="eyebrow">Equipment Location</div>
            <div className="text-sm text-white/80 mt-1">925 Poinsettia Ave, Vista, CA 92081</div>
          </div>
        </div>
      </div>

      {upcomingJobs.length === 0 ? (
        <div className="text-center py-16 text-white/55">
          <svg className="w-12 h-12 mx-auto mb-4 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="font-display text-lg font-semibold text-white mb-1.5">No upcoming jobs</div>
          <div className="text-sm">You're all clear! Time to prep for future work.</div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card shadow-card p-4">
              <div className={`font-display text-2xl font-semibold tabular ${nextJobDays !== null ? getUrgencyColor(nextJobDays) : 'text-white/45'}`}>
                {nextJobDays !== null ? (
                  nextJobDays < 0 ? 'Under way' : daysLabel(nextJobDays)
                ) : 'None'}
              </div>
              <div className="eyebrow mt-1.5">Next Job</div>
            </div>
            <div className="card shadow-card p-4">
              <div className={`font-display text-2xl font-semibold tabular ${urgentJobs.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {urgentJobs.length}
              </div>
              <div className="eyebrow mt-1.5">Urgent Jobs</div>
            </div>
            <div className="card shadow-card p-4">
              <div className="font-display text-2xl font-semibold tabular text-white">
                {completedProductionTasks}/{productionTasks.length}
              </div>
              <div className="eyebrow mt-1.5">Tasks Done</div>
            </div>
            <div className="card shadow-card p-4">
              <div className="font-display text-2xl font-semibold tabular text-white">
                {totalProducts}
              </div>
              <div className="eyebrow mt-1.5">Total Items</div>
            </div>
          </div>

          {/* Urgent Items Alert */}
          {urgentJobs.length > 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <div className="font-semibold text-red-400 mb-1">Urgent Prep Needed</div>
                  <div className="text-sm text-white/70">
                    {urgentJobs.length} job{urgentJobs.length > 1 ? 's' : ''} starting within 3 days still {urgentJobs.length > 1 ? 'need' : 'needs'} prep:
                  </div>
                  <div className="mt-2 space-y-1">
                    {urgentJobs.map(job => (
                      <div key={job.fldr.id} className="text-sm">
                        <span className="text-red-400 font-medium">{job.fldr.title}</span>
                        {' - '}
                        <span className="text-white/55">{job.readinessPercent}% ready</span>
                        {' · '}
                        <span className={getUrgencyColor(job.daysUntil)}>
                          {job.daysUntil < 0 ? 'Under way' : daysLabel(job.daysUntil)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Jobs Timeline */}
          <div className="card shadow-card p-4">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upcoming Jobs
              <span className="font-sans text-xs font-normal text-white/50 ml-auto tabular">{jobCards.length} jobs</span>
            </h2>
            <div className="space-y-3">
              {jobCards.map(job => (
                <div 
                  key={job.fldr.id}
                  onClick={() => router.push(`/jobs/${job.fldr.id}`)}
                  className="p-4 bg-canvas/60 rounded-xl hover:bg-surface-raised transition-colors cursor-pointer border border-line hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{job.fldr.title}</h3>
                        {/* The same Job Status the jobs list and the job page show */}
                        {job.fldr.job_status && (
                          <span className={`badge ${
                            job.fldr.job_status === 'confirmed' ? 'bg-emerald-500/15 text-emerald-300' :
                            job.fldr.job_status === 'in_progress' ? 'bg-blue-500/15 text-blue-300' :
                            job.fldr.job_status === 'awaiting_return' ? 'bg-amber-500/15 text-amber-300' :
                            'bg-yellow-500/15 text-yellow-300'
                          }`}>
                            {job.fldr.job_status === 'awaiting_return' ? 'waiting on return' : job.fldr.job_status.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-white/55">
                        <span className={getUrgencyColor(job.daysUntil)}>
                          {job.daysUntil < 0 ? 'Under way' : daysLabel(job.daysUntil)}
                        </span>
                        <span>•</span>
                        <span>{formatJobDate(job.fldr.date_start)}</span>
                        {job.fldr.location && (
                          <>
                            <span>•</span>
                            <span>{job.fldr.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-display text-2xl font-semibold tabular ${getReadinessColor(job.readinessPercent)}`}>
                        {job.readinessPercent === null ? '—' : `${job.readinessPercent}%`}
                      </div>
                      <div className="text-xs text-white/40">{job.readinessPercent === null ? 'nothing to tick yet' : 'ready'}</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/55">
                    {job.productCount > 0 && (
                      <span>
                        {job.productCount} {job.productCount === 1 ? 'product' : 'products'}
                      </span>
                    )}
                    {job.taskCount > 0 && (
                      <span>
                        {job.tasksDone} of {job.taskCount} tasks done
                      </span>
                    )}
                    {job.stepCount > 0 && (
                      <span>
                        {job.stepsDone} of {job.stepCount} logistics steps done
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Production Tasks */}
          {productionTasks.length > 0 && (
            <div className="card shadow-card p-4">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Production Prep
                <span className="font-sans text-xs font-normal text-white/50 ml-auto tabular">{completedProductionTasks} of {productionTasks.length} done</span>
              </h2>
              <div className="space-y-2">
                {productionTasks
                  .sort((a, b) => a.daysUntil - b.daysUntil) // Sort by urgency
                  .map((task, idx) => (
                    <div 
                      key={`${task.fldrId}-${task.index}-${idx}`} 
                      className="flex items-center gap-1 rounded-lg transition-colors hover:bg-canvas/60"
                    >
                      {/* The label makes the whole 44px square tick the box */}
                      <label className="flex h-11 w-11 flex-shrink-0 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.fldrId, task.index, task.item)}
                          aria-label={task.item || 'Task'}
                          className="h-5 w-5 rounded"
                        />
                      </label>
                      <div className="flex-1 min-w-0 py-1.5">
                        <div className={`text-[15px] leading-snug ${task.completed ? 'line-through text-white/45' : 'text-white/90'}`}>
                          {task.item}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
                          <button
                            onClick={() => router.push(`/jobs/${task.fldrId}`)}
                            className="-my-1 py-1 text-white/50 underline decoration-white/20 underline-offset-2 transition-colors hover:text-brand-light"
                          >
                            {task.fldrTitle}
                          </button>
                          <span className="text-white/25">•</span>
                          <span className={getUrgencyColor(task.daysUntil)}>
                            {task.daysUntil < 0 ? 'Under way' : daysLabel(task.daysUntil)}
                          </span>
                          {task.category && task.category !== 'general' && (
                            <>
                              <span className="text-white/25">•</span>
                              <span className="text-white/50 capitalize">{task.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const confirmed = await askConfirm({
                            title: 'Delete this task?',
                            body: `\u201c${task.item}\u201d comes off ${task.fldrTitle}'s checklist.`,
                            confirmLabel: 'Delete',
                            tone: 'danger',
                          })
                          if (confirmed) deleteTask(task.fldrId, task.index, task.item)
                        }}
                        aria-label={`Delete ${task.item || 'task'}`}
                        title="Delete task"
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Products by Job */}
          {productsByJob.length > 0 && (
            <div className="card shadow-card p-4">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Products to Make
                <span className="font-sans text-xs font-normal text-white/50 ml-auto tabular">{totalProducts} items</span>
              </h2>
              <div className="space-y-3">
                {productsByJob
                  .sort((a, b) => a.daysUntil - b.daysUntil) // Sort by urgency
                  .map((product) => {
                    return (
                      <div 
                        key={`${product.fldrId}-${product.id}`} 
                        className="p-3 bg-canvas/60 border border-line rounded-xl group hover:bg-surface-raised transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{product.name}</div>
                            {product.notes && (
                              <div className="text-[13px] text-white/50 mt-0.5">{product.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm font-semibold tabular">×{product.quantity}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
                          <button
                            onClick={() => router.push(`/jobs/${product.fldrId}`)}
                            className="-my-1 py-1 text-white/50 underline decoration-white/20 underline-offset-2 transition-colors hover:text-brand-light"
                          >
                            {product.fldrTitle}
                          </button>
                          <span className="text-white/25">•</span>
                          <span className={getUrgencyColor(product.daysUntil)}>
                            {product.daysUntil < 0 ? 'Under way' : daysLabel(product.daysUntil)}
                          </span>
                          <span className="text-white/25">•</span>
                          <span className="text-white/50">{formatJobDate(product.jobDate)}</span>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
