import type { JigAllocation, JigTracking } from '@/types/jigs'

/** The bits of a job the jig dialogs need */
export interface JigJob {
  id: string
  start: string // YYYY-MM-DD (or an ISO datetime)
  end: string | null
}

/** Jigs a job still needs, grouped by kind of jig */
export interface NeedGroup {
  typeId: string
  name: string
  tracking: JigTracking
  rows: JigAllocation[] // the 'needed' rows: one per jig, or one counted row
  qty: number
}

/** The label for one jig line: "Tumbler jig #2", "Luggage tag jig ×2" */
export function lineName(row: Pick<JigAllocation, 'type_name' | 'unit_label' | 'qty' | 'tracking'>): string {
  if (row.unit_label) return `${row.type_name} ${row.unit_label}`
  return row.tracking === 'bulk' && row.qty > 1 ? `${row.type_name} ×${row.qty}` : row.type_name
}
