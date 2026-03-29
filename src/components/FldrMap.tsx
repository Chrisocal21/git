'use client'

import { useEffect, useState, useRef, memo } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'

interface Location {
  label: string
  address: string
  coordinates?: [number, number]
  phone?: string
  notes?: string
  additionalInfo?: string
}

interface NearbyPlace {
  name: string
  vicinity: string
  distance: string
  rating?: number
  website?: string
}

interface FldrMapProps {
  locations: Location[]
  venueAddress?: string
  hotelAddress?: string
  airportAddress?: string
  forceFullscreen?: boolean
  onNearbyTypeChange?: (type: 'restaurant' | 'cafe' | 'gas_station' | 'bar') => void
  onSearchLocationChange?: (address: string) => void
  nearbyPlaces?: { places: NearbyPlace[] } | null
  nearbyLoading?: boolean
  nearbyType?: 'restaurant' | 'cafe' | 'gas_station' | 'bar'
  searchFromAddress?: string
}

function FldrMap({
  locations,
  venueAddress,
  hotelAddress,
  airportAddress,
  forceFullscreen = false,
  onNearbyTypeChange,
  onSearchLocationChange,
  nearbyPlaces,
  nearbyLoading,
  nearbyType = 'restaurant',
  searchFromAddress
}: FldrMapProps) {
  const [geocodedLocations, setGeocodedLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(forceFullscreen)
  const [error, setError] = useState<string | null>(null)
  const [isRefReady, setIsRefReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const isFullscreenView = forceFullscreen || isFullscreen
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  // Initialize map
  useEffect(() => {
    async function initMap() {
      const element = mapContainerRef.current
      if (!element) {
        setLoading(false)
        return
      }
      if (googleMapRef.current) return

      setLoading(true)
      setError(null)

      try {
        await googleMapsLoader.load()

        // Geocode addresses (if any)
        const results = await Promise.all(
          (locations || []).map(async (loc) => {
            if (!loc.address.trim()) return null
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 10000)
            try {
              const response = await fetch(`/api/timezone?address=${encodeURIComponent(loc.address)}`, {
                signal: controller.signal
              })
              if (!response.ok) return null
              const data = await response.json()
              if (data.coordinates?.lat && data.coordinates?.lng) {
                return {
                  ...loc,
                  coordinates: [parseFloat(data.coordinates.lat), parseFloat(data.coordinates.lng)] as [number, number]
                }
              }
            } catch (e) {
              console.error('[Map] Geocoding error:', e)
            } finally {
              clearTimeout(timeoutId)
            }
            return null
          })
        )

        const validLocations = results.filter((loc): loc is Location & { coordinates: [number, number] } => loc !== null)
        setGeocodedLocations(validLocations)

        // Always render a map, even if no addresses geocode successfully.
        // This prevents a blank fullscreen when job data has missing/incomplete addresses.
        const fallbackCenter = { lat: 32.7157, lng: -117.1611 } // San Diego default
        const initialCenter = validLocations.length > 0
          ? { lat: validLocations[0].coordinates[0], lng: validLocations[0].coordinates[1] }
          : fallbackCenter

        const bounds = new google.maps.LatLngBounds()
        validLocations.forEach(loc => bounds.extend(new google.maps.LatLng(loc.coordinates[0], loc.coordinates[1])))

        const map = new google.maps.Map(element, {
          center: initialCenter,
          zoom: validLocations.length > 0 ? 12 : 10,
          fullscreenControl: false,
          mapTypeId: google.maps.MapTypeId.ROADMAP
        })

        googleMapRef.current = map
        markersRef.current.forEach(marker => marker.setMap(null))
        markersRef.current = []

        validLocations.forEach((loc) => {
          const marker = new google.maps.Marker({
            position: { lat: loc.coordinates[0], lng: loc.coordinates[1] },
            map,
            title: loc.label,
          })

          // Build info window content with available fields
          let contentHTML = `
            <div style="color: #000; padding: 12px; min-width: 200px; max-width: 300px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="font-weight: 600; margin-bottom: 8px; font-size: 15px; color: #1a1a1a;">${loc.label}</div>
          `
          
          if (loc.address) {
            contentHTML += `
              <div style="font-size: 13px; color: #555; margin-bottom: 6px; line-height: 1.4;">
                <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                </svg>
                ${loc.address}
              </div>
            `
          }
          
          if (loc.phone) {
            contentHTML += `
              <div style="font-size: 13px; color: #555; margin-bottom: 6px;">
                <svg style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px;" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/>
                </svg>
                <a href="tel:${loc.phone}" style="color: #2563eb; text-decoration: none;">${loc.phone}</a>
              </div>
            `
          }
          
          if (loc.additionalInfo) {
            contentHTML += `
              <div style="font-size: 12px; color: #666; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e5e5; line-height: 1.4;">
                ${loc.additionalInfo}
              </div>
            `
          }
          
          if (loc.notes) {
            contentHTML += `
              <div style="font-size: 12px; color: #888; margin-top: 6px; font-style: italic; line-height: 1.4;">
                📝 ${loc.notes}
              </div>
            `
          }
          
          contentHTML += `</div>`

          const infoWindow = new google.maps.InfoWindow({
            content: contentHTML
          })

          marker.addListener('click', () => infoWindow.open(map, marker))
          markersRef.current.push(marker)
        })

        if (validLocations.length > 1) {
          map.fitBounds(bounds)
        }

        // Maps in overlays can initialize before final layout settles.
        // Trigger a resize and re-center after mount to avoid blank tiles.
        window.setTimeout(() => {
          if (!googleMapRef.current) return
          google.maps.event.trigger(googleMapRef.current, 'resize')
          if (validLocations.length > 1) {
            googleMapRef.current.fitBounds(bounds)
          } else if (validLocations.length === 1) {
            googleMapRef.current.setCenter({
              lat: validLocations[0].coordinates[0],
              lng: validLocations[0].coordinates[1],
            })
          } else {
            googleMapRef.current.setCenter(initialCenter)
          }
        }, 250)

        setLoading(false)
      } catch (error) {
        setError(`Failed to load map`)
      } finally {
        setLoading(false)
      }
    }

    if (isRefReady) {
      initMap()
    }

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
      googleMapRef.current = null
    }
  }, [locations, isRefReady])

  const setMapRef = (element: HTMLDivElement | null) => {
    mapContainerRef.current = element
    if (element && !isRefReady) {
      setIsRefReady(true)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement
      setIsFullscreen(isCurrentlyFullscreen)
      
      // When entering fullscreen, reset sidebar visibility and default to venue if available
      if (isCurrentlyFullscreen) {
        setSidebarVisible(true)
        if (!selectedLocation && venueAddress) {
          setSelectedLocation(venueAddress)
          if (onSearchLocationChange) {
            onSearchLocationChange(venueAddress)
          }
        }
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [selectedLocation, venueAddress, onSearchLocationChange])

  useEffect(() => {
    if (forceFullscreen) {
      setIsFullscreen(true)
      setSidebarVisible(window.innerWidth >= 768)
    }
  }, [forceFullscreen])

  const toggleFullscreen = async () => {
    if (!fullscreenContainerRef.current) return
    
    try {
      if (!document.fullscreenElement) {
        await fullscreenContainerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err)
    }
  }

  const handleLocationToggle = (address: string) => {
    setSelectedLocation(address)
    const matchingLocation = geocodedLocations.find((loc) => loc.address === address)
    if (matchingLocation?.coordinates && googleMapRef.current) {
      googleMapRef.current.panTo({
        lat: matchingLocation.coordinates[0],
        lng: matchingLocation.coordinates[1],
      })
      googleMapRef.current.setZoom(14)
    }
    if (onSearchLocationChange) {
      onSearchLocationChange(address)
    }
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    setGettingCurrentLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        setSelectedLocation(address)
        if (onSearchLocationChange) {
          onSearchLocationChange(address)
        }
       setGettingCurrentLocation(false)
      },
      () => {
        alert('Unable to get your location')
        setGettingCurrentLocation(false)
      }
    )
  }

  return (
    <div
      ref={fullscreenContainerRef}
      className={forceFullscreen
        ? 'relative w-full h-full overflow-hidden'
        : 'relative h-64 md:h-96 lg:h-[500px] xl:h-[600px] rounded-lg overflow-hidden border border-white/10'}
    >
      {loading && (
        <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center z-10">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center z-10">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      {/* Custom Fullscreen Button (shown when NOT in fullscreen) */}
      {!isFullscreenView && (
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 z-[1000] bg-white hover:bg-gray-100 rounded-sm shadow-md p-2 transition-colors"
          title="Toggle fullscreen view"
        >
          <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
        </button>
      )}

      {/* Sidebar (visible only in fullscreen) */}
      {isFullscreenView && (
        <div className={`absolute inset-y-0 left-0 z-[9999] w-[82vw] max-w-[360px] md:w-96 lg:w-[420px] bg-gradient-to-b from-[#2F5F7F] via-[#2a5570] to-[#1e3a4a] flex flex-col border-r border-white/10 shadow-2xl overflow-hidden transition-transform duration-300 ${
          sidebarVisible ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-white/20 bg-black/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Nearby Places</h2>
              <div className="flex items-center gap-2">
                {/* Mobile Close Button */}
                <button 
                  onClick={() => setSidebarVisible(false)}
                  className="md:hidden p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Hide sidebar"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {/* Desktop Exit Fullscreen Button */}
                <button 
                  onClick={toggleFullscreen}
                  className="hidden md:block p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Exit fullscreen"
                >
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Location Toggles */}
            <div className="space-y-2 mb-4">
              <div className="text-white/70 text-xs font-semibold mb-2">SEARCH FROM:</div>
              
              {/* Current Location */}
              <button
                onClick={getCurrentLocation}
                disabled={gettingCurrentLocation}
                className={`w-full px-3 py-2.5 rounded-lg text-left transition-all flex items-center gap-3 ${
                  selectedLocation && !venueAddress && !hotelAddress && !airportAddress
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white/80'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm font-medium">
                  {gettingCurrentLocation ? 'Getting location...' : 'Current Location'}
                </span>
              </button>

              {/* Venue */}
              {venueAddress && (
                <button
                  onClick={() => handleLocationToggle(venueAddress)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-all flex items-center gap-3 ${
                    selectedLocation === venueAddress
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Venue</div>
                    <div className="text-xs opacity-70 truncate">{venueAddress}</div>
                  </div>
                </button>
              )}

              {/* Hotel */}
              {hotelAddress && (
                <button
                  onClick={() => handleLocationToggle(hotelAddress)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-all flex items-center gap-3 ${
                    selectedLocation === hotelAddress
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Hotel</div>
                    <div className="text-xs opacity-70 truncate">{hotelAddress}</div>
                  </div>
                </button>
              )}

              {/* Airport */}
              {airportAddress && (
                <button
                  onClick={() => handleLocationToggle(airportAddress)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-all flex items-center gap-3 ${
                    selectedLocation === airportAddress
                      ? 'bg-blue-500 text-white'
                      : 'bg-white/5 hover:bg-white/10 text-white/80'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Airport</div>
                    <div className="text-xs opacity-70 truncate">{airportAddress}</div>
                  </div>
                </button>
              )}
            </div>

            {/* Category Buttons */}
            {onNearbyTypeChange && selectedLocation && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: 'restaurant' as const, label: 'Food', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
                  { type: 'cafe' as const, label: 'Coffee', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z M12 6v6m0 0v6m0-6h6m-6 0H6' },
                  { type: 'gas_station' as const, label: 'Gas', icon: 'M19 9l-7 7-7-7 M5 3v11a7 7 0 007 7 7 7 0 007-7V3' },
                  { type: 'bar' as const, label: 'Bars', icon: 'M19 9l-7 7-7-7m7-7V3m0 0a7 7 0 11-7 7 M9 3h6M9 21h6M12 3v18' }
                ].map(({ type, label, icon }) => (
                  <button
                    key={type}
                    onClick={() => onNearbyTypeChange(type)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                      nearbyType === type
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                    </svg>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3">
            {!selectedLocation ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="text-white/50 text-sm">Select a location above to find nearby places</div>
              </div>
            ) : nearbyLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                <div className="text-white/80 text-sm">Finding nearby places...</div>
              </div>
            ) : nearbyPlaces && nearbyPlaces.places && nearbyPlaces.places.length > 0 ? (
              <div className="space-y-2">
                {nearbyPlaces.places.map((place: NearbyPlace, idx: number) => (
                  <div key={idx} className="bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10 hover:border-blue-500/50 transition-all">
                    <div className="flex justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-semibold text-sm mb-1 truncate">{place.name}</div>
                        <div className="text-gray-400 text-xs line-clamp-2">{place.vicinity}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="text-blue-400 font-bold text-xs whitespace-nowrap">{place.distance}</div>
                        {place.rating && (
                          <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-yellow-300 text-xs font-medium">{place.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Google Search Link */}
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(place.name + ' ' + place.vicinity)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Google Search
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg className="w-16 h-16 text-white/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <div className="text-white/70 font-medium mb-2">No places found</div>
                <div className="text-gray-400 text-sm">Try a different category</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating toggle button for mobile (when sidebar is hidden) */}
      {isFullscreenView && !sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="md:hidden absolute top-[max(4.5rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] z-[10000] bg-gradient-to-b from-[#2F5F7F] to-[#1e3a4a] text-white p-3 rounded-lg shadow-2xl hover:scale-110 transition-transform"
          title="Show sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Mobile Exit Fullscreen Button (when sidebar is hidden) */}
      {!forceFullscreen && isFullscreenView && !sidebarVisible && (
        <button
          onClick={toggleFullscreen}
          className="md:hidden absolute top-4 right-4 z-[10000] bg-white text-gray-700 p-3 rounded-lg shadow-2xl hover:scale-110 transition-transform"
          title="Exit fullscreen"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        </button>
      )}

      {/* Map */}
      <div ref={setMapRef} className="w-full h-full" />
    </div>
  )
}

export default memo(FldrMap)
