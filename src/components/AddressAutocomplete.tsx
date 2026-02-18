'use client'

import { useRef, useEffect, useState } from 'react'
import { googleMapsLoader } from '@/lib/googleMapsLoader'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void
  placeholder?: string
  className?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    const initAutocomplete = async () => {
      if (!inputRef.current) return

      try {
        setIsLoading(true)
        
        // Wait for Google Maps to load (singleton - only loads once)
        await googleMapsLoader.load()
        
        // Component might have unmounted while loading
        if (!isMounted || !inputRef.current) return

        // Initialize autocomplete
        autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
          types: ['geocode', 'establishment'],
          fields: ['formatted_address', 'address_components', 'geometry', 'name'],
        })

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace()
          if (place && place.formatted_address) {
            onChange(place.formatted_address)
            if (onPlaceSelected) {
              onPlaceSelected(place)
            }
          }
        })

        setIsLoading(false)
      } catch (error) {
        // Silently fail - input will work as a regular text field
        // Only log if it's not the missing API key warning (already logged by loader)
        if (error instanceof Error && !error.message.includes('not configured')) {
          console.error('Failed to initialize Google Maps autocomplete:', error)
        }
        setIsLoading(false)
      }
    }

    initAutocomplete()

    return () => {
      isMounted = false
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  )
}
