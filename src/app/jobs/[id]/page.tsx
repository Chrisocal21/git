'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Fldr, FlightSegment, HotelInfo, VenueInfo, RentalCarInfo, JobInfo, JobTracker, Person, Photo, Product, ChecklistItem, JobStatus } from '@/types/fldr'
import {
  AlertIcon,
  ArchiveIcon,
  CheckIcon,
  ChevronLeftIcon,
  ClockIcon,
  CopyIcon,
  DirectionsIcon,
  DocumentIcon,
  DownloadIcon,
  MapIcon,
  MoreIcon,
  PencilIcon,
  RefreshIcon,
  ShareIcon,
  SparkIcon,
  TrashIcon,
} from '@/components/Icons'
import { WeatherSVG } from '@/components/WeatherIcon'
import { fetchWeather, readCachedWeather } from '@/lib/weatherCache'
import { tripPhase, tripPills } from '@/lib/tripDays'
import type { WeatherReply } from '@/lib/weatherCache'
import CopyButton from '@/components/CopyButton'
import { FldrDetailSkeleton } from '@/components/SkeletonLoader'
import RichTextEditor from '@/components/RichTextEditor'
import { askConfirm, showNotice, toast } from '@/components/Dialogs'
import { SectionCard, AddSectionButton, CopyAction, TextAction } from '@/components/job/parts'
import SectionNav from '@/components/job/SectionNav'
import GlanceCard from '@/components/job/GlanceCard'
import type { DriveTime } from '@/components/job/GlanceCard'
import { ClientEventCard, VenueTimeCard } from '@/components/job/EventCards'
import LogisticsCard from '@/components/job/LogisticsCard'
import { TravelDatesRow, FlightsCard, HotelCard, RentalCarCard } from '@/components/job/TravelCards'
import StaffCard from '@/components/job/StaffCard'
import LinksCard from '@/components/job/LinksCard'
import ProductsCard from '@/components/job/ProductsCard'
import ChecklistCard from '@/components/job/ChecklistCard'
import { mergeFldrUpdates } from '@/lib/fldrMerge'
import { readStep, flightSpan } from '@/lib/jobTracker'
import { dayKey, directionsUrl, plainText } from '@/lib/jobFormat'
import { NO_SUGGESTIONS, buildJobSuggestions, readCachedJobs } from '@/lib/jobSuggestions'
import type { JobSuggestions } from '@/lib/jobSuggestions'
import { todayKey } from '@/lib/jigsFormat'
import { 
  getCachedFldr, 
  cacheFldr, 
  addToSyncQueue, 
  hasUnsyncedChanges,
  isOnline,
  syncQueuedChanges
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

// Which section each card lives in. The job page shows one section at a time.
const SECTION_OF_CARD: Record<string, string> = {
  summary: 'overview',
  weather: 'overview',
  itinerary: 'overview',
  event: 'event',
  venue: 'event',
  products: 'event',
  logistics: 'logistics',
  flight: 'travel',
  hotel: 'travel',
  rentalCar: 'travel',
  people: 'team',
  notes: 'more',
  links: 'more',
  checklist: 'more',
  photos: 'more',
  prompts: 'more',
}

/**
 * Whether a reply from the server really is this job. With no signal, the service worker
 * can answer a job request with an empty list, and taking that on would blank the page.
 */
function isJobReply(data: unknown, id: string): data is Fldr {
  return !!data && typeof data === 'object' && !Array.isArray(data) && (data as Fldr).id === id
}

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
    logistics: true, // The only card in its section, so it opens ready to use
    checklist: false,
    people: true, // Same: the only card under Team
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
  // Lit for a moment after each save, so the Saved in the header is seen to happen
  const [savedFlash, setSavedFlash] = useState(false)
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
  const [driveTimes, setDriveTimes] = useState<DriveTime[]>([])
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
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  // The job isn't on this phone and the server doesn't have it either
  const [notFound, setNotFound] = useState(false)
  // The job isn't on this phone and the server couldn't be reached to get it
  const [loadFailed, setLoadFailed] = useState(false)
  // Bumped by "Try again" to run the load once more
  const [loadAttempt, setLoadAttempt] = useState(0)
  // Clients, venues and hotels from earlier jobs, offered while this one is filled in
  const [suggestions, setSuggestions] = useState<JobSuggestions>(NO_SUGGESTIONS)
  const [showParseEmailModal, setShowParseEmailModal] = useState<'flight' | 'hotel' | 'rental_car' | null>(null)
  const [parseEmailText, setParseEmailText] = useState('')
  const [parseEmailImage, setParseEmailImage] = useState<string | null>(null)
  const [parseInputMode, setParseInputMode] = useState<'text' | 'image'>('text')
  const [parsingEmail, setParsingEmail] = useState(false)
  const [generatingItinerary, setGeneratingItinerary] = useState(false)
  const [generatedItineraryItems, setGeneratedItineraryItems] = useState<any[]>([])
  const [generatedItineraryOverview, setGeneratedItineraryOverview] = useState<string>('')

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
      // v2: the cards now live one section at a time, so everyone starts from the new defaults once
      const saved = localStorage.getItem('burrow-job-cards-v2')
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
      localStorage.setItem('burrow-job-cards-v2', JSON.stringify(expandedCards))
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
                if (isJobReply(updated, currentFldrId)) {
                  adoptServerFldr(updated)
                  console.log('[Sync] Data refreshed from server')
                }
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
          if (!isJobReply(updated, current.id)) return
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

  // Close the More menu when tapping outside it, or on Escape
  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    window.addEventListener('keydown', handleEsc)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [showMenu])

  // What earlier jobs already know, read from the jobs list this phone has
  useEffect(() => {
    setSuggestions(buildJobSuggestions(readCachedJobs(), params.id as string))
  }, [params.id])

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
    // Set when the page moves on to another job, so a slow reply for this one is dropped
    let cancelled = false
    if (params.id) {
      const fldrId = params.id as string
      console.log(`[Load] Loading fldr: ${fldrId}`)
      logStorageInfo()
      setNotFound(false)
      setLoadFailed(false)

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
            // The server has no such job (deleted, or a link to one that never existed)
            if (res.status === 404) {
              if (!cancelled && !cached) setNotFound(true)
              return null
            }
            throw new Error('Failed to fetch')
          })
          .then(freshData => {
            if (cancelled || !freshData) return
            if (!isJobReply(freshData, fldrId)) {
              // Not the job (no signal, most likely): keep what's on screen, or say it couldn't load
              if (!cached) setLoadFailed(true)
              return
            }
            // Something was already saved from this page, so its reply is newer than this
            if (saveRequestSeqRef.current !== savesBefore) return
            console.log('[Server] Got fresh data from server, photos:', freshData.photos?.length || 0)
            const merged = adoptServerFldr(freshData)
            // A job this phone had never seen (a shared link, a new phone): it's on screen now
            if (!cached) {
              setEditTitle(merged.title)
              setEditDateStart(merged.date_start)
              setEditDateEnd(merged.date_end || '')
              setEditLocation(merged.location || '')
              setLoading(false)
            }

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
            // Keep using cached data; with none, say so instead of leaving a blank page
            if (!cancelled && !cached) setLoadFailed(true)
          })
      } else {
        console.log('[Network] Offline - using cached data only')
        if (!cached) setLoadFailed(true)
      }
    }
    return () => {
      cancelled = true
    }
  }, [params.id, adoptServerFldr, loadAttempt])

  // Fetch distances between key locations
  useEffect(() => {
    const fetchDistances = async () => {
      if (!fldr) return
      
      const locations: Array<{ label: string; address: string }> = []
      if (fldr.hotel_info?.address) locations.push({ label: 'Hotel', address: fldr.hotel_info.address })
      if (fldr.venue_info?.address) locations.push({ label: 'Venue', address: fldr.venue_info.address })
      
      // Add first outbound flight arrival if available
      const outboundFlight = fldr.flight_info?.find(f => f.segment_type === 'outbound' || f.segment_type === 'connection')
      if (outboundFlight?.arrival_address) locations.push({ label: 'Airport', address: outboundFlight.arrival_address })

      if (locations.length < 2) {
        setDriveTimes([])
        return
      }

      setDistancesLoading(true)

      try {
        // Calculate distances from first location to all others
        const origin = locations[0]
        const others = locations.slice(1)
        const destinations = others.map(place => place.address).join('|')
        
        const response = await fetch(`/api/distance?origins=${encodeURIComponent(origin.address)}&destinations=${encodeURIComponent(destinations)}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch distances')
        }

        const data = await response.json()
        // The answers come back in the order the places were asked about
        const times: DriveTime[] = []
        ;(data.distances || []).forEach((result: { duration?: string | null; distance?: string | null; error?: string }, index: number) => {
          const place = others[index]
          if (!place || result.error || !result.duration || !result.distance) return
          times.push({ label: `${origin.label} to ${place.label}`, duration: result.duration, distance: result.distance })
        })
        setDriveTimes(times)
      } catch (error) {
        console.error('Distance fetch error:', error)
        setDriveTimes([])
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

    const show = (d: WeatherReply) => {
      const cityLabel = d.location?.name
        ? `${d.location.name}${d.location.state ? ', ' + d.location.state : d.location.country ? ', ' + d.location.country : ''}`
        : null
      setJobWeather({ cityLabel, current: d.current ?? null, daily: d.daily ?? [], loading: false, error: false })
    }

    // What the phone already knows is on screen straight away, with no "Loading" in between
    // (weather barely moves in a few hours, so a saved answer is asked for again only once it's old)
    const saved = candidates.map(readCachedWeather).find(Boolean)
    if (saved) show(saved.data)
    else setJobWeather(prev => ({ ...prev, loading: true, error: false }))

    const tryFetch = async () => {
      for (const location of candidates) {
        const d = await fetchWeather(location)
        if (d?.current) {
          if (!cancelled) show(d)
          return
        }
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

  // The time it is where the job is, from the job's time zone.
  // When the time zone can't be found nothing is shown: this phone's own time beside
  // another city's name would be wrong, and look right.
  useEffect(() => {
    const address = fldr?.location || fldr?.venue_info?.address
    setLocationTime(null)
    if (!address) return

    let cancelled = false
    let interval: ReturnType<typeof setInterval> | null = null

    fetch(`/api/timezone?address=${encodeURIComponent(address)}`)
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (cancelled || !data?.timeZoneId) return
        const updateTime = () => {
          try {
            setLocationTime(
              new Date().toLocaleTimeString('en-US', {
                timeZone: data.timeZoneId,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })
            )
          } catch {
            setLocationTime(null)
          }
        }
        updateTime()
        interval = setInterval(updateTime, 60000) // Update every minute
      })
      .catch(error => {
        console.error('Timezone fetch error:', error)
      })

    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
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
      // Nothing waiting and nothing on its way: there is no save to show
      if (Object.keys(pendingRef.current).length === 0) return Promise.resolve()
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

  // Each save lights the header's Saved for a moment
  useEffect(() => {
    if (!lastSaved) return
    setSavedFlash(true)
    const timer = setTimeout(() => setSavedFlash(false), 2500)
    return () => clearTimeout(timer)
  }, [lastSaved])

  // Opening a card puts the others in its section away, so there is only ever one thing open to look at
  const toggleCard = (cardName: string) => {
    setExpandedCards(prev => {
      const opening = !prev[cardName]
      const next = { ...prev, [cardName]: opening }
      if (opening) {
        for (const other of Object.keys(SECTION_OF_CARD)) {
          if (other !== cardName && SECTION_OF_CARD[other] === SECTION_OF_CARD[cardName]) next[other] = false
        }
      }
      return next
    })
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

  // The section on screen. A saved name that this job doesn't have (time off has no Event) falls back to Overview.
  const shownSection = navSections.some(section => section.id === activeSection) ? activeSection : 'overview'

  // Shows one section and nothing else, starting at its top just under the bar
  const showSection = (id: string) => {
    setActiveSection(id)
    requestAnimationFrame(() => {
      const top = document.getElementById('job-content')
      if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' })
    })
  }

  // Opens a card, in whichever section it lives, and brings it into view (the Job Summary uses this for what's still missing)
  const jumpToCard = (card: string) => {
    setExpandedCards(prev => {
      const next = { ...prev, [card]: true }
      for (const other of Object.keys(SECTION_OF_CARD)) {
        if (other !== card && SECTION_OF_CARD[other] === SECTION_OF_CARD[card]) next[other] = false
      }
      return next
    })
    if (SECTION_OF_CARD[card]) setActiveSection(SECTION_OF_CARD[card])
    // Give the section a moment to show and the card to open before finding where it is
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`card-${card}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }


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

  // Several hotel fields at once: what an earlier stay at the same hotel already knows
  const patchHotelInfo = (patch: Partial<HotelInfo>) => {
    const current = fldrRef.current
    if (!current?.hotel_info) return
    const updated = { ...current.hotel_info, ...patch }
    const next = { ...current, hotel_info: updated }
    fldrRef.current = next
    setFldr(next)
    debouncedSave({ hotel_info: updated })
  }

  // One or several venue fields. Reads the job through the ref, so two changes made
  // back to back both land.
  const patchVenueInfo = (patch: Partial<VenueInfo>) => {
    const currentFldr = fldrRef.current
    if (!currentFldr) return
    const venueInfo = currentFldr.venue_info || {
      name: null,
      address: null,
      contact_name: null,
      contact_phone: null,
      notes: null,
    }
    const updated = { ...venueInfo, ...patch }
    const nextFldr = { ...currentFldr, venue_info: updated }
    fldrRef.current = nextFldr
    setFldr(nextFldr)
    debouncedSave({ venue_info: updated })
  }

  const updateVenueInfo = (field: keyof VenueInfo, value: string) => {
    patchVenueInfo({ [field]: value || null })
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
      toast('Filled in from the email. Check it over.')
    } catch (error) {
      console.error('Parse email error:', error)
      toast("Couldn't read that email. Try pasting it again, or fill it in by hand.", 'error')
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

  const addPerson = (name?: string, known?: { phone: string | null; email: string | null }) => {
    if (!fldr) return
    const people = fldr.people || []
    const newPerson: Person = { name: name || '', role: null, phone: known?.phone || null, email: known?.email || null }
    const updated = [...people, newPerson]
    setFldr({ ...fldr, people: updated })
    debouncedSave({ people: updated })
  }

  // Phone and email together, filled in from an earlier job
  const updatePersonContact = (index: number, contact: { phone: string | null; email: string | null }) => {
    if (!fldr?.people) return
    const people = [...fldr.people]
    people[index] = { ...people[index], phone: contact.phone, email: contact.email }
    setFldr({ ...fldr, people })
    debouncedSave({ people })
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

  const removePhoto = async (index: number) => {
    if (!fldr?.photos) return
    // A photo can't be brought back, so it's asked about first
    const target = fldr.photos[index]
    const confirmed = await askConfirm({ title: 'Remove this photo?', body: "It can't be brought back once it's removed.", confirmLabel: 'Remove', tone: 'danger' })
    const current = fldrRef.current
    if (!confirmed || !target || !current?.photos) return
    // By id, in case the list changed while the question was up
    const photos = current.photos.filter(photo => photo.id !== target.id)
    setFldr({ ...current, photos })
    debouncedSave({ photos })
  }

  // Product handlers
  const addProduct = (name?: string, quantity?: number) => {
    if (!fldr) return
    const products = fldr.products || []
    const newProduct: Product = {
      id: `product_${Date.now()}`,
      name: name || '',
      sku: null,
      quantity: quantity && quantity > 0 ? quantity : 1,
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

  // What each removable section is called on the page
  const MODULE_NAMES: Record<string, string> = {
    flight_info: 'Flights',
    hotel_info: 'Hotel',
    venue_info: 'Venue',
    rental_car_info: 'Rental Car',
    job_info: 'Job Info',
    checklist: 'Checklist',
    people: 'Staff',
    photos: 'Photos',
    products: 'Products',
  }

  const disableModule = async (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'job_info' | 'checklist' | 'people' | 'photos' | 'products') => {
    if (!fldr) return
    
    // Anything filled in gets asked about first
    if (hasModuleData(module)) {
      const name = MODULE_NAMES[module]
      const confirmed = await askConfirm({
        title: `Remove ${name}?`,
        body: `Everything saved under ${name} on this job will be deleted.`,
        confirmLabel: 'Remove',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    
    // Remove the module - save immediately (not debounced) to prevent it from coming back
    setFldr(prev => (prev ? { ...prev, [module]: null } : prev))
    await saveFldr({ [module]: null })
    setExpandedCards(prev => ({ ...prev, [module.replace('_info', '')]: false }))
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
    const confirmed = await askConfirm({
      title: 'Duplicate job?',
      body: 'A copy will be created. You can update dates and details after.',
      confirmLabel: 'Duplicate',
    })
    if (confirmed) await doDuplicateJob()
  }

  const doDuplicateJob = async () => {
    if (!fldr) return
    
    setSaving(true)
    
    try {
      const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

      // Creating a job only takes its name, dates, city, staff and notes
      const response = await fetch('/api/fldrs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${fldr.title} (Copy)`,
          date_start: fldr.date_start,
          date_end: fldr.date_end,
          location: fldr.location,
          people: fldr.people ? copy(fldr.people) : null,
          notes: fldr.notes || '',
        })
      })
      if (!response.ok) throw new Error('Failed to duplicate job')
      let createdFldr: Fldr = await response.json()

      // ...so everything else goes on with a save straight after.
      // Left behind on purpose: photos, the logistics ticks, anything AI wrote, and jigs.
      const rest: Partial<Fldr> = {
        attending: fldr.attending,
        flight_info: fldr.flight_info ? copy(fldr.flight_info) : null,
        hotel_info: fldr.hotel_info ? copy(fldr.hotel_info) : null,
        venue_info: fldr.venue_info ? copy(fldr.venue_info) : null,
        rental_car_info: fldr.rental_car_info ? copy(fldr.rental_car_info) : null,
        job_info: fldr.job_info ? copy(fldr.job_info) : null,
        checklist: fldr.checklist ? copy(fldr.checklist).map((item: ChecklistItem) => ({ ...item, completed: false })) : null,
        products: fldr.products ? copy(fldr.products) : null,
      }
      const filled = await fetch(`/api/fldrs/${createdFldr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rest)
      })
      const complete = filled.ok
      if (complete) createdFldr = await filled.json()
      console.log('[Duplicate] Job duplicated successfully')

      // On this phone's list right away, so the copy opens without a trip back to the list
      cacheFldr(createdFldr)
      try {
        const listCache = localStorage.getItem('git-fldrs')
        const allFldrs = listCache ? JSON.parse(listCache) : []
        localStorage.setItem('git-fldrs', JSON.stringify([...allFldrs, createdFldr]))
      } catch (e) {
        console.error('Failed to update list cache:', e)
      }

      if (complete) toast('Copy made. This is the copy.')
      else toast('The copy was made, but only its name, dates, city, staff and notes came across.', 'error')
      router.push(`/jobs/${createdFldr.id}`)
    } catch (error) {
      console.error('[Duplicate] Duplicate job failed:', error)
      toast("Couldn't duplicate the job. Please try again.", 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteJob = async () => {
    if (!fldr) return
    const confirmed = await askConfirm({
      title: 'Delete job?',
      body: `\u201c${fldr.title}\u201d will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (confirmed) await doDeleteJob()
  }

  const doDeleteJob = async () => {
    if (!fldr) return
    
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
      toast("Couldn't delete the job. Please try again.", 'error')
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
      toast("Couldn't write the overview. Please try again.", 'error')
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
      toast("Couldn't share the PDF. Please try again.", 'error')
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
      toast("Couldn't make the PDF. Please try again.", 'error')
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
      toast("Couldn't share the PDF. Please try again.", 'error')
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
      toast("Couldn't make the PDF. Please try again.", 'error')
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
      const freshData = res.ok ? await res.json() : null
      if (!isJobReply(freshData, fldr.id)) {
        toast("Couldn't refresh. Check your connection and try again.", 'error')
      } else {
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
      toast("Couldn't refresh. Check your connection and try again.", 'error')
    }
    
    setIsRefreshing(false)
  }

  const openParseEmail = async (kind: 'flight' | 'hotel' | 'rental_car') => {
    await flushAndSave()
    setShowParseEmailModal(kind)
    setParseEmailText('')
  }

  // The job isn't on this phone, and the server either doesn't have it or couldn't be reached
  if (!fldr && (notFound || loadFailed)) {
    return (
      <div className="min-h-page flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-white">{notFound ? "This job isn't here anymore" : "Can't open this job right now"}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-white/60">
            {notFound
              ? 'It may have been deleted, or the link may be wrong.'
              : "This phone doesn't have a copy of it yet, and the server couldn't be reached. Check your connection and try again."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {!notFound && (
              <button onClick={() => setLoadAttempt(attempt => attempt + 1)} className="btn-brand min-h-[2.75rem]">
                Try Again
              </button>
            )}
            <button onClick={() => router.push('/jobs')} className="btn-secondary min-h-[2.75rem]">
              Back to Jobs
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading || !fldr) {
    return <FldrDetailSkeleton />
  }

  // Who's on the job, offered when adding travelers to a flight
  const staffNames = Array.from(
    new Set([...(fldr.people || []).map(p => p.name), ...(fldr.job_info?.team_members || [])].map(n => n?.trim()).filter(Boolean))
  ) as string[]

  // Where the save stands, for the button in the header
  const saveState: 'saving' | 'unsaved' | 'waiting' | 'saved' =
    saving || autoSaving ? 'saving' : unsavedChanges ? 'unsaved' : hasUnsynced ? 'waiting' : 'saved'

  // The days the trip runs between and the airports it uses, so the travel cards can
  // start their date pickers in the right place and offer the airport for the rental car
  const flights = Array.isArray(fldr.flight_info) ? fldr.flight_info : []
  const flightsOut = flights.filter(flight => flight.segment_type !== 'return')
  const lastFlightOut = flightsOut[flightsOut.length - 1]
  const flightHome = flights.find(flight => flight.segment_type === 'return')
  const trip = {
    out: fldr.job_info?.travel_start || dayKey(flightsOut[0]?.departure_time) || fldr.date_start,
    back: fldr.job_info?.travel_end || dayKey(flightHome?.departure_time) || fldr.date_end || fldr.date_start,
  }
  const arrivalAirport = lastFlightOut?.arrival_address
    ? { code: lastFlightOut.arrival_code, address: lastFlightOut.arrival_address, time: lastFlightOut.arrival_time }
    : null
  const departureAirport = flightHome?.departure_address
    ? { code: flightHome.departure_code, address: flightHome.departure_address, time: flightHome.departure_time }
    : null

  const menuItem =
    'flex min-h-[2.75rem] w-full items-center gap-3 px-4 text-left text-[15px] text-white/85 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50'
  const menuItemDanger =
    'flex min-h-[2.75rem] w-full items-center gap-3 px-4 text-left text-[15px] text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50'
  const menuIcon =
    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-brand-light transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50'

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
              <span className="text-[15px] font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="text-brand-light text-[15px] font-medium">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}
        </div>
      )}
      {/* Header: back, how the save stands, and everything else under More */}
      <div className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 h-14 px-3 max-w-2xl mx-auto">
        {/* Left side - Back button */}
        <button
          onClick={async () => {
            // Flush any pending save before navigating
            await flushAndSave()
            router.push('/jobs')
          }}
          className="flex items-center gap-1 pl-1.5 pr-3 h-11 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[15px] font-medium transition-colors"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Right side - Save and More */}
        <div className="flex items-center gap-1">
          {/* Says where the save stands, and saves right away when tapped */}
          <button
            onClick={manualSave}
            disabled={saving || !fldr}
            aria-label={
              saveState === 'saving'
                ? 'Saving'
                : saveState === 'unsaved'
                ? 'Save changes now'
                : saveState === 'waiting'
                ? 'Changes not sent yet. Tap to try again'
                : 'All changes saved. Tap to save again'
            }
            className={`inline-flex h-11 min-w-[6.5rem] items-center justify-center gap-2 rounded-lg border px-3.5 text-[15px] font-semibold transition-colors disabled:opacity-60 ${
              saveState === 'unsaved'
                ? 'bg-brand border-brand hover:bg-brand-hover text-white'
                : saveState === 'waiting'
                ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                : saveState === 'saved' && savedFlash
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
                : 'bg-white/5 border-line-strong hover:bg-white/10 text-white/70'
            }`}
          >
            {saveState === 'saving' ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : saveState === 'saved' ? (
              <CheckIcon className="w-4 h-4" />
            ) : saveState === 'waiting' ? (
              <AlertIcon className="w-4 h-4" />
            ) : null}
            <span>
              {saveState === 'saving' ? 'Saving...' : saveState === 'unsaved' ? 'Save' : saveState === 'waiting' ? 'Not sent' : 'Saved'}
            </span>
          </button>

          {/* Everything else about the job lives under one button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={async () => {
                await flushAndSave()
                setShowMenu(!showMenu)
              }}
              className="icon-btn h-11 w-11"
              title="More options"
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={showMenu}
            >
              <MoreIcon className="w-5 h-5" />
            </button>

            {showMenu && (
              <div
                role="menu"
                className="absolute top-full right-0 mt-2 w-[min(19rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-5.5rem)] overflow-y-auto bg-surface border border-line-strong rounded-xl shadow-pop py-1.5 z-50 animate-slide-in"
              >
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    enableEditMode()
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className={menuItem}
                >
                  <PencilIcon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>Edit Name and Dates</span>
                </button>
                <button
                  role="menuitem"
                  disabled={!online || isRefreshing}
                  onClick={async () => {
                    setShowMenu(false)
                    setIsRefreshing(true)
                    await handleRefresh()
                  }}
                  className={menuItem}
                >
                  <RefreshIcon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>Refresh</span>
                </button>
                <button
                  role="menuitem"
                  disabled={saving}
                  onClick={() => {
                    setShowMenu(false)
                    duplicateJob()
                  }}
                  className={menuItem}
                >
                  <CopyIcon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>Duplicate Job</span>
                </button>

                <div className="border-t border-line my-1.5"></div>
                <div className="px-4 pt-1.5 pb-1">
                  <span className="eyebrow">Share</span>
                </div>
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    generateOverview()
                  }}
                  disabled={generatingOverview}
                  className={menuItem}
                >
                  <DocumentIcon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>{generatingOverview ? 'Generating...' : 'Text Overview'}</span>
                </button>
                <div className="flex min-h-[2.75rem] items-center gap-1 pl-4 pr-2">
                  <span className="min-w-0 flex-1 text-[15px] text-white/85">Quick PDF (1 page)</span>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false)
                      handleQuickOverviewDownload()
                    }}
                    disabled={generatingPDF !== null}
                    aria-label="Download Quick PDF"
                    title="Download"
                    className={menuIcon}
                  >
                    <DownloadIcon className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false)
                      handleQuickOverviewShare()
                    }}
                    disabled={generatingPDF !== null}
                    aria-label="Share Quick PDF"
                    title="Share"
                    className={menuIcon}
                  >
                    <ShareIcon className="w-[18px] h-[18px]" />
                  </button>
                </div>
                <div className="flex min-h-[2.75rem] items-center gap-1 pl-4 pr-2">
                  <span className="min-w-0 flex-1 text-[15px] text-white/85">Full Trip Brief</span>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false)
                      handleFullTripBriefDownload()
                    }}
                    disabled={generatingPDF !== null}
                    aria-label="Download Full Trip Brief"
                    title="Download"
                    className={menuIcon}
                  >
                    <DownloadIcon className="w-[18px] h-[18px]" />
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowMenu(false)
                      handleFullTripBriefShare()
                    }}
                    disabled={generatingPDF !== null}
                    aria-label="Share Full Trip Brief"
                    title="Share"
                    className={menuIcon}
                  >
                    <ShareIcon className="w-[18px] h-[18px]" />
                  </button>
                </div>

                <div className="border-t border-line my-1.5"></div>

                {/* Archive/Unarchive */}
                <button
                  role="menuitem"
                  onClick={async () => {
                    if (!fldr) return
                    setShowMenu(false)
                    const newArchiveStatus = !fldr.archived
                    if (newArchiveStatus && jigsOut > 0) {
                      await showNotice({
                        title: 'Jigs are still out',
                        body: 'Some jigs from this job are still out. Check them in first, or set the status to Waiting on return.',
                      })
                      return
                    }
                    setSaving(true)
                    try {
                      setFldr({ ...fldr, archived: newArchiveStatus })
                      await saveFldr({ archived: newArchiveStatus })
                      toast(newArchiveStatus ? 'Job archived' : 'Job is back on the list')
                    } finally {
                      setSaving(false)
                    }
                  }}
                  disabled={saving}
                  className={menuItem}
                >
                  <ArchiveIcon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>{fldr.archived ? 'Unarchive Job' : 'Archive Job'}</span>
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowMenu(false)
                    deleteJob()
                  }}
                  disabled={saving}
                  className={menuItemDanger}
                >
                  <TrashIcon className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>Delete Job</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Read out for screen readers as the save moves along */}
      <div className="sr-only" aria-live="polite">
        {saveState === 'saving' ? 'Saving' : saveState === 'unsaved' ? 'Changes not saved yet' : saveState === 'waiting' ? 'Changes not sent yet' : lastSaved ? 'Saved' : ''}
      </div>

      {/* Only shown when something needs saying: offline, or a save that hasn't got through */}
      {(!online || hasUnsynced) && (
        <div className="px-4 max-w-2xl mx-auto mt-3" role="status">
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/30 bg-amber-500/10 py-1 pl-3.5 pr-1.5 text-sm leading-snug text-amber-100">
            <AlertIcon className="w-4 h-4 flex-shrink-0 text-amber-300" />
            <span className="min-w-0 flex-1 py-2">
              {!online
                ? "You're offline. Changes are kept on this phone and sent when you're back online."
                : "Some changes haven't reached the server yet."}
            </span>
            {online && hasUnsynced && (
              <button
                onClick={manualSave}
                disabled={saving}
                className="inline-flex min-h-[2.5rem] flex-shrink-0 items-center rounded-lg px-3 text-[15px] font-semibold text-amber-200 transition-colors hover:bg-amber-500/15 disabled:opacity-50"
              >
                Send Now
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 mb-4 px-4 max-w-2xl mx-auto">
        {editMode ? (
          <div className="card shadow-card space-y-4 p-5">
            <div>
              <label className="label">
                Job Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="input"
                placeholder="e.g. Acme Corp"
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
                  min={editDateStart || undefined}
                  onChange={(e) => setEditDateEnd(e.target.value)}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="label">
                City <span className="text-white/35 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="input"
                placeholder="e.g. Austin, TX"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBasicInfo}
                disabled={!editTitle.trim() || !editDateStart || saving}
                className="btn-brand flex-1 min-h-[2.75rem]"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="btn-secondary flex-1 min-h-[2.75rem]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* The job's name, large and sitting right on the page like the title of an app screen */}
            <div className="px-1">
              <h2 className="text-[28px] font-bold leading-tight tracking-tight text-white break-words">{fldr.title}</h2>
              <div className="mt-1.5 text-base text-white/65 tabular">
                {formatDate(fldr.date_start)}
                {fldr.date_end && ` – ${formatDate(fldr.date_end)}`}
              </div>
              {fldr.location && (
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                  <div className="text-base text-white/85">{fldr.location}</div>
                  {locationTime && (
                    <div className="flex items-center gap-1 text-sm text-white/55 tabular" title="The time there right now">
                      <ClockIcon className="w-3.5 h-3.5" />
                      <span>{locationTime} there</span>
                    </div>
                  )}
                </div>
              )}

              {/* Countdown Timers */}
              {isJob && (() => {
                // The countdown is to the day you leave; on that day it says Travel Day, and once the job is on, Job Day
                const phase = tripPhase(fldr)
                const pills = tripPills(phase)
                if (pills.length === 0) return null
                const urgency =
                  phase.kind === 'travel-day' || phase.kind === 'job-day'
                    ? 'bg-brand/20 border-brand/40 text-brand-light'
                    : phase.days <= 2
                    ? 'bg-red-500/10 border-red-400/30 text-red-300'
                    : phase.days <= 7
                    ? 'bg-yellow-500/10 border-yellow-400/30 text-yellow-300'
                    : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300'

                return (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {pills.map(text => (
                      <span key={text} className={`rounded-full border px-3.5 py-1.5 text-[15px] font-semibold ${urgency}`}>
                        {text}
                      </span>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Job Status Selector */}
            {isJob && (
              <div className="card mt-4 py-1.5 pl-4 pr-1.5">
                <div className="flex items-center gap-3">
                  <label htmlFor="job-status" className="flex-shrink-0 text-base font-medium text-white/80">Job Status</label>
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
                    className="input min-h-[2.75rem] flex-1"
                  >
                    <option value="" className="bg-gray-800 text-white">Not Set</option>
                    <option value="pending" className="bg-gray-800 text-white">Pending</option>
                    <option value="confirmed" className="bg-gray-800 text-white">Confirmed</option>
                    <option value="in_progress" className="bg-gray-800 text-white">In Progress</option>
                    <option value="awaiting_return" className="bg-gray-800 text-white">Waiting on return</option>
                    <option value="complete" className="bg-gray-800 text-white">Complete</option>
                  </select>
                </div>
                {fldr.job_status === 'awaiting_return' && (
                  <p className="pb-2 pr-3 pt-1 text-sm leading-relaxed text-amber-200/80">
                    Waiting on {jigsOut} jig{jigsOut === 1 ? '' : 's'} to be checked in. This job completes itself once everything is back.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <SectionNav sections={navSections} active={shownSection} onSelect={showSection} />

      {/* One section at a time. The others stay mounted (so nothing typed is lost) but out of sight. */}
      <div id="job-content" className="px-4 max-w-2xl mx-auto scroll-mt-[8.5rem]">
        {/* ── Overview: what's next, the trip start to end, the details you reach for ── */}
        <section
          id="sec-overview"
          role="tabpanel"
          aria-label="Overview"
          className={shownSection === 'overview' ? 'space-y-3 animate-fade-in' : 'hidden'}
        >
          {/* Getting there: the venue is a tap away once its address is in */}
          {!editMode && (
            <div className={`grid gap-2 ${fldr.venue_info?.address ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {fldr.venue_info?.address && (
                <a
                  href={directionsUrl(fldr.venue_info.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-2 py-2.5 text-center text-[15px] font-medium leading-tight text-white transition-colors active:bg-white/10"
                >
                  <DirectionsIcon className="w-5 h-5 text-gold" />
                  Directions to Venue
                </a>
              )}
              <button
                onClick={() => setShowMapModal(true)}
                className="card flex min-h-[3.5rem] flex-col items-center justify-center gap-1 px-2 py-2.5 text-center text-[15px] font-medium leading-tight text-white transition-colors active:bg-white/10"
              >
                <MapIcon className="w-5 h-5 text-gold" />
                Map &amp; Nearby Places
              </button>
            </div>
          )}

          <GlanceCard
            fldr={fldr}
            jigsOut={jigsOut}
            driveTimes={driveTimes}
            driveTimesLoading={distancesLoading}
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
                    <span className="text-[15px] text-white/70">{Math.round(jobWeather.current.temp)}°</span>
                  </div>
                )
              }
            >
              <>
                {jobWeather.loading && (
                  <div className="py-6 text-center text-[15px] text-white/55">Loading weather…</div>
                )}

                {!jobWeather.loading && jobWeather.error && (
                  <div className="py-6 text-center text-[15px] leading-relaxed text-white/55">
                    Couldn&apos;t get the weather for this city. Check the city&apos;s spelling under Client &amp; Event.
                  </div>
                )}

                {!jobWeather.loading && !jobWeather.error && jobWeather.current && (
                  <>
                    {jobWeather.cityLabel && (
                      <div className="text-[13px] text-brand-light font-semibold uppercase tracking-wide mb-2">
                        {jobWeather.cityLabel}
                      </div>
                    )}
                    <div className="flex items-center justify-between pb-3 border-b border-line">
                      <div className="flex items-center gap-3">
                        <WeatherSVG condition={jobWeather.current.main} size="lg" />
                        <div>
                          <div className="text-2xl font-light text-white leading-none">
                            {Math.round(jobWeather.current.temp)}°
                          </div>
                          <div className="text-sm text-white/60 capitalize mt-1">
                            {jobWeather.current.description}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm text-white/60 space-y-0.5">
                        <div>Feels like {Math.round(jobWeather.current.feels_like)}°</div>
                        <div>{jobWeather.current.humidity}% humidity</div>
                        <div>{jobWeather.current.wind_speed} mph wind</div>
                      </div>
                    </div>

                    {jobWeather.daily.length > 0 && (
                      <div className="grid grid-cols-5 gap-1 pt-3">
                        {jobWeather.daily.map(day => (
                          <div key={day.date} className="flex flex-col items-center gap-1">
                            <div className="text-[13px] text-white/50">
                              {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            <WeatherSVG condition={day.main} size="xs" />
                            <div className="text-[15px] font-semibold text-white">{day.high}°</div>
                            <div className="text-[13px] text-white/50">{day.low}°</div>
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
          <SectionCard
            id="itinerary"
            title="Itinerary"
            open={expandedCards.itinerary}
            onToggle={() => toggleCard('itinerary')}
            summary="Every time on the job, hour by hour"
          >
            <>
              {(() => {
                const itinerary = generateItinerary()

                if (Object.keys(itinerary).length === 0) {
                  return (
                    <p className="text-[15px] leading-relaxed text-white/55 py-4 text-center">
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
                        <div className="text-[15px] font-semibold text-brand-light mb-3">
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
                                className={`flex gap-3 pl-3 border-l-2 transition-all ${
                                  isPast
                                    ? 'border-brand/20 opacity-60'
                                    : isNext
                                      ? 'border-gold bg-gold/[0.06] py-1'
                                      : 'border-brand/40'
                                }`}
                              >
                                <span className={`w-[4.25rem] flex-shrink-0 pt-px text-sm font-medium tabular ${isPast ? 'text-white/45' : isNext ? 'text-gold' : 'text-brand-light'}`}>
                                  {event.dateTime.toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className={`flex flex-wrap items-center gap-1.5 text-base leading-snug ${
                                    isPast
                                      ? 'line-through text-white/45'
                                      : 'font-medium text-white/90'
                                  }`}>
                                    {event.title}
                                    {isNext && <span className="badge bg-gold/15 py-0.5 text-gold">Next</span>}
                                  </div>
                                  {event.details.length > 0 && (
                                    <div className={`mt-0.5 text-sm space-y-0.5 text-white/50 ${isPast ? 'line-through' : ''}`}>
                                      {event.details.map((detail, i) => (
                                        <div key={i} className="break-words">{detail}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
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
          <section
            id="sec-event"
            role="tabpanel"
            aria-label="Event"
            className={shownSection === 'event' ? 'space-y-3 animate-fade-in' : 'hidden'}
          >
            <ClientEventCard
              fldr={fldr}
              suggestions={suggestions}
              open={expandedCards.event}
              onToggle={() => toggleCard('event')}
              onJobInfo={updateJobInfo}
              onJobInfoPatch={patchJobInfo}
              onLocation={updateLocation}
              onDone={flushPending}
            />
            <VenueTimeCard
              fldr={fldr}
              suggestions={suggestions}
              open={expandedCards.venue}
              onToggle={() => toggleCard('venue')}
              onVenue={updateVenueInfo}
              onVenuePatch={patchVenueInfo}
              onJobInfo={updateJobInfo}
              onLocation={updateLocation}
              onDone={flushPending}
            />
            {fldr.products !== null ? (
              <ProductsCard
                products={fldr.products}
                job={{ id: fldr.id, start: fldr.date_start, end: fldr.date_end }}
                jigs={jobJigs}
                jigsOut={jigsOut}
                gift={fldr.job_info?.item ? { name: fldr.job_info.item, quantity: fldr.job_info.quantity } : null}
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
          <section
            id="sec-logistics"
            role="tabpanel"
            aria-label="Logistics"
            className={shownSection === 'logistics' ? 'space-y-3 animate-fade-in' : 'hidden'}
          >
            <LogisticsCard
              tracker={fldr.tracker}
              open={expandedCards.logistics}
              onToggle={() => toggleCard('logistics')}
              onChange={patch => updateTracker(patch, true)}
              onType={patch => updateTracker(patch)}
              onCommit={flushPending}
            />
          </section>
        )}

        {/* ── Travel ── */}
        <section
          id="sec-travel"
          role="tabpanel"
          aria-label="Travel"
          className={shownSection === 'travel' ? 'space-y-3 animate-fade-in' : 'hidden'}
        >
          <TravelDatesRow
            start={fldr.job_info?.travel_start ?? null}
            end={fldr.job_info?.travel_end ?? null}
            flightDates={flightSpan(fldr)}
            booked={isJob ? readStep(fldr.tracker, 'travel_booked') : null}
            readyToBook={hasModuleData('flight_info') && hasModuleData('hotel_info')}
            onDates={updateTravelDates}
            onToggleBooked={toggleTravelBooked}
          />
          {fldr.flight_info !== null && (
            <FlightsCard
              segments={flights}
              staffNames={staffNames}
              trip={trip}
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
              suggestions={suggestions}
              trip={{ out: dayKey(arrivalAirport?.time) || trip.out, back: trip.back }}
              airportAddress={arrivalAirport?.address ?? null}
              venueAddress={fldr.venue_info?.address ?? null}
              open={expandedCards.hotel}
              onToggle={() => toggleCard('hotel')}
              onField={updateHotelInfo}
              onPatch={patchHotelInfo}
              onParseEmail={() => openParseEmail('hotel')}
              onRemoveSection={() => disableModule('hotel_info')}
              onDone={flushPending}
            />
          )}
          {fldr.rental_car_info !== null && (
            <RentalCarCard
              car={fldr.rental_car_info}
              trip={trip}
              arrival={arrivalAirport}
              departure={departureAirport}
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
        <section
          id="sec-team"
          role="tabpanel"
          aria-label="Team"
          className={shownSection === 'team' ? 'space-y-3 animate-fade-in' : 'hidden'}
        >
          <StaffCard
            people={fldr.people}
            wardrobe={fldr.job_info?.wardrobe ?? null}
            suggestions={suggestions}
            open={expandedCards.people}
            onToggle={() => toggleCard('people')}
            onAddPerson={addPerson}
            onPersonField={updatePerson}
            onPersonContact={updatePersonContact}
            onPersonNameBlur={handlePersonNameBlur}
            onRemovePerson={removePerson}
            onWardrobe={value => updateJobInfo('wardrobe', value || null)}
            onDone={flushPending}
          />
        </section>

        {/* ── More: notes, links and the rest ── */}
        <section
          id="sec-more"
          role="tabpanel"
          aria-label="More"
          className={shownSection === 'more' ? 'space-y-3 animate-fade-in' : 'hidden'}
        >
          <SectionCard
            id="notes"
            title="Notes"
            open={expandedCards.notes}
            onToggle={() => toggleCard('notes')}
            summary={plainText(fldr.notes).slice(0, 140) || 'Anything else worth writing down'}
          >
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[13px] font-medium text-white/60">Notes</label>
                <TextAction onClick={() => setUseRichEditor(!useRichEditor)}>
                  {useRichEditor ? 'Plain text' : 'Add formatting'}
                </TextAction>
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
                    onBlur={flushPending}
                    aria-label="Notes"
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
              summary={fldr.photos.length === 0 ? 'Pictures from the job' : undefined}
              meta={fldr.photos.length > 0 && <span className="text-sm font-semibold tabular text-white/55">{fldr.photos.length}</span>}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/45">
                    {(fldr.photos || []).length} {(fldr.photos || []).length === 1 ? 'photo' : 'photos'}
                  </span>
                  <label className="-mx-2 inline-flex min-h-[2.75rem] cursor-pointer items-center rounded-lg px-2 text-[15px] font-medium text-brand-light transition-colors hover:bg-white/5 hover:text-white">
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
                        aria-label="Remove photo"
                        title="Remove photo"
                        className="absolute top-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition-colors hover:bg-red-600"
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
                      onBlur={flushPending}
                      aria-label="Photo caption"
                      className="input"
                      placeholder="Add a caption, e.g. Table set up and ready"
                    />
                  </div>
                ))}
                {(fldr.photos || []).length === 0 && (
                  <p className="text-sm text-white/40">No photos yet</p>
                )}
                <div>
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
                [fldr.job_info?.prompt_1 && 'Prompt 1', fldr.job_info?.prompt_2 && 'Prompt 2'].filter(Boolean).join(' · ') ||
                'The two prompts for this job'
              }
            >
              <div className="space-y-3">
                {/* Prompt Creator writes these and saves them back here */}
                <button
                  type="button"
                  onClick={async () => {
                    await flushAndSave()
                    router.push(`/prompt-creator?job=${fldr.id}`)
                  }}
                  className="flex min-h-[2.75rem] w-full items-center gap-2.5 rounded-xl border border-line-strong bg-white/5 px-3.5 py-2 text-left transition-colors hover:bg-white/10"
                >
                  <SparkIcon className="h-4 w-4 flex-shrink-0 text-gold" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-white">Open Prompt Creator for this job</span>
                    <span className="block text-[13px] text-white/45">Write or rework the prompts there, then save them back here.</span>
                  </span>
                </button>
                {(['prompt_1', 'prompt_2'] as const).map((field, index) => (
                  <div key={field}>
                    <div className="flex min-h-[2.75rem] items-center justify-between">
                      <label className="text-[13px] font-medium text-white/60">Prompt {index + 1}</label>
                      <div className="-mr-2.5">
                        <CopyAction text={fldr.job_info?.[field] || ''} label={`Copy prompt ${index + 1}`} />
                      </div>
                    </div>
                    <textarea
                      value={fldr.job_info?.[field] || ''}
                      onChange={(e) => updateJobInfo(field, e.target.value || null)}
                      onBlur={flushPending}
                      aria-label={`Prompt ${index + 1}`}
                      className="input resize-none"
                      rows={4}
                      placeholder="Paste the prompt here"
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {(fldr.checklist === null || fldr.photos === null) && (
            <div className="flex flex-wrap gap-2">
              {fldr.checklist === null && <AddSectionButton label="Checklist" onClick={() => enableModule('checklist')} />}
              {fldr.photos === null && <AddSectionButton label="Photos" onClick={() => enableModule('photos')} />}
            </div>
          )}

          {/* Delete Job: also in the menu at the top. Kept here, quietly, for anyone who looks at the bottom of More. */}
          <div className="flex justify-center pt-4">
            <TextAction onClick={() => deleteJob()} tone="danger">
              <TrashIcon className="h-4 w-4" />
              Delete Job
            </TextAction>
          </div>
        </section>
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
                <p className="text-[15px] text-center">{fldr.photos[expandedPhotoIndex].caption}</p>
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
                Fill in {showParseEmailModal === 'flight' ? 'Flights' : showParseEmailModal === 'hotel' ? 'the Hotel' : 'the Rental Car'} from an Email
              </h3>
              <button
                onClick={async () => {
                  await flushAndSave()
                  setShowParseEmailModal(null)
                  setParseEmailText('')
                  setParseEmailImage(null)
                  setParseInputMode('text')
                }}
                className="icon-btn h-11 w-11 -mr-2"
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
                className={`min-h-[2.75rem] px-4 py-2 text-[15px] font-medium transition-colors border-b-2 -mb-px ${
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
                className={`min-h-[2.75rem] px-4 py-2 text-[15px] font-medium transition-colors border-b-2 -mb-px ${
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
                        <p className="mb-2 text-[15px] text-white/60">
                          <span className="font-display font-semibold">Tap to choose a screenshot</span>
                        </p>
                        <p className="text-[13px] text-white/45">A picture up to 10MB</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 10 * 1024 * 1024) {
                              toast('That picture is too big. The most it can be is 10MB.', 'error')
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
                <p className="text-[13px] text-white/45">
Burrow reads it and fills in the fields. Check them over after.
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
                    className="btn-secondary min-h-[2.75rem] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={parseEmail}
                    disabled={(parseInputMode === 'text' && !parseEmailText.trim()) || (parseInputMode === 'image' && !parseEmailImage) || parsingEmail}
                    className="btn-brand min-h-[2.75rem]"
                  >
                    {parsingEmail ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Reading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        Fill In
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
                className="icon-btn h-11 w-11 -mr-2"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="bg-canvas/60 border border-line rounded-xl p-4 mb-4">
              <pre className="whitespace-pre-wrap font-mono text-[15px] text-white/80 leading-relaxed">
                {generatedOverview}
              </pre>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-white/45">
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

    </div>
  )
}
