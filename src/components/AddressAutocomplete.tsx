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

interface SuggestionItem {
  id: string
  primaryText: string
  secondaryText?: string
  prediction: any
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  className,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [apiReady, setApiReady] = useState(false)

  useEffect(() => {
    let isMounted = true

    const initPlaces = async () => {
      try {
        setIsLoading(true)

        await googleMapsLoader.load()
        await google.maps.importLibrary('places')

        if (!isMounted) return
        setApiReady(true)
        setIsLoading(false)
      } catch (error) {
        if (error instanceof Error && !error.message.includes('not configured')) {
          console.error('Failed to initialize Google Maps autocomplete:', error)
        }
        setIsLoading(false)
      }
    }

    initPlaces()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!apiReady || !value.trim()) {
      setSuggestions([])
      return
    }

    let isMounted = true
    const timeoutId = window.setTimeout(async () => {
      try {
        const placesLib = await google.maps.importLibrary('places')
        const response = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value,
        })

        if (!isMounted) return

        const nextSuggestions = (response?.suggestions || []).slice(0, 6).map((suggestion: any, index: number) => {
          const prediction = suggestion.placePrediction
          const primaryText = prediction?.mainText?.text
            || prediction?.text?.text
            || prediction?.text?.toString?.()
            || prediction?.structuredFormat?.mainText?.text
            || ''
          const secondaryText = prediction?.secondaryText?.text
            || prediction?.structuredFormat?.secondaryText?.text
            || ''

          return {
            id: prediction?.placeId || `${primaryText}-${index}`,
            primaryText,
            secondaryText,
            prediction,
          }
        }).filter((suggestion: SuggestionItem) => suggestion.primaryText)

        setSuggestions(nextSuggestions)
      } catch (error) {
        if (error instanceof Error && !error.message.includes('not configured')) {
          console.error('Failed to fetch address suggestions:', error)
        }
        if (isMounted) {
          setSuggestions([])
        }
      }
    }, 250)

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [apiReady, value])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSuggestionSelect = async (suggestion: SuggestionItem) => {
    try {
      const place = suggestion.prediction?.toPlace?.()
      if (place?.fetchFields) {
        await place.fetchFields({
          fields: ['formattedAddress', 'displayName', 'location', 'addressComponents'],
        })
      }

      const formattedAddress = place?.formattedAddress || suggestion.primaryText
      const placeResult: google.maps.places.PlaceResult = {
        formatted_address: formattedAddress,
        name: place?.displayName || suggestion.primaryText,
        geometry: place?.location ? { location: place.location } : undefined,
        address_components: place?.addressComponents,
      }

      onChange(formattedAddress)
      onPlaceSelected?.(placeResult)
    } catch (error) {
      console.error('Failed to resolve selected address suggestion:', error)
      onChange([suggestion.primaryText, suggestion.secondaryText].filter(Boolean).join(', '))
    } finally {
      setShowSuggestions(false)
      setSuggestions([])
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowSuggestions(true)
        }}
        onFocus={() => setShowSuggestions(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          ...
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-white/20 bg-[#101820] shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => void handleSuggestionSelect(suggestion)}
              className="block w-full border-b border-white/10 px-3 py-2 text-left last:border-b-0 hover:bg-white/5"
            >
              <div className="text-sm text-white">{suggestion.primaryText}</div>
              {suggestion.secondaryText && (
                <div className="text-xs text-gray-400">{suggestion.secondaryText}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
