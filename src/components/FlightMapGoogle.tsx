'use client'

import { useEffect, useRef, useState } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'
import { FlightSegment } from '@/types/fldr'

// Airport coordinates and location database - Major US Airports
interface AirportInfo {
  coords: [number, number]
  city: string
  state: string
  name: string
}

const AIRPORT_INFO: Record<string, AirportInfo> = {
  // Major Hubs
  'ATL': { coords: [33.6407, -84.4277], city: 'Atlanta', state: 'GA', name: 'Hartsfield-Jackson' },
  'ORD': { coords: [41.9742, -87.9073], city: 'Chicago', state: 'IL', name: "O'Hare" },
  'DFW': { coords: [32.8998, -97.0403], city: 'Dallas', state: 'TX', name: 'Dallas/Fort Worth' },
  'DAL': { coords: [32.8471, -96.8518], city: 'Dallas', state: 'TX', name: 'Love Field' },
  'DEN': { coords: [39.8561, -104.6737], city: 'Denver', state: 'CO', name: 'International' },
  'LAX': { coords: [33.9416, -118.4085], city: 'Los Angeles', state: 'CA', name: 'International' },
  'JFK': { coords: [40.6413, -73.7781], city: 'New York', state: 'NY', name: 'JFK' },
  'SFO': { coords: [37.6213, -122.3790], city: 'San Francisco', state: 'CA', name: 'International' },
  'BOS': { coords: [42.3656, -71.0096], city: 'Boston', state: 'MA', name: 'Logan' },
  'MIA': { coords: [25.7959, -80.2870], city: 'Miami', state: 'FL', name: 'International' },
  'MCO': { coords: [28.4312, -81.3081], city: 'Orlando', state: 'FL', name: 'International' },
  'PHX': { coords: [33.4352, -112.0101], city: 'Phoenix', state: 'AZ', name: 'Sky Harbor' },
  'LAS': { coords: [36.0840, -115.1537], city: 'Las Vegas', state: 'NV', name: 'Harry Reid' },
  'SEA': { coords: [47.4502, -122.3088], city: 'Seattle', state: 'WA', name: 'Tacoma Int.' },
  'SAN': { coords: [32.7338, -117.1933], city: 'San Diego', state: 'CA', name: 'International' },
  'IAH': { coords: [29.9902, -95.3368], city: 'Houston', state: 'TX', name: 'Bush Int.' },
  'HOU': { coords: [29.6454, -95.2789], city: 'Houston', state: 'TX', name: 'Hobby' },
  'CLT': { coords: [35.2144, -80.9473], city: 'Charlotte', state: 'NC', name: 'Douglas' },
  'EWR': { coords: [40.6895, -74.1745], city: 'Newark', state: 'NJ', name: 'Liberty' },
  'MSP': { coords: [44.8848, -93.2223], city: 'Minneapolis', state: 'MN', name: 'St. Paul Int.' },
  'DTW': { coords: [42.2162, -83.3554], city: 'Detroit', state: 'MI', name: 'Metro Wayne County' },
  'PHL': { coords: [39.8729, -75.2437], city: 'Philadelphia', state: 'PA', name: 'International' },
  'BNA': { coords: [36.1263, -86.6681], city: 'Nashville', state: 'TN', name: 'International' },
  'AUS': { coords: [30.1945, -97.6699], city: 'Austin', state: 'TX', name: 'Bergstrom' },
  'BWI': { coords: [39.1774, -76.6684], city: 'Baltimore', state: 'MD', name: 'Washington Int.' },
  'IAD': { coords: [38.9531, -77.4565], city: 'Washington', state: 'DC', name: 'Dulles' },
  'DCA': { coords: [38.8521, -77.0377], city: 'Washington', state: 'DC', name: 'Reagan National' },
  'RDU': { coords: [35.8801, -78.7880], city: 'Raleigh-Durham', state: 'NC', name: 'Int. Airport' },
  'SLC': { coords: [40.7899, -111.9791], city: 'Salt Lake City', state: 'UT', name: 'International' },
  'PDX': { coords: [45.5898, -122.5951], city: 'Portland', state: 'OR', name: 'International' },
  'TPA': { coords: [27.9755, -82.5332], city: 'Tampa', state: 'FL', name: 'International' },
  'STL': { coords: [38.7487, -90.3700], city: 'St. Louis', state: 'MO', name: 'Lambert' },
  'MSY': { coords: [29.9902, -90.2580], city: 'New Orleans', state: 'LA', name: 'Louis Armstrong' },
  'FLL': { coords: [26.0726, -80.1528], city: 'Fort Lauderdale', state: 'FL', name: 'Hollywood Int.' },
  'SJC': { coords: [37.3626, -121.9290], city: 'San Jose', state: 'CA', name: 'International'  },
  'OAK': { coords: [37.7126, -122.2197], city: 'Oakland', state: 'CA', name: 'International' },
  'HNL': { coords: [21.3187, -157.9225], city: 'Honolulu', state: 'HI', name: 'International' },
  'MCI': { coords: [39.2976, -94.7139], city: 'Kansas City', state: 'MO', name: 'International' },
  'SMF': { coords: [38.6954, -121.5908], city: 'Sacramento', state: 'CA', name: 'International' },
  'JAX': { coords: [30.4941, -81.6879], city: 'Jacksonville', state: 'FL', name: 'International' },
}

