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
}

interface FldrMapProps {
  locations: Location[]
  venueAddress?: string
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
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, address: string} | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)
  const [isPanelMinimized, setIsPanelMinimized] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const locationPickerRef = useRef<HTMLDivElement | null>(null)

  // Close location picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (locationPickerRef.current && !locationPickerRef.current.contains(event.target as Node)) {
        setShowLocationPicker(false)
      }
    }

    if (showLocationPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showLocationPicker])

  // Auto-expand panel when new results come in or category changes
  useEffect(() => {
    if (nearbyPlaces && nearbyPlaces.places && nearbyPlaces.places.length > 0) {
      setIsPanelMinimized(false)
    }
  }, [nearbyPlaces, nearbyType])

  useEffect(() => {
    async function initMap() {
      const element = mapContainerRef.current
      
      if (!element) {
        console.warn('⚠️ Map element not ready')
        return
      }
      
      if (!locations || locations.length === 0) {
        console.log('⚠️ No locations provided')
        setLoading(false)
        return
      }
      
      // Prevent re-initialization if map already exists
      if (googleMapRef.current) {
        console.log('♻️ Map already initialized, skipping re-init')
        return
      }

      console.log('🗺️ Initializing Google Maps with', locations.length, 'locations')
      
      setLoading(true)
      setError(null)

      try {
        // Load Google Maps
        console.log('📍 Loading Google Maps API...')
        await googleMapsLoader.load()
        console.log('✅ Google Maps API loaded, geocoding addresses via server...')

        // Geocode addresses using our server-side API (more reliable than client-side)
        const results = await Promise.all(
          locations.map(async (loc) => {
            if (!loc.address.trim()) {
              return null
            }
            try {
              console.log('🔍 Geocoding:', loc.label, '-', loc.address)
              
              // Use our server-side geocoding API
              const response = await fetch(`/api/timezone?address=${encodeURIComponent(loc.address)}`)
              
              if (!response.ok) {
                console.warn('⚠️ Geocoding failed for:', loc.label)
                return null
              }
              
              const data = await response.json()
              
              if (data.coordinates?.lat && data.coordinates?.lng) {
                const coordinates: [number, number] = [parseFloat(data.coordinates.lat), parseFloat(data.coordinates.lng)]
                console.log('✅ Geocoded:', loc.label, '→', coordinates)
                return { ...loc, coordinates }
              } else {
                console.warn('❌ No results for:', loc.label, loc.address)
              }
            } catch (e) {
              console.error('❌ Geocoding error for:', loc.address, e)
            }
            return null
          })
        )

        const validLocations = results.filter((loc): loc is Location & { coordinates: [number, number] } => loc !== null)
        setGeocodedLocations(validLocations)
        
        console.log('📍 Valid locations:', validLocations.length)

        if (validLocations.length === 0) {
          console.warn('⚠️ No valid addresses to display on map')
          setError('No valid addresses to display')
          setLoading(false)
          return
        }

        // Calculate center and bounds
        const bounds = new google.maps.LatLngBounds()
        validLocations.forEach(loc => {
          bounds.extend(new google.maps.LatLng(loc.coordinates![0], loc.coordinates![1]))
        })

        // Create map
        const map = new google.maps.Map(element, {
          center: { lat: validLocations[0].coordinates![0], lng: validLocations[0].coordinates![1] },
          zoom: 12,
          styles: [
            {
              "elementType": "geometry",
              "stylers": [{ "color": "#212121" }]
            },
            {
              "elementType": "labels.icon",
              "stylers": [{ "visibility": "off" }]
            },
            {
              "elementType": "labels.text.fill",
              "stylers": [{ "color": "#757575" }]
            },
            {
              "elementType": "labels.text.stroke",
              "stylers": [{ "color": "#212121" }]
            },
            {
              "featureType": "administrative",
              "elementType": "geometry",
              "stylers": [{ "color": "#757575" }]
            },
            {
              "featureType": "poi",
              "elementType": "labels.text.fill",
              "stylers": [{ "color": "#757575" }]
            },
            {
              "featureType": "road",
              "elementType": "geometry.fill",
              "stylers": [{ "color": "#2c2c2c" }]
            },
            {
              "featureType": "road",
              "elementType": "labels.text.fill",
              "stylers": [{ "color": "#8a8a8a" }]
            },
            {
              "featureType": "water",
              "elementType": "geometry",
              "stylers": [{ "color": "#000000" }]
            },
            {
              "featureType": "water",
              "elementType": "labels.text.fill",
              "stylers": [{ "color": "#3d3d3d" }]
            }
          ]
        })

        googleMapRef.current = map

        // Clear old markers
        markersRef.current.forEach(marker => marker.setMap(null))
        markersRef.current = []

        // Add markers
        validLocations.forEach((loc) => {
          const marker = new google.maps.Marker({
            position: { lat: loc.coordinates![0], lng: loc.coordinates![1] },
            map: map,
            title: loc.label,
          })

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="color: #000; padding: 8px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${loc.label}</div>
                <div style="font-size: 12px; color: #666;">${loc.address}</div>
              </div>
            `
          })

          marker.addListener('click', () => {
            infoWindow.open(map, marker)
          })

          markersRef.current.push(marker)
        })

        // Fit bounds if multiple locations
        if (validLocations.length > 1) {
          map.fitBounds(bounds)
        }

        console.log('✅ Google Maps initialized successfully')
        setLoading(false)

      } catch (error) {
        console.error('❌ Map initialization error:', error)
        setError(`Failed to load map: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setLoading(false)
      }
    }

    console.log('🗺️ useEffect triggered - isRefReady:', isRefReady, 'locations:', locations.length)
    
    if (isRefReady && locations.length > 0) {
      locations.forEach((loc, i) => {
        console.log(`  ${i + 1}. ${loc.label}: "${loc.address}"`)
      })
      initMap()
    }

    return () => {
      console.log('🧹 Cleanup - clearing markers')
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []
      googleMapRef.current = null
    }
  }, [locations, isRefReady])

  // Callback ref - triggers state update when element is attached
  const setMapRef = (element: HTMLDivElement | null) => {
    console.log('🎯 Map ref callback:', element ? 'ELEMENT SET' : 'NULL')
    mapContainerRef.current = element
    if (element && !isRefReady) {
      setIsRefReady(true)
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    setGettingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        // Use a simple coordinate string as address
        const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        
        setCurrentLocation({ lat, lng, address })
        if (onSearchLocationChange) {
          onSearchLocationChange(address)
        }
        setGettingLocation(false)
      },
      (error) => {
        console.error('Error getting location:', error)
        alert('Unable to get your location. Please enable location services.')
        setGettingLocation(false)
      }
    )
  }

  const getSearchLocationLabel = () => {
    if (!searchFromAddress) return venueAddress ? 'Venue' : 'Location'
    
    if (currentLocation && searchFromAddress === currentLocation.address) {
      return 'Current Location'
    }
    
    const location = geocodedLocations.find(loc => loc.address === searchFromAddress)
    return location?.label || 'Selected Location'
  }

  // Always render the map container, show loading overlay on top
  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-black/95' : 'relative'}`}>
      {/* Control Panel - Only visible in fullscreen mode */}
      {venueAddress && onNearbyTypeChange && isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex flex-col gap-2 items-center">
          {/* Category Selection */}
          <div className="flex gap-2 sm:gap-3 bg-black/80 backdrop-blur-xl px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl border border-white/20 shadow-2xl">
            <button
              onClick={() => onNearbyTypeChange('restaurant')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                nearbyType === 'restaurant'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105'
              }`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="hidden sm:inline">Food</span>
              </span>
            </button>
            <button
              onClick={() => onNearbyTypeChange('cafe')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                nearbyType === 'cafe'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105'
              }`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span className="hidden sm:inline">Coffee</span>
              </span>
            </button>
            <button
              onClick={() => onNearbyTypeChange('gas_station')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                nearbyType === 'gas_station'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105'
              }`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v11a7 7 0 007 7 7 7 0 007-7V3" />
                </svg>
                <span className="hidden sm:inline">Gas</span>
              </span>
            </button>
            <button
              onClick={() => onNearbyTypeChange('bar')}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                nearbyType === 'bar'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/50 scale-105'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white hover:scale-105'
              }`}
            >
              <span className="flex items-center gap-1.5 sm:gap-2">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7m7-7V3m0 0a7 7 0 11-7 7" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6M9 21h6M12 3v18" />
                </svg>
                <span className="hidden sm:inline">Bars</span>
              </span>
            </button>
          </div>
          
          {/* Location Picker Button */}
          {onSearchLocationChange && (
            <div className="relative" ref={locationPickerRef}>
              <button
                onClick={() => setShowLocationPicker(!showLocationPicker)}
                className="flex items-center gap-2 bg-black/80 backdrop-blur-xl px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-white/20 shadow-xl hover:bg-black/90 transition-all duration-200 group"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-white text-xs sm:text-sm font-medium">
                  Near: <span className="text-blue-400">{getSearchLocationLabel()}</span>
                </span>
                <svg 
                  className={`w-3 h-3 sm:w-4 sm:h-4 text-white/60 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Location Dropdown */}
              {showLocationPicker && (
                <div className="absolute top-full mt-2 left-0 right-0 bg-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl overflow-hidden min-w-[250px] z-[1001]">
                  {/* Current Location */}
                  <button
                    onClick={() => {
                      getCurrentLocation()
                      setShowLocationPicker(false)
                    }}
                    disabled={gettingLocation}
                    className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 border-b border-white/10"
                  >
                    <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <div className="flex-1">
                      <div className="text-white text-sm font-medium">
                        {gettingLocation ? 'Getting location...' : 'Current Location'}
                      </div>
                      {currentLocation && (
                        <div className="text-gray-400 text-xs mt-0.5 truncate">
                          {currentLocation.address}
                        </div>
                      )}
                    </div>
                  </button>
                  
                  {/* Available Addresses */}
                  {geocodedLocations.filter(loc => loc.address.trim()).map((loc, idx, arr) => (
                    <button
                      key={`${loc.label}-${idx}`}
                      onClick={() => {
                        if (onSearchLocationChange) {
                          onSearchLocationChange(loc.address)
                        }
                        setShowLocationPicker(false)
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3 ${
                        idx < arr.length - 1 ? 'border-b border-white/10' : ''
                      } ${searchFromAddress === loc.address ? 'bg-blue-500/20' : ''}`}
                    >
                      {loc.label.includes('Hotel') ? (
                        <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      ) : loc.label.includes('Venue') ? (
                        <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      ) : (loc.label.includes('Airport') || loc.label.includes('Departure') || loc.label.includes('Arrival')) ? (
                        <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium">{loc.label}</div>
                        <div className="text-gray-400 text-xs mt-0.5 truncate">{loc.address}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#0a0a0a] rounded-lg flex flex-col items-center justify-center z-10 p-6 text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border-3 sm:border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3 sm:mb-4"></div>
          <div className="text-white/80 text-sm sm:text-base font-medium mb-2">Loading map...</div>
          {locations.length === 0 && (
            <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg max-w-md">
              <div className="text-blue-400 text-xs sm:text-sm flex items-center gap-2 justify-center">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                </svg>
                <span>Add a hotel or venue address to see the map with nearby restaurants, cafes, bars, and gas stations</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-[#0a0a0a] rounded-lg flex flex-col items-center justify-center p-4 sm:p-6 z-10">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 sm:p-6 max-w-md text-center">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 text-red-400 mx-auto mb-2 sm:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="text-white/90 text-sm sm:text-base font-medium mb-2">{error}</div>
            <div className="text-xs text-gray-400">
              Check the browser console for details
            </div>
          </div>
        </div>
      )}
      
      {/* Fullscreen toggle button - Responsive */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[1000] p-2 sm:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-xl rounded-lg sm:rounded-xl border border-white/20 transition-all duration-200 hover:scale-110 shadow-xl group"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        )}
      </button>
      
      {/* Map container - always rendered so ref can be set */}
      <div 
        ref={setMapRef}
        className={`${
          isFullscreen 
            ? 'absolute inset-0 w-full h-full' 
            : 'h-64 md:h-96 lg:h-[500px] xl:h-[600px]'
        } rounded-lg overflow-hidden ${isFullscreen ? '' : 'border border-white/10'}`}
      />
      
      {/* Nearby Places Results - Only visible in fullscreen mode */}
      {venueAddress && isFullscreen && nearbyPlaces && nearbyPlaces.places && nearbyPlaces.places.length > 0 && (
        <div className={`absolute left-0 right-0 bottom-0 md:left-auto md:top-20 md:right-4 md:bottom-4 md:w-80 z-[1000] bg-black/90 md:bg-black/80 backdrop-blur-xl border-t md:border md:rounded-2xl border-white/20 shadow-2xl overflow-hidden flex flex-col ${
          isPanelMinimized ? 'max-h-16 md:max-h-none' : 'max-h-[50vh] md:max-h-none'
        } transition-all duration-300`}>
          <div className="p-3 md:p-4 border-b md:border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-xs sm:text-sm flex items-center gap-2">
                {nearbyType === 'restaurant' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                ) : nearbyType === 'cafe' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : nearbyType === 'bar' ? (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7m7-7V3m0 0a7 7 0 11-7 7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3h6M9 21h6M12 3v18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v11a7 7 0 007 7 7 7 0 007-7V3" />
                  </svg>
                )}
                <span>Nearby {nearbyType === 'restaurant' ? 'Restaurants' : nearbyType === 'cafe' ? 'Cafes' : nearbyType === 'bar' ? 'Bars' : 'Gas Stations'}</span>
              </h3>
              {/* Minimize/Expand button - only on mobile */}
              <button
                onClick={() => setIsPanelMinimized(!isPanelMinimized)}
                className="md:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label={isPanelMinimized ? "Expand panel" : "Minimize panel"}
              >
                <svg 
                  className={`w-5 h-5 text-white/70 transition-transform duration-300 ${isPanelMinimized ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>
          {!isPanelMinimized && (
            <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 custom-scrollbar">
              {nearbyPlaces.places.slice(0, 10).map((place: NearbyPlace, idx: number) => (
                <div key={idx} className="p-3 md:p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-blue-500/50 transition-all duration-200 cursor-pointer group">
                  <div className="flex items-start justify-between gap-2 md:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs sm:text-sm text-white mb-1 group-hover:text-blue-400 transition-colors truncate">
                        {place.name}
                      </div>
                      <div className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                        {place.vicinity}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="text-blue-400 font-bold text-xs sm:text-sm whitespace-nowrap">
                        {place.distance}
                      </div>
                      {place.rating && (
                        <div className="flex items-center gap-1 bg-yellow-500/20 px-1.5 sm:px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-yellow-300 text-xs font-medium">{place.rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Loading state for nearby - Only visible in fullscreen mode */}
      {venueAddress && isFullscreen && nearbyLoading && (
        <div className="absolute left-0 right-0 bottom-0 md:left-auto md:top-20 md:right-4 md:bottom-4 md:w-80 z-[1000] bg-black/90 md:bg-black/80 backdrop-blur-xl border-t md:border md:rounded-2xl border-white/20 shadow-2xl flex flex-col items-center justify-center p-6 md:p-8 h-40 md:h-auto">
          <div className="w-10 h-10 md:w-12 md:h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-3 md:mb-4"></div>
          <div className="text-white/80 text-xs sm:text-sm font-medium">Finding nearby places...</div>
        </div>
      )}
      
      {/* No results state - Only visible in fullscreen mode */}
      {venueAddress && isFullscreen && nearbyPlaces && nearbyPlaces.places && nearbyPlaces.places.length === 0 && (
        <div className="absolute left-0 right-0 bottom-0 md:left-auto md:top-20 md:right-4 md:bottom-4 md:w-80 z-[1000] bg-black/90 md:bg-black/80 backdrop-blur-xl border-t md:border md:rounded-2xl border-white/20 shadow-2xl flex flex-col items-center justify-center p-6 md:p-8 text-center h-40 md:h-auto">
          <svg className="w-12 h-12 md:w-16 md:h-16 text-white/30 mb-3 md:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <div className="text-white/70 text-sm font-medium mb-2">No places found</div>
          <div className="text-gray-400 text-xs">Try a different category</div>
        </div>
      )}
    </div>
  )
}

export default memo(FldrMap)
