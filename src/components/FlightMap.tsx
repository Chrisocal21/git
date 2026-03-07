'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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
  'DEN': { coords: [39.8561, -104.6737], city: 'Denver', state: 'CO', name: 'International' },
  'LAX': { coords: [33.9416, -118.4085], city: 'Los Angeles', state: 'CA', name: 'International' },
  'JFK': { coords: [40.6413, -73.7781], city: 'New York', state: 'NY', name: 'JFK' },
  'SFO': { coords: [37.6213, -122.3790], city: 'San Francisco', state: 'CA', name: 'International' },
  
  // Northeast
  'BOS': { coords: [42.3656, -71.0096], city: 'Boston', state: 'MA', name: 'Logan' },
  'EWR': { coords: [40.6895, -74.1745], city: 'Newark', state: 'NJ', name: 'Liberty' },
  'LGA': { coords: [40.7769, -73.8740], city: 'New York', state: 'NY', name: 'LaGuardia' },
  'PHL': { coords: [39.8729, -75.2437], city: 'Philadelphia', state: 'PA', name: 'International' },
  'BWI': { coords: [39.1774, -76.6684], city: 'Baltimore', state: 'MD', name: 'Washington Int.' },
  'IAD': { coords: [38.9531, -77.4565], city: 'Washington', state: 'DC', name: 'Dulles' },
  'DCA': { coords: [38.8521, -77.0377], city: 'Washington', state: 'DC', name: 'Reagan National' },
  'BDL': { coords: [41.9389, -72.6832], city: 'Hartford', state: 'CT', name: 'Bradley' },
  'PVD': { coords: [41.7240, -71.4281], city: 'Providence', state: 'RI', name: 'T.F. Green' },
  'BUF': { coords: [42.9405, -78.7322], city: 'Buffalo', state: 'NY', name: 'Niagara' },
  'ROC': { coords: [43.1189, -77.6724], city: 'Rochester', state: 'NY', name: 'Int. Airport' },
  'SYR': { coords: [43.1112, -76.1063], city: 'Syracuse', state: 'NY', name: 'Hancock Int.' },
  'ALB': { coords: [42.7483, -73.8017], city: 'Albany', state: 'NY', name: 'International' },
  'MHT': { coords: [42.9326, -71.4357], city: 'Manchester', state: 'NH', name: 'Boston Regional' },
  'PIT': { coords: [40.4915, -80.2329], city: 'Pittsburgh', state: 'PA', name: 'International' },
  
  // Southeast
  'MIA': { coords: [25.7959, -80.2870], city: 'Miami', state: 'FL', name: 'International' },
  'FLL': { coords: [26.0726, -80.1528], city: 'Fort Lauderdale', state: 'FL', name: 'Hollywood Int.' },
  'MCO': { coords: [28.4312, -81.3081], city: 'Orlando', state: 'FL', name: 'International' },
  'TPA': { coords: [27.9755, -82.5332], city: 'Tampa', state: 'FL', name: 'International' },
  'RSW': { coords: [26.5362, -81.7552], city: 'Fort Myers', state: 'FL', name: 'Southwest Florida' },
  'PBI': { coords: [26.6832, -80.0956], city: 'West Palm Beach', state: 'FL', name: 'International' },
  'JAX': { coords: [30.4941, -81.6879], city: 'Jacksonville', state: 'FL', name: 'International' },
  'CLT': { coords: [35.2144, -80.9473], city: 'Charlotte', state: 'NC', name: 'Douglas' },
  'RDU': { coords: [35.8801, -78.7880], city: 'Raleigh-Durham', state: 'NC', name: 'Int. Airport' },
  'RIC': { coords: [37.5052, -77.3197], city: 'Richmond', state: 'VA', name: 'International' },
  'GSO': { coords: [36.0978, -79.9373], city: 'Greensboro', state: 'NC', name: 'Piedmont Triad' },
  'SAV': { coords: [32.1276, -81.2021], city: 'Savannah', state: 'GA', name: 'Hilton Head Int.' },
  'CHS': { coords: [32.8986, -80.0405], city: 'Charleston', state: 'SC', name: 'International' },
  'MSY': { coords: [29.9902, -90.2580], city: 'New Orleans', state: 'LA', name: 'Louis Armstrong' },
  'BNA': { coords: [36.1263, -86.6681], city: 'Nashville', state: 'TN', name: 'International' },
  'MEM': { coords: [35.0424, -89.9767], city: 'Memphis', state: 'TN', name: 'International' },
  
  // Midwest
  'MDW': { coords: [41.7868, -87.7522], city: 'Chicago', state: 'IL', name: 'Midway' },
  'DTW': { coords: [42.2162, -83.3554], city: 'Detroit', state: 'MI', name: 'Metro Wayne County' },
  'MSP': { coords: [44.8848, -93.2223], city: 'Minneapolis', state: 'MN', name: 'St. Paul Int.' },
  'STL': { coords: [38.7487, -90.3700], city: 'St. Louis', state: 'MO', name: 'Lambert' },
  'MCI': { coords: [39.2976, -94.7139], city: 'Kansas City', state: 'MO', name: 'International' },
  'CLE': { coords: [41.4117, -81.8498], city: 'Cleveland', state: 'OH', name: 'Hopkins' },
  'CVG': { coords: [39.0488, -84.6678], city: 'Cincinnati', state: 'OH', name: 'Northern Kentucky' },
  'CMH': { coords: [39.9980, -82.8919], city: 'Columbus', state: 'OH', name: 'John Glenn' },
  'IND': { coords: [39.7173, -86.2944], city: 'Indianapolis', state: 'IN', name: 'International' },
  'MKE': { coords: [42.9472, -87.8966], city: 'Milwaukee', state: 'WI', name: 'Mitchell' },
  'ICT': { coords: [37.6499, -97.4331], city: 'Wichita', state: 'KS', name: 'Eisenhower' },
  'OMA': { coords: [41.3032, -95.8941], city: 'Omaha', state: 'NE', name: 'Eppley Airfield' },
  'DSM': { coords: [41.5340, -93.6631], city: 'Des Moines', state: 'IA', name: 'International' },
  'GRR': { coords: [42.8808, -85.5228], city: 'Grand Rapids', state: 'MI', name: 'Gerald R. Ford' },
  
  // Southwest
  'PHX': { coords: [33.4352, -112.0101], city: 'Phoenix', state: 'AZ', name: 'Sky Harbor' },
  'LAS': { coords: [36.0840, -115.1537], city: 'Las Vegas', state: 'NV', name: 'Harry Reid' },
  'TUS': { coords: [32.1161, -110.9411], city: 'Tucson', state: 'AZ', name: 'International' },
  'ABQ': { coords: [35.0402, -106.6092], city: 'Albuquerque', state: 'NM', name: 'Sunport' },
  'ELP': { coords: [31.8072, -106.3777], city: 'El Paso', state: 'TX', name: 'International' },
  
  // Mountain West
  'SLC': { coords: [40.7899, -111.9791], city: 'Salt Lake City', state: 'UT', name: 'International' },
  'BOI': { coords: [43.5644, -116.2228], city: 'Boise', state: 'ID', name: 'Airport' },
  'ANC': { coords: [61.1743, -149.9962], city: 'Anchorage', state: 'AK', name: 'Ted Stevens' },
  'FAI': { coords: [64.8151, -147.8561], city: 'Fairbanks', state: 'AK', name: 'International' },
  'RNO': { coords: [39.4991, -119.7681], city: 'Reno', state: 'NV', name: 'Tahoe Int.' },
  'BIL': { coords: [45.8077, -108.5430], city: 'Billings', state: 'MT', name: 'Logan Int.' },
  'MSO': { coords: [46.9163, -114.0906], city: 'Missoula', state: 'MT', name: 'International' },
  
  // Texas
  'DAL': { coords: [32.8470, -96.8517], city: 'Dallas', state: 'TX', name: 'Love Field' },
  'IAH': { coords: [29.9902, -95.3368], city: 'Houston', state: 'TX', name: 'Bush Int.' },
  'HOU': { coords: [29.6465, -95.2789], city: 'Houston', state: 'TX', name: 'Hobby' },
  'AUS': { coords: [30.1945, -97.6699], city: 'Austin', state: 'TX', name: 'Bergstrom' },
  'SAT': { coords: [29.5337, -98.4698], city: 'San Antonio', state: 'TX', name: 'International' },
  
  // West Coast
  'SNA': { coords: [33.6757, -117.8682], city: 'Santa Ana', state: 'CA', name: 'John Wayne' },
  'ONT': { coords: [34.0560, -117.6012], city: 'Ontario', state: 'CA', name: 'International' },
  'BUR': { coords: [34.2007, -118.3587], city: 'Burbank', state: 'CA', name: 'Hollywood' },
  'SJC': { coords: [37.3626, -121.9290], city: 'San Jose', state: 'CA', name: 'International' },
  'SMF': { coords: [38.6954, -121.5901], city: 'Sacramento', state: 'CA', name: 'International' },
  'OAK': { coords: [37.7126, -122.2197], city: 'Oakland', state: 'CA', name: 'International' },
  'PDX': { coords: [45.5898, -122.5951], city: 'Portland', state: 'OR', name: 'International' },
  'SEA': { coords: [47.4502, -122.3088], city: 'Seattle', state: 'WA', name: 'Tacoma Int.' },
  'SAN': { coords: [32.7338, -117.1933], city: 'San Diego', state: 'CA', name: 'International' },
  
  // Hawaii
  'HNL': { coords: [21.3187, -157.9225], city: 'Honolulu', state: 'HI', name: 'International' },
  'OGG': { coords: [20.8984, -156.4306], city: 'Kahului', state: 'HI', name: 'Maui' },
  'KOA': { coords: [19.7388, -156.0456], city: 'Kona', state: 'HI', name: 'International' },
  'LIH': { coords: [21.9760, -159.3389], city: 'Lihue', state: 'HI', name: 'Kauai' },
}

