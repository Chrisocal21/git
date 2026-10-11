export type FldrStatus = 'incomplete' | 'ready' | 'active' | 'complete'
export type JobStatus = 'pending' | 'confirmed' | 'in_progress' | 'awaiting_return' | 'complete'
export type JobType = 'caricatures' | 'personalization'

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
  travelers: string[] | null
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
  distributor_name: string | null
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
  // Prompts
  prompt_1: string | null
  prompt_2: string | null
  // From the event tracker sheet. Optional because jobs saved before these existed don't have them.
  event_type?: string | null
  kickoff_date?: string | null  // YYYY-MM-DD
  prepro_date?: string | null   // YYYY-MM-DD
  travel_start?: string | null  // YYYY-MM-DD
  travel_end?: string | null    // YYYY-MM-DD
  wardrobe?: string | null
  asana_link?: string | null
  asana_fee_links?: ReferenceLink[]
}

export type StepState = 'todo' | 'done' | 'na'

/** One line on the logistics list: where it stands, the day it happened, and anything worth noting */
export interface TrackerStep {
  state: StepState
  date: string | null // YYYY-MM-DD
  note: string | null
}

export type YesNo = 'yes' | 'no'

export type TrackerStepKey =
  | 'po_received'
  | 'contract_sent'
  | 'contract_signed'
  | 'invoice_sent'
  | 'deposit_paid'
  | 'travel_booked'
  | 'mockups_sent'
  | 'mockups_approved'
  | 'product_shipped'
  | 'input_form_created'
  | 'signage_created'
  | 'custom_sms_created'

/**
 * The logistics list for a job. Every field is optional: a job nobody has touched here
 * has no tracker at all, and a save only sends the fields that changed.
 */
export type JobTracker = Partial<Record<TrackerStepKey, TrackerStep>> & {
  pre_decoration_needed?: YesNo | null
  product_arrival_start?: string | null // YYYY-MM-DD
  product_arrival_end?: string | null   // YYYY-MM-DD
  required_fields?: string | null
  signage_required?: YesNo | null
  signage_specifics?: string | null
  custom_sms_needed?: YesNo | null
}

export type ChecklistCategory = 'production' | 'packing' | 'travel' | 'onsite' | 'teardown' | 'general'

export interface ChecklistItem {
  item: string
  completed: boolean
  category?: ChecklistCategory // Optional for backward compatibility
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
  sku: string | null
  quantity: number
  notes: string | null
}

export interface AIItineraryItem {
  action: string
  time: string
  duration?: string
  reason?: string
  type?: 'transition' | 'preparation' | 'logistics' | 'buffer'
  personalized?: boolean
}

export interface Fldr {
  // Core (required)
  id: string
  title: string
  fldr_type?: 'job' | 'time_off' // undefined = job (backward compat)
  date_start: string // ISO date string
  
  // Core (optional)
  date_end: string | null
  location: string | null
  status: FldrStatus
  job_status: JobStatus | null // Granular job state: pending, confirmed, in_progress, complete
  archived: boolean // Archive completed jobs to keep main list clean
  attending: boolean // Whether user is personally attending this trip
  
  // Team/User Management (prepared for multi-user - not enforced yet)
  created_by: string | null // User ID of creator (admin) - set to null for now
  assigned_to: string[] | null // Array of user IDs assigned to this job - null = visible to all
  
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

  // Logistics list (missing on jobs saved before it existed)
  tracker?: JobTracker | null

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
  
  // AI-generated content (saved to avoid regenerating)
  ai_itinerary_items: AIItineraryItem[] | null
  ai_itinerary_overview: string | null
  
  // Meta
  created_at: string // ISO timestamp
  updated_at: string // ISO timestamp
}

export type NewFldr = Pick<Fldr, 'title' | 'date_start'> & {
  date_end?: string | null
  location?: string | null
  fldr_type?: 'job' | 'time_off'
  people?: Fldr['people']
  notes?: string
}
