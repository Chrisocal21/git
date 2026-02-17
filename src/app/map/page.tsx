'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Fldr, FlightSegment } from '@/types/fldr'
import { AirplaneIcon } from '@/components/Icons'

// FlightRoute interface (must match FlightMap component props)
interface FlightRoute {
  fldrId: string
  fldrTitle: string
  dateStart: string
  segments: FlightSegment[]
  color: string
}

// Dynamic import for map (client-side only)
const FlightMap = dynamic<{ routes: FlightRoute[]; selectedRouteId: string | null }>(
  () => import('../../components/FlightMap').then(mod => mod.default), 
  { 
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-140px)] bg-white/5 rounded-lg flex items-center justify-center">
        <div className="text-white/60">Loading map...</div>
      </div>
    )
  }
)

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
  const [showSidebar, setShowSidebar] = useState(false)
  const [showAirportStats, setShowAirportStats] = useState(false)

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
    let needsUpdate = false

    fldrsData.forEach((fldr, index) => {
      // Handle migration: if flight_info is an object (old structure), convert to array
      if (fldr.flight_info && !Array.isArray(fldr.flight_info)) {
        console.log(`🔄 Migrating flight_info for fldr: ${fldr.title}`)
        const oldFlightInfo = fldr.flight_info as any
        // Convert to array with single segment
        const migratedSegments: FlightSegment[] = [{
          id: crypto.randomUUID(),
          departure_airport: oldFlightInfo.departure_airport || null,
          departure_code: oldFlightInfo.departure_code || null,
          departure_address: oldFlightInfo.departure_address || null,
          departure_time: oldFlightInfo.departure_time || null,
          arrival_airport: oldFlightInfo.arrival_airport || null,
          arrival_code: oldFlightInfo.arrival_code || null,
          arrival_address: oldFlightInfo.arrival_address || null,
          arrival_time: oldFlightInfo.arrival_time || null,
          flight_number: oldFlightInfo.flight_number || null,
          airline: oldFlightInfo.airline || null,
          confirmation: oldFlightInfo.confirmation || null,
          notes: oldFlightInfo.notes || null,
          segment_type: 'outbound',
        }]
        fldrsData[index].flight_info = migratedSegments
        needsUpdate = true
      }

      // Now process the (potentially migrated) flight_info
      if (fldr.flight_info && Array.isArray(fldr.flight_info) && fldr.flight_info.length > 0) {
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

    // If we migrated any data, save it back to cache
    if (needsUpdate) {
      console.log('💾 Saving migrated flight data to cache')
      localStorage.setItem('git-fldrs', JSON.stringify(fldrsData))
      
      // Also update individual offline storage entries
      fldrsData.forEach(fldr => {
        if (fldr.flight_info && Array.isArray(fldr.flight_info)) {
          localStorage.setItem(`git_offline_fldrs_${fldr.id}`, JSON.stringify(fldr))
        }
      })
    }

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

  const getAirportVisits = () => {
    const airportCounts: Record<string, { code: string; name: string; count: number }> = {}
    
    routes.forEach(route => {
      route.segments.forEach((segment: FlightSegment) => {
        // Count departure airport
        if (segment.departure_code) {
          if (!airportCounts[segment.departure_code]) {
            airportCounts[segment.departure_code] = {
              code: segment.departure_code,
              name: segment.departure_airport || segment.departure_code,
              count: 0
            }
          }
          airportCounts[segment.departure_code].count++
        }
        
        // Count arrival airport
        if (segment.arrival_code) {
          if (!airportCounts[segment.arrival_code]) {
            airportCounts[segment.arrival_code] = {
              code: segment.arrival_code,
              name: segment.arrival_airport || segment.arrival_code,
              count: 0
            }
          }
          airportCounts[segment.arrival_code].count++
        }
      })
    })
    
    return Object.values(airportCounts).sort((a, b) => b.count - a.count)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#3b82f6] mb-4"></div>
          <div className="text-white/60">Loading your flight history...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        <FlightMap 
          routes={routes}
          selectedRouteId={selectedRoute}
        />
      </div>

      {/* Top header bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-4 sm:p-6 z-[1000] pointer-events-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">Flight Map</h1>
            <p className="text-xs sm:text-sm text-white/90 drop-shadow mt-1">
              {routes.length} {routes.length === 1 ? 'trip' : 'trips'} • {routes.reduce((sum, r) => sum + r.segments.length, 0)} flights
            </p>
          </div>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="hidden sm:flex px-3 sm:px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg shadow-lg transition-all hover:shadow-xl hover:scale-105 items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="font-medium">Routes</span>
          </button>
        </div>
      </div>

      {/* Mobile FAB button when sidebar is closed */}
      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-full shadow-2xl z-[1000] flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sliding sidebar for routes */}
      {showSidebar && (
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[999] sm:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}
      
      <div 
        className={`absolute top-0 right-0 bottom-0 w-full sm:w-96 bg-[#0a0a0a]/95 backdrop-blur-lg border-l border-[#2a2a2a] transform transition-transform duration-300 ease-in-out z-[1000] ${
          showSidebar ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col pb-40 sm:pb-0">
          {/* Sidebar header */}
          <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Your Routes</h2>
              <p className="text-xs text-gray-400">{routes.length} trips tracked</p>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Routes list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {routes.length === 0 ? (
              <div className="p-6 text-center">
                <AirplaneIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 text-sm mb-2">No flights found</p>
                <p className="text-xs text-gray-500">
                  Add flight info to your jobs to see them on the map
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setSelectedRoute(null)
                    setShowSidebar(false)
                  }}
                  className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                    selectedRoute === null
                      ? 'bg-[#3b82f6] border-[#3b82f6] shadow-lg shadow-[#3b82f6]/20'
                      : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">
                    ✨ Show All Routes
                  </div>
                  <div className="text-xs text-white/70 mt-1">
                    View your complete flight history
                  </div>
                </button>
                
                {routes.map(route => (
                  <button
                    key={route.fldrId}
                    onClick={() => {
                      setSelectedRoute(selectedRoute === route.fldrId ? null : route.fldrId)
                      setShowSidebar(false)
                    }}
                    className={`w-full p-3 rounded-lg text-left transition-all border-2 ${
                      selectedRoute === route.fldrId
                        ? 'bg-[#1a1a1a] border-[#3b82f6] shadow-lg shadow-[#3b82f6]/20'
                        : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div 
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0 shadow-lg"
                        style={{ backgroundColor: route.color, boxShadow: `0 0 10px ${route.color}80` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate text-white">
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
                ))}
              </>
            )}
          </div>

          {/* Sidebar footer */}
          <div className="p-4 border-t border-[#2a2a2a] bg-[#0a0a0a]">
            {/* Statistics - always visible */}
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#1a1a1a] rounded-lg p-2">
                <div className="text-xl font-bold text-[#3b82f6]">{routes.length}</div>
                <div className="text-xs text-gray-400">Trips</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-2">
                <div className="text-xl font-bold text-[#10b981]">
                  {routes.reduce((sum, r) => sum + r.segments.length, 0)}
                </div>
                <div className="text-xs text-gray-400">Flights</div>
              </div>
              <div className="bg-[#1a1a1a] rounded-lg p-2">
                <div className="text-xl font-bold text-[#f59e0b]">
                  {new Set(routes.flatMap(r => r.segments.flatMap((s: FlightSegment) => [s.departure_code, s.arrival_code]))).size}
                </div>
                <div className="text-xs text-gray-400">Airports</div>
              </div>
            </div>

            {/* Airport visit counts - only show if there are routes */}
            {routes.length > 0 && (
              <>
                <button
                  onClick={() => setShowAirportStats(!showAirportStats)}
                  className="w-full mb-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors flex items-center justify-between text-sm"
                >
                  <span className="text-white font-medium">Airport Visits</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${showAirportStats ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showAirportStats && (
                  <div className="mb-3 max-h-64 overflow-y-auto space-y-1.5">
                    {getAirportVisits().map(airport => (
                      <div
                        key={airport.code}
                        className="bg-[#1a1a1a] rounded-lg px-3 py-2 flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{airport.code}</div>
                          <div className="text-xs text-gray-400 truncate">{airport.name}</div>
                        </div>
                        <div className="ml-2 px-2 py-1 bg-[#3b82f6] rounded text-xs font-bold text-white">
                          {airport.count}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            
            <div className="text-xs text-gray-500 text-center mt-2">
              Click routes to focus • Tap markers for details
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient for better readability */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent h-24 pointer-events-none z-[999]" />
    </div>
  )
}
