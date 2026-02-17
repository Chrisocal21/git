'use client'

import { useRef, useEffect } from 'react'

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

  useEffect(() => {
    // Load Google Places API if not already loaded
    if (typeof window !== 'undefined' && !window.google) {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.defer = true
      document.head.appendChild(script)
      
      script.onload = () => {
        initAutocomplete()
      }
    } else if (window.google) {
      initAutocomplete()
    }

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  const initAutocomplete = () => {
    if (!inputRef.current) return

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
  }

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
