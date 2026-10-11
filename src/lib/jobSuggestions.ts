import type { Fldr } from '@/types/fldr'

// What Burrow already knows from earlier jobs, offered while a new one is being filled in.
// It reads the jobs list this phone already has, so it works offline and asks the server nothing.

export interface KnownContact {
  /** The client this person was the contact for */
  client: string
  name: string | null
  phone: string | null
  email: string | null
}

export interface KnownVenue {
  name: string
  address: string | null
  contact_name: string | null
  contact_phone: string | null
}

export interface KnownHotel {
  name: string
  address: string | null
  phone: string | null
}

export interface KnownPerson {
  name: string
  phone: string | null
  email: string | null
}

export interface JobSuggestions {
  clients: string[]
  distributors: string[]
  cities: string[]
  contacts: KnownContact[]
  venues: KnownVenue[]
  hotels: KnownHotel[]
  /** Staff who had a phone or email on an earlier job */
  people: KnownPerson[]
}

export const NO_SUGGESTIONS: JobSuggestions = { clients: [], distributors: [], cities: [], contacts: [], venues: [], hotels: [], people: [] }

const key = (value: string) => value.trim().toLowerCase()

/** The jobs list as this phone last saw it */
export function readCachedJobs(): Fldr[] {
  try {
    const cached = localStorage.getItem('git-fldrs')
    const jobs = cached ? JSON.parse(cached) : []
    return Array.isArray(jobs) ? jobs : []
  } catch {
    return []
  }
}

/** Everything worth offering, most recent job first, leaving out the job being worked on */
export function buildJobSuggestions(jobs: Fldr[], currentId?: string): JobSuggestions {
  const recent = jobs
    .filter(job => job && job.id !== currentId && job.fldr_type !== 'time_off')
    .sort((a, b) => (b.date_start || '').localeCompare(a.date_start || ''))

  const clients = new Map<string, string>()
  const distributors = new Map<string, string>()
  const cities = new Map<string, string>()
  const contacts = new Map<string, KnownContact>()
  const venues = new Map<string, KnownVenue>()
  const hotels = new Map<string, KnownHotel>()
  const people = new Map<string, KnownPerson>()

  // The first one seen is the newest, so that's the one that's kept
  const keep = <T,>(map: Map<string, T>, name: string | null | undefined, value: T) => {
    if (name && name.trim() && !map.has(key(name))) map.set(key(name), value)
  }

  for (const job of recent) {
    const info = job.job_info
    keep(clients, info?.client_name, info?.client_name?.trim() as string)
    keep(distributors, info?.distributor_name, info?.distributor_name?.trim() as string)
    keep(cities, job.location, job.location?.trim() as string)
    if (info?.client_name && (info.client_contact_name || info.client_contact_phone || info.client_contact_email)) {
      keep(contacts, info.client_name, {
        client: info.client_name.trim(),
        name: info.client_contact_name || null,
        phone: info.client_contact_phone || null,
        email: info.client_contact_email || null,
      })
    }
    const venue = job.venue_info
    if (venue?.name) {
      keep(venues, venue.name, {
        name: venue.name.trim(),
        address: venue.address || null,
        contact_name: venue.contact_name || null,
        contact_phone: venue.contact_phone || null,
      })
    }
    const hotel = job.hotel_info
    if (hotel?.name) {
      keep(hotels, hotel.name, { name: hotel.name.trim(), address: hotel.address || null, phone: hotel.phone || null })
    }
    for (const person of job.people || []) {
      if (person?.name && (person.phone || person.email)) {
        keep(people, person.name, { name: person.name.trim(), phone: person.phone || null, email: person.email || null })
      }
    }
  }

  return {
    clients: Array.from(clients.values()),
    distributors: Array.from(distributors.values()),
    cities: Array.from(cities.values()),
    contacts: Array.from(contacts.values()),
    venues: Array.from(venues.values()),
    hotels: Array.from(hotels.values()),
    people: Array.from(people.values()),
  }
}

/** The contact used the last time this client had a job */
export function contactFor(suggestions: JobSuggestions, client: string | null | undefined): KnownContact | null {
  if (!client || !client.trim()) return null
  return suggestions.contacts.find(contact => key(contact.client) === key(client)) || null
}

export function venueNamed(suggestions: JobSuggestions, name: string | null | undefined): KnownVenue | null {
  if (!name || !name.trim()) return null
  return suggestions.venues.find(venue => key(venue.name) === key(name)) || null
}

export function personNamed(suggestions: JobSuggestions, name: string | null | undefined): KnownPerson | null {
  if (!name || !name.trim()) return null
  return suggestions.people.find(person => key(person.name) === key(name)) || null
}

export function hotelNamed(suggestions: JobSuggestions, name: string | null | undefined): KnownHotel | null {
  if (!name || !name.trim()) return null
  return suggestions.hotels.find(hotel => key(hotel.name) === key(name)) || null
}
