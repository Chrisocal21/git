/**
 * Singleton Google Maps API loader
 * Ensures the script is only loaded once across all components
 */

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'error'

class GoogleMapsLoader {
  private status: LoadStatus = 'idle'
  private promise: Promise<void> | null = null
  private callbacks: Array<() => void> = []

  isLoaded(): boolean {
    return typeof window !== 'undefined' && !!window.google?.maps
  }

  load(): Promise<void> {
    // Already loaded
    if (this.isLoaded()) {
      return Promise.resolve()
    }

    // Currently loading - return existing promise
    if (this.promise) {
      return this.promise
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
    
    // Check if API key is valid (not placeholder or empty)
    if (!apiKey || apiKey === 'your_google_maps_api_key_here') {
      console.warn('⚠️ Google Maps API key not configured. Address autocomplete will not work.')
      console.warn('To fix: Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file')
      return Promise.reject(new Error('Google Maps API key not configured'))
    }

    // Start loading
    this.status = 'loading'
    this.promise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Google Maps can only be loaded in browser'))
        return
      }

      // Check if script already exists in DOM (can happen with hot reload)
      const existingScript = document.querySelector(
        'script[src*="maps.googleapis.com"]'
      )

      if (existingScript) {
        // Script exists but not loaded yet - wait for it
        existingScript.addEventListener('load', () => {
          this.status = 'loaded'
          resolve()
        })
        existingScript.addEventListener('error', () => {
          this.status = 'error'
          this.promise = null
          reject(new Error('Failed to load Google Maps API'))
        })
        return
      }

      // Create new script
      const script = document.createElement('script')
      
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
      script.async = true
      script.defer= true

      script.onload = () => {
        this.status = 'loaded'
        this.callbacks.forEach(cb => cb())
        this.callbacks = []
        resolve()
      }

      script.onerror = () => {
        this.status = 'error'
        this.promise = null
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
