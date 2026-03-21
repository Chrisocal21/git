'use client'

import { useEffect, useState, useRef, memo } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'

interface Location {
  label: string
  address: string
  coordinates?: [number, number]
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
  onNearbyTypeChange,
  onSearchLocationChange,
  nearbyPlaces,
  nearbyLoading,
  nearbyType = 'restaurant',
  searchFromAddress
}: FldrMapProps) {
  const [geocodedLocations, setGeocodedLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRefReady, setIsRefReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [gettingCurrentLocation, setGettingCurrentLocation] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])

  // Initialize map
  useEffect(() => {
    async function initMap() {
      const element = mapContainerRef.current
      if (!element || !locations || locations.length === 0) {
        setLoading(false)
        return
      }
      if (googleMapRef.current) return

      setLoading(true)
      setError(null)

      try {
        await googleMapsLoader.load()

        // Geocode addresses
        const results = await Promise.all(
          locations.map(async (loc) => {
            if (!loc.address.trim()) return null
            try {
              const response = await fetch(`/api/timezone?address=${encodeURIComponent(loc.address)}`)
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
            }
            return null
          })
        )

        const validLocations = results.filter((loc): loc is Location & { coordinates: [number, number] } => loc !== null)
        setGeocodedLocations(validLocations)

        if (validLocations.length === 0) {
          setError('No valid addresses to display')
          setLoading(false)
          return
        }

        const bounds = new google.maps.LatLngBounds()
        validLocations.forEach(loc => bounds.extend(new google.maps.LatLng(loc.coordinates[0], loc.coordinates[1])))

        const map = new google.maps.Map(element, {
          center: { lat: validLocations[0].coordinates[0], lng: validLocations[0].coordinates[1] },
          zoom: 12,
          styles: [
            { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
            { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
            { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
            { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
            { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
          ]
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

          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="color: #000; padding: 8px;"><div style="font-weight: 600; margin-bottom: 4px;">${loc.label}</div><div style="font-size: 12px; color: #666;">${loc.address}</div></div>`
          })

          marker.addListener('click', () => infoWindow.open(map, marker))
          markersRef.current.push(marker)
        })

        if (validLocations.length > 1) {
          map.fitBounds(bounds)
        }

        setLoading(false)
      } catch (error) {
        setError(`Failed to load map`)
        setLoading(false)
      }
    }

    if (isRefReady && locations.length > 0) {
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

  const toggleFullscreen = () => {
    const newFullscreenState = !isFullscreen
    setIsFullscreen(newFullscreenState)
    
    // When entering fullscreen, default to venue if available
    if (newFullscreenState && !selectedLocation && venueAddress) {
      setSelectedLocation(venueAddress)
      if (onSearchLocationChange) {
        onSearchLocationChange(venueAddress)
      }
    }
  }

  const handleLocationToggle = (address: string) => {
    setSelectedLocation(address)
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

  // Fullscreen overlay with sidebar
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a1929] flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-96 lg:w-[420px] bg-gradient-to-b from-[#2F5F7F] via-[#2a5570] to-[#1e3a4a] flex flex-col border-r border-white/10 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-white/20 bg-black/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold text-lg">Nearby Places</h2>
              <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
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

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={setMapRef} className="w-full h-full" />
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Regular view
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-[#0a0a0a] rounded-lg flex items-center justify-center z-10">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-[#0a0a0a] rounded-lg flex items-center justify-center z-10">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-[1000] p-3 bg-black/60 hover:bg-black/80 backdrop-blur-xl rounded-xl border border-white/20 transition-all hover:scale-110 shadow-xl"
        title="Open Nearby Places"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <div ref={setMapRef} className="h-64 md:h-96 lg:h-[500px] xl:h-[600px] rounded-lg overflow-hidden border border-white/10" />
    </div>
  )
}

export default memo(FldrMap)
