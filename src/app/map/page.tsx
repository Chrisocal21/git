'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Fldr, FlightSegment } from '@/types/fldr'
import { AirplaneIcon } from '@/components/Icons'

// FlightRoute interface
interface FlightRoute {
  fldrId: string
  fldrTitle: string
  dateStart: string
  segments: FlightSegment[]
  color: string
}

// Dynamic import for map (client-side only)
// @ts-ignore - Module exists but TypeScript has caching issues
const FlightMap = dynamic(() => import('@/components/FlightMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-[calc(100vh-140px)] bg-white/5 rounded-lg flex items-center justify-center">
      <div className="text-white/60">Loading map...</div>
    </div>
  )
})

const ROUTE_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
]

export default function MapPage() {
  const [fldrs, setFldrs] = useState<Fldr[]>([])
  const [routes, setRoutes] = useState<FlightRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)

  useEffect(() => {
    // Load fldrs from cache or API
    const cached = localStorage.getItem('git-fldrs')
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setFldrs(data)
        processRoutes(data)
      } catch (e) {
        console.error('Failed to parse cached fldrs:', e)
      }
    }

    // Fetch fresh data
    fetch('/api/fldrs')
      .then(res => res.json())
      .then(data => {
        setFldrs(data)
        processRoutes(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch fldrs:', err)
        setLoading(false)
      })
  }, [])

  const processRoutes = (fldrsData: Fldr[]) => {
    const flightRoutes: FlightRoute[] = []
    let colorIndex = 0

    fldrsData.forEach(fldr => {
      if (fldr.flight_info && fldr.flight_info.length > 0) {
        const hasValidSegments = fldr.flight_info.some(seg => 
          seg.departure_code && seg.arrival_code
        )
        
        if (hasValidSegments) {
          flightRoutes.push({
            fldrId: fldr.id,
            fldrTitle: fldr.title,
            dateStart: fldr.date_start,
            segments: fldr.flight_info,
            color: ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
          })
          colorIndex++
        }
      }
    })

    // Sort by date
    flightRoutes.sort((a, b) => 
      new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
    )

    setRoutes(flightRoutes)
  }

  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getRouteDescription = (segments: FlightSegment[]) => {
    if (segments.length === 0) return 'No flights'
    if (segments.length === 1) {
      return `${segments[0].departure_code} → ${segments[0].arrival_code}`
    }
    
    const codes = [segments[0].departure_code]
    segments.forEach(seg => {
      if (seg.arrival_code) codes.push(seg.arrival_code)
    })
    return codes.filter(Boolean).join(' → ')
  }

  if (loading) {
    return (
      <div className="p-4 max-w-7xl mx-auto pb-24">
        <h1 className="text-2xl font-bold mb-6">Flight Map</h1>
        <div className="h-[calc(100vh-140px)] bg-white/5 rounded-lg flex items-center justify-center">
          <div className="text-white/60">Loading flights...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-7xl mx-auto pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Flight Map</h1>
          <p className="text-sm text-gray-400 mt-1">
            {routes.length} {routes.length === 1 ? 'trip' : 'trips'} with flights
          </p>
        </div>
        <button
          onClick={() => setSelectedRoute(null)}
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Show All
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2">
          <FlightMap 
            routes={routes}
            selectedRouteId={selectedRoute}
          />
        </div>

        {/* Routes List */}
        <div className="space-y-2 max-h-[calc(100vh-140px)] overflow-y-auto">
          {routes.length === 0 ? (
            <div className="p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-center">
              <p className="text-gray-400 text-sm">No flights found</p>
              <p className="text-xs text-gray-500 mt-1">
                Add flight info to your jobs to see them here
              </p>
            </div>
          ) : (
            routes.map(route => (
              <button
                key={route.fldrId}
                onClick={() => setSelectedRoute(
                  selectedRoute === route.fldrId ? null : route.fldrId
                )}
                className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                  selectedRoute === route.fldrId
                    ? 'bg-[#1a1a1a] border-[#3b82f6]'
                    : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  <div 
                    className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: route.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      {route.fldrTitle}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(route.dateStart)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-300 ml-5">
                  <AirplaneIcon className="w-3 h-3" />
                  <span>{getRouteDescription(route.segments)}</span>
                </div>
                <div className="text-xs text-gray-500 ml-5 mt-1">
                  {route.segments.length} {route.segments.length === 1 ? 'segment' : 'segments'}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
