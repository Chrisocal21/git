/**
 * Singleton Google Maps API loader
 * Ensures the script is only loaded once across all components
 */

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

class GoogleMapsLoader {
  private status: LoadStatus = 'idle'
  private promise: Promise<void> | null = null
  private callbacks: Array<() => void> = []
  private readonly LOAD_TIMEOUT_MS = 15000
  private loadingStartedAt: number | null = null

  isLoaded(): boolean {
    return typeof window !== 'undefined' && !!window.google?.maps?.Map
  }

  load(): Promise<void> {
    // Already loaded
    if (this.isLoaded()) {
      return Promise.resolve()
    }

    // Currently loading - return existing promise
    if (this.promise) {
      if (
        this.status === 'loading' &&
        this.loadingStartedAt &&
        Date.now() - this.loadingStartedAt > this.LOAD_TIMEOUT_MS
      ) {
        this.promise = null
        this.status = 'idle'
        this.loadingStartedAt = null
      } else {
        return this.promise
      }
    }

    // Promise may have been reset due to stale timeout
    if (this.promise) {
      return this.promise
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    
    // Check if API key is valid (not placeholder or empty)
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      console.warn('[Maps] Google Maps API key not configured. Address autocomplete will not work.')
      console.warn('To fix: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file')
      return Promise.reject(new Error('Google Maps API key not configured'))
    }

    // Start loading
    this.status = 'loading'
    this.loadingStartedAt = Date.now()
    this.promise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Google Maps can only be loaded in browser'))
        return
      }

      const waitForMapsReady = (): Promise<void> => {
        return new Promise((innerResolve, innerReject) => {
          const start = Date.now()

          const checkReady = () => {
            if (window.google?.maps?.Map) {
              innerResolve()
              return
            }

            if (Date.now() - start >= this.LOAD_TIMEOUT_MS) {
              innerReject(new Error('Google Maps API load timeout'))
              return
            }

            setTimeout(checkReady, 50)
          }

          checkReady()
        })
      }

      const handleReady = async () => {
        try {
          await waitForMapsReady()
          this.status = 'loaded'
          this.loadingStartedAt = null
          this.callbacks.forEach(cb => cb())
          this.callbacks = []
          resolve()
        } catch (err) {
          this.status = 'error'
          this.promise = null
          this.loadingStartedAt = null
          reject(err instanceof Error ? err : new Error('Failed to load Google Maps API'))
        }
      }

      // Check if script already exists in DOM (can happen with hot reload)
      const existingScript = document.querySelector(
        'script[src*="maps.googleapis.com"]'
      )

      if (existingScript) {
        // Script exists: either already ready, still loading, or stalled. Handle all cases.
        if (window.google?.maps?.Map) {
          this.status = 'loaded'
          resolve()
          return
        }

        existingScript.addEventListener('load', () => {
          void handleReady()
        })
        existingScript.addEventListener('error', () => {
          this.status = 'error'
          this.promise = null
          this.loadingStartedAt = null
          reject(new Error('Failed to load Google Maps API'))
        })

        // If the script is already in DOM but events never fire, timeout via readiness polling.
        void handleReady()
        return
      }

      // Create new script
      const script = document.createElement('script')
      
      // Only load places library - geocoding is done server-side via /api/timezone
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&loading=async`
      script.async = true
      script.defer = true

      script.onload = () => {
        void handleReady()
      }

      script.onerror = () => {
        this.status = 'error'
        this.promise = null
        this.loadingStartedAt = null
        reject(new Error('Failed to load Google Maps API'))
      }

      document.head.appendChild(script)
    })

    return this.promise
  }

  onLoad(callback: () => void): void {
    if (this.isLoaded()) {
      callback()
    } else {
      this.callbacks.push(callback)
    }
  }
}

// Export singleton instance
export const googleMapsLoader = new GoogleMapsLoader()
