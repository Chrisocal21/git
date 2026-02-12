'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for missing marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface Location {
  label: string
  address: string
  coordinates?: [number, number]
}

interface FldrMapProps {
  locations: Location[]
}

// Component to auto-fit bounds to show all markers
function AutoFitBounds({ locations }: { locations: Location[] }) {
  const map = useMap()

  useEffect(() => {
    const validLocations = locations.filter(loc => loc.coordinates)
    if (validLocations.length > 0) {
      const bounds = L.latLngBounds(validLocations.map(loc => loc.coordinates!))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 })
    }
  }, [locations, map])

  return null
}

// Geocode address using Nominatim (OpenStreetMap)
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'GIT-App/1.0', // Nominatim requires a user agent
        },
      }
    )
    const data = await response.json()
    if (data && data.length > 0) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)]
    }
    return null
  } catch (error) {
    console.error('Geocoding error:', error)
    return null
  }
}

export default function FldrMap({ locations }: FldrMapProps) {
  const [geocodedLocations, setGeocodedLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function geocodeAll() {
      setLoading(true)
      const results = await Promise.all(
        locations.map(async (loc) => {
          if (!loc.address.trim()) {
            return null // Skip empty addresses
          }
          const coords = await geocodeAddress(loc.address)
          return coords ? { ...loc, coordinates: coords } : null
        })
      )
      setGeocodedLocations(results.filter((loc): loc is Location & { coordinates: [number, number] } => loc !== null))
      setLoading(false)
    }

    if (locations.length > 0) {
      geocodeAll()
    } else {
      setLoading(false)
    }
  }, [locations])

  if (loading) {
    return (
      <div className="h-64 bg-white/5 rounded-lg flex items-center justify-center">
        <div className="text-white/60">Loading map...</div>
      </div>
    )
  }

  if (geocodedLocations.length === 0) {
    return (
      <div className="h-64 bg-white/5 rounded-lg flex items-center justify-center">
        <div className="text-white/60">No valid addresses to display</div>
      </div>
    )
  }

  // Default center (will be overridden by AutoFitBounds)
  const center = geocodedLocations[0].coordinates || [39.8283, -98.5795] // US center

  return (
    <div className="h-96 rounded-lg overflow-hidden border border-white/10">
      <MapContainer
        center={center}
        zoom={10}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geocodedLocations.map((loc, index) => (
          <Marker key={index} position={loc.coordinates!}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{loc.label}</div>
                <div className="text-xs text-gray-600 mt-1">{loc.address}</div>
              </div>
            </Popup>
          </Marker>
        ))}
        <AutoFitBounds locations={geocodedLocations} />
      </MapContainer>
    </div>
  )
}
