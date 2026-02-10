'use client';

import { useState } from 'react'

export default function ProdPage() {
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
    } catch (error) {
      console.error('Migration error:', error)
      alert('❌ Migration failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className="p-6">
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
