import { Fldr } from '@/types/fldr'
import { toast } from '@/components/Dialogs'

const STORAGE_KEY = 'git_offline_fldrs'
const SYNC_QUEUE_KEY = 'git_sync_queue'

export interface SyncQueueItem {
  fldrId: string
  updates: Partial<Fldr>
  timestamp: number
  /** How many times the server has answered this change with an error */
  refusals?: number
}

// A change the server has kept refusing for a whole day isn't going to go through
// (too big for the database, most likely), so it's let go rather than retried forever
const MAX_REFUSALS = 5
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000

// Get cached fldr data
export const getCachedFldr = (fldrId: string): Fldr | null => {
  try {
    const cached = localStorage.getItem(`${STORAGE_KEY}_${fldrId}`)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('Failed to get cached fldr:', error)
    return null
  }
}

// Cache fldr data locally
export const cacheFldr = (fldr: Fldr): void => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${fldr.id}`, JSON.stringify(fldr))
  } catch (error) {
    console.error('Failed to cache fldr:', error)
  }
}

// Get all cached fldr IDs
export const getCachedFldrIds = (): string[] => {
  try {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(STORAGE_KEY))
    return keys.map(key => key.replace(`${STORAGE_KEY}_`, ''))
  } catch (error) {
    console.error('Failed to get cached fldr IDs:', error)
    return []
  }
}

// Add item to sync queue
export const addToSyncQueue = (fldrId: string, updates: Partial<Fldr>): void => {
  try {
    const queue = getSyncQueue()
    queue.push({
      fldrId,
      updates,
      timestamp: Date.now(),
    })
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue))
  } catch (error) {
    console.error('Failed to add to sync queue:', error)
  }
}

// Get sync queue
export const getSyncQueue = (): SyncQueueItem[] => {
  try {
    const queue = localStorage.getItem(SYNC_QUEUE_KEY)
    return queue ? JSON.parse(queue) : []
  } catch (error) {
    console.error('Failed to get sync queue:', error)
    return []
  }
}

// Clear sync queue
export const clearSyncQueue = (): void => {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY)
  } catch (error) {
    console.error('Failed to clear sync queue:', error)
  }
}

// Check if there are unsynced changes
export const hasUnsyncedChanges = (): boolean => {
  return getSyncQueue().length > 0
}

// Clear all cached data (hard refresh)
export const clearAllCache = (): void => {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(STORAGE_KEY) || key === SYNC_QUEUE_KEY
    )
    keys.forEach(key => localStorage.removeItem(key))
  } catch (error) {
    console.error('Failed to clear cache:', error)
  }
}

// Check if online
export const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' && navigator.onLine
}

// Only one sync runs at a time, so two pages asking at once can't send the same change twice
let syncing: Promise<boolean> | null = null

// Sync all queued changes to server. True when nothing is left waiting.
export const syncQueuedChanges = (): Promise<boolean> => {
  if (!syncing) {
    syncing = runSync().finally(() => {
      syncing = null
    })
  }
  return syncing
}

const runSync = async (): Promise<boolean> => {
  if (!isOnline()) return false
  
  const queue = getSyncQueue()
  if (queue.length === 0) return true
  
  console.log(`[Sync] Syncing ${queue.length} queued changes...`)
  
  // A change only leaves the queue once the server has taken it. One that fails stays for
  // next time, and so does everything queued after it for the same job: sending those out
  // of order would let an older change land on top of a newer one.
  const kept: SyncQueueItem[] = []
  const held = new Set<string>()
  let letGo = 0

  for (const item of queue) {
    if (held.has(item.fldrId)) {
      kept.push(item)
      continue
    }
    console.log(`[Sync] Syncing fldr ${item.fldrId}:`, Object.keys(item.updates))
    if (item.updates.photos) {
      console.log(`[Sync] Syncing ${item.updates.photos.length} photos for fldr ${item.fldrId}`)
    }
    try {
      const res = await fetch(`/api/fldrs/${item.fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.updates),
      })
      // 404: the job has been deleted, so there is nothing left for the change to go to
      if (!res.ok && res.status !== 404) {
        console.error(`[Sync] Server refused a queued change for ${item.fldrId}:`, res.status)
        const refusals = (item.refusals || 0) + 1
        if (refusals >= MAX_REFUSALS && Date.now() - item.timestamp > GIVE_UP_AFTER_MS) {
          letGo++
        } else {
          kept.push({ ...item, refusals })
          held.add(item.fldrId)
        }
      }
    } catch (error) {
      console.error('Failed to sync a queued change:', error)
      kept.push(item)
      held.add(item.fldrId)
    }
  }

  if (letGo > 0) {
    toast("A change the server kept refusing for a day was let go. Open the job and check nothing is missing.", 'error')
  }

  // Anything queued while this was running sits after the ones just handled; it stays too
  try {
    const addedMeanwhile = getSyncQueue().slice(queue.length)
    const remaining = [...kept, ...addedMeanwhile]
    if (remaining.length === 0) {
      clearSyncQueue()
      console.log('[Sync] Sync queue cleared')
    } else {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remaining))
      console.log(`[Sync] ${remaining.length} queued changes still waiting`)
    }
    return remaining.length === 0
  } catch (error) {
    console.error('Failed to update the sync queue:', error)
    return false
  }
}
