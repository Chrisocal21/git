'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Fldr, FlightInfo, HotelInfo, VenueInfo, RentalCarInfo, JobInfo, ReferenceLink, Person, Photo, Product } from '@/types/fldr'
import { ChevronDownIcon, PencilIcon } from '@/components/Icons'
import CopyButton from '@/components/CopyButton'
import { FldrDetailSkeleton } from '@/components/SkeletonLoader'
import AirportAutocomplete from '@/components/AirportAutocomplete'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import RichTextEditor from '@/components/RichTextEditor'
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

// Dynamic import for map (client-side only, Leaflet doesn't support SSR)
const FldrMap = dynamic(() => import('@/components/FldrMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-64 bg-white/5 rounded-lg flex items-center justify-center">
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
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    summary: true, // New unified view - open by default
    flight: false,
    hotel: false,
    venue: false,
    rentalCar: false,
    map: false,
    preTrip: false,
    jobInfo: false,
    checklist: false,
    people: false,
    photos: false,
    products: false,
    notes: false,
  })
  const [generatingWrapUp, setGeneratingWrapUp] = useState(false)
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

  useEffect(() => {
    // Check online status
    const updateOnlineStatus = () => {
      setOnline(isOnline())
      setHasUnsynced(hasUnsyncedChanges())
    }
    
    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    
    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (params.id) {
      const fldrId = params.id as string
      console.log(`🔍 Loading fldr: ${fldrId}`)
      logStorageInfo()
      
      // Try to load from cache first (fallback 1: offlineStorage)
      let cached = getCachedFldr(fldrId)
      
      // Fallback 2: Check the main list cache
      if (!cached) {
        console.log('⚠️ Not found in offline storage, checking list cache')
        try {
          const listCache = localStorage.getItem('git-fldrs')
          if (listCache) {
            const allFldrs = JSON.parse(listCache)
            cached = allFldrs.find((f: Fldr) => f.id === fldrId)
            if (cached) {
              console.log('✅ Found in list cache')
            } else {
              console.log('❌ Not found in list cache either')
            }
          } else {
            console.log('❌ No list cache exists')
          }
        } catch (e) {
          console.error('❌ Failed to parse list cache:', e)
        }
      } else {
        console.log('✅ Found in offline storage')
      }
      
      if (cached) {
        setFldr(cached)
        setEditTitle(cached.title)
        setEditDateStart(cached.date_start)
        setEditDateEnd(cached.date_end || '')
        setEditLocation(cached.location || '')
        setLoading(false)
      }
      
      // Don't fetch from server - we're using localStorage as primary storage
      // Server memory resets on Vercel serverless, so it's unreliable
      // Only sync happens on explicit save (in saveFldr function)
      if (!cached) {
        // No cached data - redirect to list
        console.error('💥 CRITICAL: No cached data found for fldr:', fldrId)
        console.error('💥 This should not happen! Data may have been lost.')
        logStorageInfo()
        
        // Give user a chance to see the error before redirect
        setTimeout(() => {
          router.push('/fldr')
        }, 2000)
      }
    }
  }, [params.id, router])

  const saveFldr = useCallback(async (updates: Partial<Fldr>) => {
    if (!fldr) return
    setSaving(true)
    try {
      // Check if fldr should be marked as ready/complete
      const updatedFldr = { ...fldr, ...updates }
      const hasFlightInfo = updatedFldr.flight_info && (
        updatedFldr.flight_info.departure_airport ||
        updatedFldr.flight_info.arrival_airport
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
        updates.status = 'ready'
      }
      
      // Update local state and cache immediately
      const newFldr = { ...fldr, ...updates }
      setFldr(newFldr)
      cacheFldr(newFldr)
      setLastSaved(new Date())
      
      // Also update the list cache so changes appear on list page
      try {
        const listCache = localStorage.getItem('git-fldrs')
        if (listCache) {
          const allFldrs = JSON.parse(listCache)
          const index = allFldrs.findIndex((f: Fldr) => f.id === fldr.id)
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
        try {
          const response = await fetch(`/api/fldrs/${fldr.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          })
          if (response.ok) {
            const updated = await response.json()
            setFldr(updated)
            cacheFldr(updated)
            setLastSaved(new Date())
            
            // Update list cache with server response
            try {
              const listCache = localStorage.getItem('git-fldrs')
              if (listCache) {
                const allFldrs = JSON.parse(listCache)
                const index = allFldrs.findIndex((f: Fldr) => f.id === fldr.id)
                if (index !== -1) {
                  allFldrs[index] = updated
                  localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
                }
              }
            } catch (e) {
              console.error('Failed to update list cache:', e)
            }
          }
        } catch (error) {
          // If save fails, add to sync queue
          addToSyncQueue(fldr.id, updates)
          setHasUnsynced(true)
        }
      } else {
        // Offline: add to sync queue
        addToSyncQueue(fldr.id, updates)
        setHasUnsynced(true)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }, [fldr])

  // Debounced save - clear existing timeout and set new one
  const debouncedSave = useCallback((updates: Partial<Fldr>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setSaving(true)
    saveTimeoutRef.current = setTimeout(() => {
      saveFldr(updates)
    }, 1000) // Save 1 second after typing stops
  }, [saveFldr])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

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

  // Format dates in local timezone to avoid day-off errors
  const formatDate = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    const localDate = new Date(year, month - 1, day)
    return localDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const updateFlightInfo = (field: keyof FlightInfo, value: string) => {
    if (!fldr) return
    const flightInfo = fldr.flight_info || {
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
    }
    const updated = { ...flightInfo, [field]: value || null }
    setFldr({ ...fldr, flight_info: updated })
    debouncedSave({ flight_info: updated })
  }

  const updateDepartureAirport = (airport: { name: string; code: string; address: string }) => {
    if (!fldr) return
    const flightInfo = fldr.flight_info || {
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
    }
    const updated = {
      ...flightInfo,
      departure_airport: airport.name,
      departure_code: airport.code,
      departure_address: airport.address,
    }
    setFldr({ ...fldr, flight_info: updated })
    debouncedSave({ flight_info: updated })
  }

  const updateArrivalAirport = (airport: { name: string; code: string; address: string }) => {
    if (!fldr) return
    const flightInfo = fldr.flight_info || {
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
    }
    const updated = {
      ...flightInfo,
      arrival_airport: airport.name,
      arrival_code: airport.code,
      arrival_address: airport.address,
    }
    setFldr({ ...fldr, flight_info: updated })
    debouncedSave({ flight_info: updated })
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
    setFldr({ ...fldr, hotel_info: updated })
    debouncedSave({ hotel_info: updated })
  }

  const updateVenueInfo = (field: keyof VenueInfo, value: string) => {
    if (!fldr) return
    const venueInfo = fldr.venue_info || {
      name: null,
      address: null,
      contact_name: null,
      contact_phone: null,
      notes: null,
    }
    const updated = { ...venueInfo, [field]: value || null }
    setFldr({ ...fldr, venue_info: updated })
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
      notes: null,
    }
    const updated = { ...rentalCarInfo, [field]: value || null }
    setFldr({ ...fldr, rental_car_info: updated })
    debouncedSave({ rental_car_info: updated })
  }

  const updateJobInfo = (field: keyof JobInfo, value: any) => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      job_title: null,
      client_name: null,
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
    }
    const updated = { ...jobInfo, [field]: value }
    setFldr({ ...fldr, job_info: updated })
    debouncedSave({ job_info: updated })
  }

  const addReferenceLink = () => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      job_title: null,
      client_name: null,
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
    }
    const newLink: ReferenceLink = { label: '', url: '' }
    updateJobInfo('reference_links', [...jobInfo.reference_links, newLink])
  }

  const updateReferenceLink = (index: number, field: 'label' | 'url', value: string) => {
    if (!fldr?.job_info) return
    const links = [...fldr.job_info.reference_links]
    links[index] = { ...links[index], [field]: value }
    updateJobInfo('reference_links', links)
  }

  const removeReferenceLink = (index: number) => {
    if (!fldr?.job_info) return
    const links = fldr.job_info.reference_links.filter((_, i) => i !== index)
    updateJobInfo('reference_links', links)
  }

  const addTeamMember = () => {
    if (!fldr) return
    const jobInfo = fldr.job_info || {
      job_title: null,
      client_name: null,
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

  const updateWrapUp = (value: string) => {
    if (!fldr) return
    setFldr({ ...fldr, wrap_up: value })
    debouncedSave({ wrap_up: value })
  }

  const addChecklistItem = () => {
    if (!fldr) return
    const checklist = fldr.checklist || []
    const newItem = { item: '', completed: false }
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

  const addPerson = () => {
    if (!fldr) return
    const people = fldr.people || []
    const newPerson: Person = { name: '', role: null, phone: null, email: null }
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
    setFldr({ ...fldr, photos: updated })
    debouncedSave({ photos: updated })
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

  const enableModule = (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'checklist' | 'people' | 'job_info' | 'photos' | 'products') => {
    if (!fldr) return
    if (module === 'flight_info') {
      const flightInfo: FlightInfo = {
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
      }
      setFldr({ ...fldr, flight_info: flightInfo })
      debouncedSave({ flight_info: flightInfo })
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
      debouncedSave({ hotel_info: hotelInfo })
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
      debouncedSave({ venue_info: venueInfo })
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
        notes: null,
      }
      setFldr({ ...fldr, rental_car_info: rentalCarInfo })
      debouncedSave({ rental_car_info: rentalCarInfo })
      setExpandedCards(prev => ({ ...prev, rentalCar: true }))
    } else if (module === 'checklist') {
      setFldr({ ...fldr, checklist: [] })
      debouncedSave({ checklist: [] })
      setExpandedCards(prev => ({ ...prev, checklist: true }))
    } else if (module === 'people') {
      setFldr({ ...fldr, people: [] })
      debouncedSave({ people: [] })
      setExpandedCards(prev => ({ ...prev, people: true }))
    } else if (module === 'photos') {
      setFldr({ ...fldr, photos: [] })
      debouncedSave({ photos: [] })
      setExpandedCards(prev => ({ ...prev, photos: true }))
    } else if (module === 'products') {
      setFldr({ ...fldr, products: [] })
      debouncedSave({ products: [] })
      setExpandedCards(prev => ({ ...prev, products: true }))
    } else if (module === 'job_info') {
      const jobInfo: JobInfo = {
        job_title: null,
        client_name: null,
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
      }
      setFldr({ ...fldr, job_info: jobInfo })
      debouncedSave({ job_info: jobInfo })
      setExpandedCards(prev => ({ ...prev, jobInfo: true, preTrip: true }))
    }
  }

  const hasModuleData = (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'job_info' | 'checklist' | 'people' | 'photos' | 'products'): boolean => {
    if (!fldr) return false
    
    if (module === 'flight_info' && fldr.flight_info) {
      return !!(
        fldr.flight_info.departure_airport ||
        fldr.flight_info.arrival_airport ||
        fldr.flight_info.airline ||
        fldr.flight_info.flight_number
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

  const disableModule = (module: 'flight_info' | 'hotel_info' | 'venue_info' | 'rental_car_info' | 'job_info' | 'checklist' | 'people' | 'photos' | 'products') => {
    if (!fldr) return
    
    const hasData = hasModuleData(module)
    
    if (hasData) {
      const confirmed = window.confirm(
        `This module contains data. Are you sure you want to remove it? All data in this module will be permanently deleted.`
      )
      if (!confirmed) return
    }
    
    // Remove the module
    setFldr({ ...fldr, [module]: null })
    debouncedSave({ [module]: null })
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

  const updateAttending = async (attending: boolean) => {
    if (!fldr) return
    setSaving(true)
    try {
      setFldr({ ...fldr, attending })
      await saveFldr({ attending })
    } finally {
      setSaving(false)
    }
  }

  const generateWrapUp = async () => {
    if (!fldr || !fldr.notes.trim()) return
    
    setGeneratingWrapUp(true)
    try {
      const response = await fetch('/api/wrap-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: fldr.notes,
          fldr_title: fldr.title,
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        const wrapUp = data.wrap_up
        // Save wrap-up to fldr and update local state
        const updatedFldr = { ...fldr, wrap_up: wrapUp }
        setFldr(updatedFldr)
        await saveFldr({ wrap_up: wrapUp })
      }
    } catch (error) {
      console.error('Failed to generate wrap-up:', error)
    } finally {
      setGeneratingWrapUp(false)
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
    if (confirm('Clear all offline data? This will remove all locally saved changes!')) {
      clearAllCache()
      setHasUnsynced(false)
      // Redirect to list since we cleared everything
      router.push('/fldr')
    }
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

  const handleRefresh = async () => {
    console.log('🔄 Pull-to-refresh triggered on detail page')
    
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration()
      if (registration) {
        await registration.update()
        console.log('✅ Service worker checked for updates')
        
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
      const res = await fetch(`/api/fldrs/${fldr.id}`, { cache: 'no-store' })
      if (res.ok) {
        const freshData = await res.json()
        setFldr(freshData)
        cacheFldr(freshData)
        
        // Also update the list cache
        const listCache = localStorage.getItem('git-fldrs')
        if (listCache) {
          const allFldrs = JSON.parse(listCache)
          const index = allFldrs.findIndex((f: Fldr) => f.id === fldr.id)
          if (index !== -1) {
            allFldrs[index] = freshData
            localStorage.setItem('git-fldrs', JSON.stringify(allFldrs))
          }
        }
        
        console.log('✅ Fldr data refreshed from server')
      }
    } catch (error) {
      console.error('❌ Refresh failed:', error)
    }
    
    setIsRefreshing(false)
  }

  if (loading || !fldr) {
    return <FldrDetailSkeleton />
  }

  return (
    <div 
      className="p-4 max-w-lg mx-auto pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(isPulling || isRefreshing) && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center items-center bg-[#0a0a0a] z-50 transition-all"
          style={{
            height: isRefreshing ? '60px' : `${Math.min(pullDistance, 80)}px`,
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 80, 1)
          }}
        >
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-[#3b82f6]">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">Refreshing...</span>
            </div>
          ) : (
            <div className="text-[#3b82f6] text-sm font-medium">
              {pullDistance > 80 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/fldr')}
            className="text-[#3b82f6] hover:text-[#2563eb]"
          >
            ← Back
          </button>
          {!editMode && (
            <button
              onClick={enableEditMode}
              className="flex items-center gap-1 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <PencilIcon className="w-4 h-4" />
              <span>Edit</span>
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold">GIT</h1>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            {/* Online/Offline indicator */}
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-400">{online ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          {saving && (
            <span className="text-xs text-yellow-400">Saving...</span>
          )}
          {!saving && lastSaved && (
            <span className="text-xs text-gray-500">
              Saved {new Date().getTime() - lastSaved.getTime() < 60000
                ? 'just now'
                : `${Math.floor((new Date().getTime() - lastSaved.getTime()) / 60000)}m ago`}
            </span>
          )}
        </div>
      </div>

      {/* Sync status bar */}
      {hasUnsynced && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm text-yellow-500">Unsynced changes</span>
          </div>
          <div className="flex gap-2">
            {online && (
              <button
                onClick={handleSync}
                className="px-3 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded text-xs font-medium transition-colors"
              >
                Sync Now
              </button>
            )}
            <button
              onClick={handleHardRefresh}
              disabled={!online}
              className="px-3 py-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2a2a2a] hover:border-yellow-500/50 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hard Refresh
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        {editMode ? (
          <div className="space-y-4 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <div>
              <label className="block text-sm font-medium mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="Trip or event name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={editDateStart}
                  onChange={(e) => setEditDateStart(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  End Date <span className="text-xs text-gray-500">(optional)</span>
                </label>
                <input
                  type="date"
                  value={editDateEnd}
                  onChange={(e) => setEditDateEnd(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Location <span className="text-xs text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="City, State"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBasicInfo}
                disabled={!editTitle.trim() || !editDateStart || saving}
                className="flex-1 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-2xl font-bold">{fldr.title}</h2>
              <div className={`px-2 py-1 rounded text-xs font-medium border ${
                fldr.status === 'incomplete' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                fldr.status === 'ready' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                fldr.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                'bg-gray-500/20 text-gray-400 border-gray-500/30'
              }`}>
                {fldr.status}
              </div>
            </div>
            <div className="text-gray-400">
              {formatDate(fldr.date_start)}
              {fldr.date_end && ` - ${formatDate(fldr.date_end)}`}
            </div>
            {fldr.location && (
              <div className="text-gray-500 mt-1">{fldr.location}</div>
            )}
            {/* Attending checkbox */}
            <div className="mt-3 flex items-center gap-2 p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <input
                type="checkbox"
                id="attending-checkbox"
                checked={fldr.attending ?? false}
                onChange={(e) => updateAttending(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 text-[#3b82f6] focus:ring-[#3b82f6] focus:ring-offset-0 bg-[#0a0a0a] cursor-pointer"
              />
              <label htmlFor="attending-checkbox" className="text-sm text-gray-300 cursor-pointer select-none">
                I am attending this trip
              </label>
            </div>
          </>
        )}
      </div>

      {/* Status Actions */}
      {(fldr.status === 'ready' || fldr.status === 'incomplete') && (
        <div className="mb-4">
          <button
            onClick={() => updateStatus('active')}
            disabled={saving}
            className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Activating...' : 'Activate Job'}
          </button>
        </div>
      )}
      {fldr.status === 'active' && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => updateStatus('complete')}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Completing...' : 'Mark Complete'}
          </button>
          <button
            onClick={() => updateStatus('ready')}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Pausing...' : '⏸ Pause'}
          </button>
        </div>
      )}
      {fldr.status === 'complete' && (
        <div className="mb-4">
          <button
            onClick={() => updateStatus('active')}
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Reactivating...' : '↻ Reactivate Job'}
          </button>
        </div>
      )}

      {/* Job Summary - Cross-module overview */}
      <div className="mb-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
        <button
          onClick={() => toggleCard('summary')}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
        >
          <span className="font-semibold">📋 Job Summary</span>
          <ChevronDownIcon
            className={`w-5 h-5 transition-transform ${
              expandedCards.summary ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedCards.summary && (
          <div className="px-4 pb-4 space-y-3 text-sm">
            {/* Job Info */}
            {fldr.job_info && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg">
                <div className="font-semibold text-[#3b82f6] mb-2">Job Details</div>
                {fldr.job_info.job_title && (
                  <div><span className="text-gray-400">Title:</span> {fldr.job_info.job_title}</div>
                )}
                {fldr.job_info.client_name && (
                  <div><span className="text-gray-400">Client:</span> {fldr.job_info.client_name}</div>
                )}
                {fldr.job_info.job_type && (
                  <div><span className="text-gray-400">Type:</span> {fldr.job_info.job_type}</div>
                )}
                {fldr.job_info.client_contact_name && (
                  <div><span className="text-gray-400">Contact:</span> {fldr.job_info.client_contact_name}</div>
                )}
                {fldr.job_info.client_contact_phone && (
                  <div><span className="text-gray-400">Phone:</span> {fldr.job_info.client_contact_phone}</div>
                )}
                {fldr.job_info.client_contact_email && (
                  <div><span className="text-gray-400">Email:</span> {fldr.job_info.client_contact_email}</div>
                )}
              </div>
            )}

            {/* Products */}
            {fldr.products && fldr.products.length > 0 && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg">
                <div className="font-semibold text-[#3b82f6] mb-2">
                  Products ({fldr.products.reduce((sum, p) => sum + p.quantity, 0)} total items)
                </div>
                {fldr.products.map((product, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{product.name}</span>
                    <span className="text-gray-400">×{product.quantity}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Flight Info */}
            {fldr.flight_info && (fldr.flight_info.departure_code || fldr.flight_info.arrival_code) && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg">
                <div className="font-semibold text-[#3b82f6] mb-2">Flight</div>
                <div className="flex items-center gap-2">
                  {fldr.flight_info.departure_code && (
                    <span className="font-mono font-bold">{fldr.flight_info.departure_code}</span>
                  )}
                  <span className="text-gray-400">→</span>
                  {fldr.flight_info.arrival_code && (
                    <span className="font-mono font-bold">{fldr.flight_info.arrival_code}</span>
                  )}
                </div>
                {fldr.flight_info.airline && (
                  <div className="text-gray-400 text-xs mt-1">
                    {fldr.flight_info.airline} {fldr.flight_info.flight_number}
                  </div>
                )}
              </div>
            )}

            {/* Hotel & Venue */}
            {(fldr.hotel_info?.name || fldr.venue_info?.name) && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg space-y-2">
                <div className="font-semibold text-[#3b82f6] mb-2">Locations</div>
                {fldr.hotel_info?.name && (
                  <div>
                    <div className="text-gray-400 text-xs">Hotel</div>
                    <div>{fldr.hotel_info.name}</div>
                    {fldr.hotel_info.address && (
                      <div className="text-gray-500 text-xs">{fldr.hotel_info.address}</div>
                    )}
                  </div>
                )}
                {fldr.venue_info?.name && (
                  <div>
                    <div className="text-gray-400 text-xs">Venue</div>
                    <div>{fldr.venue_info.name}</div>
                    {fldr.venue_info.address && (
                      <div className="text-gray-500 text-xs">{fldr.venue_info.address}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Team & People */}
            {(fldr.people && fldr.people.length > 0) && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg">
                <div className="font-semibold text-[#3b82f6] mb-2">People ({fldr.people.length})</div>
                {fldr.people.slice(0, 5).map((person, idx) => (
                  <div key={idx} className="text-xs">
                    {person.name} {person.role && `(${person.role})`}
                  </div>
                ))}
                {fldr.people.length > 5 && (
                  <div className="text-xs text-gray-500 mt-1">+{fldr.people.length - 5} more</div>
                )}
              </div>
            )}

            {/* Checklist Progress */}
            {fldr.checklist && fldr.checklist.length > 0 && (
              <div className="p-3 bg-[#0a0a0a] rounded-lg">
                <div className="font-semibold text-[#3b82f6] mb-2">Checklist Progress</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#2a2a2a] rounded-full h-2">
                    <div 
                      className="bg-[#3b82f6] h-2 rounded-full transition-all"
                      style={{ width: `${(fldr.checklist.filter(i => i.completed).length / fldr.checklist.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {fldr.checklist.filter(i => i.completed).length}/{fldr.checklist.length}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {/* Flight Info Card - Only show if enabled */}
        {fldr.flight_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('flight')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Flight Info</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.flight ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('flight_info')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.flight && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Departure Airport</label>
                    <AirportAutocomplete
                      type="name"
                      value={fldr.flight_info?.departure_airport || ''}
                      onChange={(value) => updateFlightInfo('departure_airport', value)}
                      onAirportSelect={updateDepartureAirport}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Type airport name or code..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Code</label>
                    <AirportAutocomplete
                      type="code"
                      value={fldr.flight_info?.departure_code || ''}
                      onChange={(value) => updateFlightInfo('departure_code', value)}
                      onAirportSelect={updateDepartureAirport}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="LAX"
                    />
                  </div>
                </div>
                {fldr.flight_info?.departure_address && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Departure Airport Address</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fldr.flight_info.departure_address}
                        readOnly
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-gray-400 cursor-not-allowed"
                      />
                      <CopyButton text={fldr.flight_info.departure_address} label="Copy address" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Departure Time</label>
                  <input
                    type="datetime-local"
                    value={fldr.flight_info?.departure_time || ''}
                    onChange={(e) => updateFlightInfo('departure_time', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Arrival Airport</label>
                    <AirportAutocomplete
                      type="name"
                      value={fldr.flight_info?.arrival_airport || ''}
                      onChange={(value) => updateFlightInfo('arrival_airport', value)}
                      onAirportSelect={updateArrivalAirport}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Type airport name or code..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Code</label>
                    <AirportAutocomplete
                      type="code"
                      value={fldr.flight_info?.arrival_code || ''}
                      onChange={(value) => updateFlightInfo('arrival_code', value)}
                      onAirportSelect={updateArrivalAirport}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="JFK"
                    />
                  </div>
                </div>
                {fldr.flight_info?.arrival_address && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Arrival Airport Address</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fldr.flight_info.arrival_address}
                        readOnly
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-sm text-gray-400 cursor-not-allowed"
                      />
                      <CopyButton text={fldr.flight_info.arrival_address} label="Copy address" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Arrival Time</label>
                  <input
                    type="datetime-local"
                    value={fldr.flight_info?.arrival_time || ''}
                    onChange={(e) => updateFlightInfo('arrival_time', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Airline</label>
                    <input
                      type="text"
                      value={fldr.flight_info?.airline || ''}
                      onChange={(e) => updateFlightInfo('airline', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Airline name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Flight Number</label>
                    <input
                      type="text"
                      value={fldr.flight_info?.flight_number || ''}
                      onChange={(e) => updateFlightInfo('flight_number', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="e.g. AA123"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Confirmation Number</label>
                  <input
                    type="text"
                    value={fldr.flight_info?.confirmation || ''}
                    onChange={(e) => updateFlightInfo('confirmation', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Confirmation code"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={fldr.flight_info?.notes || ''}
                    onChange={(e) => updateFlightInfo('notes', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={2}
                    placeholder="Additional flight notes..."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* NOTE: Hotel, Venue, and Rental Car cards will be added next */}

        {/* Hotel Info Card - Only show if enabled */}
        {fldr.hotel_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('hotel')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Hotel Info</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.hotel ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('hotel_info')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.hotel && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Hotel Name</label>
                  <input
                    type="text"
                    value={fldr.hotel_info?.name || ''}
                    onChange={(e) => updateHotelInfo('name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Hotel name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Address</label>
                  <div className="flex items-center gap-2">
                    <AddressAutocomplete
                      value={fldr.hotel_info?.address || ''}
                      onChange={(value) => updateHotelInfo('address', value)}
                      className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Start typing hotel address..."
                    />
                    <CopyButton text={fldr.hotel_info?.address || ''} label="Copy address" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={fldr.hotel_info?.phone || ''}
                    onChange={(e) => updateHotelInfo('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Hotel phone number"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Check-in</label>
                    <input
                      type="datetime-local"
                      value={fldr.hotel_info?.check_in || ''}
                      onChange={(e) => updateHotelInfo('check_in', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Check-out</label>
                    <input
                      type="datetime-local"
                      value={fldr.hotel_info?.check_out || ''}
                      onChange={(e) => updateHotelInfo('check_out', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Confirmation Number</label>
                  <input
                    type="text"
                    value={fldr.hotel_info?.confirmation || ''}
                    onChange={(e) => updateHotelInfo('confirmation', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Confirmation code"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={fldr.hotel_info?.notes || ''}
                    onChange={(e) => updateHotelInfo('notes', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={2}
                    placeholder="Additional hotel notes..."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Venue Info Card - Only show if enabled */}
        {fldr.venue_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('venue')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Venue Info</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.venue ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('venue_info')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.venue && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={fldr.venue_info?.name || ''}
                    onChange={(e) => updateVenueInfo('name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Event venue name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Address</label>
                  <div className="flex items-center gap-2">
                    <AddressAutocomplete
                      value={fldr.venue_info?.address || ''}
                      onChange={(value) => updateVenueInfo('address', value)}
                      className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Start typing venue address..."
                    />
                    <CopyButton text={fldr.venue_info?.address || ''} label="Copy address" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={fldr.venue_info?.contact_name || ''}
                    onChange={(e) => updateVenueInfo('contact_name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Venue contact person"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={fldr.venue_info?.contact_phone || ''}
                    onChange={(e) => updateVenueInfo('contact_phone', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Venue contact phone"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={fldr.venue_info?.notes || ''}
                    onChange={(e) => updateVenueInfo('notes', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={2}
                    placeholder="Additional venue notes..."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rental Car Info Card - Only show if enabled */}
        {fldr.rental_car_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('rentalCar')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Rental Car</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.rentalCar ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('rental_car_info')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.rentalCar && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Company</label>
                    <input
                      type="text"
                      value={fldr.rental_car_info?.company || ''}
                      onChange={(e) => updateRentalCarInfo('company', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="e.g. Hertz"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Vehicle Type</label>
                    <input
                      type="text"
                      value={fldr.rental_car_info?.vehicle_type || ''}
                      onChange={(e) => updateRentalCarInfo('vehicle_type', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="e.g. SUV"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pickup Location</label>
                  <AddressAutocomplete
                    value={fldr.rental_car_info?.pickup_location || ''}
                    onChange={(value) => updateRentalCarInfo('pickup_location', value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Start typing pickup location..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pickup Time</label>
                  <input
                    type="datetime-local"
                    value={fldr.rental_car_info?.pickup_time || ''}
                    onChange={(e) => updateRentalCarInfo('pickup_time', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Dropoff Location</label>
                  <AddressAutocomplete
                    value={fldr.rental_car_info?.dropoff_location || ''}
                    onChange={(value) => updateRentalCarInfo('dropoff_location', value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Start typing dropoff location..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Dropoff Time</label>
                  <input
                    type="datetime-local"
                    value={fldr.rental_car_info?.dropoff_time || ''}
                    onChange={(e) => updateRentalCarInfo('dropoff_time', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Confirmation Number</label>
                  <input
                    type="text"
                    value={fldr.rental_car_info?.confirmation || ''}
                    onChange={(e) => updateRentalCarInfo('confirmation', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Confirmation code"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Notes</label>
                  <textarea
                    value={fldr.rental_car_info?.notes || ''}
                    onChange={(e) => updateRentalCarInfo('notes', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={2}
                    placeholder="Additional rental car notes..."
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Map Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleCard('map')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
          >
            <span className="font-semibold">Map</span>
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${
                expandedCards.map ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedCards.map && (
            <div className="px-4 pb-4">
              <FldrMap
                locations={[
                  {
                    label: 'Departure Airport',
                    address: fldr.flight_info?.departure_address || '',
                  },
                  {
                    label: 'Arrival Airport',
                    address: fldr.flight_info?.arrival_address || '',
                  },
                  {
                    label: 'Hotel',
                    address: fldr.hotel_info?.address || '',
                  },
                  {
                    label: 'Venue',
                    address: fldr.venue_info?.address || '',
                  },
                  {
                    label: 'Rental Car Pickup',
                    address: fldr.rental_car_info?.pickup_location || '',
                  },
                ].filter(loc => loc.address.trim() !== '')}
              />
            </div>
          )}
        </div>

        {/* Pre-trip Info Card - Only show if job_info enabled */}
        {fldr.job_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCard('preTrip')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
            >
              <span className="font-semibold">Pre-trip Info</span>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform ${
                  expandedCards.preTrip ? 'rotate-180' : ''
                }`}
              />
            </button>
            {expandedCards.preTrip && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Pre-engrave Details</label>
                  <textarea
                    value={fldr.job_info?.pre_engrave_details || ''}
                    onChange={(e) => updateJobInfo('pre_engrave_details', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={3}
                    placeholder="Pre-engrave prep notes..."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Team Members</label>
                    <button
                      onClick={addTeamMember}
                      className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                    >
                      + Add
                    </button>
                  </div>
                  {fldr.job_info?.team_members.map((member, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={member}
                        onChange={(e) => updateTeamMember(index, e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removeTeamMember(index)}
                        className="px-3 text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(!fldr.job_info?.team_members || fldr.job_info.team_members.length === 0) && (
                    <p className="text-xs text-gray-500">No team members yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Job Info Card - Only show if job_info enabled */}
        {fldr.job_info !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('jobInfo')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Job Info</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.jobInfo ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('job_info')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.jobInfo && (
              <div className="px-4 pb-4 space-y-3">
                {/* Job Overview - Cross-module summary */}
                <div className="p-3 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-gray-400 mb-2">Job Overview</div>
                  
                  {/* Products Summary */}
                  {fldr.products && fldr.products.length > 0 && (
                    <div className="text-xs">
                      <span className="text-gray-500">Products: </span>
                      <span className="text-white">
                        {fldr.products.map(p => `${p.name} (${p.quantity})`).join(', ')}
                      </span>
                      <span className="text-gray-500 ml-1">
                        • Total: {fldr.products.reduce((sum, p) => sum + p.quantity, 0)} items
                      </span>
                    </div>
                  )}
                  
                  {/* Checklist Progress */}
                  {fldr.checklist && fldr.checklist.length > 0 && (
                    <div className="text-xs">
                      <span className="text-gray-500">Checklist: </span>
                      <span className="text-white">
                        {fldr.checklist.filter(i => i.completed).length} / {fldr.checklist.length} complete
                      </span>
                    </div>
                  )}
                  
                  {/* People Count */}
                  {fldr.people && fldr.people.length > 0 && (
                    <div className="text-xs">
                      <span className="text-gray-500">People: </span>
                      <span className="text-white">
                        {fldr.people.map(p => p.name).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {/* Location Info */}
                  {(fldr.hotel_info?.name || fldr.venue_info?.name) && (
                    <div className="text-xs">
                      {fldr.hotel_info?.name && (
                        <div>
                          <span className="text-gray-500">Hotel: </span>
                          <span className="text-white">{fldr.hotel_info.name}</span>
                        </div>
                      )}
                      {fldr.venue_info?.name && (
                        <div>
                          <span className="text-gray-500">Venue: </span>
                          <span className="text-white">{fldr.venue_info.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Flight Info */}
                  {fldr.flight_info?.departure_code && fldr.flight_info?.arrival_code && (
                    <div className="text-xs">
                      <span className="text-gray-500">Flight: </span>
                      <span className="text-white">
                        {fldr.flight_info.departure_code} → {fldr.flight_info.arrival_code}
                        {fldr.flight_info.airline && ` (${fldr.flight_info.airline})`}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={fldr.job_info?.job_title || ''}
                    onChange={(e) => updateJobInfo('job_title', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Job title or name"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={fldr.job_info?.client_name || ''}
                    onChange={(e) => updateJobInfo('client_name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Client/company name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Item</label>
                    <input
                      type="text"
                      value={fldr.job_info?.item || ''}
                      onChange={(e) => updateJobInfo('item', e.target.value)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Product"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      value={fldr.job_info?.quantity || ''}
                      onChange={(e) => updateJobInfo('quantity', parseInt(e.target.value) || null)}
                      className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Job Type</label>
                  <select
                    value={fldr.job_info?.job_type || ''}
                    onChange={(e) => updateJobInfo('job_type', e.target.value || null)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                  >
                    <option value="">Select type</option>
                    <option value="caricatures">Caricatures</option>
                    <option value="names_monograms">Names/Monograms</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={fldr.job_info?.client_contact_name || ''}
                    onChange={(e) => updateJobInfo('client_contact_name', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                    placeholder="Contact person"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Phone</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={fldr.job_info?.client_contact_phone || ''}
                        onChange={(e) => updateJobInfo('client_contact_phone', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                        placeholder="Phone"
                      />
                      <CopyButton text={fldr.job_info?.client_contact_phone || ''} label="Copy phone" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={fldr.job_info?.client_contact_email || ''}
                        onChange={(e) => updateJobInfo('client_contact_email', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                        placeholder="Email"
                      />
                      <CopyButton text={fldr.job_info?.client_contact_email || ''} label="Copy email" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Event Details</label>
                  <textarea
                    value={fldr.job_info?.event_details || ''}
                    onChange={(e) => updateJobInfo('event_details', e.target.value)}
                    className="w-full px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm resize-none"
                    rows={3}
                    placeholder="Event context, special instructions..."
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-gray-400">Reference Links</label>
                    <button
                      onClick={addReferenceLink}
                      className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                    >
                      + Add
                    </button>
                  </div>
                  {(fldr.job_info?.reference_links || []).map((link, index) => (
                    <div key={index} className="space-y-2 mb-3 p-3 bg-[#0a0a0a] rounded-lg">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateReferenceLink(index, 'label', e.target.value)}
                        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                        placeholder="Label"
                      />
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => updateReferenceLink(index, 'url', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                          placeholder="URL"
                        />
                        <button
                          onClick={() => removeReferenceLink(index)}
                          className="px-3 text-red-500 hover:text-red-400"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!fldr.job_info?.reference_links || fldr.job_info.reference_links.length === 0) && (
                    <p className="text-xs text-gray-500">No reference links yet</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checklist Card - Only show if enabled */}
        {fldr.checklist !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('checklist')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Checklist</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.checklist ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('checklist')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.checklist && (
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400">
                    {(fldr.checklist || []).filter(i => i.completed).length} / {(fldr.checklist || []).length} complete
                  </span>
                  <button
                    onClick={addChecklistItem}
                    className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-2">
                  <p className="text-xs text-blue-400">
                    ℹ️ Checklist progress automatically updates in Job Summary section
                  </p>
                </div>
                {(fldr.checklist || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => toggleChecklistItem(index)}
                      className="w-4 h-4 rounded border-[#2a2a2a] bg-[#0a0a0a] accent-[#3b82f6]"
                    />
                    <input
                      type="text"
                      value={item.item}
                      onChange={(e) => updateChecklistItem(index, e.target.value)}
                      className={`flex-1 px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm ${
                        item.completed ? 'line-through text-gray-500' : ''
                      }`}
                      placeholder="Item"
                    />
                    <button
                      onClick={() => removeChecklistItem(index)}
                      className="px-2 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}  
                {(fldr.checklist || []).length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No items yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* People Card - Only show if enabled */}
        {fldr.people !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('people')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">People</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.people ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('people')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.people && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{(fldr.people || []).length} people</span>
                  <button
                    onClick={addPerson}
                    className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                  >
                    + Add Person
                  </button>
                </div>
                <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-2">
                  <p className="text-xs text-blue-400">
                    ℹ️ People added here automatically appear in Job Summary and Job Info sections
                  </p>
                </div>
                {(fldr.people || []).map((person, index) => (
                  <div key={index} className="p-3 bg-[#0a0a0a] rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePerson(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm font-medium"
                        placeholder="Name"
                      />
                      <button
                        onClick={() => removePerson(index)}
                        className="px-2 text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                    <input
                      type="text"
                      value={person.role || ''}
                      onChange={(e) => updatePerson(index, 'role', e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Role"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={person.phone || ''}
                          onChange={(e) => updatePerson(index, 'phone', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                          placeholder="Phone"
                        />
                        <CopyButton text={person.phone || ''} label="Copy phone" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={person.email || ''}
                          onChange={(e) => updatePerson(index, 'email', e.target.value)}
                          className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                          placeholder="Email"
                        />
                        <CopyButton text={person.email || ''} label="Copy email" />
                      </div>
                    </div>
                  </div>
                ))}
                {fldr.people.length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No people yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Photos Card - Only show if enabled */}
        {fldr.photos !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('photos')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Photos</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.photos ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('photos')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.photos && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">{(fldr.photos || []).length} photos</span>
                  <label className="text-xs text-[#3b82f6] hover:text-[#2563eb] cursor-pointer">
                    + Add Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          // For now, use a data URL - in production you'd upload to cloud storage
                          const reader = new FileReader()
                          reader.onload = (event) => {
                            const url = event.target?.result as string
                            addPhoto(url)
                          }
                          reader.readAsDataURL(file)
                        }
                        e.target.value = '' // Reset input
                      }}
                    />
                  </label>
                </div>
                {(fldr.photos || []).map((photo, index) => (
                  <div key={photo.id} className="p-3 bg-[#0a0a0a] rounded-lg space-y-2">
                    <div className="relative">
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Photo'}
                        className="w-full h-48 object-cover rounded-lg"
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
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Add caption..."
                    />
                  </div>
                ))}
                {(fldr.photos || []).length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No photos yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Products Card - Only show if enabled */}
        {fldr.products !== null && (
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
            <div className="w-full px-4 py-3 flex items-center justify-between">
              <button
                onClick={() => toggleCard('products')}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1"
              >
                <span className="font-semibold">Products</span>
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform ${
                    expandedCards.products ? 'rotate-180' : ''
                  }`}
                />
              </button>
              <button
                onClick={() => disableModule('products')}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded border border-red-500/30 hover:bg-red-500/10 transition-colors"
              >
                Remove
              </button>
            </div>
            {expandedCards.products && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {(fldr.products || []).reduce((sum, p) => sum + p.quantity, 0)} total items
                  </span>
                  <button
                    onClick={addProduct}
                    className="text-xs text-[#3b82f6] hover:text-[#2563eb]"
                  >
                    + Add Product
                  </button>
                </div>
                <div className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-2">
                  <p className="text-xs text-blue-400">
                    ℹ️ Products added here automatically appear in Job Summary and Job Info sections
                  </p>
                </div>
                {(fldr.products || []).map((product, index) => (
                  <div key={product.id} className="p-3 bg-[#0a0a0a] rounded-lg space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => updateProduct(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm font-medium"
                        placeholder="Product name"
                      />
                      <input
                        type="number"
                        min="1"
                        value={product.quantity}
                        onChange={(e) => updateProduct(index, 'quantity', e.target.value)}
                        className="w-20 px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm text-center"
                      />
                      <button
                        onClick={() => removeProduct(index)}
                        className="px-2 text-red-500 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                    <input
                      type="text"
                      value={product.notes || ''}
                      onChange={(e) => updateProduct(index, 'notes', e.target.value)}
                      className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] text-sm"
                      placeholder="Notes (optional)"
                    />
                  </div>
                ))}
                {(fldr.products || []).length === 0 && (
                  <p className="text-xs text-gray-500 py-2">No products yet</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Notes Card */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg overflow-hidden">
          <button
            onClick={() => toggleCard('notes')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1f1f1f] transition-colors"
          >
            <span className="font-semibold">Notes</span>
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${
                expandedCards.notes ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedCards.notes && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs text-gray-400">Notes</label>
                <button
                  onClick={() => setUseRichEditor(!useRichEditor)}
                  className="text-xs px-3 py-1 bg-[#3b82f6] hover:bg-[#2563eb] rounded-md transition-colors"
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
                    className="w-full min-h-[120px] px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                    placeholder="Add notes..."
                  />
                )}
              </div>
              <button
                onClick={generateWrapUp}
                disabled={!fldr.notes.trim() || generatingWrapUp}
                className="w-full py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 hover:border-[#3b82f6] disabled:border-[#2a2a2a] disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                {generatingWrapUp ? 'Generating Wrap-up...' : 'Generate Wrap-up'}
              </button>
              {fldr.wrap_up && (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Wrap-up Summary</label>
                  <textarea
                    value={fldr.wrap_up}
                    onChange={(e) => updateWrapUp(e.target.value)}
                    className="w-full min-h-[120px] px-3 py-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                    placeholder="Wrap-up will appear here..."
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(fldr.wrap_up!)}
                    className="mt-2 w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg text-sm font-medium transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Module Section */}
      <div className="mt-6 p-4 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
        <h3 className="text-sm font-semibold mb-3 text-gray-400">Add Module</h3>
        <div className="flex flex-wrap gap-2">
          {fldr.flight_info === null && (
            <button
              onClick={() => enableModule('flight_info')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Flight Info
            </button>
          )}
          {fldr.hotel_info === null && (
            <button
              onClick={() => enableModule('hotel_info')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Hotel Info
            </button>
          )}
          {fldr.venue_info === null && (
            <button
              onClick={() => enableModule('venue_info')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Venue Info
            </button>
          )}
          {fldr.rental_car_info === null && (
            <button
              onClick={() => enableModule('rental_car_info')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Rental Car
            </button>
          )}
          {fldr.job_info === null && (
            <button
              onClick={() => enableModule('job_info')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Job Info
            </button>
          )}
          {fldr.checklist === null && (
            <button
              onClick={() => enableModule('checklist')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Checklist
            </button>
          )}
          {fldr.people === null && (
            <button
              onClick={() => enableModule('people')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + People
            </button>
          )}
          {fldr.photos === null && (
            <button
              onClick={() => enableModule('photos')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Photos
            </button>
          )}
          {fldr.products === null && (
            <button
              onClick={() => enableModule('products')}
              className="px-3 py-2 bg-[#0a0a0a] border border-[#3b82f6]/30 rounded-lg text-sm hover:border-[#3b82f6] transition-colors"
            >
              + Products
            </button>
          )}
        </div>
        {fldr.flight_info !== null && fldr.hotel_info !== null && fldr.venue_info !== null && fldr.rental_car_info !== null && fldr.job_info !== null && fldr.checklist !== null && fldr.people !== null && fldr.photos !== null && fldr.products !== null && (
          <p className="text-xs text-gray-500">All modules enabled</p>
        )}
      </div>
    </div>
  )
}
