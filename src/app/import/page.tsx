'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Fldr } from '@/types/fldr';
import PageHeader from '@/components/PageHeader';
import { CheckIcon } from '@/components/Icons';
import { fmtDayRange } from '@/lib/jobFormat';

interface OldTrip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  status: string;
  color: string;
}

/** A date from the old database as the plain day Burrow stores ("2025-03-14"), or '' if it isn't one */
function toDay(value: string | null | undefined): string {
  if (!value) return '';
  const plain = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  if (plain) return plain[1];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

const sameJob = (title: string, day: string) => `${title.trim().toLowerCase()}|${day}`;

export default function ImportPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<OldTrip[]>([]);
  // Trips that are already jobs in Burrow (same name, same first day), so nothing comes over twice
  const [alreadyIn, setAlreadyIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The server piece this page reads from isn't there
  const [unavailable, setUnavailable] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());
  const [migrating, setMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migratedCount, setMigratedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
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
      if (response.status === 404) {
        setUnavailable(true);
        return;
      }
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch trips');
      }

      setTrips(data.trips);

      // What Burrow already has, to mark the trips that came over before
      try {
        const jobsRes = await fetch('/api/fldrs', { cache: 'no-store' });
        const jobs: Fldr[] = jobsRes.ok ? await jobsRes.json() : [];
        if (Array.isArray(jobs)) {
          const have = new Set(jobs.map(job => sameJob(job.title || '', toDay(job.date_start))));
          setAlreadyIn(new Set(data.trips.filter((trip: OldTrip) => have.has(sameJob(trip.name || 'Untitled', toDay(trip.startDate)))).map((trip: OldTrip) => trip.id)));
        }
      } catch (e) {
        console.error('Could not check which trips are already in Burrow:', e);
      }
    } catch (err: any) {
      console.error('Error fetching trips:', err);
      setError(err.message || 'Failed to load trips from old database');
    } finally {
      setLoading(false);
    }
  }

  function toggleTrip(tripId: string) {
    if (alreadyIn.has(tripId)) return;
    const newSelected = new Set(selectedTrips);
    if (newSelected.has(tripId)) {
      newSelected.delete(tripId);
    } else {
      newSelected.add(tripId);
    }
    setSelectedTrips(newSelected);
  }

  function selectAll() {
    setSelectedTrips(new Set(trips.filter(t => !alreadyIn.has(t.id)).map(t => t.id)));
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
    console.log('[Refresh] Pull-to-refresh triggered on import page');

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
    if (selectedTrips.size === 0 || migrating) return;

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
          // Burrow keeps plain days; the old database may hold full timestamps
          const start = toDay(fldr.date_start);
          if (!start) {
            console.error('Skipping a trip with no usable start date:', fldr.title);
            failCount++;
            continue;
          }

          const createRes = await fetch('/api/fldrs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: fldr.title,
              date_start: start,
              date_end: toDay(fldr.date_end) || null,
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

          // Update the fldr with all the migrated data.
          // A trip that's over goes in as complete, so it lands in the Completed Archive
          // rather than in among the jobs still on the go.
          const updateRes = await fetch(`/api/fldrs/${newFldr.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: fldr.status,
              job_status: fldr.status === 'complete' ? 'complete' : 'pending',
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
          if (Array.isArray(allFldrs)) {
            localStorage.setItem('git-fldrs', JSON.stringify(allFldrs));
            console.log('Updated localStorage cache with', allFldrs.length, 'fldrs');
          }
        }
      } catch (e) {
        console.error('Failed to update cache:', e);
      }

      setMigratedCount(successCount);
      setFailedCount(failCount);
      setMigrationComplete(true);
    } catch (err: any) {
      console.error('Error migrating trips:', err);
      setError("The import didn't go through. Nothing was added. Try again in a moment.");
    } finally {
      setMigrating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-page text-white">
        <PageHeader title="Import History" width="max-w-4xl" />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-[15px] text-white/55">Looking for trips in the old database...</div>
        </div>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="min-h-page text-white">
        <PageHeader title="Import History" width="max-w-4xl" />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="card p-5">
            <div className="font-semibold text-white mb-1.5">Import isn&apos;t available</div>
            <div className="text-[15px] leading-relaxed text-white/60">
              The part of Burrow that reads the old TripFldr trips isn&apos;t on this server. Your jobs in Burrow are not affected.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && trips.length === 0) {
    return (
      <div className="min-h-page text-white">
        <PageHeader title="Import History" width="max-w-4xl" />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 mb-4">
            <div className="font-semibold text-red-300 mb-2">Couldn&apos;t read the old trips</div>
            <div className="text-[15px] leading-relaxed text-white/75 mb-3">
              Burrow looked for the old TripFldr trips in the database and didn&apos;t get them. They may no longer be there, or the database may not be connected right now.
            </div>
            <div className="text-[13px] text-white/45 break-words">What the database said: {error}</div>
          </div>
          <button
            onClick={fetchTrips}
            className="btn-brand min-h-[2.75rem]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (migrationComplete) {
    return (
      <div className="min-h-page text-white">
        <PageHeader title="Import Complete" width="max-w-4xl" />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 mb-4">
            <div className="font-display text-lg font-semibold mb-2">
              Imported {migratedCount} {migratedCount === 1 ? 'trip' : 'trips'}
            </div>
            <div className="text-[15px] leading-relaxed text-white/70">
              Each one is now a job in Burrow. Trips that are over are in the Completed Archive on the Jobs page, with their notes and checklist.
            </div>
          </div>
          {failedCount > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-[15px] leading-relaxed text-red-200">
              {failedCount} {failedCount === 1 ? "trip didn't" : "trips didn't"} come over. {failedCount === 1 ? 'It is' : 'They are'} still in the list to try again.
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/jobs')}
              className="btn-primary min-h-[2.75rem]"
            >
              View Jobs
            </button>
            <button
              onClick={() => {
                setMigrationComplete(false);
                setMigratedCount(0);
                setFailedCount(0);
                setSelectedTrips(new Set());
                fetchTrips();
              }}
              className="btn-secondary min-h-[2.75rem]"
            >
              Import More
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fresh = trips.filter(trip => !alreadyIn.has(trip.id));

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
      <PageHeader title="Import History" width="max-w-4xl" />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <p className="text-[15px] leading-relaxed text-white/60 mb-5">
          These are the trips from the old TripFldr app. Pick the ones to bring into Burrow. Each becomes a job with its notes and checklist, and trips that are over go straight to the Completed Archive.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <div className="text-[15px] text-red-200">{error}</div>
          </div>
        )}

        {trips.length === 0 ? (
          <div className="text-[15px] text-white/55">There are no trips in the old database.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 mb-3">
              <div className="text-[15px] text-white/60 tabular">
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'}
                {alreadyIn.size > 0 && ` · ${alreadyIn.size} already in Burrow`}
                {selectedTrips.size > 0 && ` · ${selectedTrips.size} selected`}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={selectAll}
                  disabled={fresh.length === 0}
                  className="inline-flex min-h-[2.75rem] items-center rounded-lg px-2 text-[15px] font-medium text-brand-light hover:text-white transition-colors disabled:opacity-40"
                >
                  Select All
                </button>
                <span className="text-white/25">·</span>
                <button
                  onClick={deselectAll}
                  className="inline-flex min-h-[2.75rem] items-center rounded-lg px-2 text-[15px] font-medium text-brand-light hover:text-white transition-colors"
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {trips.map((trip) => {
                const imported = alreadyIn.has(trip.id);
                const picked = selectedTrips.has(trip.id);
                return (
                  <button
                    key={trip.id}
                    onClick={() => toggleTrip(trip.id)}
                    aria-pressed={picked}
                    disabled={imported}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      imported
                        ? 'bg-surface/50 border-line opacity-60'
                        : picked
                        ? 'bg-brand/15 border-brand'
                        : 'bg-surface border-line hover:border-line-strong'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-base font-semibold mb-0.5 break-words">{trip.name}</div>
                        {trip.destination && <div className="text-[15px] text-white/60 mb-0.5">{trip.destination}</div>}
                        <div className="text-sm text-white/50 tabular">
                          {fmtDayRange(toDay(trip.startDate), toDay(trip.endDate)) || 'No dates'}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {imported ? (
                          <span className="badge bg-white/10 text-white/60">already in Burrow</span>
                        ) : (
                          <>
                            <span
                              className={`badge ${
                                trip.status === 'past'
                                  ? 'bg-white/10 text-white/60'
                                  : trip.status === 'upcoming'
                                  ? 'bg-blue-500/15 text-blue-300'
                                  : 'bg-emerald-500/15 text-emerald-300'
                              }`}
                            >
                              {trip.status}
                            </span>
                            <div
                              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                picked ? 'bg-brand border-brand' : 'border-white/30'
                              }`}
                            >
                              {picked && <CheckIcon className="w-4 h-4 text-white" />}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleMigrate}
                disabled={selectedTrips.size === 0 || migrating}
                className="btn-primary flex-1 px-6 min-h-[3rem]"
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
