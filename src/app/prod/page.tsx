'use client';

import { useState } from 'react'

export default function ProdPage() {
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<any>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)

  const handleMigrateToD1 = async () => {
    if (!confirm('Migrate all localStorage data to D1? This will push your existing fldrs to the cloud database.')) {
      return
    }

    setMigrating(true)
    setMigrationResult(null)

    try {
      // Get all fldrs from localStorage
      const cached = localStorage.getItem('git-fldrs')
      if (!cached) {
        alert('No data found in localStorage!')
        setMigrating(false)
        return
      }

      const fldrs = JSON.parse(cached)
      console.log(`📤 Migrating ${fldrs.length} fldrs to D1...`)

      const response = await fetch('/api/migrate-to-d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fldrs }),
      })

      const result = await response.json()
      setMigrationResult(result)

      if (result.migrated > 0) {
        alert(`✅ Successfully migrated ${result.migrated} fldrs to D1!`)
      } else {
        alert(`⚠️ Migration failed. Check console for details.`)
      }
      
      console.log('Migration result:', result)
      
      // Log detailed errors
      if (result.results?.failed && result.results.failed.length > 0) {
        console.error('❌ Failed migrations:')
        result.results.failed.forEach((f: any) => {
          console.error(`  - ${f.id}: ${f.error}`)
        })
      }
    } catch (error) {
      console.error('Migration error:', error)
      alert('❌ Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setMigrating(false)
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
    
    setIsRefreshing(false)
  }

  return (
    <div 
      className="p-6"
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
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="space-y-4 max-w-md">
        <a
          href="/import"
          className="block p-4 bg-gray-900 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
        >
          <div className="font-semibold mb-1">Import History</div>
          <div className="text-sm text-gray-400">
            Import jobs from old TripFldr database
          </div>
        </a>

        <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
          <div className="font-semibold mb-1">Migrate to D1</div>
          <div className="text-sm text-gray-400 mb-3">
            Push existing localStorage data to cloud database
          </div>
          <button
            onClick={handleMigrateToD1}
            disabled={migrating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-sm rounded-lg transition-colors"
          >
            {migrating ? 'Migrating...' : 'Migrate to D1'}
          </button>
          {migrationResult && (
            <div className="mt-3 p-3 bg-gray-800 rounded text-xs">
              <div className="text-green-400">✅ {migrationResult.migrated} migrated</div>
              {migrationResult.failed > 0 && (
                <div className="text-red-400">❌ {migrationResult.failed} failed</div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
          <div className="font-semibold mb-1">Clear Cache</div>
          <div className="text-sm text-gray-400 mb-3">
            Clear offline cache and sync queue
          </div>
          <button
            onClick={() => {
              if (confirm('Clear all offline cache? This cannot be undone.')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-sm rounded-lg transition-colors"
          >
            Clear All Cache
          </button>
        </div>

        <div className="text-xs text-gray-500 text-center pt-4">
          GIT - Get It Together v1.0
        </div>
      </div>
    </div>
  )
}
