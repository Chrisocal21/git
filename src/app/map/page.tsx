'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Fldr, FlightSegment, Person } from '@/types/fldr'
import { AirplaneIcon } from '@/components/Icons'
import { filterJobsByUser, getCurrentUser } from '@/lib/auth'

// FlightRoute interface (must match FlightMap component props)
interface FlightRoute {
  fldrId: string
  fldrTitle: string
  dateStart: string
  segments: FlightSegment[]
  color: string
}

// JobLocation interface for jobs without flights
interface JobLocation {
  fldrId: string
  fldrTitle: string
  dateStart: string
  location: string
  address: string | null // venue address if available
  color: string
}

// Dynamic import for map (client-side only)
const FlightMap = dynamic<{ routes: FlightRoute[]; locations: JobLocation[]; selectedRouteId: string | null }>(
  () => import('../../components/FlightGlobe').then(mod => mod.default), 
  { 
    ssr: false,
    loading: () => (
      <div className="h-[calc(100vh-140px)] bg-black flex items-center justify-center">
        <div className="text-white/60">Loading globe...</div>
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
  const [locations, setLocations] = useState<JobLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showAirportStats, setShowAirportStats] = useState(false)
  const [showRoutesList, setShowRoutesList] = useState(false)
  const [viewMode, setViewMode] = useState<'team' | 'my'>('team') // team = all jobs, my = my trips based on people array
  const [people, setPeople] = useState<Person[]>([])
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [showPersonPicker, setShowPersonPicker] = useState(false)
  const [homeWeather, setHomeWeather] = useState<{ temp: number; condition: string } | null>(null)
  const user = getCurrentUser()

  useEffect(() => {
    // Load fldrs from cache or API
    const cached = localStorage.getItem('git-fldrs')
    if (cached) {
      try {
        const data = JSON.parse(cached)
        setFldrs(data)
        extractPeople(data)
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
        extractPeople(data)
        processRoutes(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to fetch fldrs:', err)
        setLoading(false)
      })
  }, [])

  // Re-process routes when person selection or view mode changes
  useEffect(() => {
    if (fldrs.length > 0) {
      processRoutes(fldrs)
    }
  }, [selectedPerson, viewMode])

  // Fetch homebase weather (San Diego)
  useEffect(() => {
    fetch('/api/weather?location=San%20Diego%2C%20CA')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.current && typeof data.current.temp === 'number') {
          setHomeWeather({ temp: Math.round(data.current.temp), condition: data.current.main || data.current.description })
        }
      })
      .catch(() => {})
  }, [])

  const extractPeople = (fldrsData: Fldr[]) => {
    const peopleSet = new Map<string, Person>()
    
    fldrsData.forEach(fldr => {
      if (fldr.people && Array.isArray(fldr.people)) {
        fldr.people.forEach(person => {
          // Skip luggage tag entries - not actual people
          if (person.role?.toLowerCase().includes('luggage') || person.role?.toLowerCase().includes('tag')) {
            return
          }
          
          // Normalize name: trim whitespace and make case-insensitive key
          if (person.name && person.name.trim()) {
            const normalizedName = person.name.trim()
            const key = normalizedName.toLowerCase()
            
            // Only add if we haven't seen this name before
            if (!peopleSet.has(key)) {
              // Store with normalized name for consistency
              peopleSet.set(key, {
                ...person,
                name: normalizedName
              })
            }
          }
        })
      }
    })
    
    const uniquePeople = Array.from(peopleSet.values()).sort((a, b) => a.name.localeCompare(b.name))
    setPeople(uniquePeople)
  }

  const processRoutes = (fldrsData: Fldr[]) => {
    // Clear existing data immediately
    setRoutes([])
    setLocations([])
    
    // Determine who we're filtering for
    const filterByPerson = selectedPerson || (viewMode === 'my' ? user?.name : null)
    
    const flightRoutes: FlightRoute[] = []
    const jobLocations: JobLocation[] = []
    let colorIndex = 0
    let needsUpdate = false

    // Process EVERY job and check if selected person is in it
    fldrsData.forEach((fldr, index) => {
      // If filtering by a specific person, check if this job has that person
      if (filterByPerson) {
        // Skip jobs without people when filtering
        if (!fldr.people || !Array.isArray(fldr.people) || fldr.people.length === 0) {
          return
        }
        
        const normalizedFilterPerson = filterByPerson.toLowerCase().trim()
        
        let matchFound = false
        
        fldr.people.forEach((person) => {
          const normalizedPersonName = person.name?.toLowerCase().trim() || ''
          const isMatch = normalizedPersonName === normalizedFilterPerson
          if (isMatch) {
            matchFound = true
          }
        })
        
        if (!matchFound) {
          return
        }
      }
      // In team view (no filter), show ALL jobs regardless of people assignment
      
      // Handle migration: if flight_info is an object (old structure), convert to array
      if (fldr.flight_info && !Array.isArray(fldr.flight_info)) {
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

      // Handle migration: if flight_info is an object (old structure), convert to array
      if (fldr.flight_info && !Array.isArray(fldr.flight_info)) {
        const oldFlightInfo = fldr.flight_info as any
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

      // Process flight_info if it exists
      if (fldr.flight_info && Array.isArray(fldr.flight_info) && fldr.flight_info.length > 0) {
        // Filter to only valid segments (with both airport codes)
        const validSegments = fldr.flight_info.filter(seg => seg.departure_code && seg.arrival_code)
        
        if (validSegments.length > 0) {
          // Add ALL valid segments from this job
          flightRoutes.push({
            fldrId: fldr.id,
            fldrTitle: fldr.title,
            dateStart: fldr.date_start,
            segments: validSegments,
            color: ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
          })
          colorIndex++
        }
      } else if (fldr.location || fldr.venue_info?.address) {
        // Job has no flights but has a location - add as location marker
        jobLocations.push({
          fldrId: fldr.id,
          fldrTitle: fldr.title,
          dateStart: fldr.date_start,
          location: fldr.location || '',
          address: fldr.venue_info?.address || null,
          color: ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
        })
        colorIndex++
      }
    })

    // If we migrated any data, save it back to cache
    if (needsUpdate) {
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
    
    jobLocations.sort((a, b) => 
      new Date(a.dateStart).getTime() - new Date(b.dateStart).getTime()
    )

    const totalSegments = flightRoutes.reduce((sum, r) => sum + r.segments.length, 0)
    
    console.log('[MapPage] processRoutes complete:', {
      flightRoutes: flightRoutes.length,
      totalSegments,
      jobLocations: jobLocations.length,
      filterByPerson: selectedPerson || (viewMode === 'my' ? user?.name : null),
      viewMode
    })
    
    setRoutes(flightRoutes)
    setLocations(jobLocations)
  }

  const formatDate = (date: string) => {
    // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm" formats
    const dateOnly = date.split('T')[0] // Extract date part if datetime string
    const [year, month, day] = dateOnly.split('-').map(Number)
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
    // Count unique dates per airport — same-day arrive+depart (connection) shares
    // the same date so it only counts once. An overnight stay (arrive day 1, depart
    // day 2) correctly counts as 2 separate visit-days.
    const airportInfo: Record<string, { code: string; name: string; dates: Set<string> }> = {}

    const addEvent = (code: string, name: string, time: string | null) => {
      if (!airportInfo[code]) {
        airportInfo[code] = { code, name, dates: new Set() }
      }
      // Use the date portion only; if no timestamp, generate a unique key so
      // undated segments still contribute to the count.
      const key = time ? time.split('T')[0] : `undated-${airportInfo[code].dates.size}`
      airportInfo[code].dates.add(key)
    }

    routes.forEach(route => {
      route.segments.forEach((segment: FlightSegment) => {
        if (segment.departure_code) {
          addEvent(segment.departure_code, segment.departure_airport || segment.departure_code, segment.departure_time)
        }
        if (segment.arrival_code) {
          addEvent(segment.arrival_code, segment.arrival_airport || segment.arrival_code, segment.arrival_time)
        }
      })
    })

    return Object.values(airportInfo)
      .map(a => ({ code: a.code, name: a.name, count: a.dates.size }))
      .sort((a, b) => b.count - a.count)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#3b82f6] mb-4"></div>
          <div className="text-white/60">Loading job travel data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0a]">
      {/* Full-screen map */}
      <div className="absolute inset-0">
        {/* Debug info */}
        <div className="absolute top-20 left-4 bg-black/80 text-white p-2 text-xs z-[2000] rounded">
          <div>Routes: {routes.length}</div>
          <div>Segments: {routes.reduce((sum, r) => sum + r.segments.length, 0)}</div>
          <div>Selected: {selectedRoute || 'none'}</div>
        </div>
        
        <FlightMap 
          routes={routes}
          locations={locations}
          selectedRouteId={selectedRoute}
        />
      </div>

      {/* Top header bar */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/90 via-black/60 to-transparent p-4 sm:p-6 z-[1000] pointer-events-none">
        <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">
              {selectedPerson ? `${selectedPerson}'s Flight Map` : viewMode === 'my' ? `${user?.name}'s Flight Map` : 'Team Flight Map'}
            </h1>
            <p className="text-xs sm:text-sm text-white/90 drop-shadow mt-1">
              {selectedPerson 
                ? `Filtered by ${selectedPerson}` 
                : viewMode === 'team' ? 'All People' : 'My Trips'
              } • {routes.length + locations.length} {routes.length + locations.length === 1 ? 'trip' : 'trips'} • {routes.reduce((sum, r) => sum + r.segments.length, 0)} flight segments
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Person Picker */}
            {people.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowPersonPicker(!showPersonPicker)
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a]/80 backdrop-blur-sm hover:bg-[#2a2a2a]/80 text-white rounded-lg shadow-lg transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm font-medium hidden sm:inline">
                    {selectedPerson || (viewMode === 'my' ? 'My Trips' : 'All People')}
                  </span>
                  <svg className={`w-3 h-3 transition-transform ${showPersonPicker ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showPersonPicker && (
                  <>
                    <div 
                      className="fixed inset-0 z-[1001]" 
                      onClick={() => setShowPersonPicker(false)}
                    />
                    <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl py-2 z-[1002] max-h-80 overflow-y-auto">
                      <button
                        onClick={() => {
                          setSelectedPerson(null)
                          setViewMode('my') // Show current user's trips
                          setShowPersonPicker(false)
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          selectedPerson === null && viewMode === 'my'
                            ? 'bg-[#3b82f6] text-white'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium">My Trips</div>
                        <div className="text-xs opacity-70">Show only my jobs</div>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedPerson(null)
                          setViewMode('team') // Show all people's trips
                          setShowPersonPicker(false)
                        }}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          selectedPerson === null && viewMode === 'team'
                            ? 'bg-[#3b82f6] text-white'
                            : 'text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="font-medium">All People</div>
                        <div className="text-xs opacity-70">Show all trips</div>
                      </button>
                      <div className="border-t border-[#2a2a2a] my-2" />
                      {people.map((person, idx) => {
                        return (
                          <button
                            key={person.name}
                            onClick={() => {
                              setSelectedPerson(person.name)
                              setShowPersonPicker(false)
                            }}
                            className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                              selectedPerson === person.name
                                ? 'bg-[#3b82f6] text-white'
                                : 'text-gray-300 hover:bg-white/10'
                            }`}
                          >
                            <div className="font-medium">{person.name}</div>
                            {person.role && <div className="text-xs opacity-70">{person.role}</div>}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="hidden sm:flex px-3 sm:px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg shadow-lg transition-all hover:shadow-xl hover:scale-105 items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="font-medium">Jobs</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile FAB button when sidebar is closed */}
      {!showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-[#E8B44D] hover:bg-[#D4A03C] text-black rounded-full shadow-2xl z-[1000] flex items-center justify-center transition-all hover:scale-110 active:scale-95"
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



          {/* Sidebar footer */}
          <div className="p-4 border-t border-[#2a2a2a] bg-[#0a0a0a]">
            {/* Statistics - always visible */}
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#1a1a1a] rounded-lg p-2">
                <div className="text-xl font-bold text-[#3b82f6]">{routes.length}</div>
                <div className="text-xs text-gray-400">Jobs</div>
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

            {/* Route list dropdown - only show if there are routes */}
            {routes.length > 0 && (
              <>
                <button
                  onClick={() => setShowRoutesList(!showRoutesList)}
                  className="w-full mb-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors flex items-center justify-between text-sm"
                >
                  <span className="text-white font-medium">Show All Routes</span>
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${showRoutesList ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showRoutesList && (
                  <div className="mb-2 max-h-64 overflow-y-auto space-y-1.5">
                    {routes.map(route => (
                      <button
                        key={route.fldrId}
                        onClick={() => {
                          setSelectedRoute(selectedRoute === route.fldrId ? null : route.fldrId)
                          setShowSidebar(false)
                        }}
                        className={`w-full p-2.5 rounded-lg text-left transition-all border ${
                          selectedRoute === route.fldrId
                            ? 'bg-[#1a1a1a] border-[#3b82f6]'
                            : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0"
                            style={{ backgroundColor: route.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs truncate text-white">{route.fldrTitle}</div>
                            <div className="text-xs text-gray-400">{formatDate(route.dateStart)}</div>
                            <div className="text-xs text-gray-500">{getRouteDescription(route.segments)}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

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
            
            <Link
              href="/leaderboard"
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] rounded-lg transition-colors text-sm text-[#E8B44D] font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Leaderboard
            </Link>
            <div className="text-xs text-gray-500 text-center mt-2">
              {viewMode === 'team' ? 'Showing all team travel' : `Showing ${user?.name}'s flights`}
            </div>
            <div className="text-xs text-gray-500 text-center">
              Click jobs to focus • Tap markers for details
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient for better readability */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent h-24 pointer-events-none z-[999]" />
    </div>
  )
}
