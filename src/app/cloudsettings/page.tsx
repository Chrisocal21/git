'use client';

import { useState } from 'react'
import PageHeader from '@/components/PageHeader'

export default function CloudSettingsPage() {
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<any>(null)

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
      console.log(`[Migration] Migrating ${fldrs.length} fldrs to D1...`)

      const response = await fetch('/api/migrate-to-d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fldrs }),
      })

      const result = await response.json()
      setMigrationResult(result)

      if (result.migrated > 0) {
        alert(`Successfully migrated ${result.migrated} fldrs to D1!`)
      } else {
        alert(`Migration failed. Check console for details.`)
      }
      
      console.log('Migration result:', result)
      
      // Log detailed errors
      if (result.results?.failed && result.results.failed.length > 0) {
        console.error('[Migration] Failed migrations:')
        result.results.failed.forEach((f: any) => {
          console.error(`  - ${f.id}: ${f.error}`)
        })
      }
    } catch (error) {
      console.error('Migration error:', error)
      alert('Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setMigrating(false)
    }
  }

  const handleClearCache = () => {
    if (confirm('Clear all cached data? You will need to refresh to reload from server.')) {
      localStorage.clear()
      alert('Cache cleared! Refresh the page to reload data.')
    }
  }

  return (
    <div className="min-h-page text-white">
      <PageHeader title="Cloud Settings" subtitle="Advanced admin tools" width="max-w-md" />

      <div className="px-4 py-6 max-w-md mx-auto">
      <div className="space-y-3">
        <a
          href="/import"
          className="card shadow-card flex items-center justify-between gap-3 p-4 hover:bg-surface-raised hover:border-line-strong transition-colors"
        >
          <div>
            <div className="font-semibold text-sm mb-1">Import History</div>
            <div className="text-sm text-white/55">
              Import jobs from old TripFldr database
            </div>
          </div>
          <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>

        <div className="card shadow-card p-4">
          <div className="font-semibold text-sm mb-1">Migrate to D1</div>
          <div className="text-sm text-white/55 mb-3">
            Push existing localStorage data to cloud database
          </div>
          <button
            onClick={handleMigrateToD1}
            disabled={migrating}
            className="btn-brand py-2"
          >
            {migrating ? 'Migrating...' : 'Migrate to D1'}
          </button>
          {migrationResult && (
            <div className="mt-3 p-3 bg-canvas border border-line rounded-lg text-xs tabular">
              <div className="text-emerald-400">{migrationResult.migrated} migrated</div>
              {migrationResult.failed > 0 && (
                <div className="text-red-400">{migrationResult.failed} failed</div>
              )}
            </div>
          )}
        </div>

        <div className="card shadow-card p-4">
          <div className="font-semibold text-sm mb-1">Clear Cache</div>
          <div className="text-sm text-white/55 mb-3">
            Remove all cached data from localStorage
          </div>
          <button
            onClick={handleClearCache}
            className="btn-danger py-2"
          >
            Clear All Cache
          </button>
        </div>
      </div>

      <div className="mt-6 px-4 py-3 bg-yellow-500/10 border border-yellow-500/25 rounded-xl">
        <div className="text-xs text-yellow-300">
          WARNING: This page is only accessible via direct URL
        </div>
      </div>
      </div>
    </div>
  )
}
