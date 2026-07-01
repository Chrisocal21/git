'use client'

import { useEffect, useRef, useState } from 'react'
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
  'IND': { coords: [39.7173, -86.2944], city: 'Indianapolis', state: 'IN', name: 'International' },
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

export interface FlightGlobeProps {
  routes: FlightRoute[]
  locations: JobLocation[]
  selectedRouteId: string | null
}

export default function FlightGlobe({ routes, locations, selectedRouteId }: FlightGlobeProps) {
  const globeRef = useRef<HTMLDivElement>(null)
  const globeInstance = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globeReady, setGlobeReady] = useState(false)

  // Force console log to appear
  if (typeof window !== 'undefined') {
    window.console.log('[FlightGlobe] Component called - routes:', routes?.length || 0, 'selectedRouteId:', selectedRouteId)
  }

  useEffect(() => {
    window.console.log('[FlightGlobe] Init useEffect triggered - globeRef:', !!globeRef.current)
    
    if (!globeRef.current) return

    console.log('[FlightGlobe] Initializing globe...')

    // Dynamic import to avoid SSR issues
    import('globe.gl').then((GlobeModule) => {
      const Globe = GlobeModule.default

      console.log('[FlightGlobe] Globe.gl loaded, creating instance...')

      try {
        // Initialize globe
        const globe = (Globe as any)()(globeRef.current!)
        
        globe
          .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
          .backgroundColor('#000000')
          .showAtmosphere(true)
          .atmosphereColor('#3a5683')
          .atmosphereAltitude(0.15)
          .width(globeRef.current!.clientWidth)
          .height(globeRef.current!.clientHeight)

        globeInstance.current = globe

        // Set initial camera position (centered on USA)
        globe.pointOfView({ lat: 39.8, lng: -98.5, altitude: 2.5 })

        console.log('[FlightGlobe] Globe initialized successfully')
        setLoading(false)
        setGlobeReady(true)

        // Handle window resize
        const handleResize = () => {
          if (globeRef.current && globeInstance.current) {
            globeInstance.current
              .width(globeRef.current.clientWidth)
              .height(globeRef.current.clientHeight)
          }
        }
        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
          if (globeInstance.current) {
            globeInstance.current._destructor?.()
          }
        }
      } catch (err) {
        console.error('[FlightGlobe] Error initializing globe:', err)
        setError('Failed to initialize globe')
        setLoading(false)
      }
    }).catch(err => {
      console.error('[FlightGlobe] Error loading globe.gl:', err)
      setError('Failed to load globe library')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    window.console.log('[FlightGlobe] Routes useEffect triggered - routes:', routes?.length, 'globeInstance:', !!globeInstance.current)
    
    if (!globeInstance.current) {
      console.log('[FlightGlobe] Cannot update routes - globe not initialized yet')
      return
    }

    if (!routes || routes.length === 0) {
      console.log('[FlightGlobe] No routes data yet, skipping update')
      return
    }

    console.log('[FlightGlobe] Updating routes...', { totalRoutes: routes.length, selectedRouteId })

    // Filter routes if one is selected
    const displayRoutes = selectedRouteId 
      ? routes.filter(r => r.fldrId === selectedRouteId) 
      : routes

    console.log('[FlightGlobe] Display routes count:', displayRoutes.length)

    // Build arcs data for flight routes
    const arcsData: any[] = []
    const pointsData: any[] = []
    const uniqueAirports = new Set<string>()

    displayRoutes.forEach(route => {
      console.log('[FlightGlobe] Processing route:', route.fldrTitle, 'segments:', route.segments.length)
      route.segments.forEach(segment => {
        const depCode = segment.departure_code
        const arrCode = segment.arrival_code

        if (!depCode || !arrCode) {
          console.warn('[FlightGlobe] Missing airport code:', { depCode, arrCode })
          return
        }
        if (!AIRPORT_INFO[depCode]) {
          console.warn('[FlightGlobe] Airport not in database:', depCode)
          return
        }
        if (!AIRPORT_INFO[arrCode]) {
          console.warn('[FlightGlobe] Airport not in database:', arrCode)
          return
        }

        const depInfo = AIRPORT_INFO[depCode]
        const arrInfo = AIRPORT_INFO[arrCode]

        // Add arc
        arcsData.push({
          startLat: depInfo.coords[0],
          startLng: depInfo.coords[1],
          endLat: arrInfo.coords[0],
          endLng: arrInfo.coords[1],
          color: route.color,
          label: `${route.fldrTitle}: ${depCode} → ${arrCode}`
        })

        // Track airports for points
        uniqueAirports.add(depCode)
        uniqueAirports.add(arrCode)
      })
    })

    console.log('[FlightGlobe] Created', arcsData.length, 'arcs and', uniqueAirports.size, 'unique airports')

    // Add airport points
    uniqueAirports.forEach(code => {
      const info = AIRPORT_INFO[code]
      if (info) {
        pointsData.push({
          lat: info.coords[0],
          lng: info.coords[1],
          label: `${code} - ${info.city}, ${info.state}`,
          size: 0.15,
          color: '#E8B44D'
        })
      }
    })

    // Update globe with arcs and points
    try {
      globeInstance.current
        .arcsData(arcsData)
        .arcColor('color')
        .arcDashLength(0.6)
        .arcDashGap(0.2)
        .arcDashAnimateTime(5000)
        .arcStroke(0.15)
        .arcAltitudeAutoScale(0.3)
        .arcLabel('label')
        .pointsData(pointsData)
        .pointColor('color')
        .pointAltitude(0)
        .pointRadius('size')
        .pointResolution(8)
        .pointLabel('label')
      
      console.log('[FlightGlobe] Globe updated successfully')
    } catch (err) {
      console.error('[FlightGlobe] Error updating globe:', err)
    }

  }, [routes, selectedRouteId, globeReady])

  return (
    <div className="relative w-full h-full">
      <div ref={globeRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-white/60">Loading globe...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-red-400">{error}</div>
        </div>
      )}
    </div>
  )
}
