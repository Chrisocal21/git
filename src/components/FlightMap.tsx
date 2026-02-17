'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FlightSegment } from '@/types/fldr'

// Airport coordinates database - Major US Airports
const AIRPORT_COORDS: Record<string, [number, number]> = {
  // Major Hubs
  'ATL': [33.6407, -84.4277],   // Atlanta Hartsfield-Jackson
  'ORD': [41.9742, -87.9073],   // Chicago O'Hare
  'DFW': [32.8998, -97.0403],   // Dallas/Fort Worth
  'DEN': [39.8561, -104.6737],  // Denver International
  'LAX': [33.9416, -118.4085],  // Los Angeles International
  'JFK': [40.6413, -73.7781],   // New York JFK
  'SFO': [37.6213, -122.3790],  // San Francisco International
  
  // Northeast
  'BOS': [42.3656, -71.0096],   // Boston Logan
  'EWR': [40.6895, -74.1745],   // Newark Liberty
  'LGA': [40.7769, -73.8740],   // New York LaGuardia
  'PHL': [39.8729, -75.2437],   // Philadelphia International
  'BWI': [39.1774, -76.6684],   // Baltimore/Washington
  'IAD': [38.9531, -77.4565],   // Washington Dulles
  'DCA': [38.8521, -77.0377],   // Washington Reagan National
  'BDL': [41.9389, -72.6832],   // Hartford Bradley
  'PVD': [41.7240, -71.4281],   // Providence
  'BUF': [42.9405, -78.7322],   // Buffalo Niagara
  'ROC': [43.1189, -77.6724],   // Rochester
  'SYR': [43.1112, -76.1063],   // Syracuse
  'ALB': [42.7483, -73.8017],   // Albany International
  'MHT': [42.9326, -71.4357],   // Manchester-Boston Regional
  'PIT': [40.4915, -80.2329],   // Pittsburgh International
  
  // Southeast
  'MIA': [25.7959, -80.2870],   // Miami International
  'FLL': [26.0726, -80.1528],   // Fort Lauderdale-Hollywood
  'MCO': [28.4312, -81.3081],   // Orlando International
  'TPA': [27.9755, -82.5332],   // Tampa International
  'RSW': [26.5362, -81.7552],   // Southwest Florida (Fort Myers)
  'PBI': [26.6832, -80.0956],   // Palm Beach International
  'JAX': [30.4941, -81.6879],   // Jacksonville International
  'CLT': [35.2144, -80.9473],   // Charlotte Douglas
  'RDU': [35.8801, -78.7880],   // Raleigh-Durham
  'RIC': [37.5052, -77.3197],   // Richmond International
  'GSO': [36.0978, -79.9373],   // Greensboro Piedmont Triad
  'SAV': [32.1276, -81.2021],   // Savannah/Hilton Head
  'CHS': [32.8986, -80.0405],   // Charleston International
  'MSY': [29.9902, -90.2580],   // New Orleans Louis Armstrong
  'BNA': [36.1263, -86.6681],   // Nashville International
  'MEM': [35.0424, -89.9767],   // Memphis International
  
  // Midwest
  'MDW': [41.7868, -87.7522],   // Chicago Midway
  'DTW': [42.2162, -83.3554],   // Detroit Metro Wayne County
  'MSP': [44.8848, -93.2223],   // Minneapolis-St. Paul
  'STL': [38.7487, -90.3700],   // St. Louis Lambert
  'MCI': [39.2976, -94.7139],   // Kansas City International
  'CLE': [41.4117, -81.8498],   // Cleveland Hopkins
  'CVG': [39.0488, -84.6678],   // Cincinnati/Northern Kentucky
  'CMH': [39.9980, -82.8919],   // Columbus John Glenn
  'IND': [39.7173, -86.2944],   // Indianapolis International
  'MKE': [42.9472, -87.8966],   // Milwaukee Mitchell
  'ICT': [37.6499, -97.4331],   // Wichita Eisenhower
  'OMA': [41.3032, -95.8941],   // Omaha Eppley Airfield
  'DSM': [41.5340, -93.6631],   // Des Moines International
  'GRR': [42.8808, -85.5228],   // Grand Rapids Gerald R. Ford
  
  // Southwest
  'PHX': [33.4352, -112.0101],  // Phoenix Sky Harbor
  'LAS': [36.0840, -115.1537],  // Las Vegas McCarran
  'TUS': [32.1161, -110.9411],  // Tucson International
  'ABQ': [35.0402, -106.6092],  // Albuquerque International Sunport
  'ELP': [31.8072, -106.3777],  // El Paso International
  
  // Mountain West
  'SLC': [40.7899, -111.9791],  // Salt Lake City International
  'BOI': [43.5644, -116.2228],  // Boise Airport
  'ANC': [61.1743, -149.9962],  // Anchorage Ted Stevens
  'FAI': [64.8151, -147.8561],  // Fairbanks International
  'RNO': [39.4991, -119.7681],  // Reno-Tahoe International
  'BIL': [45.8077, -108.5430],  // Billings Logan International
  'MSO': [46.9163, -114.0906],  // Missoula International
  
  // Texas
  'DAL': [32.8470, -96.8517],   // Dallas Love Field
  'IAH': [29.9902, -95.3368],   // Houston George Bush Intercontinental
  'HOU': [29.6465, -95.2789],   // Houston Hobby
  'AUS': [30.1945, -97.6699],   // Austin-Bergstrom
  'SAT': [29.5337, -98.4698],   // San Antonio International
  
  // West Coast (additional regional airports)
  'SNA': [33.6757, -117.8682],  // John Wayne Airport (Orange County)
  'ONT': [34.0560, -117.6012],  // Ontario International
  'BUR': [34.2007, -118.3587],  // Hollywood Burbank
  'SJC': [37.3626, -121.9290],  // San Jose International
  'SMF': [38.6954, -121.5901],  // Sacramento International
  'OAK': [37.7126, -122.2197],  // Oakland International
  'PDX': [45.5898, -122.5951],  // Portland International
  'SEA': [47.4502, -122.3088],  // Seattle-Tacoma International
  'SAN': [32.7338, -117.1933],  // San Diego International
  
  // Hawaii
  'HNL': [21.3187, -157.9225],  // Honolulu International
  'OGG': [20.8984, -156.4306],  // Kahului (Maui)
  'KOA': [19.7388, -156.0456],  // Kona International
  'LIH': [21.9760, -159.3389],  // Lihue (Kauai)
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

        if (depCode && arrCode && AIRPORT_COORDS[depCode] && AIRPORT_COORDS[arrCode]) {
          const from = AIRPORT_COORDS[depCode]
          const to = AIRPORT_COORDS[arrCode]

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
          depMarker.bindPopup(`
            <div style="color: #fff; padding: 4px;">
              <div style="font-size: 16px; font-weight: 700; color: ${route.color}; margin-bottom: 2px;">${depCode}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8);">${segment.departure_airport || 'Unknown'}</div>
              <div style="margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.6);">Departure</div>
            </div>
          `)
          markersRef.current.push(depMarker)

          const arrMarker = L.circleMarker(to, {
            radius: selectedRouteId === route.fldrId ? 7 : 6,
            fillColor: route.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: selectedRouteId === route.fldrId ? 1 : 0.85,
          }).addTo(map)
          arrMarker.bindPopup(`
            <div style="color: #fff; padding: 4px;">
              <div style="font-size: 16px; font-weight: 700; color: ${route.color}; margin-bottom: 2px;">${arrCode}</div>
              <div style="font-size: 12px; color: rgba(255,255,255,0.8);">${segment.arrival_airport || 'Unknown'}</div>
              <div style="margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.6);">Arrival</div>
            </div>
          `)
          markersRef.current.push(arrMarker)
        }
      })
    })

    // Now draw all flight lines on top of markers
    linesToDraw.forEach(({ pathPoints, route, segment, depCode, arrCode, totalCount, instanceNum }) => {
      const line = L.polyline(pathPoints, {
        color: route.color,
        weight: selectedRouteId ? 3 : 2,
        opacity: 0.9,
        dashArray: segment.segment_type === 'connection' ? '10, 10' : undefined,
        className: 'flight-path',
      }).addTo(map)

      // Add animated effect for selected route
      if (selectedRouteId === route.fldrId) {
        line.setStyle({ 
          weight: 3, 
          opacity: 1,
          className: 'flight-path-selected'
        })
      }

      // Add hover effect
      line.on('mouseover', function(this: L.Polyline) {
        this.setStyle({ weight: 4, opacity: 1 })
      })
      line.on('mouseout', function(this: L.Polyline) {
        const isSelected = selectedRouteId === route.fldrId
        this.setStyle({ 
          weight: isSelected ? 3 : (selectedRouteId ? 3 : 2), 
          opacity: isSelected ? 1 : 0.9
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
