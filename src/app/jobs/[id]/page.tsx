'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Fldr, FlightSegment, HotelInfo, VenueInfo, RentalCarInfo, JobInfo, JobTracker, Person, Photo, Product, ChecklistItem, JobStatus } from '@/types/fldr'
import { PencilIcon } from '@/components/Icons'
import { WeatherSVG } from '@/components/WeatherIcon'
import CopyButton from '@/components/CopyButton'
import { FldrDetailSkeleton } from '@/components/SkeletonLoader'
import RichTextEditor from '@/components/RichTextEditor'
import { SectionCard, GroupHeading, AddSectionButton, TextAction } from '@/components/job/parts'
import SectionNav from '@/components/job/SectionNav'
import GlanceCard from '@/components/job/GlanceCard'
import { ClientEventCard, VenueTimeCard } from '@/components/job/EventCards'
import LogisticsCard from '@/components/job/LogisticsCard'
import { TravelDatesRow, FlightsCard, HotelCard, RentalCarCard } from '@/components/job/TravelCards'
import StaffCard from '@/components/job/StaffCard'
import LinksCard from '@/components/job/LinksCard'
import ProductsCard from '@/components/job/ProductsCard'
import ChecklistCard from '@/components/job/ChecklistCard'
import { mergeFldrUpdates } from '@/lib/fldrMerge'
import { readStep, flightSpan } from '@/lib/jobTracker'
import { plainText } from '@/lib/jobFormat'
import { todayKey } from '@/lib/jigsFormat'
import { 
  getCachedFldr, 
  cacheFldr, 
  addToSyncQueue, 
  hasUnsyncedChanges,
  isOnline,
  syncQueuedChanges,
  clearAllCache
} from '@/lib/offlineStorage'
import { logStorageInfo } from '@/lib/storageHealth'
import { addOrUpdateProfile } from '@/lib/auth'
import { useJobJigs } from '@/components/jigs/useJobJigs'


// Dynamic import for map (client-side only)
const FldrMap = dynamic(() => import('@/components/FldrMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-64 md:h-96 lg:h-[500px] xl:h-[600px] bg-white/5 rounded-lg flex items-center justify-center">
      <div className="text-white/60">Loading map...</div>
    </div>
  )
})

