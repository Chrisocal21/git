'use client'

import { useState, useRef, useEffect } from 'react'

interface Airport {
  code: string
  name: string
  city: string
  address: string
}

// Top airports - feel free to expand this list
const AIRPORTS: Airport[] = [
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', address: '6000 N Terminal Pkwy, Atlanta, GA 30320' },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', address: '1 World Way, Los Angeles, CA 90045' },
  { code: 'ORD', name: "O'Hare International", city: 'Chicago', address: "10000 W O'Hare Ave, Chicago, IL 60666" },
  { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', address: '2400 Aviation Dr, Dallas, TX 75261' },
  { code: 'DEN', name: 'Denver International', city: 'Denver', address: '8500 Peña Blvd, Denver, CO 80249' },
  { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', address: 'Queens, NY 11430' },
  { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', address: 'San Francisco, CA 94128' },
  { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', address: '17801 International Blvd, Seattle, WA 98158' },
  { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', address: '5757 Wayne Newton Blvd, Las Vegas, NV 89119' },
  { code: 'MCO', name: 'Orlando International', city: 'Orlando', address: '1 Jeff Fuqua Blvd, Orlando, FL 32827' },
  { code: 'EWR', name: 'Newark Liberty International', city: 'Newark', address: '3 Brewster Rd, Newark, NJ 07114' },
  { code: 'CLT', name: 'Charlotte Douglas International', city: 'Charlotte', address: '5501 Josh Birmingham Pkwy, Charlotte, NC 28208' },
  { code: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', address: '3400 E Sky Harbor Blvd, Phoenix, AZ 85034' },
  { code: 'IAH', name: 'George Bush Intercontinental', city: 'Houston', address: '2800 N Terminal Rd, Houston, TX 77032' },
  { code: 'MIA', name: 'Miami International', city: 'Miami', address: '2100 NW 42nd Ave, Miami, FL 33142' },
  { code: 'BOS', name: 'Logan International', city: 'Boston', address: '1 Harborside Dr, Boston, MA 02128' },
  { code: 'MSP', name: 'Minneapolis-St Paul International', city: 'Minneapolis', address: '4300 Glumack Dr, St Paul, MN 55111' },
  { code: 'DTW', name: 'Detroit Metropolitan Wayne County', city: 'Detroit', address: 'Detroit, MI 48242' },
  { code: 'PHL', name: 'Philadelphia International', city: 'Philadelphia', address: '8000 Essington Ave, Philadelphia, PA 19153' },
  { code: 'LGA', name: 'LaGuardia', city: 'New York', address: 'Queens, NY 11371' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International', city: 'Fort Lauderdale', address: '100 Terminal Dr, Fort Lauderdale, FL 33315' },
  { code: 'BWI', name: 'Baltimore/Washington International', city: 'Baltimore', address: '7050 Friendship Rd, Baltimore, MD 21240' },
  { code: 'DCA', name: 'Ronald Reagan Washington National', city: 'Washington DC', address: '2401 Smith Blvd, Arlington, VA 22202' },
  { code: 'IAD', name: 'Washington Dulles International', city: 'Washington DC', address: '1 Saarinen Cir, Dulles, VA 20166' },
  { code: 'MDW', name: 'Chicago Midway International', city: 'Chicago', address: '5700 S Cicero Ave, Chicago, IL 60638' },
  { code: 'SLC', name: 'Salt Lake City International', city: 'Salt Lake City', address: '776 N Terminal Dr, Salt Lake City, UT 84122' },
  { code: 'SAN', name: 'San Diego International', city: 'San Diego', address: '3225 N Harbor Dr, San Diego, CA 92101' },
  { code: 'TPA', name: 'Tampa International', city: 'Tampa', address: '4100 George J Bean Pkwy, Tampa, FL 33607' },
  { code: 'PDX', name: 'Portland International', city: 'Portland', address: '7000 NE Airport Way, Portland, OR 97218' },
  { code: 'HNL', name: 'Daniel K. Inouye International', city: 'Honolulu', address: '300 Rodgers Blvd, Honolulu, HI 96819' },
]

interface AirportAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onCodeChange?: (code: string) => void
  onAddressChange?: (address: string) => void
  onNameChange?: (name: string) => void
  placeholder?: string
  className?: string
  type?: 'name' | 'code'
}

export default function AirportAutocomplete({
  value,
  onChange,
  onCodeChange,
  onAddressChange,
  onNameChange,
  placeholder,
  className,
  type = 'name',
}: AirportAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Airport[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (inputValue: string) => {
    onChange(inputValue)

    if (!inputValue.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const searchTerm = inputValue.toLowerCase()
    const filtered = AIRPORTS.filter(
      (airport) =>
        airport.code.toLowerCase().includes(searchTerm) ||
        airport.name.toLowerCase().includes(searchTerm) ||
        airport.city.toLowerCase().includes(searchTerm)
    ).slice(0, 5)

    setSuggestions(filtered)
    setShowSuggestions(filtered.length > 0)
  }

  const selectAirport = (airport: Airport) => {
    if (type === 'code') {
      onChange(airport.code)
    } else {
      onChange(airport.name)
    }
    if (onCodeChange) {
      onCodeChange(airport.code)
    }
    if (onAddressChange) {
      onAddressChange(airport.address)
    }
    if (onNameChange) {
      onNameChange(airport.name)
    }
    setShowSuggestions(false)
    setSuggestions([])
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => value && setSuggestions(AIRPORTS.filter(a => 
          a.code.toLowerCase().includes(value.toLowerCase()) ||
          a.name.toLowerCase().includes(value.toLowerCase()) ||
          a.city.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 5))}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-[#3b82f6] rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((airport) => (
            <button
              key={airport.code}
              type="button"
              onClick={() => selectAirport(airport)}
              className="w-full px-3 py-2 text-left hover:bg-[#2a2a2a] transition-colors border-b border-[#2a2a2a] last:border-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm">{airport.name}</div>
                  <div className="text-xs text-gray-400">{airport.city}</div>
                </div>
                <div className="text-[#3b82f6] font-mono font-bold">{airport.code}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
