export type JigTracking = 'unit' | 'bulk'
export type JigUnitStatus = 'ok' | 'needs_repair' | 'retired'

/** Where a jig is right now: an open check-out on a job */
export interface JigHolder {
  allocation_id: string
  job_id: string
  unit_label: string | null // which unit, for jigs tracked one by one
  job_title: string | null // null if the job has since been deleted
  job_location: string | null
  job_end: string | null // YYYY-MM-DD
  qty: number
  checked_out_by: string | null
  checked_out_at: string | null // ISO
}

export interface JigUnit {
  id: string
  type_id: string
  label: string
  status: JigUnitStatus
  notes: string | null
  holder: JigHolder | null // set while the unit is out
  last_returned: { job_id: string; job_title: string | null; at: string; by: string | null } | null
}

export interface JigCounts {
  total: number // usable jigs (retired ones don't count)
  available: number // in the shop and ready to go out
  out: number
  needs_repair: number
}

export interface JigType {
  id: string
  name: string
  tracking: JigTracking
  total_qty: number // meaningful for 'bulk' only
  notes: string | null
  archived: boolean
  units: JigUnit[] // empty for 'bulk'
  holders: JigHolder[] // open check-outs; for 'bulk' only (units carry their own)
  counts: JigCounts
}

export interface JigInventoryResponse {
  jigs: JigType[]
  d1: boolean
  as_of: string // ISO time the server built this list
}

// ── Jigs on jobs ────────────────────────────────────────────────────────────

/** needed: planned for the job. out: checked out of the shop. returned / lost: the end of the trip. */
export type JigAllocationStatus = 'needed' | 'out' | 'returned' | 'lost'
export type JigReturnCondition = 'ok' | 'needs_repair' | 'lost'

/** One jig line on a job. Jigs tracked one by one get a row per unit; counted jigs get one row with a qty. */
export interface JigAllocation {
  id: string
  job_id: string
  product_id: string | null // the product on the job this jig is for
  type_id: string
  type_name: string
  tracking: JigTracking
  unit_id: string | null // set once a specific unit is checked out
  unit_label: string | null
  qty: number
  status: JigAllocationStatus
  checked_out_by: string | null
  checked_out_at: string | null // ISO
  checked_in_by: string | null
  checked_in_at: string | null // ISO
  return_condition: JigReturnCondition | null
  notes: string | null
  created_at: string | null // ISO
}

/** Another job's claim on a jig for overlapping dates, or a jig that's physically out */
export interface JigBooking {
  allocation_id: string
  job_id: string
  job_title: string | null // null if the job has since been deleted
  job_start: string | null // YYYY-MM-DD
  job_end: string | null
  qty: number
  status: 'needed' | 'out'
  unit_label: string | null
  by: string | null // who checked it out, once it's out
  since: string | null // ISO check-out time, once it's out
}

/** What can still be added to a job for its dates */
export interface JigAvailability {
  type_id: string
  name: string
  tracking: JigTracking
  capacity: number // usable jigs: units in OK condition, or the counted total
  on_this_job: number // already needed or out on this job
  free: number // what can still be added for these dates
  needs_repair: number
  bookings: JigBooking[] // other jobs holding it for overlapping dates
}

/** Why a request was refused, sent with a 409 'unavailable' */
export interface JigUnavailableDetails {
  requested?: number
  free?: number
  needs_repair?: number
  bookings?: JigBooking[] // adding to a job: who has it for those dates
  holders?: JigHolder[] // checking out: who physically has it right now
}

// ── History ─────────────────────────────────────────────────────────────────

/** out: left the shop. back: returned (see condition). lost: never came back. */
export type JigEventKind = 'out' | 'back' | 'lost'

/** One movement of a jig: it went out, or it came back */
export interface JigEvent {
  id: string // the line's id plus ':out' or ':in'
  kind: JigEventKind
  at: string // ISO
  by: string | null
  allocation_id: string
  job_id: string
  job_title: string | null // null if the job has since been deleted
  type_id: string
  type_name: string
  tracking: JigTracking
  unit_id: string | null
  unit_label: string | null
  qty: number
  condition: JigReturnCondition | null // how it came back
  notes: string | null // what was written at check-in
}

export interface JigHistoryResponse {
  events: JigEvent[]
  has_more: boolean
  d1: boolean
  as_of: string
}

export interface JobJigsResponse {
  allocations: JigAllocation[]
  d1: boolean
  as_of: string
}

export interface JigAvailabilityResponse {
  types: JigAvailability[]
}

export const JIG_UNIT_STATUS_LABEL: Record<JigUnitStatus, string> = {
  ok: 'OK',
  needs_repair: 'Needs repair',
  retired: 'Retired',
}

/** "Tumbler jig #2": the full name of one physical unit */
export function unitName(jig: Pick<JigType, 'name'>, unit: Pick<JigUnit, 'label'>): string {
  return `${jig.name} ${unit.label}`
}

/** Sorts "#2" before "#10" */
export function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}
