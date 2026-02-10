'use client';

export default function ProdPage() {
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
