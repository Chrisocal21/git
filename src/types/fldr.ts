export type FldrStatus = 'incomplete' | 'ready' | 'active' | 'complete'
export type JobType = 'caricatures' | 'names_monograms'

export interface ReferenceLink {
  label: string
  url: string
}

export interface QuickReference {
  flight_info: string | null
  hotel_name: string | null
  hotel_address: string | null
  onsite_address: string | null
  local_airport: string | null
  departure_airport: string | null
}

export interface JobInfo {
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

export interface Fldr {
  // Core (required)
  id: string
  title: string
  date_start: string // ISO date string
  
  // Core (optional)
  date_end: string | null
  location: string | null
  status: FldrStatus
  
  // Modules (all optional)
  quick_reference: QuickReference | null
  job_info: JobInfo | null
  checklist: ChecklistItem[] | null
  people: Person[] | null
  
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