export interface FlightRoute {
  fldrId: string
  fldrTitle: string
  dateStart: string
  segments: FlightSegment[]
  color: string
}

export interface JobLocation {
  fldrId: string
  fldrTitle: string
  dateStart: string
  location: string
  address: string | null
  color: string
}

export interface FlightMapProps {
  routes: FlightRoute[]
  locations: JobLocation[]
  selectedRouteId: string | null
}

export default function FlightMapGoogle({ routes, locations, selectedRouteId }: FlightMapProps) {
  console.log('[FlightMapGoogle] Component render - Props received:', {
    routesCount: routes.length,
    locationsCount: locations.length,
    selectedRouteId
  })
  
  const mapRef = useRef<google.maps.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const polylinesRef = useRef<any[]>([])
  const markersRef = useRef<google.maps.Marker[]>([])
  const locationMarkersRef = useRef<google.maps.Marker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const drawRoutes = () => {
    if (!mapRef.current) {
      console.log('[FlightMap] Cannot draw routes - map not initialized')
      return
    }

    console.log('[FlightMap] ====== DRAW ROUTES CALLED ======')
    console.log('[FlightMap] Drawing routes:', routes.length, 'routes')
    console.log('[FlightMap] Routes array:', routes.map(r => `${r.fldrTitle} (${r.segments.length} segments)`).join(', '))

    // Clear existing polylines, markers, and location markers
    polylinesRef.current.forEach(line => line.setMap(null))
    markersRef.current.forEach(marker => marker.setMap(null))
    locationMarkersRef.current.forEach(marker => marker.setMap(null))
    polylinesRef.current = []
    markersRef.current = []
    locationMarkersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    const airportLocations = new Map<string, { lat: number, lng: number, color: string }>()

    // Filter routes if one is selected
    const displayRoutes = selectedRouteId 
      ? routes.filter(r => r.fldrId === selectedRouteId) 
      : routes

    console.log('\n🗺️  DRAWING MAP')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Drawing ${displayRoutes.length} routes on map:`)

    displayRoutes.forEach(route => {
      console.log(`\n📍 "${route.fldrTitle}"`)
      route.segments.forEach((segment, idx) => {
        const type = segment.segment_type || 'unknown'
        console.log(`   ${idx+1}. ${segment.departure_code} → ${segment.arrival_code} [${type}]`)
        const depCode = segment.departure_code
        const arrCode = segment.arrival_code

        // Check for missing airport codes
        if (!depCode || !arrCode) {
          console.warn(`      ⚠️  Missing airport code - dep: ${depCode}, arr: ${arrCode}`)
          return
        }
        
        if (!AIRPORT_INFO[depCode]) {
          console.warn(`      ⚠️  Airport ${depCode} not in database - cannot draw route`)
          return
        }
        
        if (!AIRPORT_INFO[arrCode]) {
          console.warn(`      ⚠️  Airport ${arrCode} not in database - cannot draw route`)
          return
        }

        if (depCode && arrCode && AIRPORT_INFO[depCode] && AIRPORT_INFO[arrCode]) {
          const depCoords = AIRPORT_INFO[depCode].coords
          const arrCoords = AIRPORT_INFO[arrCode].coords

          const path = [
            { lat: depCoords[0], lng: depCoords[1] },
            { lat: arrCoords[0], lng: arrCoords[1] }
          ]

          // Create polyline using path array (using any to handle missing type definitions)
          const polylineOptions = {
            path,
            geodesic: true,
            strokeColor: route.color,
            strokeOpacity: selectedRouteId ? 0.9 : 0.6,
            strokeWeight: selectedRouteId ? 3 : 2,
            map: mapRef.current
          }
          
          const polyline = new (google.maps as any).Polyline(polylineOptions)

          polylinesRef.current.push(polyline)

          // Store airport locations
          airportLocations.set(depCode, { ...path[0], color: route.color })
          airportLocations.set(arrCode, { ...path[1], color: route.color })

          // Extend bounds with LatLng objects
          bounds.extend(new google.maps.LatLng(path[0].lat, path[0].lng))
          bounds.extend(new google.maps.LatLng(path[1].lat, path[1].lng))
        }
      })
    })

    // Add airport markers
    airportLocations.forEach((location, code) => {
      const marker = new google.maps.Marker({
        position: location,
        map: mapRef.current!,
        title: `${code} - ${AIRPORT_INFO[code]?.city || code}`,
        icon: {
          path: (google.maps as any).SymbolPath.CIRCLE,
          scale: 6,
          fillColor: location.color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      })

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style=\"color: #fff; background: #1a1a1a; padding: 8px; border-radius: 4px;\">
            <div style=\"font-weight: 600; font-size: 14px;\">${code}</div>
            <div style=\"font-size: 12px; color: #aaa;\">${AIRPORT_INFO[code]?.name}</div>
            <div style=\"font-size: 11px; color: #888;\">${AIRPORT_INFO[code]?.city}, ${AIRPORT_INFO[code]?.state}</div>
          </div>
        `
      })

      marker.addListener('click', () => {
        if (mapRef.current) {
          infoWindow.open(mapRef.current, marker)
        }
      })

      markersRef.current.push(marker)
    })

    // Fit bounds if we have airports
    if (airportLocations.size > 0 && mapRef.current) {
      mapRef.current.fitBounds(bounds)
      console.log(`\n✓ Map rendered: ${airportLocations.size} airports shown`)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
      return bounds
    }
    
    console.log('\n⚠️  No valid airports to display')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return undefined
  }

  const drawLocationMarkers = (bounds?: google.maps.LatLngBounds) => {
    if (!mapRef.current) {
      console.log('[FlightMap] Cannot draw locations - map not initialized')
      return
    }

    console.log('[FlightMap] Drawing location markers:', locations.length, 'locations')

    // Clear existing location markers
    locationMarkersRef.current.forEach(marker => marker.setMap(null))
    locationMarkersRef.current = []
    
    // Create bounds if not provided
    const mapBounds = bounds || new google.maps.LatLngBounds()

    // Geocode and add markers for each location
    const geocoder = new google.maps.Geocoder()
    
    for (const jobLocation of locations) {
      try {
        const address = jobLocation.address || jobLocation.location
        if (!address) continue

        // Use callback-based geocode API
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results && results[0]) {
            const position = results[0].geometry.location
            
            const marker = new google.maps.Marker({
              position,
              map: mapRef.current!,
              title: jobLocation.fldrTitle,
              icon: {
                path: (google.maps as any).SymbolPath.CIRCLE,
                scale: 10,
                fillColor: jobLocation.color,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 3
              }
            })

            const infoWindow = new google.maps.InfoWindow({
              content: `
                <div style="color: #fff; background: #1a1a1a; padding: 8px; border-radius: 4px;">
                  <div style="font-weight: 600; font-size: 14px;">${jobLocation.fldrTitle}</div>
                  <div style="font-size: 12px; color: #aaa;">${address}</div>
                  <div style="font-size: 11px; color: #888;">${new Date(jobLocation.dateStart).toLocaleDateString()}</div>
                </div>
              `
            })

            marker.addListener('click', () => {
              if (mapRef.current) {
                infoWindow.open(mapRef.current, marker)
              }
            })

            locationMarkersRef.current.push(marker)
            
            // Extend bounds to include this location
            mapBounds.extend(position)
            
            // Fit bounds after adding all markers
            if (mapRef.current && locationMarkersRef.current.length === locations.length) {
              mapRef.current.fitBounds(mapBounds)
              console.log('[FlightMap] Map bounds updated to include', locationMarkersRef.current.length, 'location markers')
            }
          } else {
            console.warn(`[FlightMap] Geocoding failed for ${jobLocation.fldrTitle}:`, status)
          }
        })
      } catch (error) {
        console.warn(`[FlightMap] Failed to geocode location for ${jobLocation.fldrTitle}:`, error)
      }
    }
  }

  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 10
    
    async function initMap() {
      // Wait for container to be ready
      if (!mapContainerRef.current) {
        if (retryCount < maxRetries && mounted) {
          retryCount++
          console.log(`[FlightMap] Container not ready, retry ${retryCount}/${maxRetries}`)
          setTimeout(initMap, 100)
        } else {
          console.error('[FlightMap] Container ref never became ready')
          setError('Map container failed to initialize')
          setLoading(false)
        }
        return
      }
      
      if (!mounted) return
      
      try {
        console.log('[FlightMap] Initializing Google Maps...')
        await googleMapsLoader.load()
        
        if (!mounted || !mapContainerRef.current) return
        
        // Verify google.maps.Map is available
        if (!window.google?.maps?.Map) {
          throw new Error('Google Maps API loaded but Map constructor not available')
        }
        
        console.log('[FlightMap] Google Maps loaded, creating map')
        
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: 39.8283, lng: -98.5795 }, // Center of USA
          zoom: 4,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#212121' }] },
            { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
            { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
            { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
          ]
        })

        console.log('[FlightMap] Map created successfully')
        mapRef.current = map
        setLoading(false)
        
        // Draw routes and locations after map is ready
        setTimeout(() => {
          if (mounted) {
            const bounds = drawRoutes()
            if (locations.length > 0) {
              drawLocationMarkers(bounds)
            }
          }
        }, 150)
      } catch (error) {
        console.error('[FlightMap] Failed to load map:', error)
        if (mounted) {
          setError(error instanceof Error ? error.message : 'Failed to load map')
          setLoading(false)
        }
      }
    }

    // Start initialization with a small delay to ensure DOM is ready
    setTimeout(initMap, 50)
    
    return () => {
      mounted = false
      console.log('[FlightMap] Cleaning up')
      polylinesRef.current.forEach(line => line.setMap(null))
      markersRef.current.forEach(marker => marker.setMap(null))
      locationMarkersRef.current.forEach(marker => marker.setMap(null))
    }
  }, [])

  useEffect(() => {
    console.log('[FlightMap] Routes/locations changed - useEffect triggered')
    console.log('  - mapRef.current:', !!mapRef.current)
    console.log('  - loading:', loading)
    console.log('  - routes.length:', routes.length)
    console.log('  - locations.length:', locations.length)
    
    if (mapRef.current && !loading) {
      console.log('[FlightMap] Routes/locations or selection changed, redrawing')
      const bounds = drawRoutes()
      if (locations.length > 0) {
        drawLocationMarkers(bounds)
      }
    } else {
      console.log('[FlightMap] Skipping redraw - map not ready or still loading')
    }
  }, [routes, locations, selectedRouteId, loading])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Map container - always rendered so ref is available */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {/* Loading overlay */}
      {loading && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: '#0a0a0a',
          zIndex: 1000
        }}>
          <div style={{ color: '#666' }}>Loading map...</div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          background: '#0a0a0a',
          zIndex: 1000
        }}>
          <div style={{ color: '#ff6b6b' }}>Error: {error}</div>
        </div>
      )}
    </div>
  )
}
