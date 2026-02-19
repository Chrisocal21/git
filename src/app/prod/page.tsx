'use client';

import { useState, useEffect } from 'react'
import { Fldr, Product, ChecklistItem } from '@/types/fldr'
import { useRouter } from 'next/navigation'
import { isOnline, hasUnsyncedChanges, syncQueuedChanges } from '@/lib/offlineStorage'

type ProductWithJob = Product & { fldrId: string; fldrTitle: string; isCompleted?: boolean }
type TaskWithJob = ChecklistItem & { fldrId: string; fldrTitle: string }

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
      console.log('📡 Connection restored - checking for queued changes...')
      setOnline(true)
      
      if (hasUnsyncedChanges()) {
        console.log('📡 Auto-syncing queued changes from prod page...')
        const success = await syncQueuedChanges()
        if (success) {
          console.log('✅ Auto-sync complete! Refreshing prod page...')
          await loadFldrs()
        }
      } else {
        console.log('✅ No queued changes to sync')
      }
    }
    
    const handleOffline = () => {
      console.log('📴 Connection lost')
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
        console.log('✅ Loaded from D1:', data.length, 'fldrs')
        setFldrs(data)
        localStorage.setItem('git-fldrs', JSON.stringify(data))
      }
    } catch (error) {
      console.error('❌ Failed to load from API, using offline cache:', error)
      // Already loaded from cache above
    } finally {
      setLoading(false)
    }
  }

  // Get active jobs (ready or active status)
  const activeJobs = fldrs.filter(f => f.status === 'ready' || f.status === 'active')

  console.log('🔍 Active Jobs Detail:', activeJobs.map(f => ({
    title: f.title,
    status: f.status,
    products: f.products,
    productsLength: f.products?.length,
    productsType: typeof f.products
  })))

  // Aggregate all products from active jobs
  const allProducts: ProductWithJob[] = activeJobs.flatMap(fldr => {
    if (!fldr.products || fldr.products.length === 0) {
      console.log(`❌ No products in ${fldr.title}`, { products: fldr.products })
      return []
    }
    console.log(`✅ Found ${fldr.products.length} products in ${fldr.title}`, fldr.products)
    return fldr.products.map(product => ({
      ...product,
      fldrId: fldr.id,
      fldrTitle: fldr.title,
      isCompleted: false
    }))
  })

  // Aggregate all tasks from active jobs
  const allTasks: TaskWithJob[] = activeJobs.flatMap(fldr => {
    if (!fldr.checklist || fldr.checklist.length === 0) {
      return []
    }
    return fldr.checklist.map((task, index) => ({
      ...task,
      fldrId: fldr.id,
      fldrTitle: fldr.title
    }))
  })

  // Debug logging
  console.log('📊 Prod Dashboard Stats:', {
    totalFldrs: fldrs.length,
    activeJobs: activeJobs.length,
    activeJobTitles: activeJobs.map(f => f.title),
    products: allProducts.length,
    tasks: allTasks.length,
    allStatuses: fldrs.map(f => ({ title: f.title, status: f.status, hasProducts: !!f.products?.length, hasTasks: !!f.checklist?.length }))
  })

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
    console.log('🔄 Pull-to-refresh triggered on prod page')
    
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

  const completedTasks = allTasks.filter(t => t.completed).length
  const totalTasks = allTasks.length

  if (loading) {
    return (
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Production</h1>
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

      <h1 className="text-2xl font-bold mb-6">Production</h1>

      {/* Overview Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
          <div className="text-2xl font-bold text-[#3b82f6]">{activeJobs.length}</div>
          <div className="text-xs text-gray-400">Active Jobs</div>
        </div>
        <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
          <div className="text-2xl font-bold text-[#3b82f6]">{allProducts.length}</div>
          <div className="text-xs text-gray-400">Products</div>
        </div>
        <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
          <div className="text-2xl font-bold text-[#3b82f6]">{completedTasks}/{totalTasks}</div>
          <div className="text-xs text-gray-400">Tasks Done</div>
        </div>
      </div>

      {activeJobs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-4">🎉</div>
          <div className="text-lg font-medium mb-2">No active jobs</div>
          <div className="text-sm">You're all caught up!</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tasks Section */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
              <span>Tasks</span>
              <span className="text-sm text-gray-400">{completedTasks}/{totalTasks}</span>
            </h2>
            {allTasks.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No tasks</div>
            ) : (
              <div className="space-y-2">
                {allTasks.map((task, idx) => (
                  <div key={`${task.fldrId}-${idx}`} className="flex items-start gap-3 group hover:bg-[#2a2a2a] p-2 rounded transition-colors">
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
                      <button
                        onClick={() => router.push(`/fldr/${task.fldrId}`)}
                        className="text-xs text-gray-500 hover:text-[#3b82f6] transition-colors"
                      >
                        {task.fldrTitle}
                      </button>
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
            )}
          </div>

          {/* Products Section */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center justify-between">
              <span>Products</span>
              <span className="text-sm text-gray-400">{allProducts.reduce((sum, p) => sum + p.quantity, 0)} items</span>
            </h2>
            {allProducts.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No products</div>
            ) : (
              <div className="space-y-3">
                {allProducts.map((product) => (
                  <div key={`${product.fldrId}-${product.id}`} className="p-3 bg-[#0a0a0a] rounded-lg group hover:bg-[#151515] transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={product.name}
                          onChange={(e) => updateProduct(product.fldrId, product.id, { name: e.target.value })}
                          className="w-full bg-transparent text-sm font-medium border-none focus:outline-none focus:ring-0 p-0"
                          placeholder="Product name"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={product.quantity}
                          onChange={(e) => updateProduct(product.fldrId, product.id, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-16 px-2 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
                        />
                        <button
                          onClick={() => {
                            if (confirm('Delete this product?')) {
                              deleteProduct(product.fldrId, product.id)
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {product.notes && (
                      <input
                        type="text"
                        value={product.notes}
                        onChange={(e) => updateProduct(product.fldrId, product.id, { notes: e.target.value })}
                        className="w-full bg-transparent text-xs text-gray-400 border-none focus:outline-none focus:ring-0 p-0 mb-2"
                        placeholder="Notes"
                      />
                    )}
                    <button
                      onClick={() => router.push(`/fldr/${product.fldrId}`)}
                      className="text-xs text-gray-500 hover:text-[#3b82f6] transition-colors"
                    >
                      {product.fldrTitle}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
