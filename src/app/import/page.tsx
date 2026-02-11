'use client';

import { useState, useEffect } from 'react';
import { Fldr } from '@/types/fldr';

interface OldTrip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  color: string;
}

export default function ImportPage() {
  const [trips, setTrips] = useState<OldTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

  useEffect(() => {
    fetchTrips();
  }, []);

  async function fetchTrips() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/import/trips');
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch trips');
      }

      setTrips(data.trips);
    } catch (err: any) {
      console.error('Error fetching trips:', err);
      setError(err.message || 'Failed to load trips from old database');
    } finally {
      setLoading(false);
    }
  }

  function toggleTrip(tripId: string) {
    const newSelected = new Set(selectedTrips);
    if (newSelected.has(tripId)) {
      newSelected.delete(tripId);
    } else {
      newSelected.add(tripId);
    }
    setSelectedTrips(newSelected);
  }

  function selectAll() {
    setSelectedTrips(new Set(trips.map(t => t.id)));
  }

  function deselectAll() {
    setSelectedTrips(new Set());
  }

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || window.scrollY > 0) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY;
    
    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setIsRefreshing(true);
      await handleRefresh();
    }
    setIsPulling(false);
    setPullDistance(0);
    setTouchStartY(0);
  };

  const handleRefresh = async () => {
    console.log('🔄 Pull-to-refresh triggered on import page');
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
          return;
        }
      }
    }
    
    // Refresh trips list
    await fetchTrips();
    setIsRefreshing(false);
  };

  async function handleMigrate() {
    if (selectedTrips.size === 0) return;

    try {
      setMigrating(true);
      setError(null);

      const response = await fetch('/api/import/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripIds: Array.from(selectedTrips) }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Migration failed');
      }

      // Add migrated fldrs to store via API
      let successCount = 0;
      let failCount = 0;
      
      for (const fldr of data.fldrs) {
        try {
          console.log('Creating fldr:', fldr.title);
          
          const createRes = await fetch('/api/fldrs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: fldr.title,
              date_start: fldr.date_start,
              date_end: fldr.date_end,
              location: fldr.location,
            }),
          });

          if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error('Failed to create fldr:', createRes.status, errorText);
            failCount++;
            continue;
          }

          const newFldr = await createRes.json();
          console.log('Created fldr with ID:', newFldr.id);
          
          // Update the fldr with all the migrated data
          const updateRes = await fetch(`/api/fldrs/${newFldr.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: fldr.status,
              notes: fldr.notes,
              checklist: fldr.checklist,
            }),
          });

          if (!updateRes.ok) {
            const errorText = await updateRes.text();
            console.error('Failed to update fldr:', updateRes.status, errorText);
            failCount++;
            continue;
          }

          console.log('Successfully imported:', fldr.title);
          successCount++;
        } catch (err) {
          console.error('Error importing fldr:', err);
          failCount++;
        }
      }
      
      console.log(`Import complete: ${successCount} succeeded, ${failCount} failed`);

      // Refresh the fldrs cache after successful import
      try {
        const fldrRes = await fetch('/api/fldrs');
        if (fldrRes.ok) {
          const allFldrs = await fldrRes.json();
          localStorage.setItem('git-fldrs', JSON.stringify(allFldrs));
          console.log('Updated localStorage cache with', allFldrs.length, 'fldrs');
        }
      } catch (e) {
        console.error('Failed to update cache:', e);
      }

      setMigratedCount(successCount);
      setMigrationComplete(true);
      
      if (failCount > 0) {
        setError(`Imported ${successCount} jobs, but ${failCount} failed. Check console for details.`);
      }
    } catch (err: any) {
      console.error('Error migrating trips:', err);
      setError(err.message || 'Failed to migrate trips');
    } finally {
      setMigrating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Import History</h1>
          <div className="text-gray-400">Loading trips from old database...</div>
        </div>
      </div>
    );
  }

  if (error && trips.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Import History</h1>
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
            <div className="font-semibold mb-2">Connection Error</div>
            <div className="text-sm text-gray-300 mb-4">{error}</div>
            <div className="text-xs text-gray-400">
              Make sure you have added your CLOUDFLARE_API_TOKEN to the .env file.
            </div>
          </div>
          <button
            onClick={fetchTrips}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (migrationComplete) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Import Complete</h1>
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6 mb-6">
            <div className="text-lg font-semibold mb-2">
              ✓ Successfully imported {migratedCount} {migratedCount === 1 ? 'job' : 'jobs'}
            </div>
            <div className="text-sm text-gray-300">
              Your old trips have been converted to Fldrs and are now available in the app.
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href="/"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              View Fldrs
            </a>
            <button
              onClick={() => {
                setMigrationComplete(false);
                setMigratedCount(0);
                setSelectedTrips(new Set());
                fetchTrips();
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Import More
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-black text-white p-6 pb-24"
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Import History</h1>
        <p className="text-gray-400 mb-6">
          Select trips from your old TripFldr database to import as Fldrs
        </p>

        {error && (
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-4">
            <div className="text-sm">{error}</div>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="text-gray-400">No trips found in database</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-400">
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'} found
                {selectedTrips.size > 0 && ` · ${selectedTrips.size} selected`}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Select All
                </button>
                <span className="text-gray-600">·</span>
                <button
                  onClick={deselectAll}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => toggleTrip(trip.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedTrips.has(trip.id)
                      ? 'bg-blue-900/20 border-blue-500'
                      : 'bg-gray-900 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold mb-1">{trip.name}</div>
                      <div className="text-sm text-gray-400 mb-1">
                        {trip.destination}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(trip.startDate).toLocaleDateString()} -{' '}
                        {new Date(trip.endDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          trip.status === 'past'
                            ? 'bg-gray-700 text-gray-300'
                            : trip.status === 'upcoming'
                            ? 'bg-blue-900/30 text-blue-400'
                            : 'bg-green-900/30 text-green-400'
                        }`}
                      >
                        {trip.status}
                      </span>
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedTrips.has(trip.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'border-gray-600'
                        }`}
                      >
                        {selectedTrips.has(trip.id) && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMigrate}
                disabled={selectedTrips.size === 0 || migrating}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-colors ${
                  selectedTrips.size === 0 || migrating
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {migrating
                  ? 'Importing...'
                  : `Import ${selectedTrips.size} ${
                      selectedTrips.size === 1 ? 'Trip' : 'Trips'
                    }`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
