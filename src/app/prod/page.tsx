'use client';

import { useState, useEffect } from 'react'
import { Fldr, Product, ChecklistItem } from '@/types/fldr'
import { useRouter } from 'next/navigation'
import { isOnline, hasUnsyncedChanges, syncQueuedChanges } from '@/lib/offlineStorage'

type ProductWithJob = Product & { 
  fldrId: string
  fldrTitle: string
  jobDate: string
  daysUntil: number
}

type TaskWithJob = ChecklistItem & { 
  fldrId: string
  fldrTitle: string
  jobDate: string
  daysUntil: number
}

type JobCard = {
  fldr: Fldr
  daysUntil: number
  productCount: number
  productsDone: number
  taskCount: number
  tasksDone: number
  readinessPercent: number
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
        setFldrs(cachedData)
        setLoading(false)
      }

      // Then fetch from API (D1 as source of truth)
      const res = await fetch('/api/fldrs', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        console.log('[D1] Loaded from D1:', data.length, 'fldrs')
        setFldrs(data)
        localStorage.setItem('git-fldrs', JSON.stringify(data))
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
      if (f.status === 'complete') return false
      const days = daysUntil(f.date_start)
      return days >= -7 && days <= 30 // Include jobs from 7 days ago to 30 days ahead
    })
    .sort((a, b) => daysUntil(a.date_start) - daysUntil(b.date_start))

  // Get production-only tasks (exclude travel/packing/personal)
  const productionTasks: TaskWithJob[] = upcomingJobs.flatMap(fldr => {
    if (!fldr.checklist || fldr.checklist.length === 0) return []
    
    return fldr.checklist
      .filter(task => {
        // Only include production, onsite, teardown, or general (not packing/travel)
        const cat = task.category || 'general'
        return cat === 'production' || cat === 'onsite' || cat === 'teardown' || cat === 'general'
      })
      .map(task => ({
        ...task,
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
    
    const productsDone = products.filter(p => (p.waste || 0) === 0).length // Simplified: assume products with no waste are "ready"
    const tasksDone = tasks.filter(t => t.completed).length
    
    const totalItems = products.length + tasks.length
    const doneItems = productsDone + tasksDone
    const readinessPercent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 100
    
    return {
      fldr,
      daysUntil: daysUntil(fldr.date_start),
      productCount: products.length,
      productsDone,
      taskCount: tasks.length,
      tasksDone,
      readinessPercent
    }
  })

  // Urgent items (jobs starting in <= 3 days with incomplete prep)
  const urgentJobs = jobCards.filter(job => job.daysUntil <= 3 && job.readinessPercent < 100)
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
  const toggleTask = async (fldrId: string, taskItem: string) => {
    const fldr = fldrs.find(f => f.id === fldrId)
    if (!fldr || !fldr.checklist) return

    const updatedChecklist = fldr.checklist.map(t => 
      t.item === taskItem ? { ...t, completed: !t.completed } : t
    )

    try {
      await fetch(`/api/fldrs/${fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: updatedChecklist })
      })
      
      const updatedFldrs = fldrs.map(f => 
        f.id === fldrId ? { ...f, checklist: updatedChecklist } : f
      )
      setFldrs(updatedFldrs)
      localStorage.setItem('git-fldrs', JSON.stringify(updatedFldrs))
    } catch (error) {
      console.error('Failed to toggle task:', error)
    }
  }

  // Delete task
  const deleteTask = async (fldrId: string, taskItem: string) => {
    const fldr = fldrs.find(f => f.id === fldrId)
    if (!fldr || !fldr.checklist) return

    const updatedChecklist = fldr.checklist.filter(t => t.item !== taskItem)

    try {
      await fetch(`/api/fldrs/${fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: updatedChecklist })
      })
      
      const updatedFldrs = fldrs.map(f => 
        f.id === fldrId ? { ...f, checklist: updatedChecklist } : f
      )
      setFldrs(updatedFldrs)
      localStorage.setItem('git-fldrs', JSON.stringify(updatedFldrs))
    } catch (error) {
      console.error('Failed to delete task:', error)
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
    if (days < 0) return 'text-gray-500' // Past
    if (days === 0) return 'text-red-400' // Today
    if (days <= 3) return 'text-orange-400' // Urgent
    if (days <= 7) return 'text-yellow-400' // Soon
    return 'text-[#3b82f6]' // Future
  }

  // Get readiness color
  const getReadinessColor = (percent: number): string => {
    if (percent === 100) return 'text-green-400'
    if (percent >= 75) return 'text-[#3b82f6]'
    if (percent >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Production Dashboard</h1>
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div 
      className="p-4 max-w-4xl mx-auto pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-[#0a0a0a] z-50 transition-all"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(pullDistance, 80)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1)
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-[#3b82f6]">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="text-[#3b82f6] text-sm font-medium">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Production Dashboard</h1>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">{online ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      {/* Office Location Banner */}
      <div className="mb-6 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-[#3b82f6] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-300">Equipment Location</div>
            <div className="text-xs text-gray-400">925 Poinsettia Ave, Vista, CA 92081</div>
          </div>
        </div>
      </div>

      {upcomingJobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-lg font-medium mb-2">No upcoming jobs</div>
          <div className="text-sm">You're all clear! Time to prep for future work.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <div className={`text-2xl font-bold ${nextJobDays !== null ? getUrgencyColor(nextJobDays) : 'text-gray-500'}`}>
                {nextJobDays !== null ? (
                  nextJobDays === 0 ? 'TODAY' : 
                  nextJobDays < 0 ? 'ACTIVE' :
                  `${nextJobDays}d`
                ) : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">Next Job</div>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <div className={`text-2xl font-bold ${urgentJobs.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {urgentJobs.length}
              </div>
              <div className="text-xs text-gray-400">Urgent Jobs</div>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <div className="text-2xl font-bold text-[#3b82f6]">
                {completedProductionTasks}/{productionTasks.length}
              </div>
              <div className="text-xs text-gray-400">Tasks Done</div>
            </div>
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <div className="text-2xl font-bold text-[#3b82f6]">
                {totalProducts}
              </div>
              <div className="text-xs text-gray-400">Total Items</div>
            </div>
          </div>

          {/* Urgent Items Alert */}
          {urgentJobs.length > 0 && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <div className="font-semibold text-red-400 mb-1">⚠️ Urgent Prep Needed</div>
                  <div className="text-sm text-gray-300">
                    {urgentJobs.length} job{urgentJobs.length > 1 ? 's' : ''} starting in ≤3 days need preparation:
                  </div>
                  <div className="mt-2 space-y-1">
                    {urgentJobs.map(job => (
                      <div key={job.fldr.id} className="text-sm">
                        <span className="text-red-400 font-medium">{job.fldr.title}</span>
                        {' - '}
                        <span className="text-gray-400">{job.readinessPercent}% ready</span>
                        {' · '}
                        <span className={getUrgencyColor(job.daysUntil)}>
                          {job.daysUntil === 0 ? 'TODAY' : `${job.daysUntil}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Jobs Timeline */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Upcoming Jobs
              <span className="text-sm text-gray-400 ml-auto">{jobCards.length} jobs</span>
            </h2>
            <div className="space-y-3">
              {jobCards.map(job => (
                <div 
                  key={job.fldr.id}
                  onClick={() => router.push(`/jobs/${job.fldr.id}`)}
                  className="p-4 bg-[#0a0a0a] rounded-lg hover:bg-[#151515] transition-colors cursor-pointer border border-transparent hover:border-[#3b82f6]/30"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{job.fldr.title}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border ${
                          job.fldr.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                          job.fldr.status === 'ready' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {job.fldr.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className={getUrgencyColor(job.daysUntil)}>
                          {job.daysUntil < 0 ? 'In Progress' :
                           job.daysUntil === 0 ? 'TODAY' :
                           `${job.daysUntil} day${job.daysUntil !== 1 ? 's' : ''}`}
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
                    <div className={`text-2xl font-bold ${getReadinessColor(job.readinessPercent)}`}>
                      {job.readinessPercent}%
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs">
                    {job.productCount > 0 && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span className="text-gray-400">
                          {job.productsDone}/{job.productCount} products
                        </span>
                      </div>
                    )}
                    {job.taskCount > 0 && (
                      <div className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span className="text-gray-400">
                          {job.tasksDone}/{job.taskCount} tasks
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Production Tasks */}
          {productionTasks.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Production Prep
                <span className="text-sm text-gray-400 ml-auto">{completedProductionTasks}/{productionTasks.length}</span>
              </h2>
              <div className="space-y-2">
                {productionTasks
                  .sort((a, b) => a.daysUntil - b.daysUntil) // Sort by urgency
                  .map((task, idx) => (
                    <div 
                      key={`${task.fldrId}-${idx}`} 
                      className="flex items-start gap-3 group hover:bg-[#0a0a0a] p-2 rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => toggleTask(task.fldrId, task.item)}
                        className="mt-0.5 w-4 h-4 rounded border-[#2a2a2a] bg-[#0a0a0a] accent-[#3b82f6]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${task.completed ? 'line-through text-gray-500' : ''}`}>
                          {task.item}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <button
                            onClick={() => router.push(`/jobs/${task.fldrId}`)}
                            className="text-xs text-gray-500 hover:text-[#3b82f6] transition-colors"
                          >
                            {task.fldrTitle}
                          </button>
                          <span className="text-gray-600">•</span>
                          <span className={`text-xs ${getUrgencyColor(task.daysUntil)}`}>
                            {task.daysUntil < 0 ? 'Active' :
                             task.daysUntil === 0 ? 'TODAY' :
                             `${task.daysUntil}d`}
                          </span>
                          {task.category && task.category !== 'general' && (
                            <>
                              <span className="text-gray-600">•</span>
                              <span className="text-xs text-gray-500 capitalize">{task.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Delete this task?')) {
                            deleteTask(task.fldrId, task.item)
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 text-sm transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Products by Job */}
          {productsByJob.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#3b82f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Products to Make
                <span className="text-sm text-gray-400 ml-auto">{totalProducts} items</span>
              </h2>
              <div className="space-y-3">
                {productsByJob
                  .sort((a, b) => a.daysUntil - b.daysUntil) // Sort by urgency
                  .map((product) => {
                    const waste = product.waste || 0
                    const available = product.quantity - waste
                    
                    return (
                      <div 
                        key={`${product.fldrId}-${product.id}`} 
                        className="p-3 bg-[#0a0a0a] rounded-lg group hover:bg-[#151515] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{product.name}</div>
                            {product.notes && (
                              <div className="text-xs text-gray-500 mt-0.5">{product.notes}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-sm font-medium">×{product.quantity}</div>
                              {waste > 0 && (
                                <div className="text-xs text-red-400">-{waste} waste</div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            onClick={() => router.push(`/jobs/${product.fldrId}`)}
                            className="text-gray-500 hover:text-[#3b82f6] transition-colors"
                          >
                            {product.fldrTitle}
                          </button>
                          <span className="text-gray-600">•</span>
                          <span className={getUrgencyColor(product.daysUntil)}>
                            {product.daysUntil < 0 ? 'Active' :
                             product.daysUntil === 0 ? 'TODAY' :
                             `${product.daysUntil}d`}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-500">{formatJobDate(product.jobDate)}</span>
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
  )
}
