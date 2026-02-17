'use client'

import { useState, useRef, useEffect } from 'react'

interface Airport {
  code: string
  name: string
  city: string
  address: string
}

// Comprehensive US Airport Database
const AIRPORTS: Airport[] = [
  // Major Hubs
  { code: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', address: '6000 N Terminal Pkwy, Atlanta, GA 30320' },
  { code: 'ORD', name: "O'Hare International", city: 'Chicago', address: "10000 W O'Hare Ave, Chicago, IL 60666" },
  { code: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', address: '2400 Aviation Dr, Dallas, TX 75261' },
  { code: 'DEN', name: 'Denver International', city: 'Denver', address: '8500 Peña Blvd, Denver, CO 80249' },
  { code: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', address: '1 World Way, Los Angeles, CA 90045' },
  { code: 'JFK', name: 'John F. Kennedy International', city: 'New York', address: 'Queens, NY 11430' },
  { code: 'SFO', name: 'San Francisco International', city: 'San Francisco', address: 'San Francisco, CA 94128' },
  
  // Northeast
  { code: 'BOS', name: 'Logan International', city: 'Boston', address: '1 Harborside Dr, Boston, MA 02128' },
  { code: 'EWR', name: 'Newark Liberty International', city: 'Newark', address: '3 Brewster Rd, Newark, NJ 07114' },
  { code: 'LGA', name: 'LaGuardia', city: 'New York', address: 'Queens, NY 11371' },
  { code: 'PHL', name: 'Philadelphia International', city: 'Philadelphia', address: '8000 Essington Ave, Philadelphia, PA 19153' },
  { code: 'BWI', name: 'Baltimore/Washington International', city: 'Baltimore', address: '7050 Friendship Rd, Baltimore, MD 21240' },
  { code: 'IAD', name: 'Washington Dulles International', city: 'Washington DC', address: '1 Saarinen Cir, Dulles, VA 20166' },
  { code: 'DCA', name: 'Ronald Reagan Washington National', city: 'Washington DC', address: '2401 Smith Blvd, Arlington, VA 22202' },
  { code: 'BDL', name: 'Bradley International', city: 'Hartford', address: 'Schoephoester Rd, Windsor Locks, CT 06096' },
  { code: 'PVD', name: 'T.F. Green International', city: 'Providence', address: '2000 Post Rd, Warwick, RI 02886' },
  { code: 'BUF', name: 'Buffalo Niagara International', city: 'Buffalo', address: '4200 Genesee St, Buffalo, NY 14225' },
  { code: 'ROC', name: 'Greater Rochester International', city: 'Rochester', address: '1200 Brooks Ave, Rochester, NY 14624' },
  { code: 'SYR', name: 'Syracuse Hancock International', city: 'Syracuse', address: '1000 Col Eileen Collins Blvd, Syracuse, NY 13212' },
  { code: 'ALB', name: 'Albany International', city: 'Albany', address: '737 Albany Shaker Rd, Albany, NY 12211' },
  { code: 'MHT', name: 'Manchester-Boston Regional', city: 'Manchester', address: '1 Airport Rd, Manchester, NH 03103' },
  { code: 'PIT', name: 'Pittsburgh International', city: 'Pittsburgh', address: '1000 Airport Blvd, Pittsburgh, PA 15231' },
  
  // Southeast
  { code: 'MIA', name: 'Miami International', city: 'Miami', address: '2100 NW 42nd Ave, Miami, FL 33142' },
  { code: 'FLL', name: 'Fort Lauderdale-Hollywood International', city: 'Fort Lauderdale', address: '100 Terminal Dr, Fort Lauderdale, FL 33315' },
  { code: 'MCO', name: 'Orlando International', city: 'Orlando', address: '1 Jeff Fuqua Blvd, Orlando, FL 32827' },
  { code: 'TPA', name: 'Tampa International', city: 'Tampa', address: '4100 George J Bean Pkwy, Tampa, FL 33607' },
  { code: 'RSW', name: 'Southwest Florida International', city: 'Fort Myers', address: '11000 Terminal Access Rd, Fort Myers, FL 33913' },
  { code: 'PBI', name: 'Palm Beach International', city: 'West Palm Beach', address: '1000 James L Turnage Blvd, West Palm Beach, FL 33415' },
  { code: 'JAX', name: 'Jacksonville International', city: 'Jacksonville', address: '2400 Yankee Clipper Dr, Jacksonville, FL 32218' },
  { code: 'CLT', name: 'Charlotte Douglas International', city: 'Charlotte', address: '5501 Josh Birmingham Pkwy, Charlotte, NC 28208' },
  { code: 'RDU', name: 'Raleigh-Durham International', city: 'Raleigh', address: '2400 John Brantley Blvd, Morrisville, NC 27560' },
  { code: 'RIC', name: 'Richmond International', city: 'Richmond', address: '1 Richard E Byrd Terminal Dr, Richmond, VA 23250' },
  { code: 'GSO', name: 'Piedmont Triad International', city: 'Greensboro', address: '1000 Ted Johnson Pkwy, Greensboro, NC 27409' },
  { code: 'SAV', name: 'Savannah/Hilton Head International', city: 'Savannah', address: '400 Airways Ave, Savannah, GA 31408' },
  { code: 'CHS', name: 'Charleston International', city: 'Charleston', address: '5500 International Blvd, Charleston, SC 29418' },
  { code: 'MSY', name: 'Louis Armstrong New Orleans International', city: 'New Orleans', address: '1 Terminal Dr, Kenner, LA 70062' },
  { code: 'BNA', name: 'Nashville International', city: 'Nashville', address: '1 Terminal Dr, Nashville, TN 37214' },
  { code: 'MEM', name: 'Memphis International', city: 'Memphis', address: '2491 Winchester Rd, Memphis, TN 38116' },
  
  // Midwest
  { code: 'MDW', name: 'Chicago Midway International', city: 'Chicago', address: '5700 S Cicero Ave, Chicago, IL 60638' },
  { code: 'DTW', name: 'Detroit Metro Wayne County', city: 'Detroit', address: '11050 Rogell Dr, Detroit, MI 48242' },
  { code: 'MSP', name: 'Minneapolis-St Paul International', city: 'Minneapolis', address: '4300 Glumack Dr, St Paul, MN 55111' },
  { code: 'STL', name: 'St. Louis Lambert International', city: 'St. Louis', address: '10701 Lambert International Blvd, St Louis, MO 63145' },
  { code: 'MCI', name: 'Kansas City International', city: 'Kansas City', address: '1 Kansas City Blvd, Kansas City, MO 64153' },
  { code: 'CLE', name: 'Cleveland Hopkins International', city: 'Cleveland', address: '5300 Riverside Dr, Cleveland, OH 44135' },
  { code: 'CVG', name: 'Cincinnati/Northern Kentucky International', city: 'Cincinnati', address: 'CVG Airport, Hebron, KY 41048' },
  { code: 'CMH', name: 'John Glenn Columbus International', city: 'Columbus', address: '4600 International Gateway, Columbus, OH 43219' },
  { code: 'IND', name: 'Indianapolis International', city: 'Indianapolis', address: '7800 Col H Weir Cook Memorial Dr, Indianapolis, IN 46241' },
  { code: 'MKE', name: 'Milwaukee Mitchell International', city: 'Milwaukee', address: '5300 S Howell Ave, Milwaukee, WI 53207' },
  { code: 'ICT', name: 'Wichita Dwight D. Eisenhower National', city: 'Wichita', address: '2173 Air Cargo Rd, Wichita, KS 67209' },
  { code: 'OMA', name: 'Eppley Airfield', city: 'Omaha', address: '4501 Abbott Dr, Omaha, NE 68110' },
  { code: 'DSM', name: 'Des Moines International', city: 'Des Moines', address: '5800 Fleur Dr, Des Moines, IA 50321' },
  { code: 'GRR', name: 'Gerald R. Ford International', city: 'Grand Rapids', address: '5500 44th St SE, Grand Rapids, MI 49512' },
  
  // Southwest
  { code: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', address: '3400 E Sky Harbor Blvd, Phoenix, AZ 85034' },
  { code: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', address: '5757 Wayne Newton Blvd, Las Vegas, NV 89119' },
  { code: 'SAN', name: 'San Diego International', city: 'San Diego', address: '3225 N Harbor Dr, San Diego, CA 92101' },
  { code: 'TUS', name: 'Tucson International', city: 'Tucson', address: '7250 S Tucson Blvd, Tucson, AZ 85756' },
  { code: 'ABQ', name: 'Albuquerque International Sunport', city: 'Albuquerque', address: '2200 Sunport Blvd SE, Albuquerque, NM 87106' },
  { code: 'ELP', name: 'El Paso International', city: 'El Paso', address: '6701 Convair Rd, El Paso, TX 79925' },
  { code: 'SNA', name: 'John Wayne Airport', city: 'Santa Ana', address: '18601 Airport Way, Santa Ana, CA 92707' },
  { code: 'ONT', name: 'Ontario International', city: 'Ontario', address: '1923 E Avion St, Ontario, CA 91761' },
  { code: 'BUR', name: 'Hollywood Burbank Airport', city: 'Burbank', address: '2627 N Hollywood Way, Burbank, CA 91505' },
  { code: 'SJC', name: 'Norman Y. Mineta San Jose International', city: 'San Jose', address: '1701 Airport Blvd, San Jose, CA 95110' },
  { code: 'SMF', name: 'Sacramento International', city: 'Sacramento', address: '6900 Airport Blvd, Sacramento, CA 95837' },
  { code: 'OAK', name: 'Oakland International', city: 'Oakland', address: '1 Airport Dr, Oakland, CA 94621' },
  
  // Mountain West
  { code: 'SLC', name: 'Salt Lake City International', city: 'Salt Lake City', address: '776 N Terminal Dr, Salt Lake City, UT 84122' },
  { code: 'BOI', name: 'Boise Airport', city: 'Boise', address: '3201 Airport Way, Boise, ID 83705' },
  { code: 'PDX', name: 'Portland International', city: 'Portland', address: '7000 NE Airport Way, Portland, OR 97218' },
  { code: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', address: '17801 International Blvd, Seattle, WA 98158' },
  { code: 'ANC', name: 'Ted Stevens Anchorage International', city: 'Anchorage', address: '5000 W International Airport Rd, Anchorage, AK 99502' },
  { code: 'FAI', name: 'Fairbanks International', city: 'Fairbanks', address: '6450 Airport Way, Fairbanks, AK 99709' },
  { code: 'RNO', name: 'Reno-Tahoe International', city: 'Reno', address: '2001 E Plumb Ln, Reno, NV 89502' },
  { code: 'BIL', name: 'Billings Logan International', city: 'Billings', address: '1901 Terminal Cir, Billings, MT 59105' },
  { code: 'MSO', name: 'Missoula International', city: 'Missoula', address: '5225 US-10 W, Missoula, MT 59808' },
  
  // Texas
  { code: 'DAL', name: 'Dallas Love Field', city: 'Dallas', address: '8008 Herb Kelleher Way, Dallas, TX 75235' },
  { code: 'IAH', name: 'George Bush Intercontinental', city: 'Houston', address: '2800 N Terminal Rd, Houston, TX 77032' },
  { code: 'HOU', name: 'William P. Hobby Airport', city: 'Houston', address: '7800 Airport Blvd, Houston, TX 77061' },
  { code: 'AUS', name: 'Austin-Bergstrom International', city: 'Austin', address: '3600 Presidential Blvd, Austin, TX 78719' },
  { code: 'SAT', name: 'San Antonio International', city: 'San Antonio', address: '9800 Airport Blvd, San Antonio, TX 78216' },
  
  // Hawaii
  { code: 'HNL', name: 'Daniel K. Inouye International', city: 'Honolulu', address: '300 Rodgers Blvd, Honolulu, HI 96819' },
  { code: 'OGG', name: 'Kahului Airport', city: 'Maui', address: '1 Kahului Airport Rd, Kahului, HI 96732' },
  { code: 'KOA', name: 'Ellison Onizuka Kona International', city: 'Kona', address: '73-200 Kupipi St, Kailua-Kona, HI 96740' },
  { code: 'LIH', name: 'Lihue Airport', city: 'Kauai', address: '3901 Mokulele Loop, Lihue, HI 96766' },
]

interface AirportAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onCodeChange?: (code: string) => void
  onAddressChange?: (address: string) => void
  onNameChange?: (name: string) => void
  onAirportSelect?: (airport: { name: string; code: string; address: string }) => void
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
  onAirportSelect,
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
    // If batch callback provided, use it instead of individual callbacks
    if (onAirportSelect) {
      onAirportSelect({
        name: airport.name,
        code: airport.code,
        address: airport.address,
      })
    } else {
      // Fallback to individual callbacks for backward compatibility
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