export default function FldrDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [fldr, setFldr] = useState<Fldr | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // A save running in the background (typing, a tick). Kept apart from `saving` so the
  // buttons that say "Activating..." or "Updating..." only change for their own action.
  const [autoSaving, setAutoSaving] = useState(false)
  const [unsavedChanges, setUnsavedChanges] = useState(false)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    summary: true, // The at-a-glance card is the one worth seeing first
    flight: false,
    hotel: false,
    venue: false,
    rentalCar: false,
    map: false, // Closed by default
    weather: false,
    itinerary: false,
    event: false,
    logistics: false,
    checklist: false,
    people: false,
    photos: false,
    products: false,
    notes: false,
    links: false,
    prompts: false,
  })
  const cardsRestoredRef = useRef(false)
  const [activeSection, setActiveSection] = useState('overview')
  const [online, setOnline] = useState(true)
  const [hasUnsynced, setHasUnsynced] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [, setRefreshCounter] = useState(0)
  const [editMode, setEditMode] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDateStart, setEditDateStart] = useState('')
  const [editDateEnd, setEditDateEnd] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [touchStartY, setTouchStartY] = useState(0)
  const [useRichEditor, setUseRichEditor] = useState(false)
  const [isRoundTrip, setIsRoundTrip] = useState(false)
  const [expandedPhotoIndex, setExpandedPhotoIndex] = useState<number | null>(null)
  const [locationTime, setLocationTime] = useState<string | null>(null)
  const [jobWeather, setJobWeather] = useState<{
    cityLabel: string | null
    current: { temp: number; feels_like: number; description: string; main: string; humidity: number; wind_speed: number } | null
    daily: Array<{ date: string; high: number; low: number; main: string; description: string; pop: number }>
    loading: boolean
    error: boolean
  }>({ cityLabel: null, current: null, daily: [], loading: false, error: false })
  const [distances, setDistances] = useState<any>(null)
  const [distancesLoading, setDistancesLoading] = useState(false)
  const [nearbyPlaces, setNearbyPlaces] = useState<any>(null)
  const [nearbyLoading, setNearbyLoading] = useState(false)
  const [nearbyType, setNearbyType] = useState<'restaurant' | 'cafe' | 'gas_station' | 'bar'>('restaurant')
  const [searchFromAddress, setSearchFromAddress] = useState<string | undefined>(undefined)
  const [showOverviewModal, setShowOverviewModal] = useState(false)
  const [generatedOverview, setGeneratedOverview] = useState<string>('')
  const [showMapModal, setShowMapModal] = useState(false)
  const [generatingOverview, setGeneratingOverview] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState<'quick' | 'full' | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)
  const [showParseEmailModal, setShowParseEmailModal] = useState<'flight' | 'hotel' | 'rental_car' | null>(null)
  const [parseEmailText, setParseEmailText] = useState('')
  const [parseEmailImage, setParseEmailImage] = useState<string | null>(null)
  const [parseInputMode, setParseInputMode] = useState<'text' | 'image'>('text')
  const [parsingEmail, setParsingEmail] = useState(false)
  const [generatingItinerary, setGeneratingItinerary] = useState(false)
  const [generatedItineraryItems, setGeneratedItineraryItems] = useState<any[]>([])
  const [generatedItineraryOverview, setGeneratedItineraryOverview] = useState<string>('')

  // Toast confirm dialogs
  type ConfirmDialog = { type: 'module'; module: Parameters<typeof disableModule>[0] } | { type: 'deleteJob' } | { type: 'hardRefresh' } | { type: 'duplicate' }
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const prevItineraryDataRef = useRef<string>('')
  const fldrRef = useRef<Fldr | null>(null)
  const saveRequestSeqRef = useRef(0)
  // Edits made on this page that haven't been sent yet. Anything fetched from the
  // server is laid under these, so a refresh or a save coming back never wipes typing.
  const pendingRef = useRef<Partial<Fldr>>({})
  // Saves on their way to the server right now
  const savesInFlightRef = useRef(0)
  // The loop that sends them one at a time, while it's running
  const savePumpRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    fldrRef.current = fldr
  }, [fldr])

  /** Takes the server's copy of the job, keeping anything typed here that hasn't gone out yet */
  const adoptServerFldr = useCallback((serverFldr: Fldr): Fldr => {
    const merged = mergeFldrUpdates(serverFldr, pendingRef.current)
    fldrRef.current = merged
    setFldr(merged)
    cacheFldr(merged)
    return merged
  }, [])

  // Remember which cards are open, on this device, from one job to the next
  useEffect(() => {
    try {
      const saved = localStorage.getItem('burrow-job-cards')
      if (saved) setExpandedCards(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch {}
  }, [])

  useEffect(() => {
    // The first pass is the defaults, before the saved layout is back
    if (!cardsRestoredRef.current) {
      cardsRestoredRef.current = true
      return
    }
    try {
      localStorage.setItem('burrow-job-cards', JSON.stringify(expandedCards))
    } catch {}
  }, [expandedCards])

  // Jigs on this job, shown under each product. Only loaded when the Products card is on.
  const jobJigs = useJobJigs(fldr?.id, !!fldr && fldr.products !== null && fldr.fldr_type !== 'time_off')
  const jigsOut = jobJigs.allocations.filter(a => a.status === 'out').length
  const heldWaitingRef = useRef(false)

  useEffect(() => {
    if (!showMapModal) return

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMapModal(false)
      }
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [showMapModal])

  // Memoize map locations to prevent unnecessary re-renders
  const mapLocations = useMemo(() => {
    if (!fldr) return []
    
    const locations = []
    
    // Departure Airport
    if (fldr.flight_info && fldr.flight_info.length > 0 && fldr.flight_info[0].departure_address) {
      locations.push({
        label: 'Departure Airport',
        address: fldr.flight_info[0].departure_address,
        additionalInfo: fldr.flight_info[0].departure_airport 
          ? `${fldr.flight_info[0].departure_airport} (${fldr.flight_info[0].departure_code || ''})` 
          : undefined,
      })
    }
    
    // Arrival Airport
    if (fldr.flight_info && fldr.flight_info.length > 0 && fldr.flight_info[0].arrival_address) {
      locations.push({
        label: 'Arrival Airport',
        address: fldr.flight_info[0].arrival_address,
        additionalInfo: fldr.flight_info[0].arrival_airport 
          ? `${fldr.flight_info[0].arrival_airport} (${fldr.flight_info[0].arrival_code || ''})` 
          : undefined,
      })
    }
    
    // Hotel
    if (fldr.hotel_info?.address) {
      locations.push({
        label: 'Hotel',
        address: fldr.hotel_info.address,
        phone: fldr.hotel_info.phone || undefined,
        notes: fldr.hotel_info.notes || undefined,
        additionalInfo: fldr.hotel_info.name || undefined,
      })
    }
    
    // Venue
    if (fldr.venue_info?.address) {
      locations.push({
        label: 'Venue',
        address: fldr.venue_info.address,
        phone: fldr.venue_info.contact_phone || undefined,
        notes: fldr.venue_info.notes || undefined,
        additionalInfo: fldr.venue_info.name 
          ? `${fldr.venue_info.name}${fldr.venue_info.contact_name ? ' • Contact: ' + fldr.venue_info.contact_name : ''}` 
          : undefined,
      })
    }
    
    // Rental Car Pickup
    if (fldr.rental_car_info?.pickup_location) {
      locations.push({
        label: 'Rental Car Pickup',
        address: fldr.rental_car_info.pickup_location,
        additionalInfo: fldr.rental_car_info.company || undefined,
        notes: fldr.rental_car_info.confirmation 
          ? `Confirmation: ${fldr.rental_car_info.confirmation}` 
          : undefined,
      })
    }
    
    return locations
  }, [
    fldr?.flight_info?.[0]?.departure_address,
    fldr?.flight_info?.[0]?.arrival_address,
    fldr?.hotel_info?.address,
    fldr?.venue_info?.address,
    fldr?.rental_car_info?.pickup_location,
  ])

  // Memoize map callbacks to prevent FldrMap re-renders
  const handleNearbyTypeChange = useCallback((type: 'restaurant' | 'cafe' | 'gas_station' | 'bar') => {
    setNearbyType(type)
  }, [])

  const handleSearchLocationChange = useCallback((address: string) => {
    setSearchFromAddress(address)
  }, [])

  useEffect(() => {
    // Update online status
    const updateOnlineStatus = () => {
      setOnline(isOnline())
      setHasUnsynced(hasUnsyncedChanges())
    }
    
    // Auto-sync when coming back online
    const handleOnline = async () => {
      console.log('[Network] Connection restored - checking for queued changes...')
      setOnline(true)
      
      if (hasUnsyncedChanges()) {
        console.log('[Sync] Auto-syncing queued changes...')
        setSaving(true)
        const success = await syncQueuedChanges()
        if (success) {
          setHasUnsynced(false)
          console.log('[Sync] Auto-sync complete!')
          
          // Refresh from server to get latest data
          const currentFldrId = params.id as string
          if (currentFldrId) {
            try {
              const response = await fetch(`/api/fldrs/${currentFldrId}`, { cache: 'no-store' })
              if (response.ok) {
                const updated = await response.json()
                adoptServerFldr(updated)
                console.log('[Sync] Data refreshed from server')
              }
            } catch (error) {
              console.error('Failed to refresh after auto-sync:', error)
            }
          }
        }
        setSaving(false)
      } else {
        console.log('[Sync] No queued changes to sync')
      }
    }
    
    const handleOffline = () => {
      console.log('[Network] Connection lost')
      setOnline(false)
    }
    
    updateOnlineStatus()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [params.id, adoptServerFldr])

  // Pull the latest from the server whenever the page comes back into view:
  // a desktop tab getting focus, or the app being reopened on a phone
  useEffect(() => {
    let lastRefresh = 0

    const handleFocus = async () => {
      const current = fldrRef.current
      if (!current || !isOnline()) return
      // An older copy landing on top of a save that's still going out would undo it
      if (savesInFlightRef.current > 0) return
      // Focus and visibility usually fire together
      if (Date.now() - lastRefresh < 2000) return
      lastRefresh = Date.now()
      const savesBefore = saveRequestSeqRef.current
      console.log('[Focus] Tab focused - refreshing from server...')

      try {
        const response = await fetch(`/api/fldrs/${current.id}`, { cache: 'no-store' })
        if (response.ok) {
          const updated = await response.json()
          // Something was saved while this was loading, so what just arrived is already out of date
          if (saveRequestSeqRef.current !== savesBefore) return
          console.log('[Focus] Refreshed from server (focus), photos:', updated.photos?.length || 0)
          const merged = adoptServerFldr(updated)

          // Update list cache too
          try {
            const listCache = localStorage.getItem('git-fldrs')
            if (listCache) {
              const allFldrs = JSON.parse(listCache)
              const index = allFldrs.findIndex((f: Fldr) => f.id === current.id)
              if (index !== -1) {
                allFldrs[index] = merged
                localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
              }
            }
          } catch (e) {
            console.error('Failed to update list cache:', e)
          }
        }
      } catch (error) {
        console.error('Failed to refresh on focus:', error)
      }
    }
    const handleVisible = () => {
      if (document.visibilityState === 'visible') handleFocus()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisible)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisible)
    }
  }, [adoptServerFldr])

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false)
      }
    }

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportMenu])

  // Update current time every minute for itinerary strikethrough
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(timer)
  }, [])

  // Auto-detect job status on load if not set and user is attending
  useEffect(() => {
    if (!fldr || !fldr.attending || fldr.job_status) return // Skip if not attending or status already set
    
    const autoStatus = autoDetectJobStatus(fldr)
    if (autoStatus && autoStatus !== fldr.job_status) {
      console.log('[AutoStatus] Auto-detected job status:', autoStatus)
      setFldr({ ...fldr, job_status: autoStatus })
      saveFldr({ job_status: autoStatus })
    }
  }, [fldr?.id]) // Only run once when fldr loads

  // Auto-generate smart itinerary ONLY when travel timing data actually changes
  useEffect(() => {
    if (!fldr) return

    // Load saved AI suggestions if they exist
    if (fldr.ai_itinerary_items && fldr.ai_itinerary_items.length > 0) {
      console.log('[AI] Loading saved itinerary suggestions from database')
      setGeneratedItineraryItems(fldr.ai_itinerary_items)
      setGeneratedItineraryOverview(fldr.ai_itinerary_overview || '')
      return // Don't regenerate if we already have saved suggestions
    }

    // Only check data that affects travel timing
    const itineraryRelevantData = {
      flights: fldr.flight_info?.map(f => `${f.departure_time}-${f.arrival_time}`).join(','),
      hotelCheckin: fldr.hotel_info?.check_in,
      hotelCheckout: fldr.hotel_info?.check_out,
      hotelAddress: fldr.hotel_info?.address,
      venueAddress: fldr.venue_info?.address,
      showUpTime: fldr.job_info?.show_up_time,
      eventStart: fldr.job_info?.job_start_time,
      eventEnd: fldr.job_info?.job_end_time,
      rentalPickup: fldr.rental_car_info?.pickup_time,
      rentalDropoff: fldr.rental_car_info?.dropoff_time,
    }

    const currentHash = JSON.stringify(itineraryRelevantData)
    
    // Only regenerate if timing data actually changed
    if (currentHash !== prevItineraryDataRef.current && (itineraryRelevantData.flights || itineraryRelevantData.eventStart)) {
      console.log('[Itinerary] Timing data changed - regenerating')
      prevItineraryDataRef.current = currentHash
      generateSmartItinerary()
    } else if (!itineraryRelevantData.flights && !itineraryRelevantData.eventStart) {
      setGeneratedItineraryItems([])
      setGeneratedItineraryOverview('')
    }
  }, [
    fldr?.flight_info,
    fldr?.hotel_info?.check_in,
    fldr?.hotel_info?.check_out,
    fldr?.hotel_info?.address,
    fldr?.venue_info?.address,
    fldr?.job_info?.show_up_time,
    fldr?.job_info?.job_start_time,
    fldr?.job_info?.job_end_time,
    fldr?.rental_car_info?.pickup_time,
    fldr?.rental_car_info?.dropoff_time,
    fldr?.ai_itinerary_items
  ])

  // Sync round trip checkbox state with flight segments
  useEffect(() => {
    if (fldr?.flight_info && Array.isArray(fldr.flight_info)) {
      const hasReturnSegment = fldr.flight_info.some(seg => seg.segment_type === 'return')
      setIsRoundTrip(hasReturnSegment)
    }
  }, [fldr?.flight_info])

  useEffect(() => {
    if (params.id) {
      const fldrId = params.id as string
      console.log(`[Load] Loading fldr: ${fldrId}`)
      logStorageInfo()

      // Switching straight from one job to another: anything unsent belongs to the job
      // being left, so it goes out under that job before this one loads
      if (fldrRef.current && fldrRef.current.id !== fldrId) beaconPending()
      
      // Try to load from cache first (fallback 1: offlineStorage)
      let cached = getCachedFldr(fldrId)
      
      // Fallback 2: Check the main list cache
      if (!cached) {
        console.log('[Cache] Not found in offline storage, checking list cache')
        try {
          const listCache = localStorage.getItem('git-fldrs')
          if (listCache) {
            const allFldrs = JSON.parse(listCache)
            cached = allFldrs.find((f: Fldr) => f.id === fldrId)
            if (cached) {
              console.log('[Cache] Found in list cache')
            } else {
              console.log('[Cache] Not found in list cache either')
            }
          } else {
            console.log('[Cache] No list cache exists')
          }
        } catch (e) {
          console.error('[Cache] Failed to parse list cache:', e)
        }
      } else {
        console.log('[Cache] Found in offline storage')
      }
      
      if (cached) {
        // Migrate old flight_info structure to new array structure
        if (cached.flight_info && !Array.isArray(cached.flight_info)) {
          console.log('[Migration] Migrating old flight_info structure to array format')
          const oldFlightInfo = cached.flight_info as any
          // Convert old object structure to array with one segment
          cached.flight_info = [{
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
            travelers: null,
          }]
          // Save the migrated structure
          cacheFldr(cached)
        }
        
        // Ensure flight_info is either null or an array (never undefined)
        if (cached.flight_info === undefined) {
          cached.flight_info = null
        }
        
        console.log('[Cache] Loaded from cache, photos:', cached.photos?.length || 0)
        setFldr(cached)
        setEditTitle(cached.title)
        setEditDateStart(cached.date_start)
        setEditDateEnd(cached.date_end || '')
        setEditLocation(cached.location || '')
        setLoading(false)
      }
      
      // Fetch from server to get latest data (especially notes from other devices)
      // Try to fetch fresh data if online
      if (isOnline()) {
        console.log('[Server] Fetching latest data from server...')
        const savesBefore = saveRequestSeqRef.current
        fetch(`/api/fldrs/${fldrId}`, { cache: 'no-store' })
          .then(res => {
            if (res.ok) {
              return res.json()
            }
            throw new Error('Failed to fetch')
          })
          .then(freshData => {
            // Something was already saved from this page, so its reply is newer than this
            if (saveRequestSeqRef.current !== savesBefore) return
            console.log('[Server] Got fresh data from server, photos:', freshData.photos?.length || 0)
            const merged = adoptServerFldr(freshData)

            // Also update the list cache
            try {
              const listCache = localStorage.getItem('git-fldrs')
              if (listCache) {
                const allFldrs = JSON.parse(listCache)
                const index = allFldrs.findIndex((f: Fldr) => f.id === fldrId)
                if (index !== -1) {
                  allFldrs[index] = merged
                  localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
                }
              }
            } catch (e) {
              console.error('Failed to update list cache:', e)
            }
          })
          .catch(err => {
            console.log('[Server] Server fetch failed, using cached data:', err)
            // Keep using cached data
          })
      } else {
        console.log('[Network] Offline - using cached data only')
      }
      
      if (!cached) {
        // No cached data - redirect to list
        console.error('[Error] CRITICAL: No cached data found for fldr:', fldrId)
        console.error('[Error] This should not happen! Data may have been lost.')
        logStorageInfo()
        
        // Give user a chance to see the error before redirect
        setTimeout(() => {
          router.push('/jobs')
        }, 2000)
      }
    }
  }, [params.id, router, adoptServerFldr])

  // Fetch location time when fldr location is available
  useEffect(() => {
    const fetchLocationTime = async () => {
      if (!fldr?.location) {
        setLocationTime(null)
        return
      }

      try {
        // WorldTimeAPI is free but doesn't support direct location lookup
        // Instead, we'll use the browser's built-in timezone detection
        // For now, just show the time if we have location data
        // This is a simplified version - for production, you'd want to map locations to timezones
        
        const updateTime = () => {
          // For now, just use the local time with location label
          // In production, you'd want to determine the actual timezone from the location
          const time = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
          setLocationTime(time)
        }

        updateTime()
        const interval = setInterval(updateTime, 60000) // Update every minute

        return () => clearInterval(interval)
      } catch (error) {
        console.error('Location time fetch error:', error)
        setLocationTime(null)
      }
    }

    fetchLocationTime()
  }, [fldr?.location])

  // Fetch distances between key locations
  useEffect(() => {
    const fetchDistances = async () => {
      if (!fldr) return
      
      const locations = []
      if (fldr.hotel_info?.address) locations.push(fldr.hotel_info.address)
      if (fldr.venue_info?.address) locations.push(fldr.venue_info.address)
      
      // Add first outbound flight arrival if available
      const outboundFlight = fldr.flight_info?.find(f => f.segment_type === 'outbound' || f.segment_type === 'connection')
      if (outboundFlight?.arrival_address) locations.push(outboundFlight.arrival_address)

      if (locations.length < 2) {
        setDistances(null)
        return
      }

      setDistancesLoading(true)

      try {
        // Calculate distances from first location to all others
        const origin = locations[0]
        const destinations = locations.slice(1).join('|')
        
        const response = await fetch(`/api/distance?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destinations)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch distances')
        }

        const data = await response.json()
        setDistances(data)
      } catch (error) {
        console.error('Distance fetch error:', error)
        setDistances(null)
      } finally {
        setDistancesLoading(false)
      }
    }

    fetchDistances()
  }, [fldr?.hotel_info?.address, fldr?.venue_info?.address, fldr?.flight_info])

  // Fetch weather for the job's destination.
  // City-level names (e.g. "Palm Beach Gardens, FL") geocode far more reliably
  // than full street addresses, so try `location` first and fall back to the
  // venue's street address only if that lookup fails.
  useEffect(() => {
    const candidates = [fldr?.location, fldr?.venue_info?.address].filter(Boolean) as string[]
    if (candidates.length === 0) {
      setJobWeather({ cityLabel: null, current: null, daily: [], loading: false, error: false })
      return
    }

    let cancelled = false
    setJobWeather(prev => ({ ...prev, loading: true, error: false }))

    const tryFetch = async () => {
      for (const location of candidates) {
        try {
          const res = await fetch(`/api/weather?location=${encodeURIComponent(location)}`)
          const d = res.ok ? await res.json() : null
          if (d?.current) {
            if (cancelled) return
            const cityLabel = d.location?.name
              ? `${d.location.name}${d.location.state ? ', ' + d.location.state : d.location.country ? ', ' + d.location.country : ''}`
              : null
            setJobWeather({ cityLabel, current: d.current, daily: d.daily ?? [], loading: false, error: false })
            return
          }
        } catch {}
      }
      if (!cancelled) {
        setJobWeather({ cityLabel: null, current: null, daily: [], loading: false, error: true })
      }
    }

    tryFetch()
    return () => { cancelled = true }
  }, [fldr?.location, fldr?.venue_info?.address])

  // Fetch nearby places for selected location
  useEffect(() => {
    const fetchNearby = async () => {
      // Use searchFromAddress if set, otherwise default to venue address
      const addressToSearch = searchFromAddress || fldr?.venue_info?.address
      
      if (!addressToSearch) {
        setNearbyPlaces(null)
        return
      }

      setNearbyLoading(true)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      try {
        const response = await fetch(`/api/nearby?address=${encodeURIComponent(addressToSearch)}&type=${nearbyType}`, {
          signal: controller.signal
        })
        
        if (!response.ok) {
          throw new Error('Failed to fetch nearby places')
        }

        const data = await response.json()
        setNearbyPlaces(data)
      } catch (error) {
        console.error('Nearby search error:', error)
        setNearbyPlaces(null)
      } finally {
        clearTimeout(timeoutId)
        setNearbyLoading(false)
      }
    }

    fetchNearby()
  }, [searchFromAddress, fldr?.venue_info?.address, nearbyType])

  // Initialize searchFromAddress with venue address when it becomes available
  useEffect(() => {
    if (fldr?.venue_info?.address && !searchFromAddress) {
      setSearchFromAddress(fldr.venue_info.address)
    }
  }, [fldr?.venue_info?.address, searchFromAddress])

  // Auto-detect timezone using Google API when location changes
  useEffect(() => {
    const fetchTimezone = async () => {
      if (!fldr?.location && !fldr?.venue_info?.address) {
        setLocationTime(null)
        return
      }

      const address = fldr.location || fldr.venue_info?.address
      if (!address) return

      try {
        const response = await fetch(`/api/timezone?address=${encodeURIComponent(address)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch timezone')
        }

        const data = await response.json()
        
        // Update location time with actual timezone-aware time
        const updateTime = () => {
          const time = new Date().toLocaleTimeString('en-US', {
            timeZone: data.timeZoneId,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
          setLocationTime(time)
        }

        updateTime()
        const interval = setInterval(updateTime, 60000) // Update every minute

        return () => clearInterval(interval)
      } catch (error) {
        console.error('Timezone fetch error:', error)
        // Fall back to simple display
        const time = new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
        setLocationTime(time)
      }
    }

    fetchTimezone()
  }, [fldr?.location, fldr?.venue_info?.address])

  // Sends everything that's waiting as one request, then takes on the server's reply.
  const sendPending = useCallback(async () => {
    const currentFldr = fldrRef.current
    if (!currentFldr) return
    const effectiveUpdates: Partial<Fldr> = pendingRef.current
    pendingRef.current = {}
    setUnsavedChanges(false)
    saveRequestSeqRef.current++
    savesInFlightRef.current++

    console.log('[Save] saveFldr called with updates:', Object.keys(effectiveUpdates))
    if (effectiveUpdates.photos) {
      console.log('[Save] Saving photos:', effectiveUpdates.photos.length, 'photos')
      const photosSize = JSON.stringify(effectiveUpdates.photos).length
      console.log('[Save] Photos JSON size:', (photosSize / 1024).toFixed(2), 'KB')
      if (photosSize > 500000) {
        console.warn('[Save] WARNING: Photos data is large -', (photosSize / 1024).toFixed(2), 'KB')
      }
    }

    try {
      // Check if fldr should be marked as ready/complete
      const updatedFldr = mergeFldrUpdates(currentFldr, effectiveUpdates)
      const hasFlightInfo = updatedFldr.flight_info && Array.isArray(updatedFldr.flight_info) && updatedFldr.flight_info.length > 0 && updatedFldr.flight_info.some(seg =>
        seg.departure_airport || seg.arrival_airport
      )
      const hasHotelInfo = updatedFldr.hotel_info && (
        updatedFldr.hotel_info.name ||
        updatedFldr.hotel_info.address
      )
      const hasVenueInfo = updatedFldr.venue_info && (
        updatedFldr.venue_info.name ||
        updatedFldr.venue_info.address
      )
      const hasJobInfo = updatedFldr.job_info && (
        updatedFldr.job_info.client_name ||
        updatedFldr.job_info.item
      )

      // Auto-update status if it's currently incomplete and has key info
      if (updatedFldr.status === 'incomplete' && (hasFlightInfo || hasHotelInfo || hasVenueInfo || hasJobInfo)) {
        effectiveUpdates.status = 'ready'
      }

      // Update local state and cache immediately
      const newFldr = mergeFldrUpdates(currentFldr, effectiveUpdates)
      fldrRef.current = newFldr
      setFldr(newFldr)
      cacheFldr(newFldr)
      setLastSaved(new Date())
      console.log('[Save] Updated local cache, fldr now has', newFldr.photos?.length || 0, 'photos')

      // Also update the list cache so changes appear on list page
      try {
        const listCache = localStorage.getItem('git-fldrs')
        if (listCache) {
          const allFldrs = JSON.parse(listCache)
          const index = allFldrs.findIndex((f: Fldr) => f.id === currentFldr.id)
          if (index !== -1) {
            allFldrs[index] = newFldr
            localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
          }
        }
      } catch (e) {
        console.error('Failed to update list cache:', e)
      }

      // If online, save to server
      if (isOnline()) {
        console.log('[Server] Online - sending PATCH request to server...')
        try {
          const body = JSON.stringify(effectiveUpdates)
          const response = await fetch(`/api/fldrs/${currentFldr.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body,
            // Lets a save that's already on its way finish if the page is closed.
            // Browsers only allow this for small requests (64 KB), which is every save but photos.
            keepalive: new Blob([body]).size < 60000,
          })
          if (response.ok) {
            const updated = await response.json()
            console.log('[Server] Server save successful! Server now has', updated.photos?.length || 0, 'photos')
            // The server's copy, with anything typed since this save went out laid back over it
            const merged = adoptServerFldr(updated)
            setLastSaved(new Date())

            // Update list cache with server response
            try {
              const listCache = localStorage.getItem('git-fldrs')
              if (listCache) {
                const allFldrs = JSON.parse(listCache)
                const index = allFldrs.findIndex((f: Fldr) => f.id === currentFldr.id)
                if (index !== -1) {
                  allFldrs[index] = merged
                  localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
                }
              }
            } catch (e) {
              console.error('Failed to update list cache:', e)
            }
          } else {
            // Server returned an error
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            console.error('[Server] Server save failed:', response.status, errorData)
            // Add to sync queue on server error
            addToSyncQueue(currentFldr.id, effectiveUpdates)
            setHasUnsynced(true)
            if (effectiveUpdates.photos) {
              console.log('[Sync] Photo save failed on server, added to sync queue')
            }
          }
        } catch (error) {
          // If save fails, add to sync queue
          console.log('[Sync] Server save failed, adding to sync queue:', error)
          addToSyncQueue(currentFldr.id, effectiveUpdates)
          setHasUnsynced(true)
          if (effectiveUpdates.photos) {
            console.log('[Sync] Photo saved to sync queue, will sync when online')
          }
        }
      } else {
        // Offline: add to sync queue
        console.log('[Network] Offline - adding changes to sync queue')
        addToSyncQueue(currentFldr.id, effectiveUpdates)
        setHasUnsynced(true)
        if (effectiveUpdates.photos) {
          console.log('[Sync] Photo saved to sync queue, will sync when online')
        }
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      savesInFlightRef.current--
    }
  }, [adoptServerFldr])

  // Saves `updates` along with anything typed and not sent yet. Call it with {} to just
  // send what's waiting. The returned promise settles once all of it has gone out.
  //
  // Only one save is ever on its way at a time: the server reads the job, merges and
  // writes it back, so two saves crossing would have the second undo the first. Whatever
  // turns up while one is out waits in pendingRef and goes with the next.
  const saveFldr = useCallback((updates: Partial<Fldr>): Promise<void> => {
    const currentFldr = fldrRef.current
    if (!currentFldr) return Promise.resolve()
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (Object.keys(updates).length > 0) {
      // On screen and in the waiting pile right away, whether or not another save is still out
      pendingRef.current = mergeFldrUpdates(pendingRef.current, updates)
      const next = mergeFldrUpdates(currentFldr, updates)
      fldrRef.current = next
      setFldr(next)
    }
    if (!savePumpRef.current) {
      setAutoSaving(true)
      savePumpRef.current = (async () => {
        while (Object.keys(pendingRef.current).length > 0) {
          await sendPending()
        }
      })().finally(() => {
        savePumpRef.current = null
        setAutoSaving(false)
      })
    }
    return savePumpRef.current
  }, [sendPending])

  // Save button: sends whatever is waiting (and nothing else, so a phone holding an
  // older copy of the job can't write it over newer changes)
  const manualSave = useCallback(async () => {
    if (!fldrRef.current) return
    setSaving(true)
    try {
      await saveFldr({})
      // Anything that couldn't reach the server earlier gets another go
      if (isOnline() && hasUnsyncedChanges()) {
        const synced = await syncQueuedChanges()
        if (synced) setHasUnsynced(false)
      }
    } finally {
      setSaving(false)
    }
  }, [saveFldr])

  // Save shortly after typing stops. Edits to different parts of the job pile up in
  // pendingRef until they're sent, so one never pushes another out.
  const debouncedSave = useCallback((updates: Partial<Fldr>) => {
    pendingRef.current = mergeFldrUpdates(pendingRef.current, updates)
    setUnsavedChanges(true)
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    // Don't set saving=true here - let saveFldr do it when save actually starts
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null
      saveFldr({})
    }, 2500)
  }, [saveFldr])

  // Waiting on return finishes by itself once the last jig is checked in
  useEffect(() => {
    if (fldr?.job_status !== 'awaiting_return') return
    if (!jobJigs.loaded || jobJigs.loading || jobJigs.problem) return
    if (jigsOut > 0) {
      // Something is out now, so a later empty count means it all came back
      heldWaitingRef.current = false
      return
    }
    // Picked by hand with nothing out yet: leave it be until jigs go out and return
    if (heldWaitingRef.current) return
    setFldr(prev => (prev ? { ...prev, job_status: 'complete' } : prev))
    saveFldr({ job_status: 'complete' })
  }, [fldr?.job_status, jobJigs.loaded, jobJigs.loading, jobJigs.problem, jigsOut, saveFldr])

  // Send what's waiting right now - used before navigation/UI actions, and when a card's form is closed
  const flushAndSave = useCallback(async () => {
    await saveFldr({})
  }, [saveFldr])
  const flushPending = useCallback(() => {
    saveFldr({})
  }, [saveFldr])

  // Leaving with edits still waiting: hand them to the browser to deliver after the page is gone
  const beaconPending = useCallback(() => {
    const current = fldrRef.current
    const updates = pendingRef.current
    if (!current || Object.keys(updates).length === 0) return
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    pendingRef.current = {}
    if (!isOnline()) {
      addToSyncQueue(current.id, updates)
      return
    }
    const body = JSON.stringify(updates)
    const sent = navigator.sendBeacon?.(`/api/fldrs/${current.id}`, body)
    if (!sent) {
      fetch(`/api/fldrs/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => addToSyncQueue(current.id, updates))
    }
  }, [])

  // Save before closing the page, and whenever it goes into the background
  // (a phone often never fires the "closing" event at all)
  useEffect(() => {
    const handleHidden = () => {
      if (document.visibilityState === 'hidden') saveFldr({})
    }
    window.addEventListener('beforeunload', beaconPending)
    window.addEventListener('pagehide', beaconPending)
    document.addEventListener('visibilitychange', handleHidden)
    return () => {
      window.removeEventListener('beforeunload', beaconPending)
      window.removeEventListener('pagehide', beaconPending)
      document.removeEventListener('visibilitychange', handleHidden)
      // Navigating to another page in the app: same thing
      beaconPending()
    }
  }, [beaconPending, saveFldr])

  // Update "time ago" display every minute
  useEffect(() => {
    if (!lastSaved) return
    const interval = setInterval(() => {
      // Force re-render to update "time ago" text
      setRefreshCounter(c => c + 1)
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [lastSaved])

  const toggleCard = (cardName: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }))
  }

  // The sections of the page, as the jump bar lists them. Time off has no event or logistics to show.
  const isJob = fldr?.fldr_type !== 'time_off'
  const navSections = useMemo(
    () =>
      isJob
        ? [
            { id: 'overview', label: 'Overview' },
            { id: 'event', label: 'Event' },
            { id: 'logistics', label: 'Logistics' },
            { id: 'travel', label: 'Travel' },
            { id: 'team', label: 'Team' },
            { id: 'more', label: 'More' },
          ]
        : [
            { id: 'overview', label: 'Overview' },
            { id: 'travel', label: 'Travel' },
            { id: 'team', label: 'Team' },
            { id: 'more', label: 'More' },
          ],
    [isJob]
  )

  const jumpToSection = (id: string) => {
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Opens a card and brings it into view (the Job Summary uses this for what's still missing)
  const jumpToCard = (card: string) => {
    setExpandedCards(prev => ({ ...prev, [card]: true }))
    // Give the card a moment to open before finding where it is
    requestAnimationFrame(() => {
      document.getElementById(`card-${card}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  // Light up the section that's at the top of the screen
  const jobLoaded = !loading && !!fldr
  useEffect(() => {
    if (!jobLoaded) return
    let frame = 0
    const update = () => {
      frame = 0
      let current = navSections[0].id
      for (const section of navSections) {
        const el = document.getElementById(`sec-${section.id}`)
        if (el && el.getBoundingClientRect().top <= 130) current = section.id
      }
      // The last section can be too short to ever reach the top
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = navSections[navSections.length - 1].id
      }
      setActiveSection(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [jobLoaded, navSections])

  // Format dates in local timezone to avoid day-off errors
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

  const updateFlightSegment = (segmentIndex: number, field: keyof FlightSegment, value: string) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    const segments = [...fldr.flight_info]
    segments[segmentIndex] = { ...segments[segmentIndex], [field]: value || null }
    
    // Auto-detect job status based on flight info
    const autoStatus = autoDetectJobStatus({ ...fldr, flight_info: segments })
    const updates = autoStatus ? { flight_info: segments, job_status: autoStatus } : { flight_info: segments }
    
    setFldr({ ...fldr, ...updates })
    debouncedSave(updates)
  }

  const addSegmentTraveler = (segmentIndex: number, name: string) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    const trimmed = name.trim()
    if (!trimmed) return
    const segments = [...fldr.flight_info]
    const existing = segments[segmentIndex].travelers || []
    if (existing.some(t => t.toLowerCase() === trimmed.toLowerCase())) return
    segments[segmentIndex] = { ...segments[segmentIndex], travelers: [...existing, trimmed] }
    setFldr({ ...fldr, flight_info: segments })
    debouncedSave({ flight_info: segments })
  }

  const removeSegmentTraveler = (segmentIndex: number, travelerIndex: number) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    const segments = [...fldr.flight_info]
    const existing = segments[segmentIndex].travelers || []
    const travelers = existing.filter((_, i) => i !== travelerIndex)
    segments[segmentIndex] = { ...segments[segmentIndex], travelers: travelers.length > 0 ? travelers : null }
    setFldr({ ...fldr, flight_info: segments })
    debouncedSave({ flight_info: segments })
  }

  const updateSegmentDepartureAirport = (segmentIndex: number, airport: { name: string; code: string; address: string }) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    const segments = [...fldr.flight_info]
    segments[segmentIndex] = {
      ...segments[segmentIndex],
      departure_airport: airport.name,
      departure_code: airport.code,
      departure_address: airport.address,
    }
    
    // Auto-detect job status based on flight info
    const autoStatus = autoDetectJobStatus({ ...fldr, flight_info: segments })
    const updates = autoStatus ? { flight_info: segments, job_status: autoStatus } : { flight_info: segments }
    
    setFldr({ ...fldr, ...updates })
    debouncedSave(updates)
  }

  const updateSegmentArrivalAirport = (segmentIndex: number, airport: { name: string; code: string; address: string }) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    const segments = [...fldr.flight_info]
    segments[segmentIndex] = {
      ...segments[segmentIndex],
      arrival_airport: airport.name,
      arrival_code: airport.code,
      arrival_address: airport.address,
    }
    
    // Auto-detect job status based on flight info
    const autoStatus = autoDetectJobStatus({ ...fldr, flight_info: segments })
    const updates = autoStatus ? { flight_info: segments, job_status: autoStatus } : { flight_info: segments }
    
    setFldr({ ...fldr, ...updates })
    debouncedSave(updates)
  }

  const addFlightSegment = () => {
    if (!fldr) return
    // Initialize flight_info as empty array if it's null
    const currentSegments = fldr.flight_info || []
    const newSegment: FlightSegment = {
      id: crypto.randomUUID(),
      departure_airport: null,
      departure_code: null,
      departure_address: null,
      departure_time: null,
      arrival_airport: null,
      arrival_code: null,
      arrival_address: null,
      arrival_time: null,
      flight_number: null,
      airline: null,
      confirmation: null,
      notes: null,
      segment_type: currentSegments.length === 0 ? 'outbound' : 'connection',
      travelers: null,
    }
    const segments = [...currentSegments, newSegment]
    setFldr({ ...fldr, flight_info: segments })
    debouncedSave({ flight_info: segments })
  }

  const toggleRoundTrip = async (checked: boolean) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    setIsRoundTrip(checked)
    
    if (checked) {
      // Find the first outbound segment to use as basis for return flight
      const outboundSegment = fldr.flight_info.find(seg => seg.segment_type === 'outbound') || fldr.flight_info[0]
      
      if (!outboundSegment) return
      
      // Check if return segment already exists
      const hasReturnSegment = fldr.flight_info.some(seg => seg.segment_type === 'return')
      
      if (!hasReturnSegment) {
        // Create return segment with reversed airports
        const returnSegment: FlightSegment = {
          id: crypto.randomUUID(),
          departure_airport: outboundSegment.arrival_airport,
          departure_code: outboundSegment.arrival_code,
          departure_address: outboundSegment.arrival_address,
          departure_time: null, // User fills in return time
          arrival_airport: outboundSegment.departure_airport,
          arrival_code: outboundSegment.departure_code,
          arrival_address: outboundSegment.departure_address,
          arrival_time: null, // User fills in arrival time
          flight_number: null, // User fills in return flight number
          airline: outboundSegment.airline, // Copy airline
          confirmation: null, // User fills in return confirmation
          notes: null,
          segment_type: 'return',
          travelers: outboundSegment.travelers,
        }
        
        const segments = [...fldr.flight_info, returnSegment]
        setFldr({ ...fldr, flight_info: segments })
        // Save immediately (no debounce) so map sees the change
        await saveFldr({ flight_info: segments })
      }
    } else {
      // Remove return segment when unchecked
      const segments = fldr.flight_info.filter(seg => seg.segment_type !== 'return')
      setFldr({ ...fldr, flight_info: segments })
      // Save immediately (no debounce) so map sees the change
      await saveFldr({ flight_info: segments })
    }
  }

  const removeFlightSegment = (segmentIndex: number) => {
    if (!fldr || !fldr.flight_info || !Array.isArray(fldr.flight_info)) return
    const segments = fldr.flight_info.filter((_, i) => i !== segmentIndex)
    setFldr({ ...fldr, flight_info: segments })
    debouncedSave({ flight_info: segments })
  }

  const updateHotelInfo = (field: keyof HotelInfo, value: string) => {
    if (!fldr) return
    const hotelInfo = fldr.hotel_info || {
      name: null,
      address: null,
      phone: null,
      confirmation: null,
      check_in: null,
      check_out: null,
      notes: null,
    }
    const updated = { ...hotelInfo, [field]: value || null }
    
    // Auto-detect job status based on hotel info
    const autoStatus = autoDetectJobStatus({ ...fldr, hotel_info: updated })
    const updates = autoStatus ? { hotel_info: updated, job_status: autoStatus } : { hotel_info: updated }
    
    setFldr({ ...fldr, ...updates })
    debouncedSave(updates)
  }

  const updateVenueInfo = (field: keyof VenueInfo, value: string) => {
    const currentFldr = fldrRef.current
    if (!currentFldr) return
    const venueInfo = currentFldr.venue_info || {
      name: null,
      address: null,
      contact_name: null,
      contact_phone: null,
      notes: null,
    }
    const updated = { ...venueInfo, [field]: value || null }
    const nextFldr = { ...currentFldr, venue_info: updated }
    fldrRef.current = nextFldr
    setFldr(nextFldr)
    debouncedSave({ venue_info: updated })
  }

  const updateRentalCarInfo = (field: keyof RentalCarInfo, value: string) => {
    if (!fldr) return
    const rentalCarInfo = fldr.rental_car_info || {
      company: null,
      confirmation: null,
      pickup_location: null,
      pickup_time: null,
      dropoff_location: null,
      dropoff_time: null,
      vehicle_type: null,
      insurance_policy_number: null,
      travel_reservation: null,
      notes: null,
    }
    const updated = { ...rentalCarInfo, [field]: value || null }
    setFldr({ ...fldr, rental_car_info: updated })
    debouncedSave({ rental_car_info: updated })
  }

  // Auto-detect job status based on confirmed info
  const autoDetectJobStatus = (fldrData: Partial<Fldr>): JobStatus | null => {
    // Only auto-detect if user is attending
    if (!fldr?.attending) return null
    
    const hasFlight = fldrData.flight_info && Array.isArray(fldrData.flight_info) && fldrData.flight_info.length > 0 &&
      fldrData.flight_info.some(f => f.departure_airport || f.arrival_airport || f.confirmation)
    
    const hasHotel = fldrData.hotel_info && (fldrData.hotel_info.name || fldrData.hotel_info.confirmation || fldrData.hotel_info.address)
    
    // If both flight and hotel are confirmed, mark as confirmed
    if (hasFlight && hasHotel) {
      return 'confirmed'
    }
    
    // If has either flight or hotel (but not both), mark as pending
    if (hasFlight || hasHotel) {
      return 'pending'
    }
    
    // If neither, leave as is (don't override manual settings)
    return null
  }

  const parseEmail = async () => {
    if (!fldr || !showParseEmailModal) return
    if (parseInputMode === 'text' && !parseEmailText.trim()) return
    if (parseInputMode === 'image' && !parseEmailImage) return

    setParsingEmail(true)

    try {
      const response = await fetch('/api/parse-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailText: parseInputMode === 'text' ? parseEmailText : undefined,
          imageData: parseInputMode === 'image' ? parseEmailImage : undefined,
          type: showParseEmailModal
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to parse email')
      }

      const data = result.data

      // Apply parsed data based on type
      if (showParseEmailModal === 'flight') {
        // Handle multiple flight segments (connecting flights, return flights, etc.)
        const currentSegments = fldr.flight_info || []
        const parsedFlights = data.flights || (data.flight_number ? [data] : []) // Handle both new array format and legacy single object format
        
        const newSegments: FlightSegment[] = parsedFlights.map((flight: any, index: number) => {
          // Determine segment type based on parsed data or position
          let segmentType: 'outbound' | 'connection' | 'return' = 'outbound'
          if (flight.segment_type) {
            segmentType = flight.segment_type as 'outbound' | 'connection' | 'return'
          } else if (currentSegments.length > 0 || index > 0) {
            // If there are existing segments or this isn't the first parsed flight
            segmentType = 'connection'
          }
          
          return {
            id: crypto.randomUUID(),
            departure_airport: flight.departure_airport || null,
            departure_code: flight.departure_code || null,
            departure_address: null,
            departure_time: flight.departure_time || null,
            arrival_airport: flight.arrival_airport || null,
            arrival_code: flight.arrival_code || null,
            arrival_address: null,
            arrival_time: flight.arrival_time || null,
            flight_number: flight.flight_number || null,
            airline: flight.airline || null,
            confirmation: flight.confirmation || null,
            notes: flight.notes || null,
            segment_type: segmentType,
            travelers: Array.isArray(flight.passenger_names) && flight.passenger_names.length > 0
              ? flight.passenger_names
              : null,
          }
        })
        
        const segments = [...currentSegments, ...newSegments]
        
        // Auto-detect job status based on parsed flight info
        const autoStatus = autoDetectJobStatus({ ...fldr, flight_info: segments })
        const updates = autoStatus ? { flight_info: segments, job_status: autoStatus } : { flight_info: segments }
        
        setFldr({ ...fldr, ...updates })
        debouncedSave(updates)
      } else if (showParseEmailModal === 'hotel') {
        const hotelInfo: HotelInfo = {
          name: data.name || null,
          address: data.address || null,
          phone: data.phone || null,
          confirmation: data.confirmation || null,
          check_in: data.check_in || null,
          check_out: data.check_out || null,
          notes: data.notes || null,
        }
        
        // Auto-detect job status based on parsed hotel info
        const autoStatus = autoDetectJobStatus({ ...fldr, hotel_info: hotelInfo })
        const updates = autoStatus ? { hotel_info: hotelInfo, job_status: autoStatus } : { hotel_info: hotelInfo }
        
        setFldr({ ...fldr, ...updates })
        debouncedSave(updates)
        setExpandedCards(prev => ({ ...prev, hotel: true }))
      } else if (showParseEmailModal === 'rental_car') {
        const rentalCarInfo: RentalCarInfo = {
          company: data.company || null,
          confirmation: data.confirmation || null,
          pickup_location: data.pickup_location || null,
          pickup_time: data.pickup_time || null,
          dropoff_location: data.dropoff_location || null,
          dropoff_time: data.dropoff_time || null,
          vehicle_type: data.vehicle_type || null,
          insurance_policy_number: null,
          travel_reservation: null,
          notes: data.notes || null,
        }
        setFldr({ ...fldr, rental_car_info: rentalCarInfo })
        debouncedSave({ rental_car_info: rentalCarInfo })
        setExpandedCards(prev => ({ ...prev, rentalCar: true }))
      }

      // Close modal and reset
      setShowParseEmailModal(null)
      setParseEmailText('')
      setParseEmailImage(null)
      setParseInputMode('text')
    } catch (error) {
      console.error('Parse email error:', error)
      alert(error instanceof Error ? error.message : 'Failed to parse email')
    } finally {
      setParsingEmail(false)
    }
  }

  // Helper function to calculate days until job starts
  const getDaysUntilJob = () => {
    if (!fldr?.date_start) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [year, month, day] = fldr.date_start.split('-').map(Number)
    const jobDate = new Date(year, month - 1, day)
    const diffTime = jobDate.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Helper function to calculate days until first flight
  const getDaysUntilFlight = () => {
    if (!fldr?.flight_info || fldr.flight_info.length === 0) return null
    // Find the earliest departure
    const departures = fldr.flight_info
      .filter(f => f.departure_time)
      .map(f => new Date(f.departure_time!))
    if (departures.length === 0) return null
    
    const earliestFlight = new Date(Math.min(...departures.map(d => d.getTime())))
    earliestFlight.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const diffTime = earliestFlight.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const generateSmartItinerary = async () => {
    if (!fldr) return

    setGeneratingItinerary(true)

    try {
      // Build comprehensive job context for AI analysis
      const jobData: any = {}

      // === FLIGHTS (with calculated durations) ===
      if (fldr.flight_info && fldr.flight_info.length > 0) {
        const flightDetails = fldr.flight_info.map((f, idx) => {
          const parts: string[] = []
          parts.push(`Segment ${idx + 1}: ${f.airline || ''} ${f.flight_number || ''}`)
          parts.push(`${f.departure_code || f.departure_airport} → ${f.arrival_code || f.arrival_airport}`)
          
          if (f.departure_time && f.arrival_time) {
            const depTime = new Date(f.departure_time)
            const arrTime = new Date(f.arrival_time)
            const durationMs = arrTime.getTime() - depTime.getTime()
            const hours = Math.floor(durationMs / (1000 * 60 * 60))
            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
            
            // Format times more explicitly for AI
            const depFormatted = depTime.toLocaleString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric',
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            })
            const arrFormatted = arrTime.toLocaleString('en-US', { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric',
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            })
            
            parts.push(`DEPARTS: ${depFormatted}`)
            parts.push(`ARRIVES: ${arrFormatted}`)
            parts.push(`Duration: ${hours}h ${minutes}m`)
          } else {
            if (f.departure_time) {
              const depTime = new Date(f.departure_time)
              parts.push(`DEPARTS: ${depTime.toLocaleString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
              })}`)
            }
            if (f.arrival_time) {
              const arrTime = new Date(f.arrival_time)
              parts.push(`ARRIVES: ${arrTime.toLocaleString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
              })}`)
            }
          }
          
          if (f.departure_address) parts.push(`Departure Airport: ${f.departure_address}`)
          if (f.arrival_address) parts.push(`Arrival Airport: ${f.arrival_address}`)
          return parts.join(' | ')
        }).join('\n')
        jobData.flights = flightDetails
      }

      // === HOTEL ===
      if (fldr.hotel_info) {
        const hotelParts: string[] = []
        if (fldr.hotel_info.name) hotelParts.push(`Name: ${fldr.hotel_info.name}`)
        if (fldr.hotel_info.address) hotelParts.push(`Address: ${fldr.hotel_info.address}`)
        if (fldr.hotel_info.check_in) {
          const checkInTime = new Date(fldr.hotel_info.check_in)
          hotelParts.push(`CHECK-IN: ${checkInTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
        }
        if (fldr.hotel_info.check_out) {
          const checkOutTime = new Date(fldr.hotel_info.check_out)
          hotelParts.push(`CHECK-OUT: ${checkOutTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
        }
        jobData.hotel = hotelParts.join(' | ')
      }

      // === VENUE ===
      if (fldr.venue_info) {
        const venueParts: string[] = []
        if (fldr.venue_info.name) venueParts.push(`Name: ${fldr.venue_info.name}`)
        if (fldr.venue_info.address) venueParts.push(`Address: ${fldr.venue_info.address}`)
        if (fldr.venue_info.contact_phone) venueParts.push(`Phone: ${fldr.venue_info.contact_phone}`)
        jobData.venue = venueParts.join(' | ')
      }

      // === EVENT SCHEDULE (with calculated duration) ===
      const scheduleParts: string[] = []
      if (fldr.job_info?.show_up_time) {
        const showUpTime = new Date(fldr.job_info.show_up_time)
        scheduleParts.push(`SHOW UP TIME: ${showUpTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
      }
      if (fldr.job_info?.job_start_time) {
        const startTime = new Date(fldr.job_info.job_start_time)
        scheduleParts.push(`EVENT START: ${startTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
      }
      if (fldr.job_info?.job_end_time) {
        const endTime = new Date(fldr.job_info.job_end_time)
        scheduleParts.push(`EVENT END: ${endTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
      }
      
      // Calculate event duration
      if (fldr.job_info?.job_start_time && fldr.job_info?.job_end_time) {
        const startTime = new Date(fldr.job_info.job_start_time)
        const endTime = new Date(fldr.job_info.job_end_time)
        const durationMs = endTime.getTime() - startTime.getTime()
        const hours = Math.floor(durationMs / (1000 * 60 * 60))
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60))
        scheduleParts.push(`Event Duration: ${hours}h ${minutes}m`)
      }
      
      if (scheduleParts.length > 0) {
        jobData.eventSchedule = scheduleParts.join(' | ')
      }

      // === RENTAL CAR ===
      if (fldr.rental_car_info) {
        const carParts: string[] = []
        if (fldr.rental_car_info.company) carParts.push(`Company: ${fldr.rental_car_info.company}`)
        if (fldr.rental_car_info.pickup_location) carParts.push(`Pickup: ${fldr.rental_car_info.pickup_location}`)
        if (fldr.rental_car_info.pickup_time) {
          const pickupTime = new Date(fldr.rental_car_info.pickup_time)
          carParts.push(`at ${pickupTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
        }
        if (fldr.rental_car_info.dropoff_location) carParts.push(`Dropoff: ${fldr.rental_car_info.dropoff_location}`)
        if (fldr.rental_car_info.dropoff_time) {
          const dropoffTime = new Date(fldr.rental_car_info.dropoff_time)
          carParts.push(`at ${dropoffTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`)
        }
        jobData.rentalCar = carParts.join(' | ')
      }

      // === EQUIPMENT PICKUP (Office Location) ===
      jobData.equipmentPickup = '925 Poinsettia Ave, Vista, CA 92081'
      jobData.equipmentNote = 'NOTE: Equipment (XTool cases) stored at office location. Travel time from home/current location to office will vary per person and depends on day of week, time of day, and traffic conditions.'

      // === CALCULATE DRIVE TIMES (using Google Maps Distance Matrix API) ===
      const driveTimeSegments: string[] = []
      
      try {
        // Get addresses
        const arrivalAirport = fldr.flight_info?.[fldr.flight_info.length - 1]?.arrival_address
        const departureAirport = fldr.flight_info?.[0]?.departure_address
        const hotelAddress = fldr.hotel_info?.address
        const venueAddress = fldr.venue_info?.address
        
        // Calculate Airport → Hotel
        if (arrivalAirport && hotelAddress) {
          const response = await fetch(`/api/distance?origin=${encodeURIComponent(arrivalAirport)}&destination=${encodeURIComponent(hotelAddress)}`)
          if (response.ok) {
            const data = await response.json()
            if (data.distance && data.duration) {
              driveTimeSegments.push(`Airport → Hotel: ${data.distance} (${data.duration})`)
            }
          }
        }
        
        // Calculate Hotel → Venue
        if (hotelAddress && venueAddress) {
          const response = await fetch(`/api/distance?origin=${encodeURIComponent(hotelAddress)}&destination=${encodeURIComponent(venueAddress)}`)
          if (response.ok) {
            const data = await response.json()
            if (data.distance && data.duration) {
              driveTimeSegments.push(`Hotel → Venue: ${data.distance} (${data.duration})`)
            }
          }
        }
        
        // Calculate Venue → Airport (for departure)
        if (venueAddress && departureAirport) {
          const response = await fetch(`/api/distance?origin=${encodeURIComponent(venueAddress)}&destination=${encodeURIComponent(departureAirport)}`)
          if (response.ok) {
            const data = await response.json()
            if (data.distance && data.duration) {
              driveTimeSegments.push(`Venue → Airport: ${data.distance} (${data.duration})`)
            }
          }
        }
        
        // Calculate Airport → Venue (if no hotel)
        if (!hotelAddress && arrivalAirport && venueAddress) {
          const response = await fetch(`/api/distance?origin=${encodeURIComponent(arrivalAirport)}&destination=${encodeURIComponent(venueAddress)}`)
          if (response.ok) {
            const data = await response.json()
            if (data.distance && data.duration) {
              driveTimeSegments.push(`Airport → Venue: ${data.distance} (${data.duration})`)
            }
          }
        }
        
        if (driveTimeSegments.length > 0) {
          jobData.driveTimes = driveTimeSegments.join(' | ')
        }
      } catch (error) {
        console.error('Failed to calculate drive times:', error)
      }

      console.log('[AI] Generating smart itinerary with context:', Object.keys(jobData).join(', '))

      const response = await fetch('/api/smart-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobData })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate itinerary')
      }

      const aiItems = result.itinerary?.recommendations || []
      const aiOverview = result.itinerary?.overview || ''
      
      setGeneratedItineraryItems(aiItems)
      setGeneratedItineraryOverview(aiOverview)
      
      // Save AI suggestions to database to avoid regenerating
      setFldr({ ...fldr, ai_itinerary_items: aiItems, ai_itinerary_overview: aiOverview })
      await saveFldr({ ai_itinerary_items: aiItems, ai_itinerary_overview: aiOverview })
      
      console.log('[AI] Smart itinerary saved to database')
    } catch (error) {
      console.error('Failed to generate smart itinerary:', error)
      alert('Failed to generate smart itinerary. Please try again.')
    } finally {
      setGeneratingItinerary(false)
    }
  }



  // What a job's info starts from the first time one of its fields is filled in
  const emptyJobInfo = (): JobInfo => ({
    job_title: null,
    client_name: null,
    distributor_name: null,
    item: null,
    quantity: null,
    job_type: null,
    client_contact_name: null,
    client_contact_phone: null,
    client_contact_email: null,
    event_details: null,
    reference_links: [],
    team_members: [],
    pre_engrave_details: null,
    show_up_time: null,
    job_start_time: null,
    job_end_time: null,
    break_start_time: null,
    break_end_time: null,
    use_daily_schedule: false,
    daily_start_time: null,
    daily_end_time: null,
    daily_break_start: null,
    daily_break_end: null,
    prompt_1: null,
    prompt_2: null,
  })

  // One or several job info fields at once. Reads the job through the ref, so two
  // changes made back to back both land.
  const patchJobInfo = (patch: Partial<JobInfo>) => {
    const current = fldrRef.current
    if (!current) return
    const updated = { ...(current.job_info || emptyJobInfo()), ...patch }
    const next = { ...current, job_info: updated }
    fldrRef.current = next
    setFldr(next)
    debouncedSave({ job_info: updated })
  }

  const updateJobInfo = (field: keyof JobInfo, value: any) => {
    patchJobInfo({ [field]: value })
  }

  const updateTravelDates = (start: string | null, end: string | null) => {
    patchJobInfo({ travel_start: start, travel_end: end })
  }

  // The logistics list. Only the lines that changed are sent, so two people ticking
  // different steps on the same job never undo each other. Ticks and dates go up right
  // away; typing waits for a pause like everything else.
  const updateTracker = (patch: Partial<JobTracker>, now = false) => {
    const current = fldrRef.current
    if (!current) return
    const next = { ...current, tracker: { ...(current.tracker || {}), ...patch } }
    fldrRef.current = next
    setFldr(next)
    if (now) saveFldr({ tracker: patch })
    else debouncedSave({ tracker: patch })
  }

  const toggleTravelBooked = () => {
    const step = readStep(fldrRef.current?.tracker, 'travel_booked')
    const done = step.state === 'done'
    updateTracker({ travel_booked: { state: done ? 'todo' : 'done', date: done ? null : step.date || todayKey(), note: step.note } }, true)
  }

  const updateLocation = (value: string) => {
    const current = fldrRef.current
    if (!current) return
    const next = { ...current, location: value || null }
    fldrRef.current = next
    setFldr(next)
    debouncedSave({ location: value || null })
  }

  const addTeamMember = () => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      job_title: null,
      client_name: null,
      distributor_name: null,
      item: null,
      quantity: null,
      job_type: null,
      client_contact_name: null,
      client_contact_phone: null,
      client_contact_email: null,
      event_details: null,
      reference_links: [],
      team_members: [],
      pre_engrave_details: null,
      show_up_time: null,
      job_start_time: null,
      job_end_time: null,
      break_start_time: null,
      break_end_time: null,
      use_daily_schedule: false,
      daily_start_time: null,
      daily_end_time: null,
      daily_break_start: null,
      daily_break_end: null,
      prompt_1: null,
      prompt_2: null,
    }
    updateJobInfo('team_members', [...jobInfo.team_members, ''])
  }

  const updateTeamMember = (index: number, value: string) => {
    if (!fldr?.job_info) return
    const members = [...fldr.job_info.team_members]
    members[index] = value
    updateJobInfo('team_members', members)
  }

  const removeTeamMember = (index: number) => {
    if (!fldr?.job_info) return
    const members = fldr.job_info.team_members.filter((_, i) => i !== index)
    updateJobInfo('team_members', members)
  }

  const updateNotes = (value: string) => {
    if (!fldr) return
    setFldr({ ...fldr, notes: value })
    debouncedSave({ notes: value })
  }

  // Generate itinerary from all time-based data
  const generateItinerary = () => {
    if (!fldr) return {}

    interface ItineraryEvent {
      dateTime: Date
      type: string
      title: string
      details: string[]
      isAI?: boolean
      personalized?: boolean
    }

    const events: ItineraryEvent[] = []

    // Helper function to parse datetime strings consistently in local timezone
    const parseDateTime = (dateTimeStr: string): Date => {
      // Handle datetime-local format: "YYYY-MM-DDTHH:mm"
      if (dateTimeStr.includes('T')) {
        const [datePart, timePart] = dateTimeStr.split('T')
        const [year, month, day] = datePart.split('-').map(Number)
        const [hours, minutes] = timePart.split(':').map(Number)
        return new Date(year, month - 1, day, hours, minutes)
      }
      // Handle date-only format: "YYYY-MM-DD"
      const [year, month, day] = dateTimeStr.split('-').map(Number)
      return new Date(year, month - 1, day)
    }

    // Add flight segments
    if (fldr.flight_info && Array.isArray(fldr.flight_info)) {
      fldr.flight_info.forEach(segment => {
        if (segment.departure_time) {
          events.push({
            dateTime: parseDateTime(segment.departure_time),
            type: 'flight',
            title: `Flight Departure${segment.segment_type === 'return' ? ' (Return)' : ''}`,
            details: [
              segment.airline && segment.flight_number ? `${segment.airline} ${segment.flight_number}` : segment.airline || segment.flight_number || '',
              segment.departure_airport ? `From: ${segment.departure_airport}` : '',
              segment.arrival_airport ? `To: ${segment.arrival_airport}` : '',
              segment.confirmation ? `Confirmation: ${segment.confirmation}` : '',
              segment.travelers && segment.travelers.length > 0 ? `Travelers: ${segment.travelers.join(', ')}` : '',
            ].filter(d => d)
          })
        }
        if (segment.arrival_time) {
          events.push({
            dateTime: parseDateTime(segment.arrival_time),
            type: 'flight',
            title: `Flight Arrival${segment.segment_type === 'return' ? ' (Return)' : ''}`,
            details: [
              segment.arrival_airport || '',
              segment.travelers && segment.travelers.length > 0 ? `Travelers: ${segment.travelers.join(', ')}` : '',
            ].filter(d => d)
          })
        }
      })
    }

    // Add hotel check-in/out
    if (fldr.hotel_info) {
      if (fldr.hotel_info.check_in) {
        events.push({
          dateTime: parseDateTime(fldr.hotel_info.check_in),
          type: 'hotel',
          title: 'Hotel Check-in',
          details: [
            fldr.hotel_info.name || '',
            fldr.hotel_info.address || '',
            fldr.hotel_info.confirmation ? `Confirmation: ${fldr.hotel_info.confirmation}` : '',
          ].filter(d => d)
        })
      }
      if (fldr.hotel_info.check_out) {
        events.push({
          dateTime: parseDateTime(fldr.hotel_info.check_out),
          type: 'hotel',
          title: 'Hotel Check-out',
          details: [
            fldr.hotel_info.name || '',
          ].filter(d => d)
        })
      }
    }

    // Add rental car pickup/dropoff
    if (fldr.rental_car_info) {
      if (fldr.rental_car_info.pickup_time) {
        events.push({
          dateTime: parseDateTime(fldr.rental_car_info.pickup_time),
          type: 'rental',
          title: 'Rental Car Pickup',
          details: [
            fldr.rental_car_info.company || '',
            fldr.rental_car_info.pickup_location || '',
            fldr.rental_car_info.vehicle_type || '',
            fldr.rental_car_info.confirmation ? `Confirmation: ${fldr.rental_car_info.confirmation}` : '',
          ].filter(d => d)
        })
      }
      if (fldr.rental_car_info.dropoff_time) {
        events.push({
          dateTime: parseDateTime(fldr.rental_car_info.dropoff_time),
          type: 'rental',
          title: 'Rental Car Dropoff',
          details: [
            fldr.rental_car_info.dropoff_location || '',
          ].filter(d => d)
        })
      }
    }

    // Add job event times
    if (fldr.job_info) {
      // Show up time (always single event if provided)
      if (fldr.job_info.show_up_time) {
        events.push({
          dateTime: parseDateTime(fldr.job_info.show_up_time),
          type: 'job',
          title: 'Show Up Time',
          details: [
            fldr.job_info.job_title || fldr.job_info.client_name || '',
            fldr.venue_info?.name && fldr.venue_info.address ? `Venue: ${fldr.venue_info.name}` : '',
          ].filter(d => d)
        })
      }

      // Check if using daily schedule mode
      if (fldr.job_info.use_daily_schedule && fldr.date_start && fldr.date_end) {
        // Generate events for each day in the date range
        // Parse dates in local timezone to avoid day-off errors
        const [startYear, startMonth, startDay] = fldr.date_start.split('-').map(Number)
        const [endYear, endMonth, endDay] = fldr.date_end.split('-').map(Number)
        const startDate = new Date(startYear, startMonth - 1, startDay)
        const endDate = new Date(endYear, endMonth - 1, endDay)
        
        // Loop through each day
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0] // YYYY-MM-DD
          
          // Daily start time
          if (fldr.job_info.daily_start_time) {
            // Parse time in local timezone by constructing date from components
            const [hours, minutes] = fldr.job_info.daily_start_time.split(':').map(Number)
            const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes)
            events.push({
              dateTime: eventDate,
              type: 'job',
              title: 'Job Start',
              details: [
                fldr.job_info.job_title || fldr.job_info.client_name || '',
                fldr.job_info.item ? `Item: ${fldr.job_info.item}` : '',
              ].filter(d => d)
            })
          }
          
          // Daily break start
          if (fldr.job_info.daily_break_start) {
            const [hours, minutes] = fldr.job_info.daily_break_start.split(':').map(Number)
            const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes)
            events.push({
              dateTime: eventDate,
              type: 'job',
              title: 'Break Start',
              details: []
            })
          }
          
          // Daily break end
          if (fldr.job_info.daily_break_end) {
            const [hours, minutes] = fldr.job_info.daily_break_end.split(':').map(Number)
            const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes)
            events.push({
              dateTime: eventDate,
              type: 'job',
              title: 'Break End',
              details: []
            })
          }
          
          // Daily end time
          if (fldr.job_info.daily_end_time) {
            const [hours, minutes] = fldr.job_info.daily_end_time.split(':').map(Number)
            const eventDate = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes)
            events.push({
              dateTime: eventDate,
              type: 'job',
              title: 'Job End',
              details: [
                fldr.job_info.job_title || fldr.job_info.client_name || '',
              ].filter(d => d)
            })
          }
        }
      } else {
        // Single event times (original behavior)
        if (fldr.job_info.job_start_time) {
          events.push({
            dateTime: parseDateTime(fldr.job_info.job_start_time),
            type: 'job',
            title: 'Job Start',
            details: [
              fldr.job_info.job_title || fldr.job_info.client_name || '',
              fldr.job_info.item ? `Item: ${fldr.job_info.item}` : '',
            ].filter(d => d)
          })
        }
        if (fldr.job_info.break_start_time) {
          events.push({
            dateTime: parseDateTime(fldr.job_info.break_start_time),
            type: 'job',
            title: 'Break Start',
            details: []
          })
        }
        if (fldr.job_info.break_end_time) {
          events.push({
            dateTime: parseDateTime(fldr.job_info.break_end_time),
            type: 'job',
            title: 'Break End',
            details: []
          })
        }
        if (fldr.job_info.job_end_time) {
          events.push({
            dateTime: parseDateTime(fldr.job_info.job_end_time),
            type: 'job',
            title: 'Job End',
            details: [
              fldr.job_info.job_title || fldr.job_info.client_name || '',
            ].filter(d => d)
          })
        }
      }
    }

    // Sort by date/time
    events.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())

    // Group by day
    const groupedByDay: { [key: string]: ItineraryEvent[] } = {}
    events.forEach(event => {
      const dayKey = event.dateTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      if (!groupedByDay[dayKey]) {
        groupedByDay[dayKey] = []
      }
      groupedByDay[dayKey].push(event)
    })

    return groupedByDay
  }

  const addChecklistItem = () => {
    if (!fldr) return
    const checklist = fldr.checklist || []
    const newItem = { item: '', completed: false, category: 'general' as const }
    const updated = [...checklist, newItem]
    setFldr({ ...fldr, checklist: updated })
    debouncedSave({ checklist: updated })
  }

  const updateChecklistItem = (index: number, value: string) => {
    if (!fldr?.checklist) return
    const items = [...fldr.checklist]
    items[index] = { ...items[index], item: value }
    setFldr({ ...fldr, checklist: items })
    debouncedSave({ checklist: items })
  }

  const toggleChecklistItem = (index: number) => {
    if (!fldr?.checklist) return
    const items = [...fldr.checklist]
    items[index] = { ...items[index], completed: !items[index].completed }
    setFldr({ ...fldr, checklist: items })
    debouncedSave({ checklist: items })
  }

  const removeChecklistItem = (index: number) => {
    if (!fldr?.checklist) return
    const items = fldr.checklist.filter((_, i) => i !== index)
    setFldr({ ...fldr, checklist: items })
    debouncedSave({ checklist: items })
  }

  const addPerson = (name?: string) => {
    if (!fldr) return
    const people = fldr.people || []
    const newPerson: Person = { name: name || '', role: null, phone: null, email: null }
    const updated = [...people, newPerson]
    setFldr({ ...fldr, people: updated })
    debouncedSave({ people: updated })
  }

  const updatePerson = (index: number, field: keyof Person, value: string) => {
    if (!fldr?.people) return
    const people = [...fldr.people]
    people[index] = { ...people[index], [field]: value || null }
    setFldr({ ...fldr, people })
    debouncedSave({ people })
  }

  const handlePersonNameBlur = (name: string) => {
    // Auto-create profile when name field loses focus (user done typing)
    if (name && name.trim()) {
      try {
        addOrUpdateProfile(name.trim())
      } catch (e) {
        console.error('Failed to create profile:', e)
      }
    }
  }

  const removePerson = (index: number) => {
    if (!fldr?.people) return
    const people = fldr.people.filter((_, i) => i !== index)
    setFldr({ ...fldr, people })
    debouncedSave({ people })
  }

  // Photo handlers
  const addPhoto = (url: string) => {
    if (!fldr) return
    const photos = fldr.photos || []
    const newPhoto: Photo = {
      id: `photo_${Date.now()}`,
      url,
      caption: null,
      uploaded_at: new Date().toISOString(),
    }
    const updated = [...photos, newPhoto]
    console.log('[Photo] Adding photo:', { photoId: newPhoto.id, totalPhotos: updated.length })
    setFldr({ ...fldr, photos: updated })
    debouncedSave({ photos: updated })
    console.log('[Photo] Photo added to local state, will save in 1 second...')
  }

  const updatePhotoCaption = (index: number, caption: string) => {
    if (!fldr?.photos) return
    const photos = [...fldr.photos]
    photos[index] = { ...photos[index], caption: caption || null }
    setFldr({ ...fldr, photos })
    debouncedSave({ photos })
  }

  const removePhoto = (index: number) => {
    if (!fldr?.photos) return
    const photos = fldr.photos.filter((_, i) => i !== index)
    setFldr({ ...fldr, photos })
    debouncedSave({ photos })
  }

  // Product handlers
  const addProduct = () => {
    if (!fldr) return
    const products = fldr.products || []
    const newProduct: Product = {
      id: `product_${Date.now()}`,
      name: '',
      sku: null,
      quantity: 1,
      notes: null,
    }
    const updated = [...products, newProduct]
    setFldr({ ...fldr, products: updated })
    debouncedSave({ products: updated })
  }

  const updateProduct = (index: number, field: keyof Product, value: any) => {
    if (!fldr?.products) return
    const products = [...fldr.products]
    products[index] = { ...products[index], [field]: field === 'quantity' ? Number(value) : (value || null) }
    setFldr({ ...fldr, products })
    debouncedSave({ products })
  }

  const removeProduct = (index: number) => {
    if (!fldr?.products) return
    const products = fldr.products.filter((_, i) => i !== index)
    setFldr({ ...fldr, products })
    debouncedSave({ products })
  }

  const enableModule = async (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'checklist' | 'people' | 'job_info' | 'photos' | 'products') => {
    if (!fldr) return
    if (module === 'flight_info') {
      setFldr({ ...fldr, flight_info: [] })
      await saveFldr({ flight_info: [] })
      setExpandedCards(prev => ({ ...prev, flight: true }))
    } else if (module === 'hotel_info') {
      const hotelInfo: HotelInfo = {
        name: null,
        address: null,
        phone: null,
        confirmation: null,
        check_in: null,
        check_out: null,
        notes: null,
      }
      setFldr({ ...fldr, hotel_info: hotelInfo })
      await saveFldr({ hotel_info: hotelInfo })
      setExpandedCards(prev => ({ ...prev, hotel: true }))
    } else if (module === 'venue_info') {
      const venueInfo: VenueInfo = {
        name: null,
        address: null,
        contact_name: null,
        contact_phone: null,
        notes: null,
      }
      setFldr({ ...fldr, venue_info: venueInfo })
      await saveFldr({ venue_info: venueInfo })
      setExpandedCards(prev => ({ ...prev, venue: true }))
    } else if (module === 'rental_car_info') {
      const rentalCarInfo: RentalCarInfo = {
        company: null,
        confirmation: null,
        pickup_location: null,
        pickup_time: null,
        dropoff_location: null,
        dropoff_time: null,
        vehicle_type: null,
        insurance_policy_number: null,
        travel_reservation: null,
        notes: null,
      }
      setFldr({ ...fldr, rental_car_info: rentalCarInfo })
      await saveFldr({ rental_car_info: rentalCarInfo })
      setExpandedCards(prev => ({ ...prev, rentalCar: true }))
    } else if (module === 'checklist') {
      setFldr({ ...fldr, checklist: [] })
      await saveFldr({ checklist: [] })
      setExpandedCards(prev => ({ ...prev, checklist: true }))
    } else if (module === 'people') {
      setFldr({ ...fldr, people: [] })
      await saveFldr({ people: [] })
      setExpandedCards(prev => ({ ...prev, people: true }))
    } else if (module === 'photos') {
      setFldr({ ...fldr, photos: [] })
      await saveFldr({ photos: [] })
      setExpandedCards(prev => ({ ...prev, photos: true }))
    } else if (module === 'products') {
      setFldr({ ...fldr, products: [] })
      await saveFldr({ products: [] })
      setExpandedCards(prev => ({ ...prev, products: true }))
    } else if (module === 'job_info') {
      const jobInfo: JobInfo = {
        job_title: null,
        client_name: null,
        distributor_name: null,
        item: null,
        quantity: null,
        job_type: null,
        client_contact_name: null,
        client_contact_phone: null,
        client_contact_email: null,
        event_details: null,
        reference_links: [],
        team_members: [],
        pre_engrave_details: null,
        show_up_time: null,
        job_start_time: null,
        job_end_time: null,
        break_start_time: null,
        break_end_time: null,
        use_daily_schedule: false,
        daily_start_time: null,
        daily_end_time: null,
        daily_break_start: null,
        daily_break_end: null,
        prompt_1: null,
        prompt_2: null,
      }
      setFldr({ ...fldr, job_info: jobInfo })
      await saveFldr({ job_info: jobInfo })
      setExpandedCards(prev => ({ ...prev, jobInfo: true, preTrip: true }))
    }
  }

  const hasModuleData = (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'job_info' | 'checklist' | 'people' | 'photos' | 'products'): boolean => {
    if (!fldr) return false
    
    if (module === 'flight_info' && fldr.flight_info && Array.isArray(fldr.flight_info)) {
      return fldr.flight_info.length > 0 && fldr.flight_info.some(seg => 
        seg.departure_airport || seg.arrival_airport || seg.airline || seg.flight_number
      )
    } else if (module === 'hotel_info' && fldr.hotel_info) {
      return !!(fldr.hotel_info.name || fldr.hotel_info.address)
    } else if (module === 'venue_info' && fldr.venue_info) {
      return !!(fldr.venue_info.name || fldr.venue_info.address)
    } else if (module === 'rental_car_info' && fldr.rental_car_info) {
      return !!(fldr.rental_car_info.company || fldr.rental_car_info.pickup_location)
    } else if (module === 'job_info' && fldr.job_info) {
      return !!(
        fldr.job_info.job_title ||
        fldr.job_info.client_name ||
        fldr.job_info.item
      )
    } else if (module === 'checklist' && fldr.checklist) {
      return fldr.checklist.length > 0
    } else if (module === 'people' && fldr.people) {
      return fldr.people.length > 0
    } else if (module === 'photos' && fldr.photos) {
      return fldr.photos.length > 0
    } else if (module === 'products' && fldr.products) {
      return fldr.products.length > 0
    }
    
    return false
  }

  const disableModule = async (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'job_info' | 'checklist' | 'people' | 'photos' | 'products') => {
    if (!fldr) return
    
    const hasData = hasModuleData(module)
    
    if (hasData) {
      setConfirmDialog({ type: 'module', module })
      return
    }
    
    // Remove the module - save immediately (not debounced) to prevent it from coming back
    setFldr({ ...fldr, [module]: null })
    await saveFldr({ [module]: null })
    setExpandedCards(prev => ({ ...prev, [module.replace('_info', '')]: false }))
  }

  const updateStatus = async (newStatus: 'incomplete' | 'ready' | 'active' | 'complete') => {
    if (!fldr) return
    setSaving(true)
    try {
      setFldr({ ...fldr, status: newStatus })
      await saveFldr({ status: newStatus })
    } finally {
      setSaving(false)
    }
  }

  const handleSync = async () => {
    if (!isOnline()) return
    setSaving(true)
    const success = await syncQueuedChanges()
    if (success) {
      setHasUnsynced(false)
      // Don't fetch from server - it might be stale
      // Local cache is the source of truth
    }
    setSaving(false)
  }

  const handleHardRefresh = async () => {
    setConfirmDialog({ type: 'hardRefresh' })
  }

  const enableEditMode = () => {
    if (!fldr) return
    setEditTitle(fldr.title)
    setEditDateStart(fldr.date_start)
    setEditDateEnd(fldr.date_end || '')
    setEditLocation(fldr.location || '')
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
  }

  const saveBasicInfo = async () => {
    if (!fldr || !editTitle.trim() || !editDateStart) return
    
    setSaving(true)
    const updates = {
      title: editTitle,
      date_start: editDateStart,
      date_end: editDateEnd || null,
      location: editLocation || null,
    }
    
    setFldr({ ...fldr, ...updates })
    await saveFldr(updates)
    setEditMode(false)
    setSaving(false)
  }

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStartY(e.touches[0].clientY)
      setIsPulling(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || window.scrollY > 0) return
    
    const currentY = e.touches[0].clientY
    const distance = currentY - touchStartY
    
    if (distance > 0 && distance < 150) {
      setPullDistance(distance)
    }
  }

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setIsRefreshing(true)
      await handleRefresh()
    }
    setIsPulling(false)
    setPullDistance(0)
    setTouchStartY(0)
  }

  const duplicateJob = async () => {
    if (!fldr) return
    setConfirmDialog({ type: 'duplicate' })
  }

  const doDuplicateJob = async () => {
    if (!fldr) return
    setConfirmDialog(null)
    
    setSaving(true)
    
    try {
      // Create new fldr with duplicated data
      const newFldr: Omit<Fldr, 'id' | 'created_at' | 'updated_at'> = {
        title: `${fldr.title} (Copy)`,
        date_start: fldr.date_start,
        date_end: fldr.date_end,
        location: fldr.location,
        status: 'incomplete',
        job_status: 'pending',
        archived: false,
        attending: fldr.attending,
        created_by: null,
        assigned_to: null,
        flight_info: fldr.flight_info ? JSON.parse(JSON.stringify(fldr.flight_info)) : null,
        hotel_info: fldr.hotel_info ? JSON.parse(JSON.stringify(fldr.hotel_info)) : null,
        venue_info: fldr.venue_info ? JSON.parse(JSON.stringify(fldr.venue_info)) : null,
        rental_car_info: fldr.rental_car_info ? JSON.parse(JSON.stringify(fldr.rental_car_info)) : null,
        job_info: fldr.job_info ? JSON.parse(JSON.stringify(fldr.job_info)) : null,
        checklist: fldr.checklist ? JSON.parse(JSON.stringify(fldr.checklist)).map((item: ChecklistItem) => ({ ...item, completed: false })) : null,
        people: fldr.people ? JSON.parse(JSON.stringify(fldr.people)) : null,
        photos: null, // Don't copy photos
        products: fldr.products ? JSON.parse(JSON.stringify(fldr.products)) : null,
        notes: fldr.notes || '',
        wrap_up: null, // Don't copy wrap-up
        polished_messages: [],
        ai_itinerary_items: null, // Don't copy AI-generated content
        ai_itinerary_overview: null // Don't copy AI-generated content
      }
      
      const response = await fetch('/api/fldrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFldr)
      })
      
      if (response.ok) {
        const createdFldr = await response.json()
        console.log('[Duplicate] Job duplicated successfully')
        
        // Navigate to the new fldr
        router.push(`/jobs/${createdFldr.id}`)
      } else {
        throw new Error('Failed to duplicate job')
      }
    } catch (error) {
      console.error('[Duplicate] Duplicate job failed:', error)
      alert('Failed to duplicate job. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const deleteJob = async () => {
    if (!fldr) return
    setConfirmDialog({ type: 'deleteJob' })
  }

  const doDeleteJob = async () => {
    if (!fldr) return
    setConfirmDialog(null)
    
    setSaving(true)
    
    try {
      const response = await fetch(`/api/fldrs/${fldr.id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        console.log('[Delete] Job deleted successfully')
        
        // Update localStorage cache
        const cachedFldrs = localStorage.getItem('git-fldrs')
        if (cachedFldrs) {
          try {
            const fldrs = JSON.parse(cachedFldrs)
            const updated = fldrs.filter((f: Fldr) => f.id !== fldr.id)
            localStorage.setItem('git-fldrs', JSON.stringify(updated))
          } catch (e) {
            console.error('[Cache] Failed to update cache after delete:', e)
          }
        }
        
        // Navigate back to jobs list
        router.push('/jobs')
      } else {
        throw new Error('Failed to delete job')
      }
    } catch (error) {
      console.error('[Delete] Delete job failed:', error)
      alert('Failed to delete job. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const generateOverview = async () => {
    if (!fldr) return
    
    setGeneratingOverview(true)
    
    try {
      const response = await fetch('/api/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fldr })
      })
      
      if (response.ok) {
        const data = await response.json()
        setGeneratedOverview(data.overview)
        setShowOverviewModal(true)
      } else {
        throw new Error('Failed to generate overview')
      }
    } catch (error) {
      console.error('[Overview] Generate overview failed:', error)
      alert('Failed to generate overview. Please try again.')
    } finally {
      setGeneratingOverview(false)
    }
  }

  const handleQuickOverviewShare = async () => {
    if (!fldr) return
    setGeneratingPDF('quick')
    try {
      const { shareQuickOverviewPDF } = await import('@/lib/pdfGenerator')
      await shareQuickOverviewPDF(fldr)
    } catch (error) {
      console.error('[PDF] PDF share failed:', error)
      alert('Failed to share PDF. Please try again.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleQuickOverviewDownload = async () => {
    if (!fldr) return
    setGeneratingPDF('quick')
    try {
      const { generateQuickOverviewPDF } = await import('@/lib/pdfGenerator')
      await generateQuickOverviewPDF(fldr)
    } catch (error) {
      console.error('[PDF] PDF download failed:', error)
      alert('Failed to download PDF. Please try again.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleFullTripBriefShare = async () => {
    if (!fldr) return
    setGeneratingPDF('full')
    try {
      const { shareFullTripBriefPDF } = await import('@/lib/pdfGenerator')
      await shareFullTripBriefPDF(fldr)
    } catch (error) {
      console.error('[PDF] PDF share failed:', error)
      alert('Failed to share PDF. Please try again.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleFullTripBriefDownload = async () => {
    if (!fldr) return
    setGeneratingPDF('full')
    try {
      const { generateFullTripBriefPDF } = await import('@/lib/pdfGenerator')
      await generateFullTripBriefPDF(fldr)
    } catch (error) {
      console.error('[PDF] PDF download failed:', error)
      alert('Failed to download PDF. Please try again.')
    } finally {
      setGeneratingPDF(null)
    }
  }

  const handleRefresh = async () => {
    console.log('[Refresh] Pull-to-refresh triggered on detail page')
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
        console.log('[ServiceWorker] Service worker checked for updates')
        
        // If there's a waiting worker, activate it
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
          window.location.reload()
          return
        }
      }
    }
    
    // Fetch fresh data from API
    if (!fldr) {
      setIsRefreshing(false)
      return
    }

    try {
      // Anything typed goes up first, so what comes back includes it
      await saveFldr({})
      const res = await fetch(`/api/fldrs/${fldr.id}`, { cache: 'no-store' })
      if (res.ok) {
        const freshData = await res.json()
        console.log('[Refresh] Refreshed from server, photos:', freshData.photos?.length || 0)
        const merged = adoptServerFldr(freshData)

        // Also update the list cache
        const listCache = localStorage.getItem('git-fldrs')
        if (listCache) {
          const allFldrs = JSON.parse(listCache)
          const index = allFldrs.findIndex((f: Fldr) => f.id === fldr.id)
          if (index !== -1) {
            allFldrs[index] = merged
            localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
          }
        }
        
        console.log('[Refresh] Fldr data refreshed from server')
      }
    } catch (error) {
      console.error('[Refresh] Refresh failed:', error)
    }
    
    setIsRefreshing(false)
  }

  const openParseEmail = async (kind: 'flight' | 'hotel' | 'rental_car') => {
    await flushAndSave()
    setShowParseEmailModal(kind)
    setParseEmailText('')
  }

  if (loading || !fldr) {
    return <FldrDetailSkeleton />
  }

  // Who's on the job, offered when adding travelers to a flight
  const staffNames = Array.from(
    new Set([...(fldr.people || []).map(p => p.name), ...(fldr.job_info?.team_members || [])].map(n => n?.trim()).filter(Boolean))
  ) as string[]

  return (
    <div 
      className="min-h-page"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-canvas z-50 transition-all"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(pullDistance, 80)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1)
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-brand-light">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="text-brand-light text-sm font-medium">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}
        </div>
      )}
      {/* Header */}
      <div className="sticky top-0 z-30 mb-4 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="flex items-center justify-between h-14 px-4 max-w-2xl mx-auto">
        {/* Left side - Back button */}
        <button
          onClick={async () => {
            // Flush any pending save before navigating
            await flushAndSave()
            router.push('/jobs')
          }}
          className="flex items-center gap-1 -ml-1.5 pl-1 pr-2.5 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>

        {/* Right side - Actions */}
        <div className="flex items-center gap-1.5">
          {/* Online indicator and refresh */}
          <div className="flex items-center gap-1 mr-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-400' : 'bg-red-500'}`} />
              <span className="text-xs text-white/55">{online ? 'Online' : 'Offline'}</span>
            </div>
            {online && !isRefreshing && (
              <button
                onClick={async () => {
                  setIsRefreshing(true)
                  await handleRefresh()
                }}
                className="icon-btn h-8 w-8"
                title="Refresh from server"
                aria-label="Refresh from server"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            {isRefreshing && (
              <svg className="animate-spin h-4 w-4 mx-2 text-brand-light" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
          </div>

          {/* Manual Save Button */}
          <button
            onClick={manualSave}
            disabled={saving || !fldr}
            className={`relative h-9 px-3 rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 border ${
              unsavedChanges
                ? 'bg-brand border-brand hover:bg-brand-hover text-white'
                : 'bg-white/5 border-line-strong hover:bg-white/10 text-white/85'
            }`}
            title={unsavedChanges ? 'Save changes to server' : 'Save now'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3h11l3 3v13a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3v6h8V6M8 17h8" />
            </svg>
            <span>{saving ? 'Saving...' : 'Save'}</span>
            {/* Sits on the corner so the header doesn't shift as it comes and goes */}
            {unsavedChanges && !saving && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gold rounded-full ring-2 ring-canvas" aria-label="Unsaved changes" />
            )}
          </button>

          {!editMode && (
            <>
              <button
                onClick={enableEditMode}
                className="icon-btn"
                title="Edit"
                aria-label="Edit"
              >
                <PencilIcon className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={async () => {
                  await flushAndSave()
                  await duplicateJob()
                }}
                disabled={saving}
                className="icon-btn disabled:opacity-50"
                title="Duplicate this job"
                aria-label="Duplicate this job"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              
              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={async () => {
                    await flushAndSave()
                    setShowExportMenu(!showExportMenu)
                  }}
                  disabled={generatingOverview || generatingPDF !== null}
                  className="icon-btn disabled:opacity-50"
                  title="Export options"
                  aria-label="Export options"
                  aria-expanded={showExportMenu}
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>

                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 bg-surface border border-line-strong rounded-xl shadow-pop py-1.5 min-w-[220px] z-50 animate-slide-in">
                    <button
                      onClick={async () => {
                        await flushAndSave()
                        generateOverview()
                        setShowExportMenu(false)
                      }}
                      disabled={generatingOverview}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 hover:text-white disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{generatingOverview ? 'Generating...' : 'Text Overview'}</span>
                    </button>
                    
                    <div className="border-t border-line my-1"></div>
                    
                    <div className="px-4 pt-2 pb-1">
                      <span className="eyebrow text-[10px]">Quick PDF (1 page)</span>
                    </div>
                    <button
                      onClick={() => {
                        handleQuickOverviewDownload()
                        setShowExportMenu(false)
                      }}
                      disabled={generatingPDF !== null}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 hover:text-white disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>{generatingPDF === 'quick' ? 'Generating...' : 'Download PDF'}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleQuickOverviewShare()
                        setShowExportMenu(false)
                      }}
                      disabled={generatingPDF !== null}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 hover:text-white disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span>Share PDF</span>
                    </button>
                    
                    <div className="border-t border-line my-1"></div>
                    
                    <div className="px-4 pt-2 pb-1">
                      <span className="eyebrow text-[10px]">Full Trip Brief</span>
                    </div>
                    <button
                      onClick={() => {
                        handleFullTripBriefDownload()
                        setShowExportMenu(false)
                      }}
                      disabled={generatingPDF !== null}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 hover:text-white disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>{generatingPDF === 'full' ? 'Generating...' : 'Download PDF'}</span>
                    </button>
                    <button
                      onClick={() => {
                        handleFullTripBriefShare()
                        setShowExportMenu(false)
                      }}
                      disabled={generatingPDF !== null}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 hover:text-white disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                      <span>Share PDF</span>
                    </button>
                    
                    <div className="border-t border-line my-1"></div>
                    
                    {/* Archive/Unarchive */}
                    <button
                      onClick={async () => {
                        if (!fldr) return
                        await flushAndSave()
                        const newArchiveStatus = !fldr.archived
                        if (newArchiveStatus && jigsOut > 0) {
                          alert('Some jigs from this job are still out. Check them in first, or set the status to Waiting on return.')
                          return
                        }
                        setSaving(true)
                        try {
                          setFldr({ ...fldr, archived: newArchiveStatus })
                          await saveFldr({ archived: newArchiveStatus })
                        } finally {
                          setSaving(false)
                        }
                        setShowExportMenu(false)
                      }}
                      disabled={saving}
                      className="w-full px-4 py-2.5 text-left text-sm text-white/85 hover:bg-white/5 hover:text-white disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                      <span>{saving ? 'Updating...' : fldr.archived ? 'Unarchive Job' : 'Archive Job'}</span>
                    </button>
                    
                    <div className="border-t border-line my-1"></div>
                    
                    <button
                      onClick={async () => {
                        await flushAndSave()
                        deleteJob()
                        setShowExportMenu(false)
                      }}
                      disabled={saving}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50 flex items-center gap-2.5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Job</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      </div>

      {/* Save Status Indicator */}
      {(saving || autoSaving || unsavedChanges || lastSaved) && (
        <div className="mb-3 text-center px-4 max-w-2xl mx-auto" aria-live="polite">
          {saving || autoSaving || unsavedChanges ? (
            <span className="text-[11px] text-yellow-300">Saving...</span>
          ) : lastSaved && (
            <span className="text-[11px] text-white/40">
              Saved {new Date().getTime() - lastSaved.getTime() < 60000
                ? 'just now'
                : `${Math.floor((new Date().getTime() - lastSaved.getTime()) / 60000)}m ago`}
            </span>
          )}
        </div>
      )}

      <div className="mb-6 px-4 max-w-2xl mx-auto">
        {editMode ? (
          <div className="card shadow-card space-y-4 p-5">
            <div>
              <label className="label">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="input"
                placeholder="Client name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">
                  Start Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={editDateStart}
                  onChange={(e) => setEditDateStart(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">
                  End Date <span className="text-white/35 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={editDateEnd}
                  onChange={(e) => setEditDateEnd(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">
                Location <span className="text-white/35 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="input"
                placeholder="City, State"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBasicInfo}
                disabled={!editTitle.trim() || !editDateStart || saving}
                className="btn-brand flex-1"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="card shadow-card p-5">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-2xl font-semibold text-white leading-tight min-w-0 break-words">{fldr.title}</h2>
              <div className={`badge flex-shrink-0 mt-1 ${
                fldr.status === 'incomplete' ? 'bg-yellow-500/15 text-yellow-300' :
                fldr.status === 'ready' ? 'bg-blue-500/15 text-blue-300' :
                fldr.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' :
                'bg-white/10 text-white/60'
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {fldr.status}
              </div>
            </div>
            <div className="text-white/60 text-sm tabular">
              {formatDate(fldr.date_start)}
              {fldr.date_end && ` – ${formatDate(fldr.date_end)}`}
            </div>
            
            {/* Countdown Timers */}
            {(() => {
              const daysUntilFlight = getDaysUntilFlight()
              const daysUntilJob = getDaysUntilJob()
              
              // Determine urgency based on whichever is sooner
              const soonest = daysUntilFlight !== null && daysUntilFlight >= 0 ? daysUntilFlight : daysUntilJob
              
              if ((daysUntilFlight !== null && daysUntilFlight >= 0) || (daysUntilJob !== null && daysUntilJob >= 0)) {
                const urgencyColor = soonest !== null && soonest <= 2 ? 'text-red-300' : soonest !== null && soonest <= 7 ? 'text-yellow-300' : 'text-emerald-300'
                const urgencyBg = soonest !== null && soonest <= 2 ? 'bg-red-500/10 border-red-400/30' : soonest !== null && soonest <= 7 ? 'bg-yellow-500/10 border-yellow-400/30' : 'bg-emerald-500/10 border-emerald-400/30'
                
                return (
                  <div className={`mt-4 px-4 py-3 ${urgencyBg} border rounded-xl space-y-2`}>
                    {daysUntilFlight !== null && daysUntilFlight >= 0 && (
                      <div className="flex items-center gap-3">
                        <svg className={`w-5 h-5 ${urgencyColor} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                        <div className="flex-1">
                          <div className={`text-sm font-semibold ${urgencyColor}`}>
                            {daysUntilFlight === 0 ? 'Flight Today!' : daysUntilFlight === 1 ? '1 Day Until Flight' : `${daysUntilFlight} Days Until Flight`}
                          </div>
                        </div>
                      </div>
                    )}
                    {daysUntilJob !== null && daysUntilJob >= 0 && (
                      <div className="flex items-center gap-3">
                        <svg className={`w-5 h-5 ${urgencyColor} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <div className={`text-sm font-semibold ${urgencyColor}`}>
                            {daysUntilJob === 0 ? 'Job is Today!' : daysUntilJob === 1 ? '1 Day Until Job' : `${daysUntilJob} Days Until Job`}
                          </div>
                          {daysUntilJob > 0 && (
                            <div className="text-xs text-white/60 mt-0.5">
                              Starting {formatDate(fldr.date_start)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              }
              return null
            })()}
            
            {fldr.location && (
              <div className="flex items-center gap-2.5 mt-1.5">
                <div className="text-white/85">{fldr.location}</div>
                {locationTime && (
                  <div className="flex items-center gap-1 text-xs text-white/55 tabular">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{locationTime}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Job Status Selector */}
            <div className="mt-4 pt-4 border-t border-line">
              <label htmlFor="job-status" className="label">Job Status</label>
              <select
                id="job-status"
                value={fldr.job_status || ''}
                onChange={async (e) => {
                  if (!fldr) return
                  let newStatus = (e.target.value || null) as JobStatus | null
                  // Complete waits until every jig is checked back in
                  if (newStatus === 'complete' && jigsOut > 0) newStatus = 'awaiting_return'
                  heldWaitingRef.current = newStatus === 'awaiting_return' && jigsOut === 0
                  setSaving(true)
                  try {
                    setFldr({ ...fldr, job_status: newStatus })
                    await saveFldr({ job_status: newStatus })
                  } finally {
                    setSaving(false)
                  }
                }}
                className="input"
              >
                <option value="" className="bg-gray-800 text-white">Not Set</option>
                <option value="pending" className="bg-gray-800 text-white">Pending</option>
                <option value="confirmed" className="bg-gray-800 text-white">Confirmed</option>
                <option value="in_progress" className="bg-gray-800 text-white">In Progress</option>
                <option value="awaiting_return" className="bg-gray-800 text-white">Waiting on return</option>
                <option value="complete" className="bg-gray-800 text-white">Complete</option>
              </select>
              {fldr.job_status === 'awaiting_return' && (
                <p className="mt-2 text-xs text-amber-200/80">
                  Waiting on {jigsOut} jig{jigsOut === 1 ? '' : 's'} to be checked in. This job completes itself once everything is back.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Actions & Map */}
      <div className="px-4 max-w-2xl mx-auto mb-4 space-y-2">
        {((fldr.status === 'ready' || fldr.status === 'incomplete') || fldr.status === 'active' || fldr.status === 'complete') && (
          <>
            {(fldr.status === 'ready' || fldr.status === 'incomplete') && (
              <button
                onClick={() => updateStatus('active')}
                disabled={saving}
                className="btn w-full font-medium bg-brand/15 hover:bg-brand/25 border border-brand/40 text-brand-light"
              >
                {!saving && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {saving ? 'Activating...' : 'Activate Job'}
              </button>
            )}
            {fldr.status === 'active' && (
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus('complete')}
                  disabled={saving}
                  className="btn flex-1 font-medium bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300"
                >
                  {saving ? 'Completing...' : 'Mark Complete'}
                </button>
                <button
                  onClick={() => updateStatus('ready')}
                  disabled={saving}
                  className="btn flex-1 font-medium bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300"
                >
                  {!saving && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
                    </svg>
                  )}
                  {saving ? 'Pausing...' : 'Pause'}
                </button>
              </div>
            )}
            {fldr.status === 'complete' && (
              <button
                onClick={() => updateStatus('active')}
                disabled={saving}
                className="btn w-full font-medium bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300"
              >
                {!saving && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {saving ? 'Reactivating...' : 'Reactivate Job'}
              </button>
            )}
          </>
        )}

        {/* Map Button */}
        <button
          onClick={() => setShowMapModal(true)}
          className="btn-secondary w-full font-medium"
        >
          <svg className="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Open Google Maps & Nearby Places
        </button>
      </div>

      <SectionNav sections={navSections} active={activeSection} onSelect={jumpToSection} />

      <div className="px-4 max-w-2xl mx-auto space-y-3">
        {/* ── Overview: what's next, the trip start to end, the details you reach for ── */}
        <section id="sec-overview" className="space-y-3 scroll-mt-28">
          <GlanceCard
            fldr={fldr}
            jigsOut={jigsOut}
            distances={distances}
            distancesLoading={distancesLoading}
            open={expandedCards.summary}
            onToggle={() => toggleCard('summary')}
            onJump={jumpToCard}
          />

          {/* Weather - only when the job has a location */}
          {(fldr.location || fldr.venue_info?.address) && (
            <SectionCard
              id="weather"
              title="Weather"
              open={expandedCards.weather}
              onToggle={() => toggleCard('weather')}
              summary={jobWeather.cityLabel || undefined}
              meta={
                !jobWeather.loading && jobWeather.current && (
                  <div className="flex items-center gap-1.5">
                    <WeatherSVG condition={jobWeather.current.main} size="xs" />
                    <span className="text-sm text-white/70">{Math.round(jobWeather.current.temp)}°</span>
                  </div>
                )
              }
            >
              <>
                {jobWeather.loading && (
                  <div className="py-6 text-center text-sm text-gray-400">Loading weather…</div>
                )}

                {!jobWeather.loading && jobWeather.error && (
                  <div className="py-6 text-center text-sm text-gray-500">Weather unavailable</div>
                )}

                {!jobWeather.loading && !jobWeather.error && jobWeather.current && (
                  <>
                    {jobWeather.cityLabel && (
                      <div className="text-xs text-brand-light font-semibold uppercase tracking-wide mb-2">
                        {jobWeather.cityLabel}
                      </div>
                    )}
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="flex items-center gap-3">
                        <WeatherSVG condition={jobWeather.current.main} size="lg" />
                        <div>
                          <div className="text-2xl font-thin text-white leading-none">
                            {Math.round(jobWeather.current.temp)}°
                          </div>
                          <div className="text-xs text-gray-400 capitalize mt-1">
                            {jobWeather.current.description}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400 space-y-0.5">
                        <div>Feels {Math.round(jobWeather.current.feels_like)}°</div>
                        <div>{jobWeather.current.humidity}% humidity</div>
                        <div>{jobWeather.current.wind_speed} mph wind</div>
                      </div>
                    </div>

                    {jobWeather.daily.length > 0 && (
                      <div className="grid grid-cols-5 gap-1 pt-3">
                        {jobWeather.daily.map(day => (
                          <div key={day.date} className="flex flex-col items-center gap-1">
                            <div className="text-[10px] text-gray-500">
                              {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <WeatherSVG condition={day.main} size="xs" />
                            <div className="text-xs font-semibold text-white">{day.high}°</div>
                            <div className="text-[10px] text-gray-500">{day.low}°</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            </SectionCard>
          )}

          {/* Itinerary - built from every time on the job */}
          <SectionCard id="itinerary" title="Itinerary" open={expandedCards.itinerary} onToggle={() => toggleCard('itinerary')}>
            <>
              {/* Info banner about itinerary features */}
              <div className="mb-3 p-3 bg-canvas/50 border border-line rounded-lg backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1 text-xs text-gray-400">
                    <p className="text-gray-500">Past items automatically strike through • Next upcoming item highlights in green</p>
                  </div>
                </div>
              </div>

              {(() => {
                const itinerary = generateItinerary()
                
                if (Object.keys(itinerary).length === 0) {
                  return (
                    <p className="text-sm text-gray-400 py-4 text-center">
                      No scheduled events yet. Add flight times, hotel check-in/out, or rental car times to build your itinerary.
                    </p>
                  )
                }

                // Find the very first upcoming event across ALL days (not just within each day)
                let firstUpcomingEventTime: number | null = null
                Object.keys(itinerary).forEach(day => {
                  itinerary[day].forEach(event => {
                    if (event.dateTime.getTime() >= currentTime.getTime()) {
                      if (firstUpcomingEventTime === null || event.dateTime.getTime() < firstUpcomingEventTime) {
                        firstUpcomingEventTime = event.dateTime.getTime()
                      }
                    }
                  })
                })

                return (
                  <div className="space-y-4">
                    {Object.keys(itinerary).map((day, dayIndex) => (
                      <div key={day} className={dayIndex > 0 ? 'border-t border-line pt-4' : ''}>
                        <div className="text-sm font-semibold text-brand-light mb-3">
                          {day}
                        </div>
                        <div className="space-y-3">
                          {itinerary[day].map((event, eventIndex) => {
                            const isPast = event.dateTime.getTime() < currentTime.getTime()
                            
                            // Mark as "NEXT" only if this is THE first upcoming event across the entire itinerary
                            const isNext = firstUpcomingEventTime !== null && event.dateTime.getTime() === firstUpcomingEventTime
                            
                            return (
                              <div 
                                key={eventIndex} 
                                className={`pl-4 border-l-2 transition-all ${
                                  isPast 
                                    ? 'border-brand/20 opacity-50' 
                                    : isNext 
                                      ? 'border-emerald-500 bg-emerald-500/5 shadow-sm' 
                                      : 'border-brand/40'
                                }`}
                              >
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className={`text-xs font-medium ${isPast ? 'text-gray-400' : isNext ? 'text-emerald-500' : 'text-brand-light'}`}>
                                    {event.dateTime.toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </span>
                                  <span className={`text-sm flex items-center gap-1.5 ${
                                    isPast 
                                      ? 'line-through text-gray-400' 
                                      : 'font-medium text-gray-100'
                                  }`}>
                                    {event.title}
                                    {isNext && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-500 rounded border border-emerald-500/30">
                                        NEXT
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {event.details.length > 0 && (
                                  <div className={`text-xs space-y-0.5 ml-16 ${isPast ? 'text-gray-400 line-through' : 'text-gray-400'}`}>
                                    {event.details.map((detail, i) => (
                                      <div key={i}>{detail}</div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          </SectionCard>
        </section>

        {/* ── Event Info: who it's for, where and when, what's being made ── */}
        {isJob && (
          <section id="sec-event" className="space-y-3 scroll-mt-28">
            <GroupHeading>Event Info</GroupHeading>
            <ClientEventCard
              fldr={fldr}
              open={expandedCards.event}
              onToggle={() => toggleCard('event')}
              onJobInfo={updateJobInfo}
              onLocation={updateLocation}
              onDone={flushPending}
            />
            <VenueTimeCard
              fldr={fldr}
              open={expandedCards.venue}
              onToggle={() => toggleCard('venue')}
              onVenue={updateVenueInfo}
              onJobInfo={updateJobInfo}
              onDone={flushPending}
            />
            {fldr.products !== null ? (
              <ProductsCard
                products={fldr.products}
                job={{ id: fldr.id, start: fldr.date_start, end: fldr.date_end }}
                jigs={jobJigs}
                jigsOut={jigsOut}
                open={expandedCards.products}
                onToggle={() => toggleCard('products')}
                onAdd={addProduct}
                onField={updateProduct}
                onRemove={removeProduct}
                onRemoveSection={() => disableModule('products')}
                onDone={flushPending}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <AddSectionButton label="Products" onClick={() => enableModule('products')} />
              </div>
            )}
          </section>
        )}

        {/* ── Logistics: everything that has to happen before the event ── */}
        {isJob && (
          <section id="sec-logistics" className="space-y-3 scroll-mt-28">
            <GroupHeading>Logistics</GroupHeading>
            <LogisticsCard
              tracker={fldr.tracker}
              preEngraveDetails={fldr.job_info?.pre_engrave_details ?? null}
              open={expandedCards.logistics}
              onToggle={() => toggleCard('logistics')}
              onChange={patch => updateTracker(patch, true)}
              onType={patch => updateTracker(patch)}
              onPreEngraveChange={value => updateJobInfo('pre_engrave_details', value)}
              onCommit={flushPending}
            />
          </section>
        )}

        {/* ── Travel ── */}
        <section id="sec-travel" className="space-y-3 scroll-mt-28">
          <GroupHeading>Travel</GroupHeading>
          <TravelDatesRow
            start={fldr.job_info?.travel_start ?? null}
            end={fldr.job_info?.travel_end ?? null}
            flightDates={flightSpan(fldr)}
            booked={isJob ? readStep(fldr.tracker, 'travel_booked') : null}
            onDates={updateTravelDates}
            onToggleBooked={toggleTravelBooked}
          />
          {fldr.flight_info !== null && (
            <FlightsCard
              segments={Array.isArray(fldr.flight_info) ? fldr.flight_info : []}
              staffNames={staffNames}
              open={expandedCards.flight}
              onToggle={() => toggleCard('flight')}
              onField={updateFlightSegment}
              onDepartureAirport={updateSegmentDepartureAirport}
              onArrivalAirport={updateSegmentArrivalAirport}
              onAddTraveler={addSegmentTraveler}
              onRemoveTraveler={removeSegmentTraveler}
              onAddSegment={addFlightSegment}
              onRemoveSegment={removeFlightSegment}
              roundTrip={isRoundTrip}
              onRoundTrip={toggleRoundTrip}
              onParseEmail={() => openParseEmail('flight')}
              onRemoveSection={() => disableModule('flight_info')}
              onDone={flushPending}
            />
          )}
          {fldr.hotel_info !== null && (
            <HotelCard
              hotel={fldr.hotel_info}
              open={expandedCards.hotel}
              onToggle={() => toggleCard('hotel')}
              onField={updateHotelInfo}
              onParseEmail={() => openParseEmail('hotel')}
              onRemoveSection={() => disableModule('hotel_info')}
              onDone={flushPending}
            />
          )}
          {fldr.rental_car_info !== null && (
            <RentalCarCard
              car={fldr.rental_car_info}
              open={expandedCards.rentalCar}
              onToggle={() => toggleCard('rentalCar')}
              onField={updateRentalCarInfo}
              onParseEmail={() => openParseEmail('rental_car')}
              onRemoveSection={() => disableModule('rental_car_info')}
              onDone={flushPending}
            />
          )}
          {(fldr.flight_info === null || fldr.hotel_info === null || fldr.rental_car_info === null) && (
            <div className="flex flex-wrap gap-2">
              {fldr.flight_info === null && <AddSectionButton label="Flights" onClick={() => enableModule('flight_info')} />}
              {fldr.hotel_info === null && <AddSectionButton label="Hotel" onClick={() => enableModule('hotel_info')} />}
              {fldr.rental_car_info === null && <AddSectionButton label="Rental Car" onClick={() => enableModule('rental_car_info')} />}
            </div>
          )}
        </section>

        {/* ── Team ── */}
        <section id="sec-team" className="space-y-3 scroll-mt-28">
          <GroupHeading>Team</GroupHeading>
          <StaffCard
            people={fldr.people}
            wardrobe={fldr.job_info?.wardrobe ?? null}
            open={expandedCards.people}
            onToggle={() => toggleCard('people')}
            onAddPerson={addPerson}
            onPersonField={updatePerson}
            onPersonNameBlur={handlePersonNameBlur}
            onRemovePerson={removePerson}
            onWardrobe={value => updateJobInfo('wardrobe', value || null)}
            onDone={flushPending}
          />
        </section>

        {/* ── More: notes, links and the rest ── */}
        <section id="sec-more" className="space-y-3 scroll-mt-28">
          <GroupHeading>More</GroupHeading>
          <SectionCard
            id="notes"
            title="Notes"
            open={expandedCards.notes}
            onToggle={() => toggleCard('notes')}
            summary={plainText(fldr.notes).slice(0, 140) || undefined}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">Notes</label>
                <button
                  onClick={() => setUseRichEditor(!useRichEditor)}
                  className="text-xs px-3 py-1 bg-brand hover:bg-brand-hover rounded-md transition-colors"
                >
                  {useRichEditor ? 'Simple Editor' : 'Rich Text Editor'}
                </button>
              </div>
              <div>
                {useRichEditor ? (
                  <RichTextEditor
                    value={fldr.notes}
                    onChange={(value) => updateNotes(value)}
                    placeholder="Add notes..."
                    className="min-h-[200px]"
                  />
                ) : (
                  <textarea
                    value={fldr.notes}
                    onChange={(e) => updateNotes(e.target.value)}
                    className="input min-h-[120px] resize-none leading-relaxed"
                    placeholder="Add notes..."
                  />
                )}
              </div>
            </div>
          </SectionCard>

          {isJob && (
            <LinksCard
              jobInfo={fldr.job_info}
              open={expandedCards.links}
              onToggle={() => toggleCard('links')}
              onJobInfo={updateJobInfo}
              onDone={flushPending}
            />
          )}

          {fldr.checklist !== null && (
            <ChecklistCard
              items={fldr.checklist}
              daysUntil={getDaysUntilJob()}
              open={expandedCards.checklist}
              onToggle={() => toggleCard('checklist')}
              onAdd={addChecklistItem}
              onText={updateChecklistItem}
              onCheck={toggleChecklistItem}
              onRemove={removeChecklistItem}
              onRemoveSection={() => disableModule('checklist')}
              onCommit={flushPending}
            />
          )}

          {fldr.photos !== null && (
            <SectionCard
              id="photos"
              title="Photos"
              open={expandedCards.photos}
              onToggle={() => toggleCard('photos')}
              meta={fldr.photos.length > 0 && <span className="text-xs font-semibold tabular text-white/55">{fldr.photos.length}</span>}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{(fldr.photos || []).length} photos</span>
                  <label className="text-xs text-brand-light hover:text-brand-hover cursor-pointer">
                    + Add Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const img = new Image()
                            img.onload = () => {
                              const canvas = document.createElement('canvas')
                              const ctx = canvas.getContext('2d')
                              
                              // Smaller max size for better compression (fits D1 1MB limit)
                              const maxSize = 800
                              let width = img.width
                              let height = img.height
                              
                              // Scale down proportionally
                              if (width > height) {
                                if (width > maxSize) {
                                  height = (height * maxSize) / width
                                  width = maxSize
                                }
                              } else {
                                if (height > maxSize) {
                                  width = (width * maxSize) / height
                                  height = maxSize
                                }
                              }
                              
                              canvas.width = width
                              canvas.height = height
                              ctx?.drawImage(img, 0, 0, width, height)
                              
                              // Use WebP for better compression (falls back to JPEG if not supported)
                              let compressedUrl = canvas.toDataURL('image/webp', 0.6)
                              
                              // Fallback to JPEG if WebP not supported
                              if (!compressedUrl.startsWith('data:image/webp')) {
                                compressedUrl = canvas.toDataURL('image/jpeg', 0.6)
                              }
                              
                              const originalSize = (event.target?.result as string).length
                              const compressedSize = compressedUrl.length
                              console.log(`[Photo] Compressed: ${(originalSize/1024).toFixed(0)}KB -> ${(compressedSize/1024).toFixed(0)}KB`)
                              
                              addPhoto(compressedUrl)
                            }
                            img.src = event.target?.result as string
                          }
                          reader.readAsDataURL(file)
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {(fldr.photos || []).map((photo, index) => (
                  <div key={photo.id} className="p-3 bg-canvas rounded-lg space-y-2">
                    <div className="relative">
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Photo'}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setExpandedPhotoIndex(index)}
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded-full"
                      >
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={photo.caption || ''}
                      onChange={(e) => updatePhotoCaption(index, e.target.value)}
                      className="w-full px-3 py-2 bg-surface border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-brand text-sm"
                      placeholder="Add caption..."
                    />
                  </div>
                ))}
                {(fldr.photos || []).length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No photos yet</p>
                )}
                <div className="pt-1">
                  <TextAction onClick={() => disableModule('photos')} tone="danger">
                    Remove Photos from this job
                  </TextAction>
                </div>
              </div>
            </SectionCard>
          )}

          {isJob && (
            <SectionCard
              id="prompts"
              title="Prompts"
              open={expandedCards.prompts}
              onToggle={() => toggleCard('prompts')}
              summary={
                [fldr.job_info?.prompt_1 && 'Prompt 1', fldr.job_info?.prompt_2 && 'Prompt 2'].filter(Boolean).join(' · ') || undefined
              }
            >
              <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Prompt 1</label>
                      {fldr.job_info?.prompt_1 && (
                        <button
                          onClick={() => navigator.clipboard.writeText(fldr.job_info?.prompt_1 || '')}
                          className="text-xs text-gray-400 hover:text-brand-light px-2 py-0.5 rounded border border-line hover:bg-white/5 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      )}
                    </div>
                    <textarea
                      value={fldr.job_info?.prompt_1 || ''}
                      onChange={(e) => updateJobInfo('prompt_1', e.target.value || null)}
                      className="input resize-none"
                      rows={4}
                      placeholder="Paste prompt here..."
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-400">Prompt 2</label>
                      {fldr.job_info?.prompt_2 && (
                        <button
                          onClick={() => navigator.clipboard.writeText(fldr.job_info?.prompt_2 || '')}
                          className="text-xs text-gray-400 hover:text-brand-light px-2 py-0.5 rounded border border-line hover:bg-white/5 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      )}
                    </div>
                    <textarea
                      value={fldr.job_info?.prompt_2 || ''}
                      onChange={(e) => updateJobInfo('prompt_2', e.target.value || null)}
                      className="input resize-none"
                      rows={4}
                      placeholder="Paste prompt here..."
                    />
                  </div>
              </div>
            </SectionCard>
          )}

          {(fldr.checklist === null || fldr.photos === null) && (
            <div className="flex flex-wrap gap-2">
              {fldr.checklist === null && <AddSectionButton label="Checklist" onClick={() => enableModule('checklist')} />}
              {fldr.photos === null && <AddSectionButton label="Photos" onClick={() => enableModule('photos')} />}
            </div>
          )}
        </section>
      </div>

      {/* Delete Job */}
      <div className="px-4 max-w-2xl mx-auto mt-4 mb-4">
        <button
          onClick={() => deleteJob()}
          className="btn-danger w-full py-3 bg-transparent"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Job
        </button>
      </div>

      {/* Photo Expansion Modal */}
      {expandedPhotoIndex !== null && fldr?.photos && fldr.photos[expandedPhotoIndex] && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedPhotoIndex(null)}
        >
          <div className="relative max-w-full max-h-full">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setExpandedPhotoIndex(null)
              }}
              aria-label="Close"
              className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 rounded-full backdrop-blur-sm transition-colors z-10"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={fldr.photos[expandedPhotoIndex].url}
              alt={fldr.photos[expandedPhotoIndex].caption || 'Photo'}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            {fldr.photos[expandedPhotoIndex].caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-4 rounded-b-lg">
                <p className="text-sm text-center">{fldr.photos[expandedPhotoIndex].caption}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overview Modal */}
      {/* Parse Email Modal */}
      {showParseEmailModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={async () => {
            await flushAndSave()
            setShowParseEmailModal(null)
            setParseEmailText('')
            setParseEmailImage(null)
            setParseInputMode('text')
          }}
        >
          <div 
            role="dialog"
            aria-modal="true"
            className="bg-surface border border-line-strong rounded-2xl p-5 sm:p-6 max-w-2xl w-full max-h-[90dvh] overflow-y-auto shadow-pop animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold pr-3">
                Parse {showParseEmailModal === 'flight' ? 'Flight' : showParseEmailModal === 'hotel' ? 'Hotel' : 'Rental Car'} Confirmation Email
              </h3>
              <button
                onClick={async () => {
                  await flushAndSave()
                  setShowParseEmailModal(null)
                  setParseEmailText('')
                  setParseEmailImage(null)
                  setParseInputMode('text')
                }}
                className="icon-btn -mr-2"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Input mode tabs */}
            <div className="flex gap-2 mb-4 border-b border-line">
              <button
                onClick={() => setParseInputMode('text')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  parseInputMode === 'text'
                    ? 'text-brand-light border-brand'
                    : 'text-white/55 border-transparent hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Paste Text
                </div>
              </button>
              <button
                onClick={() => setParseInputMode('image')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  parseInputMode === 'image'
                    ? 'text-brand-light border-brand'
                    : 'text-white/55 border-transparent hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upload Screenshot
                </div>
              </button>
            </div>
            
            <div className="space-y-4">
              {parseInputMode === 'text' ? (
                <div>
                  <label className="label">
                    Paste your confirmation email below:
                  </label>
                  <textarea
                    value={parseEmailText}
                    onChange={(e) => setParseEmailText(e.target.value)}
                    className="input h-64 font-mono resize-none"
                    placeholder={`Paste the entire confirmation email here...\n\nExample:\nYour ${showParseEmailModal === 'flight' ? 'flight' : showParseEmailModal === 'hotel' ? 'hotel reservation' : 'rental car booking'} has been confirmed!\n\n${showParseEmailModal === 'flight' ? 'Flight: AA123\nFrom: Los Angeles (LAX) - Mar 15, 2024 at 2:30 PM\nTo: New York (JFK) - Mar 15, 2024 at 10:45 PM\nConfirmation: ABC123' : showParseEmailModal === 'hotel' ? 'Hotel: Marriott Downtown\nAddress: 123 Main St, New York, NY 10001\nCheck-in: Mar 15, 2024 at 3:00 PM\nCheck-out: Mar 18, 2024 at 11:00 AM\nConfirmation: ABC123' : 'Company: Hertz\nVehicle: Economy\nPick-up: LAX Airport - Mar 15, 2024 at 2:00 PM\nDrop-off: LAX Airport - Mar 18, 2024 at 10:00 AM\nConfirmation: ABC123'}`}
                  />
                </div>
              ) : (
                <div>
                  <label className="label">
                    Upload a screenshot of your confirmation email:
                  </label>
                  {!parseEmailImage ? (
                    <label className="flex flex-col items-center justify-center w-full h-64 border border-dashed border-line-strong rounded-xl cursor-pointer hover:border-brand hover:bg-white/[0.02] transition-colors bg-canvas/60">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-10 h-10 mb-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mb-2 text-sm text-gray-400">
                          <span className="font-display font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, JPEG (MAX. 10MB)</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              alert('File is too large. Maximum size is 10MB.')
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = (event) => {
                              setParseEmailImage(event.target?.result as string)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <div className="relative">
                      <img
                        src={parseEmailImage}
                        alt="Confirmation screenshot"
                        className="w-full h-64 object-contain bg-canvas/60 border border-line rounded-xl"
                      />
                      <button
                        onClick={() => setParseEmailImage(null)}
                        aria-label="Remove screenshot"
                        className="absolute top-2 right-2 p-2 bg-black/70 text-white rounded-lg hover:bg-red-600/80 backdrop-blur-sm transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-white/45">
                  AI will extract and populate the form fields automatically
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await flushAndSave()
                      setShowParseEmailModal(null)
                      setParseEmailText('')
                      setParseEmailImage(null)
                      setParseInputMode('text')
                    }}
                    className="btn-secondary py-2 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={parseEmail}
                    disabled={(parseInputMode === 'text' && !parseEmailText.trim()) || (parseInputMode === 'image' && !parseEmailImage) || parsingEmail}
                    className="btn-brand py-2"
                  >
                    {parsingEmail ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Parsing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Parse & Fill
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOverviewModal && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={async () => {
            await flushAndSave()
            setShowOverviewModal(false)
          }}
        >
          <div 
            role="dialog"
            aria-modal="true"
            className="bg-surface border border-line-strong rounded-2xl p-5 sm:p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-pop animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Job Overview</h3>
              <button
                onClick={async () => {
                  await flushAndSave()
                  setShowOverviewModal(false)
                }}
                className="icon-btn -mr-2"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-canvas/60 border border-line rounded-xl p-4 mb-4">
              <pre className="whitespace-pre-wrap font-mono text-sm text-white/80 leading-relaxed">
                {generatedOverview}
              </pre>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/45">
                Copy this overview to use in emails, reports, or other programs
              </p>
              <CopyButton 
                text={generatedOverview} 
                label="Copy Overview"
              />
            </div>
          </div>
        </div>
      )}

      {showMapModal && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setShowMapModal(false)}
        >
          <div 
            className="w-full h-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMapModal(false)}
              aria-label="Close map"
              className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-[20000] p-2.5 bg-surface/90 hover:bg-surface-raised border border-line-strong rounded-xl backdrop-blur-md transition-colors shadow-pop"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="w-full h-full">
              <FldrMap 
                locations={mapLocations} 
                venueAddress={fldr.venue_info?.address ?? undefined}
                hotelAddress={fldr.hotel_info?.address ?? undefined}
                airportAddress={
                  fldr.flight_info && fldr.flight_info.length > 0 
                    ? ((fldr.flight_info[0].arrival_address || fldr.flight_info[0].departure_address) ?? undefined)
                    : undefined
                }
                forceFullscreen={true}
                onNearbyTypeChange={handleNearbyTypeChange}
                onSearchLocationChange={handleSearchLocationChange}
                nearbyPlaces={nearbyPlaces}
                nearbyLoading={nearbyLoading}
                nearbyType={nearbyType}
                searchFromAddress={searchFromAddress}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast confirm dialogs */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6 bg-black/60 animate-fade-in" onClick={() => setConfirmDialog(null)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm bg-surface border border-line-strong rounded-2xl overflow-hidden shadow-pop" onClick={e => e.stopPropagation()}>
            {confirmDialog.type === 'module' && (
              <>
                <div className="p-5 pb-3">
                  <p className="text-white font-semibold text-center">Remove module?</p>
                  <p className="text-white/60 text-sm text-center mt-1.5 leading-relaxed">All data in this module will be permanently deleted.</p>
                </div>
                <div className="flex border-t border-line">
                  <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 text-white/70 hover:bg-white/5 text-sm transition-colors">Cancel</button>
                  <button onClick={async () => { setConfirmDialog(null); const m = confirmDialog.module; setFldr(prev => prev ? { ...prev, [m]: null } : prev); await saveFldr({ [m]: null }); setExpandedCards(prev => ({ ...prev, [m.replace('_info', '')]: false })) }} className="flex-1 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-l border-line transition-colors">Remove</button>
                </div>
              </>
            )}
            {confirmDialog.type === 'deleteJob' && (
              <>
                <div className="p-5 pb-3">
                  <p className="text-white font-semibold text-center">Delete job?</p>
                  <p className="text-white/60 text-sm text-center mt-1.5 leading-relaxed">&ldquo;{fldr?.title}&rdquo; will be permanently deleted. This cannot be undone.</p>
                </div>
                <div className="flex border-t border-line">
                  <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 text-white/70 hover:bg-white/5 text-sm transition-colors">Cancel</button>
                  <button onClick={doDeleteJob} className="flex-1 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-l border-line transition-colors">Delete</button>
                </div>
              </>
            )}
            {confirmDialog.type === 'hardRefresh' && (
              <>
                <div className="p-5 pb-3">
                  <p className="text-white font-semibold text-center">Clear offline data?</p>
                  <p className="text-white/60 text-sm text-center mt-1.5 leading-relaxed">All locally saved changes will be removed.</p>
                </div>
                <div className="flex border-t border-line">
                  <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 text-white/70 hover:bg-white/5 text-sm transition-colors">Cancel</button>
                  <button onClick={() => { setConfirmDialog(null); clearAllCache(); setHasUnsynced(false); router.push('/jobs') }} className="flex-1 py-3.5 text-red-400 hover:bg-red-500/10 text-sm font-semibold border-l border-line transition-colors">Clear</button>
                </div>
              </>
            )}
            {confirmDialog.type === 'duplicate' && (
              <>
                <div className="p-5 pb-3">
                  <p className="text-white font-semibold text-center">Duplicate job?</p>
                  <p className="text-white/60 text-sm text-center mt-1.5 leading-relaxed">A copy will be created. You can update dates and details after.</p>
                </div>
                <div className="flex border-t border-line">
                  <button onClick={() => setConfirmDialog(null)} className="flex-1 py-3.5 text-white/70 hover:bg-white/5 text-sm transition-colors">Cancel</button>
                  <button onClick={doDuplicateJob} className="flex-1 py-3.5 text-brand-light hover:bg-brand/10 text-sm font-semibold border-l border-line transition-colors">Duplicate</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
