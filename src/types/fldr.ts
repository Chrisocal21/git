export type FldrStatus = 'incomplete' | 'ready' | 'active' | 'complete'
export type JobType = 'caricatures' | 'names_monograms'

export interface ReferenceLink {
  label: string
  url: string
}

export interface FlightSegment {
  id: string
  departure_airport: string | null
  departure_code: string | null
  departure_address: string | null
  departure_time: string | null
  arrival_airport: string | null
  arrival_code: string | null
  arrival_address: string | null
  arrival_time: string | null
  flight_number: string | null
  airline: string | null
  confirmation: string | null
  notes: string | null
  segment_type: 'outbound' | 'return' | 'connection' | 'other' | null
}

export interface HotelInfo {
  name: string | null
  address: string | null
  phone: string | null
  confirmation: string | null
  check_in: string | null
  check_out: string | null
  notes: string | null
}

export interface VenueInfo {
  name: string | null
  address: string | null
  contact_name: string | null
  contact_phone: string | null
  notes: string | null
}

export interface RentalCarInfo {
  company: string | null
  confirmation: string | null
  pickup_location: string | null
  pickup_time: string | null
  dropoff_location: string | null
  dropoff_time: string | null
  vehicle_type: string | null
  insurance_policy_number: string | null
  travel_reservation: string | null
  notes: string | null
}

export interface JobInfo {
  job_title: string | null
  client_name: string | null
  item: string | null
  quantity: number | null
  job_type: JobType | null
  client_contact_name: string | null
  client_contact_phone: string | null
  client_contact_email: string | null
  event_details: string | null
  reference_links: ReferenceLink[]
  team_members: string[]
  pre_engrave_details: string | null
  show_up_time: string | null
  job_start_time: string | null
  job_end_time: string | null
  break_start_time: string | null
  break_end_time: string | null
  // Multi-day recurring schedule
  use_daily_schedule: boolean
  daily_start_time: string | null  // Time only (HH:MM)
  daily_end_time: string | null    // Time only (HH:MM)
  daily_break_start: string | null // Time only (HH:MM)
  daily_break_end: string | null   // Time only (HH:MM)
}

export interface ChecklistItem {
  item: string
  completed: boolean
}

export interface Person {
  name: string
  role: string | null
  phone: string | null
  email: string | null
}

export interface Photo {
  id: string
  url: string
  caption: string | null
  uploaded_at: string
}

export interface Product {
  id: string
  name: string
  quantity: number
  notes: string | null
  waste: number // Quantity lost/damaged/wasted
}

export interface Fldr {
  // Core (required)
  id: string
  title: string
  date_start: string // ISO date string
  
  // Core (optional)
  date_end: string | null
  location: string | null
  status: FldrStatus
  attending: boolean // Whether user is personally attending this trip
  
  // Modules (all optional)
  flight_info: FlightSegment[] | null
  hotel_info: HotelInfo | null
  venue_info: VenueInfo | null
  rental_car_info: RentalCarInfo | null
  job_info: JobInfo | null
  checklist: ChecklistItem[] | null
  people: Person[] | null
  photos: Photo[] | null
  products: Product[] | null
  
  // Notes (always available)
  notes: string
  wrap_up: string | null
  polished_messages: Array<{
    original: string
    draft: string
    polished: string
    polish_level: 'light' | 'full_suit'
    created_at: string
  }>
  
  // Meta
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

export type NewFldr = Pick<Fldr, 'title' | 'date_start'> & {
  date_end?: string | null
  location?: string | null
}
