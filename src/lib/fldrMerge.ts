import type { Fldr } from '@/types/fldr'

// Objects inside a job that are saved field by field: a save that only mentions
// some of their fields leaves the rest as they were.
const MERGED_KEYS = ['job_info', 'hotel_info', 'venue_info', 'rental_car_info', 'tracker'] as const

/**
 * How a partial update lands on a job. The server and the job page both go through
 * this, so a save reads the same on the phone as it does in the cloud.
 */
export function mergeFldrUpdates<T extends Partial<Fldr>>(existing: T, updates: Partial<Fldr>): T {
  const merged: Record<string, unknown> = { ...existing, ...updates }
  for (const key of MERGED_KEYS) {
    const before = existing[key]
    const change = updates[key]
    if (before && change) merged[key] = { ...before, ...change }
  }
  return merged as T
}