export interface FlightRoute {
  fldrId: string
  fldrTitle: string
  dateStart: string
  segments: FlightSegment[]
  color: string
}

export interface FlightMapProps {
  routes: FlightRoute[]
  selectedRouteId: string | null
}

export default function FlightMap({ routes, selectedRouteId }: FlightMapProps) {
  const mapRef = useRef<L.Map | null>(null)
  const linesRef = useRef<L.Polyline[]>([])
  const markersRef = useRef<L.CircleMarker[]>([])

  useEffect(() => {
    if (!mapRef.current) {
      // Initialize map
      const map = L.map('flight-map', {
        center: [39.8283, -98.5795], // Center of USA
        zoom: 4,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        className: 'map-tiles',
      }).addTo(map)

      // Add dark mode styling
      const style = document.createElement('style')
      style.textContent = `
        .map-tiles {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-container {
          background: #0a0a0a;
        }
        .leaflet-popup-content-wrapper {
          background: #1a1a1a;
          color: #fff;
          border-radius: 8px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(59, 130, 246, 0.2);
        }
        .leaflet-popup-tip {
          background: #1a1a1a;
        }
        .leaflet-popup-close-button {
          color: #fff !important;
          font-size: 20px !important;
        }
        .airport-tooltip {
          background: rgba(26, 26, 26, 0.95) !important;
          border: 1px solid rgba(59, 130, 246, 0.3) !important;
          border-radius: 6px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
          padding: 4px 8px !important;
        }
        .airport-tooltip::before {
          border-top-color: rgba(26, 26, 26, 0.95) !important;
        }
        .leaflet-tooltip-top::before {
          border-top-color: rgba(26, 26, 26, 0.95) !important;
        }
        .leaflet-tooltip-bottom::before {
          border-bottom-color: rgba(26, 26, 26, 0.95) !important;
        }
        .leaflet-tooltip-left::before {
          border-left-color: rgba(26, 26, 26, 0.95) !important;
        }
        .leaflet-tooltip-right::before {
          border-right-color: rgba(26, 26, 26, 0.95) !important;
        }
        .flight-path {
          transition: all 0.3s ease;
        }
        .flight-path-selected {
          filter: drop-shadow(0 0 6px currentColor);
        }
        @keyframes pulse-marker {
          0%, 100% { r: 6; opacity: 0.85; }
          50% { r: 8; opacity: 1; }
        }
      `
      document.head.appendChild(style)

      mapRef.current = map
    }

    // Clear existing lines and markers
    linesRef.current.forEach(line => line.remove())
    markersRef.current.forEach(marker => marker.remove())
    linesRef.current = []
    markersRef.current = []

    if (!mapRef.current) return

    const map = mapRef.current
    const routesToShow = selectedRouteId 
      ? routes.filter(r => r.fldrId === selectedRouteId)
      : routes

    const bounds: L.LatLngBoundsLiteral = []

    // Count duplicate routes to apply curve offsets
    // Treat reverse routes (A→B and B→A) as the same pair for counting
    const routeCounts = new Map<string, number>()
    const routeInstances = new Map<string, number>()
    
    const getNormalizedRouteKey = (depCode: string, arrCode: string) => {
      // Normalize route key so A→B and B→A count together
      const codes = [depCode, arrCode].sort()
      return `${codes[0]}-${codes[1]}`
    }
    
    routesToShow.forEach(route => {
      route.segments.forEach(segment => {
        const depCode = segment.departure_code
        const arrCode = segment.arrival_code
        if (depCode && arrCode) {
          const normalizedKey = getNormalizedRouteKey(depCode, arrCode)
          routeCounts.set(normalizedKey, (routeCounts.get(normalizedKey) || 0) + 1)
        }
      })
    })

    // Helper function to create curved path for duplicate routes  
    const createCurvedPath = (from: [number, number], to: [number, number], curveOffset: number, fromCode: string, toCode: string): L.LatLngTuple[] => {
      const lat1 = from[0], lng1 = from[1]
      const lat2 = to[0], lng2 = to[1]
      
      // Get coordinates in alphabetical order for consistent perpendicular calculation
      const codes = [fromCode, toCode].sort()
      const [refLat1, refLng1] = fromCode === codes[0] ? [lat1, lng1] : [lat2, lng2]
      const [refLat2, refLng2] = fromCode === codes[0] ? [lat2, lng2] : [lat1, lng1]
      
      // Calculate midpoint
      const midLat = (refLat1 + refLat2) / 2
      const midLng = (refLng1 + refLng2) / 2
      
      // Calculate perpendicular direction (always using alphabetical order)
      const dx = refLng2 - refLng1
      const dy = refLat2 - refLat1
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // Apply curve offset perpendicular to the reference line
      const offsetLat = midLat + (-dx / distance) * curveOffset
      const offsetLng = midLng + (dy / distance) * curveOffset
      
      // Create quadratic bezier curve with control point
      const points: L.LatLngTuple[] = []
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * offsetLat + t * t * lat2
        const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * offsetLng + t * t * lng2
        points.push([lat, lng])
      }
      return points
    }

    // Draw each route
    // First draw all markers, then draw lines on top
    const linesToDraw: Array<{
      pathPoints: L.LatLngTuple[]
      route: typeof routesToShow[0]
      segment: FlightSegment
      depCode: string
      arrCode: string
      totalCount: number
      instanceNum: number
    }> = []

    // Collect line data and draw markers
    routesToShow.forEach(route => {
      route.segments.forEach(segment => {
        const depCode = segment.departure_code
        const arrCode = segment.arrival_code

        if (depCode && arrCode && AIRPORT_INFO[depCode] && AIRPORT_INFO[arrCode]) {
          const from = AIRPORT_INFO[depCode].coords
          const to = AIRPORT_INFO[arrCode].coords
          const depInfo = AIRPORT_INFO[depCode]
          const arrInfo = AIRPORT_INFO[arrCode]

          // Add to bounds
          bounds.push(from as L.LatLngTuple)
          bounds.push(to as L.LatLngTuple)

          // Check if this route has duplicates and calculate curve offset
          const normalizedKey = getNormalizedRouteKey(depCode, arrCode)
          const totalCount = routeCounts.get(normalizedKey) || 1
          const instanceNum = routeInstances.get(normalizedKey) || 0
          routeInstances.set(normalizedKey, instanceNum + 1)
          
          // Calculate curve offset based on instance number
          let curveOffset = 0
          if (totalCount > 1) {
            const maxOffset = Math.min(3.5, totalCount * 1.2)
            const step = (2 * maxOffset) / (totalCount - 1)
            curveOffset = -maxOffset + (instanceNum * step)
          }

          // Create path (straight if no offset, curved if duplicates)
          const pathPoints = curveOffset === 0 
            ? [from, to] 
            : createCurvedPath(from, to, curveOffset, depCode, arrCode)

          // Store line data to draw later (on top of markers)
          linesToDraw.push({
            pathPoints,
            route,
            segment,
            depCode,
            arrCode,
            totalCount,
            instanceNum,
          })

          // Draw markers at airports (lines will be drawn on top after all markers)
          const depMarker = L.circleMarker(from, {
            radius: selectedRouteId === route.fldrId ? 7 : 6,
            fillColor: route.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: selectedRouteId === route.fldrId ? 1 : 0.85,
          }).addTo(map)
          
          // Popup for click (mobile)
          depMarker.bindPopup(`
            <div style="color: #fff; padding: 4px;">
              <div style="font-size: 16px; font-weight: 700; color: ${route.color}; margin-bottom: 2px;">${depCode}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8);">${depInfo.city}, ${depInfo.state}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px;">${depInfo.name}</div>
              <div style="margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.6);">Departure</div>
            </div>
          `)
          
          // Tooltip for hover (desktop)
          depMarker.bindTooltip(`
            <div style="text-align: center;">
              <div style="font-weight: 700; font-size: 13px; color: ${route.color};">${depCode}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.9);">${depInfo.city}, ${depInfo.state}</div>
            </div>
          `, {
            permanent: false,
            direction: 'top',
            className: 'airport-tooltip'
          })
          
          markersRef.current.push(depMarker)

          const arrMarker = L.circleMarker(to, {
            radius: selectedRouteId === route.fldrId ? 7 : 6,
            fillColor: route.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: selectedRouteId === route.fldrId ? 1 : 0.85,
          }).addTo(map)
          
          // Popup for click (mobile)
          arrMarker.bindPopup(`
            <div style="color: #fff; padding: 4px;">
              <div style="font-size: 16px; font-weight: 700; color: ${route.color}; margin-bottom: 2px;">${arrCode}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8);">${arrInfo.city}, ${arrInfo.state}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 2px;">${arrInfo.name}</div>
              <div style="margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.6);">Arrival</div>
            </div>
          `)
          
          // Tooltip for hover (desktop)
          arrMarker.bindTooltip(`
            <div style="text-align: center;">
              <div style="font-weight: 700; font-size: 13px; color: ${route.color};">${arrCode}</div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.9);">${arrInfo.city}, ${arrInfo.state}</div>
            </div>
          `, {
            permanent: false,
            direction: 'top',
            className: 'airport-tooltip'
          })
          
          markersRef.current.push(arrMarker)
        }
      })
    })

    // Now draw all flight lines on top of markers
    linesToDraw.forEach(({ pathPoints, route, segment, depCode, arrCode, totalCount, instanceNum }) => {
      const line = L.polyline(pathPoints, {
        color: route.color,
        weight: selectedRouteId ? 2 : 1.5,
        opacity: 0.8,
        dashArray: segment.segment_type === 'connection' ? '10, 10' : undefined,
        className: 'flight-path',
      }).addTo(map)

      // Add animated effect for selected route
      if (selectedRouteId === route.fldrId) {
        line.setStyle({ 
          weight: 2.5, 
          opacity: 1,
          className: 'flight-path-selected'
        })
      }

      // Add hover effect
      line.on('mouseover', function(this: L.Polyline) {
        this.setStyle({ weight: 3, opacity: 1 })
      })
      line.on('mouseout', function(this: L.Polyline) {
        const isSelected = selectedRouteId === route.fldrId
        this.setStyle({ 
          weight: isSelected ? 2.5 : (selectedRouteId ? 2 : 1.5), 
          opacity: isSelected ? 1 : 0.8
        })
      })

      // Add popup with enhanced styling
      const popupContent = `
        <div style="color: #fff; font-size: 13px; padding: 4px;">
          <div style="font-weight: 600; color: ${route.color}; margin-bottom: 4px;">${route.fldrTitle}</div>
          <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">
            ${depCode} → ${arrCode}
            ${totalCount > 1 ? `<span style="font-size: 11px; color: rgba(255,255,255,0.6); font-weight: 400;"> (${instanceNum + 1} of ${totalCount})</span>` : ''}
          </div>
          <div style="color: rgba(255,255,255,0.7); font-size: 12px;">
            ${segment.airline || 'Unknown airline'}
            ${segment.flight_number ? ` • ${segment.flight_number}` : ''}
          </div>
          ${segment.segment_type && segment.segment_type !== 'other' ? 
            `<div style="margin-top: 6px; display: inline-block; padding: 2px 8px; background: ${route.color}20; color: ${route.color}; border-radius: 4px; font-size: 11px; text-transform: capitalize;">
              ${segment.segment_type.replace('_', ' ')}
            </div>` : ''}
        </div>
      `
      line.bindPopup(popupContent)
      linesRef.current.push(line)
    })

    // Fit map to show all routes with smooth animation
    // Use whenReady to ensure map is fully initialized before fitting bounds
    if (bounds.length > 0) {
      map.whenReady(() => {
        try {
          if (mapRef.current) {
            mapRef.current.fitBounds(bounds, { 
              padding: [80, 80],
              animate: true,
              duration: 1.2,
            })
          }
        } catch (error) {
          // Fallback: just center on first point if fitBounds fails
          console.warn('fitBounds failed, using fallback:', error)
          if (bounds[0]) {
            mapRef.current?.setView(bounds[0] as L.LatLngTuple, 5)
          }
        }
      })
    } else {
      // Default to USA center if no routes
      map.setView([39.8283, -98.5795], 4)
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [routes, selectedRouteId])

  return (
    <div 
      id="flight-map" 
      className="w-full h-full absolute inset-0"
      style={{ background: '#1a1a1a' }}
    />
  )
}
