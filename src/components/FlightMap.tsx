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
  'FLL': [26.0726, -80.1528],
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
            weight: selectedRouteId ? 4 : 3,
            opacity: selectedRouteId ? 1 : 0.7,
            dashArray: segment.segment_type === 'connection' ? '10, 10' : undefined,
            className: 'flight-path',
          }).addTo(map)

          // Add animated effect for selected route
          if (selectedRouteId === route.fldrId) {
            line.setStyle({ 
              weight: 5, 
              opacity: 1,
              className: 'flight-path-selected'
            })
          }

          // Add hover effect
          line.on('mouseover', function(this: L.Polyline) {
            this.setStyle({ weight: 6, opacity: 1 })
          })
          line.on('mouseout', function(this: L.Polyline) {
            const isSelected = selectedRouteId === route.fldrId
            this.setStyle({ 
              weight: isSelected ? 5 : (selectedRouteId ? 4 : 3), 
              opacity: isSelected ? 1 : (selectedRouteId ? 1 : 0.7)
            })
          })

          // Add popup with enhanced styling
          const popupContent = `
            <div style="color: #fff; font-size: 13px; padding: 4px;">
              <div style="font-weight: 600; color: ${route.color}; margin-bottom: 4px;">${route.fldrTitle}</div>
              <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">
                ${depCode} → ${arrCode}
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

          // Add enhanced markers at airports
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

    // Fit map to show all routes with smooth animation
    if (bounds.length > 0) {
      map.fitBounds(bounds, { 
        padding: [80, 80],
        animate: true,
        duration: 1.2,
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
