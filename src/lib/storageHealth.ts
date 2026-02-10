// Storage health monitoring and recovery

const STORAGE_HEALTH_KEY = 'git-storage-health'
const LIST_CACHE_KEY = 'git-fldrs'

interface StorageHealth {
  lastCheck: number
  lastWrite: number
  cacheCount: number
  isWorking: boolean
}

export const checkStorageHealth = (): StorageHealth => {
  try {
    const testKey = '__storage_test__'
    localStorage.setItem(testKey, 'test')
    localStorage.removeItem(testKey)
    
    const cached = localStorage.getItem(LIST_CACHE_KEY)
    const cacheCount = cached ? JSON.parse(cached).length : 0
    
    const health: StorageHealth = {
      lastCheck: Date.now(),
      lastWrite: Date.now(),
      cacheCount,
      isWorking: true,
    }
    
    localStorage.setItem(STORAGE_HEALTH_KEY, JSON.stringify(health))
    return health
  } catch (error) {
    console.error('Storage health check failed:', error)
    return {
      lastCheck: Date.now(),
      lastWrite: 0,
      cacheCount: 0,
      isWorking: false,
    }
  }
}

export const getStorageHealth = (): StorageHealth | null => {
  try {
    const health = localStorage.getItem(STORAGE_HEALTH_KEY)
    return health ? JSON.parse(health) : null
  } catch (error) {
    console.error('Failed to get storage health:', error)
    return null
  }
}

export const logStorageInfo = () => {
  try {
    const health = getStorageHealth()
    console.log('📦 Storage Health:', health)
    
    // Log all git-related keys
    const keys = Object.keys(localStorage).filter(k => k.startsWith('git'))
    console.log('📦 Storage Keys:', keys)
    
    keys.forEach(key => {
      const value = localStorage.getItem(key)
      const size = value ? new Blob([value]).size : 0
      console.log(`  - ${key}: ${(size / 1024).toFixed(2)} KB`)
    })
    
    // Estimate total usage
    let totalSize = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        const value = localStorage.getItem(key)
        if (value) {
          totalSize += new Blob([value]).size + new Blob([key]).size
        }
      }
    }
    console.log(`📦 Total localStorage: ${(totalSize / 1024).toFixed(2)} KB`)
    
  } catch (error) {
    console.error('Failed to log storage info:', error)
  }
}
