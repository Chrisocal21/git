'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { FlightSegment } from '@/types/fldr'

// Airport coordinates database
const AIRPORT_COORDS: Record<string, [number, number]> = {
  'LAX': [33.9416, -118.4085],
  'JFK': [40.6413, -73.7781],
  'ORD': [41.9742, -87.9073],
  'SFO': [37.6213, -122.3790],
  'ATL': [33.6407, -84.4277],
  'DFW': [32.8998, -97.0403],
  'DEN': [39.8561, -104.6737],
  'LAS': [36.0840, -115.1537],
  'MCO': [28.4312, -81.3081],
  'PHX': [33.4352, -112.0101],
  'SEA': [47.4502, -122.3088],
  'MIA': [25.7959, -80.2870],
  'BOS': [42.3656, -71.0096],
  'MSP': [44.8848, -93.2223],
  'DTW': [42.2162, -83.3554],
  'EWR': [40.6895, -74.1745],
  'PHL': [39.8729, -75.2437],
  'LGA': [40.7769, -73.8740],
  'SAN': [32.7338, -117.1933],
  'IAD': [38.9531, -77.4565],
  'BWI': [39.1774, -76.6684],
  'AUS': [30.1945, -97.6699],
  'PDX': [45.5898, -122.5951],
  'SLC': [40.7899, -111.9791],
  'MSY': [29.9902, -90.2580],
  'RDU': [35.8801, -78.7880],
  'CLT': [35.2144, -80.9473],
  'TPA': [27.9755, -82.5332],
  'BNA': [36.1263, -86.6681],
  'HOU': [29.6465, -95.2789],
  'OAK': [37.7126, -122.2197],
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
      }).addTo(map)

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

    // Draw each route
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

          // Draw line
          const line = L.polyline([from, to], {
            color: route.color,
            weight: 3,
            opacity: selectedRouteId ? 0.9 : 0.6,
            dashArray: segment.segment_type === 'connection' ? '10, 10' : undefined,
          }).addTo(map)

          // Add hover effect
          line.on('mouseover', function(this: L.Polyline) {
            this.setStyle({ weight: 5, opacity: 1 })
          })
          line.on('mouseout', function(this: L.Polyline) {
            this.setStyle({ weight: 3, opacity: selectedRouteId ? 0.9 : 0.6 })
          })

          // Add popup
          const popupContent = `
            <div style="color: #000; font-size: 12px;">
              <strong>${route.fldrTitle}</strong><br/>
              ${depCode} → ${arrCode}<br/>
              ${segment.airline || 'Unknown airline'}
              ${segment.flight_number ? ` • ${segment.flight_number}` : ''}
            </div>
          `
          line.bindPopup(popupContent)

          linesRef.current.push(line)

          // Add markers at airports
          const depMarker = L.circleMarker(from, {
            radius: 5,
            fillColor: route.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          }).addTo(map)
          depMarker.bindPopup(`<div style="color: #000;"><strong>${depCode}</strong><br/>${segment.departure_airport || 'Unknown'}</div>`)
          markersRef.current.push(depMarker)

          const arrMarker = L.circleMarker(to, {
            radius: 5,
            fillColor: route.color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
          }).addTo(map)
          arrMarker.bindPopup(`<div style="color: #000;"><strong>${arrCode}</strong><br/>${segment.arrival_airport || 'Unknown'}</div>`)
          markersRef.current.push(arrMarker)
        }
      })
    })

    // Fit map to show all routes
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] })
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
      className="h-[calc(100vh-140px)] rounded-lg overflow-hidden border border-[#2a2a2a]"
      style={{ background: '#1a1a1a' }}
    />
  )
}
