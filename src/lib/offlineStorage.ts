import { Fldr } from '@/types/fldr'

const STORAGE_KEY = 'git_offline_fldrs'
const SYNC_QUEUE_KEY = 'git_sync_queue'

export interface SyncQueueItem {
  fldrId: string
  updates: Partial<Fldr>
  timestamp: number
}

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

// Sync all queued changes to server
export const syncQueuedChanges = async (): Promise<boolean> => {
  if (!isOnline()) return false
  
  const queue = getSyncQueue()
  if (queue.length === 0) return true
  
  console.log(`🔄 Syncing ${queue.length} queued changes...`)
  
  try {
    // Process each queued item
    for (const item of queue) {
      console.log(`🔄 Syncing fldr ${item.fldrId}:`, Object.keys(item.updates))
      if (item.updates.photos) {
        console.log(`📷 Syncing ${item.updates.photos.length} photos for fldr ${item.fldrId}`)
      }
      await fetch(`/api/fldrs/${item.fldrId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.updates),
      })
    }
    
    // Clear queue after successful sync
    clearSyncQueue()
    console.log('✅ Sync queue cleared')
    return true
  } catch (error) {
    console.error('Failed to sync queued changes:', error)
    return false
  }
}
