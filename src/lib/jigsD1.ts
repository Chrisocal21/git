/**
 * Jig Inventory D1 client (server-only)
 * Tables are defined in schema-jigs.sql.
 */

import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { queryD1, isD1Enabled } from './d1'
import { compareLabels } from '@/types/jigs'
import type {
  JigType,
  JigUnit,
  JigHolder,
  JigCounts,
  JigUnitStatus,
  JigAllocation,
  JigAllocationStatus,
  JigAvailability,
  JigBooking,
  JigEvent,
  JigReturnCondition,
  JigTracking,
  JigUnavailableDetails,
} from '@/types/jigs'

// ============================================================
// ERRORS
// ============================================================

/** A problem the person can act on, with the HTTP status to send back */
export class JigError extends Error {
  status: number
  code: string
  details?: JigUnavailableDetails
  constructor(message: string, status = 400, code = 'bad_request', details?: JigUnavailableDetails) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export function requireD1(): void {
  if (!isD1Enabled()) {
    throw new JigError("The database isn't connected here.", 503, 'd1_disabled')
  }
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Error && /no such table: jig_/i.test(error.message)
}

export function jigErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof JigError) {
    return NextResponse.json(
      { error: error.message, code: error.code, ...(error.details && { details: error.details }) },
      { status: error.status }
    )
  }
  if (isMissingTableError(error)) {
    console.error('[Jigs] Tables missing. Run schema-jigs.sql once.', error)
    return NextResponse.json(
      { error: "Inventory isn't set up in the database yet.", code: 'not_migrated' },
      { status: 503 }
    )
  }
  console.error(`[Jigs] ${fallback}:`, error)
  return NextResponse.json({ error: fallback, code: 'server_error' }, { status: 500 })
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json()
    if (body && typeof body === 'object' && !Array.isArray(body)) return body
  } catch {
    // fall through
  }
  throw new JigError('That request was not valid JSON.')
}

/** Runs a write and turns a unique-constraint failure into a readable conflict */
async function write(sql: string, params: unknown[], onDuplicate: string): Promise<void> {
  try {
    await queryD1(sql, params)
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      throw new JigError(onDuplicate, 409, 'duplicate')
    }
    throw error
  }
}

// ============================================================
// LIMITS + CLEANING
// ============================================================

const MAX_UNITS_PER_JIG = 60
const MAX_BULK_QTY = 10000
// D1 allows 100 bound parameters per query; a unit row uses 3
const UNIT_INSERT_CHUNK = 30

function cleanName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!name) throw new JigError('Give the jig a name.')
  if (name.length > 80) throw new JigError('That name is too long (80 characters max).')
  return name
}

function cleanLabel(value: unknown): string {
  const label = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!label) throw new JigError('Every unit needs a number or name.')
  if (label.length > 30) throw new JigError('A unit name can be 30 characters at most.')
  return label
}

function cleanNotes(value: unknown): string | null {
  if (value == null) return null
  const notes = String(value).trim()
  if (notes.length > 1000) throw new JigError('Notes are too long (1,000 characters max).')
  return notes || null
}

function cleanInt(value: unknown, what: string, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new JigError(`${what} has to be a whole number from ${min} to ${max}.`)
  }
  return n
}

function cleanStatus(value: unknown): JigUnitStatus {
  if (value === 'ok' || value === 'needs_repair' || value === 'retired') return value
  throw new JigError('Status has to be OK, Needs repair or Retired.')
}

/** D1's default timestamps look like "2026-10-05 14:30:00" (UTC, no zone) */
function toIso(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  return /(Z|[+-]\d\d:?\d\d)$/i.test(value) ? value : value.replace(' ', 'T') + 'Z'
}

// ============================================================
// READ
// ============================================================

// Open check-outs, with the job's details pulled from its JSON record
const OPEN_SQL = `
  SELECT a.id, a.job_id, a.type_id, a.unit_id, a.qty, a.checked_out_by, a.checked_out_at,
         u.label AS unit_label,
         json_extract(f.data, '$.title') AS job_title,
         json_extract(f.data, '$.location') AS job_location,
         substr(json_extract(f.data, '$.date_end'), 1, 10) AS job_end
  FROM jig_allocations a
  LEFT JOIN jig_units u ON u.id = a.unit_id
  LEFT JOIN fldrs f ON f.id = a.job_id
  WHERE a.status = 'out'
`

function holderFromRow(row: Record<string, any>): JigHolder {
  return {
    allocation_id: row.id,
    job_id: row.job_id,
    unit_label: row.unit_label ?? null,
    job_title: row.job_title ?? null,
    job_location: row.job_location ?? null,
    job_end: row.job_end || null,
    qty: Number(row.qty) || 1,
    checked_out_by: row.checked_out_by ?? null,
    checked_out_at: toIso(row.checked_out_at),
  }
}

// Every return, newest first, so the first row per unit is its most recent one
const RETURNED_SQL = `
  SELECT a.unit_id, a.job_id, a.checked_in_at, a.checked_in_by,
         json_extract(f.data, '$.title') AS job_title
  FROM jig_allocations a
  LEFT JOIN fldrs f ON f.id = a.job_id
  WHERE a.status = 'returned' AND a.unit_id IS NOT NULL
  ORDER BY a.checked_in_at DESC
`

export async function getInventory(): Promise<JigType[]> {
  const [typeRows, unitRows, openRows, returnedRows] = await Promise.all([
    queryD1('SELECT * FROM jig_types ORDER BY archived, lower(name)'),
    queryD1('SELECT * FROM jig_units'),
    queryD1(OPEN_SQL),
    queryD1(RETURNED_SQL),
  ])

  const holderByUnit = new Map<string, JigHolder>()
  const holdersByType = new Map<string, JigHolder[]>()
  for (const row of openRows) {
    const holder = holderFromRow(row)
    if (row.unit_id) {
      holderByUnit.set(row.unit_id, holder)
    } else {
      const list = holdersByType.get(row.type_id) ?? []
      list.push(holder)
      holdersByType.set(row.type_id, list)
    }
  }

  const lastReturned = new Map<string, JigUnit['last_returned']>()
  for (const row of returnedRows) {
    if (lastReturned.has(row.unit_id)) continue
    const at = toIso(row.checked_in_at)
    if (at) {
      lastReturned.set(row.unit_id, {
        job_id: row.job_id,
        job_title: row.job_title ?? null,
        at,
        by: row.checked_in_by ?? null,
      })
    }
  }

  const unitsByType = new Map<string, JigUnit[]>()
  for (const row of unitRows) {
    const unit: JigUnit = {
      id: row.id,
      type_id: row.type_id,
      label: row.label,
      status: row.status,
      notes: row.notes ?? null,
      holder: holderByUnit.get(row.id) ?? null,
      last_returned: lastReturned.get(row.id) ?? null,
    }
    const list = unitsByType.get(row.type_id) ?? []
    list.push(unit)
    unitsByType.set(row.type_id, list)
  }

  return typeRows.map(row => {
    const bulk = row.tracking === 'bulk'
    const units = (unitsByType.get(row.id) ?? []).sort((a, b) => compareLabels(a.label, b.label))
    const holders = bulk ? holdersByType.get(row.id) ?? [] : []

    let counts: JigCounts
    if (bulk) {
      const total = Number(row.total_qty) || 0
      const out = holders.reduce((sum, h) => sum + h.qty, 0)
      counts = { total, out, available: Math.max(0, total - out), needs_repair: 0 }
    } else {
      const usable = units.filter(u => u.status !== 'retired')
      counts = {
        total: usable.length,
        out: usable.filter(u => u.holder).length,
        available: usable.filter(u => u.status === 'ok' && !u.holder).length,
        needs_repair: usable.filter(u => u.status === 'needs_repair').length,
      }
    }

    return {
      id: row.id,
      name: row.name,
      tracking: bulk ? 'bulk' : 'unit',
      total_qty: Number(row.total_qty) || 0,
      notes: row.notes ?? null,
      archived: !!row.archived,
      units,
      holders,
      counts,
    }
  })
}

async function getJigById(id: string): Promise<JigType> {
  const jig = (await getInventory()).find(j => j.id === id)
  if (!jig) throw new JigError('That jig no longer exists.', 404, 'not_found')
  return jig
}

async function getTypeRow(id: string) {
  const rows = await queryD1('SELECT * FROM jig_types WHERE id = ?', [id])
  if (!rows[0]) throw new JigError('That jig no longer exists.', 404, 'not_found')
  return rows[0] as { id: string; tracking: 'unit' | 'bulk'; total_qty: number }
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const rows = await queryD1(sql, params)
  return Number(rows[0]?.n) || 0
}

// ============================================================
// JIG TYPES
// ============================================================

async function insertUnits(typeId: string, labels: string[]): Promise<void> {
  for (let i = 0; i < labels.length; i += UNIT_INSERT_CHUNK) {
    const chunk = labels.slice(i, i + UNIT_INSERT_CHUNK)
    const placeholders = chunk.map(() => '(?, ?, ?)').join(', ')
    const params = chunk.flatMap(label => [randomUUID(), typeId, label])
    await write(
      `INSERT INTO jig_units (id, type_id, label) VALUES ${placeholders}`,
      params,
      'Two units have the same number.'
    )
  }
}

/** The next "#n" for a jig, continuing from the highest numbered unit it already has */
function nextLabels(existing: string[], howMany: number): string[] {
  let highest = 0
  for (const label of existing) {
    const match = /^#(\d+)$/.exec(label)
    if (match) highest = Math.max(highest, Number(match[1]))
  }
  return Array.from({ length: howMany }, (_, i) => `#${highest + 1 + i}`)
}

export async function createJigType(input: Record<string, unknown>): Promise<JigType> {
  const name = cleanName(input.name)
  const notes = cleanNotes(input.notes)
  if (input.tracking !== 'unit' && input.tracking !== 'bulk') {
    throw new JigError('Choose whether to track each jig individually or by count.')
  }
  const tracking = input.tracking
  const quantity = cleanInt(
    input.quantity ?? 1,
    'Quantity',
    1,
    tracking === 'bulk' ? MAX_BULK_QTY : MAX_UNITS_PER_JIG
  )
  const createdBy = typeof input.created_by === 'string' ? input.created_by.slice(0, 60) : null

  const id = randomUUID()
  await write(
    `INSERT INTO jig_types (id, name, tracking, total_qty, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, name, tracking, tracking === 'bulk' ? quantity : 0, notes, createdBy],
    'You already have a jig with that name.'
  )

  if (tracking === 'unit') {
    try {
      await insertUnits(id, nextLabels([], quantity))
    } catch (error) {
      // Don't leave a jig with no units behind
      await queryD1('DELETE FROM jig_units WHERE type_id = ?', [id]).catch(() => {})
      await queryD1('DELETE FROM jig_types WHERE id = ?', [id]).catch(() => {})
      throw error
    }
  }

  return getJigById(id)
}

export async function updateJigType(id: string, patch: Record<string, unknown>): Promise<JigType> {
  const current = await getTypeRow(id)
  const sets: string[] = []
  const params: unknown[] = []

  if (patch.name !== undefined) {
    sets.push('name = ?')
    params.push(cleanName(patch.name))
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?')
    params.push(cleanNotes(patch.notes))
  }
  if (patch.total_qty !== undefined) {
    if (current.tracking !== 'bulk') {
      throw new JigError('Only jigs tracked by count have a total. Add or retire units instead.')
    }
    const qty = cleanInt(patch.total_qty, 'Quantity', 0, MAX_BULK_QTY)
    const out = await count(
      `SELECT COALESCE(SUM(qty), 0) AS n FROM jig_allocations WHERE type_id = ? AND status = 'out'`,
      [id]
    )
    if (qty < out) {
      throw new JigError(`${out} are out right now, so the total can't go below ${out}.`, 409, 'in_use')
    }
    sets.push('total_qty = ?')
    params.push(qty)
  }
  if (patch.archived !== undefined) {
    const archived = patch.archived ? 1 : 0
    if (archived) {
      const out = await count(
        `SELECT COUNT(*) AS n FROM jig_allocations WHERE type_id = ? AND status = 'out'`,
        [id]
      )
      if (out > 0) {
        throw new JigError('Some of these are still out on a job. Check them in before archiving.', 409, 'in_use')
      }
    }
    sets.push('archived = ?')
    params.push(archived)
  }

  if (sets.length === 0) return getJigById(id)

  sets.push(`updated_at = datetime('now')`)
  await write(
    `UPDATE jig_types SET ${sets.join(', ')} WHERE id = ?`,
    [...params, id],
    'You already have a jig with that name.'
  )
  return getJigById(id)
}

export async function deleteJigType(id: string): Promise<void> {
  await getTypeRow(id)
  const used = await count(`SELECT COUNT(*) AS n FROM jig_allocations WHERE type_id = ?`, [id])
  if (used > 0) {
    throw new JigError('This jig has been on jobs, so it can only be archived.', 409, 'has_history')
  }
  await queryD1('DELETE FROM jig_units WHERE type_id = ?', [id])
  await queryD1('DELETE FROM jig_types WHERE id = ?', [id])
}

// ============================================================
// UNITS
// ============================================================

export async function addUnits(typeId: string, input: Record<string, unknown>): Promise<JigType> {
  const type = await getTypeRow(typeId)
  if (type.tracking !== 'unit') {
    throw new JigError('Jigs tracked by count have no individual units. Change the quantity instead.')
  }

  const existing = (await queryD1('SELECT label FROM jig_units WHERE type_id = ?', [typeId])).map(r => r.label as string)

  const wanted =
    typeof input.label === 'string' && input.label.trim()
      ? [cleanLabel(input.label)]
      : nextLabels(existing, cleanInt(input.count ?? 1, 'Count', 1, UNIT_INSERT_CHUNK))

  if (existing.length + wanted.length > MAX_UNITS_PER_JIG) {
    throw new JigError(`A jig can have ${MAX_UNITS_PER_JIG} units at most.`)
  }

  await insertUnits(typeId, wanted)
  return getJigById(typeId)
}

async function getUnitRow(unitId: string) {
  const rows = await queryD1('SELECT * FROM jig_units WHERE id = ?', [unitId])
  if (!rows[0]) throw new JigError('That unit no longer exists.', 404, 'not_found')
  return rows[0] as { id: string; type_id: string; label: string; status: JigUnitStatus }
}

export async function updateUnit(unitId: string, patch: Record<string, unknown>): Promise<JigType> {
  const unit = await getUnitRow(unitId)
  const sets: string[] = []
  const params: unknown[] = []

  if (patch.label !== undefined) {
    sets.push('label = ?')
    params.push(cleanLabel(patch.label))
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?')
    params.push(cleanNotes(patch.notes))
  }
  if (patch.status !== undefined) {
    const status = cleanStatus(patch.status)
    if (status !== 'ok') {
      const out = await count(
        `SELECT COUNT(*) AS n FROM jig_allocations WHERE unit_id = ? AND status = 'out'`,
        [unitId]
      )
      if (out > 0) {
        throw new JigError(
          'That one is out on a job right now. Mark it when you check it in.',
          409,
          'in_use'
        )
      }
    }
    sets.push('status = ?')
    params.push(status)
  }

  if (sets.length > 0) {
    sets.push(`updated_at = datetime('now')`)
    await write(
      `UPDATE jig_units SET ${sets.join(', ')} WHERE id = ?`,
      [...params, unitId],
      'Another unit already has that number.'
    )
  }
  return getJigById(unit.type_id)
}

export async function deleteUnit(unitId: string): Promise<JigType> {
  const unit = await getUnitRow(unitId)
  const used = await count(`SELECT COUNT(*) AS n FROM jig_allocations WHERE unit_id = ?`, [unitId])
  if (used > 0) {
    throw new JigError('This one has been on jobs, so it can only be retired.', 409, 'has_history')
  }
  await queryD1('DELETE FROM jig_units WHERE id = ?', [unitId])
  return getJigById(unit.type_id)
}

// ============================================================
// JIGS ON JOBS
// ============================================================

const MAX_RESERVE_AT_ONCE = 20
// A one-by-one reserve row uses 5 bound params, and D1 allows 100 per query
const RESERVE_INSERT_CHUNK = 15

function cleanId(value: unknown, what: string): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id || id.length > 120) throw new JigError(`I need the ${what} for that.`)
  return id
}

function cleanBy(value: unknown, required: boolean): string | null {
  const by = typeof value === 'string' ? value.trim().slice(0, 60) : ''
  if (!by && required) {
    throw new JigError('Pick your profile first so we know who has it.', 400, 'who')
  }
  return by || null
}

function validDay(value: unknown): string | null {
  const day = typeof value === 'string' ? value.slice(0, 10) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) ? day : null
}

function cleanDay(value: unknown, what: string): string {
  const day = validDay(value)
  if (!day) throw new JigError(`I need the job's ${what} to check what's free.`)
  return day
}

export interface DayWindow {
  start: string
  end: string
}

/**
 * Two jobs clash when their dates overlap, except for a hand-off: one job ending
 * the day the other starts. Dates are inclusive YYYY-MM-DD strings.
 */
export function windowsConflict(a: DayWindow, b: DayWindow): boolean {
  if (a.start > b.end || b.start > a.end) return false
  if (a.end === b.start && a.start < b.start) return false
  if (b.end === a.start && b.start < a.start) return false
  return true
}

function unavailable(avail: JigAvailability | undefined, requested: number): JigError {
  return new JigError('No more available.', 409, 'unavailable', {
    requested,
    free: avail?.free ?? 0,
    needs_repair: avail?.needs_repair ?? 0,
    bookings: avail?.bookings ?? [],
  })
}

// ── Reading a job's jigs ────────────────────────────────────────────────────

const ALLOCATION_SQL = `
  SELECT a.id, a.job_id, a.product_id, a.type_id, a.unit_id, a.qty, a.status,
         a.checked_out_by, a.checked_out_at, a.checked_in_by, a.checked_in_at,
         a.return_condition, a.notes, a.created_at,
         t.name AS type_name, t.tracking AS tracking, u.label AS unit_label
  FROM jig_allocations a
  JOIN jig_types t ON t.id = a.type_id
  LEFT JOIN jig_units u ON u.id = a.unit_id
`

function allocationFromRow(row: Record<string, any>): JigAllocation {
  return {
    id: row.id,
    job_id: row.job_id,
    product_id: row.product_id ?? null,
    type_id: row.type_id,
    type_name: row.type_name,
    tracking: row.tracking === 'bulk' ? 'bulk' : 'unit',
    unit_id: row.unit_id ?? null,
    unit_label: row.unit_label ?? null,
    qty: Number(row.qty) || 1,
    status: row.status as JigAllocationStatus,
    checked_out_by: row.checked_out_by ?? null,
    checked_out_at: toIso(row.checked_out_at),
    checked_in_by: row.checked_in_by ?? null,
    checked_in_at: toIso(row.checked_in_at),
    return_condition: (row.return_condition ?? null) as JigReturnCondition | null,
    notes: row.notes ?? null,
    created_at: toIso(row.created_at),
  }
}

export async function getJobAllocations(jobId: string): Promise<JigAllocation[]> {
  const rows = await queryD1(`${ALLOCATION_SQL} WHERE a.job_id = ? ORDER BY a.created_at, a.rowid`, [jobId])
  return rows.map(allocationFromRow)
}

async function getAllocationRow(id: string) {
  const rows = await queryD1(`${ALLOCATION_SQL} WHERE a.id = ?`, [id])
  if (!rows[0]) throw new JigError('That jig line no longer exists.', 404, 'not_found')
  return rows[0] as Record<string, any>
}

// ── Availability ────────────────────────────────────────────────────────────

// Every claim that is still open, with its job's dates read from the job record
const BOOKINGS_SQL = `
  SELECT a.id, a.job_id, a.type_id, a.qty, a.status, a.checked_out_by, a.checked_out_at,
         u.label AS unit_label,
         json_extract(f.data, '$.title') AS job_title,
         substr(json_extract(f.data, '$.date_start'), 1, 10) AS job_start,
         substr(json_extract(f.data, '$.date_end'), 1, 10) AS job_end
  FROM jig_allocations a
  LEFT JOIN jig_units u ON u.id = a.unit_id
  LEFT JOIN fldrs f ON f.id = a.job_id
  WHERE a.status IN ('needed', 'out')
`

/**
 * What can still be added to a job for its dates, for each active jig.
 * Claims from other jobs only count when their dates overlap; a jig that is
 * out on a job with no dates on file always counts.
 */
export async function getAvailability(
  input: Record<string, unknown>,
  onlyTypeId?: string
): Promise<JigAvailability[]> {
  const jobId = cleanId(input.job_id, 'job')
  const start = cleanDay(input.start, 'start date')
  const end = input.end ? cleanDay(input.end, 'end date') : start
  if (end < start) throw new JigError('That job ends before it starts.')
  const window: DayWindow = { start, end }

  const [typeRows, unitCounts, bookingRows] = await Promise.all([
    onlyTypeId
      ? queryD1('SELECT * FROM jig_types WHERE id = ? AND archived = 0', [onlyTypeId])
      : queryD1('SELECT * FROM jig_types WHERE archived = 0 ORDER BY lower(name)'),
    queryD1('SELECT type_id, status, COUNT(*) AS n FROM jig_units GROUP BY type_id, status'),
    queryD1(BOOKINGS_SQL),
  ])

  const okUnits = new Map<string, number>()
  const repairUnits = new Map<string, number>()
  for (const row of unitCounts) {
    if (row.status === 'ok') okUnits.set(row.type_id, Number(row.n) || 0)
    else if (row.status === 'needs_repair') repairUnits.set(row.type_id, Number(row.n) || 0)
  }

  const bookingsByType = new Map<string, Record<string, any>[]>()
  for (const row of bookingRows) {
    const list = bookingsByType.get(row.type_id) ?? []
    list.push(row)
    bookingsByType.set(row.type_id, list)
  }

  return typeRows.map(row => {
    const bulk = row.tracking === 'bulk'
    const capacity = bulk ? Number(row.total_qty) || 0 : okUnits.get(row.id) ?? 0

    let onThisJob = 0
    let takenByOthers = 0
    const bookings: JigBooking[] = []
    for (const b of bookingsByType.get(row.id) ?? []) {
      const qty = Number(b.qty) || 1
      if (b.job_id === jobId) {
        onThisJob += qty
        continue
      }
      const bStart = validDay(b.job_start)
      const bEnd = validDay(b.job_end) ?? bStart
      const clash = bStart && bEnd ? windowsConflict(window, { start: bStart, end: bEnd }) : b.status === 'out'
      if (!clash) continue
      takenByOthers += qty
      bookings.push({
        allocation_id: b.id,
        job_id: b.job_id,
        job_title: b.job_title ?? null,
        job_start: bStart,
        job_end: bEnd,
        qty,
        status: b.status,
        unit_label: b.unit_label ?? null,
        by: b.checked_out_by ?? null,
        since: toIso(b.checked_out_at),
      })
    }

    return {
      type_id: row.id,
      name: row.name,
      tracking: (bulk ? 'bulk' : 'unit') as JigTracking,
      capacity,
      on_this_job: onThisJob,
      free: Math.max(0, capacity - onThisJob - takenByOthers),
      needs_repair: bulk ? 0 : repairUnits.get(row.id) ?? 0,
      bookings,
    }
  })
}

// ── Adding, changing and removing what a job needs ──────────────────────────

/**
 * Plan a jig for a job: { job_id, type_id, product_id?, qty, start, end, created_by? }.
 * Refused with 'No more available.' when the dates are already covered.
 */
export async function reserveJig(input: Record<string, unknown>): Promise<JigAllocation[]> {
  const jobId = cleanId(input.job_id, 'job')
  const typeId = cleanId(input.type_id, 'jig')
  const productId = input.product_id == null || input.product_id === '' ? null : cleanId(input.product_id, 'product')
  const qty = cleanInt(input.qty ?? 1, 'Quantity', 1, MAX_RESERVE_AT_ONCE)
  const createdBy = cleanBy(input.created_by, false)

  const typeRows = await queryD1('SELECT * FROM jig_types WHERE id = ?', [typeId])
  const type = typeRows[0]
  if (!type) throw new JigError('That jig no longer exists.', 404, 'not_found')
  if (type.archived) throw new JigError('That jig is archived.', 409, 'archived')

  const [avail] = await getAvailability(input, typeId)
  if (!avail || qty > avail.free) throw unavailable(avail, qty)

  if (type.tracking === 'bulk') {
    const existing = await queryD1(
      `SELECT id FROM jig_allocations
       WHERE job_id = ? AND type_id = ? AND status = 'needed' AND COALESCE(product_id, '') = ?`,
      [jobId, typeId, productId ?? '']
    )
    if (existing[0]) {
      await queryD1(
        `UPDATE jig_allocations SET qty = qty + ?, updated_at = datetime('now') WHERE id = ?`,
        [qty, existing[0].id]
      )
    } else {
      await queryD1(
        `INSERT INTO jig_allocations (id, job_id, product_id, type_id, qty, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'needed', ?)`,
        [randomUUID(), jobId, productId, typeId, qty, createdBy]
      )
    }
  } else {
    // One row per jig, so each unit's history stays its own
    for (let i = 0; i < qty; i += RESERVE_INSERT_CHUNK) {
      const rows = Math.min(RESERVE_INSERT_CHUNK, qty - i)
      const placeholders = Array.from({ length: rows }, () => `(?, ?, ?, ?, 1, 'needed', ?)`).join(', ')
      const params = Array.from({ length: rows }).flatMap(() => [randomUUID(), jobId, productId, typeId, createdBy])
      await queryD1(
        `INSERT INTO jig_allocations (id, job_id, product_id, type_id, qty, status, created_by) VALUES ${placeholders}`,
        params
      )
    }
  }

  return getJobAllocations(jobId)
}

/** Take a jig back off a job's list. Only before it has been checked out. */
export async function removeAllocation(id: string): Promise<JigAllocation[]> {
  const row = await getAllocationRow(id)
  if (row.status !== 'needed') {
    throw new JigError(
      row.status === 'out' ? 'That one is out. Check it in instead.' : 'That one has already been returned.',
      409,
      'not_needed'
    )
  }
  await queryD1(`DELETE FROM jig_allocations WHERE id = ? AND status = 'needed'`, [id])
  return getJobAllocations(row.job_id)
}

/** Change how many of a counted jig a job needs: { qty, start, end } */
export async function setNeededQty(id: string, input: Record<string, unknown>): Promise<JigAllocation[]> {
  const row = await getAllocationRow(id)
  if (row.status !== 'needed') throw new JigError('That one is already out.', 409, 'not_needed')
  if (row.tracking !== 'bulk') throw new JigError('Add or remove these one at a time.')

  const qty = cleanInt(input.qty, 'Quantity', 1, MAX_BULK_QTY)
  const current = Number(row.qty) || 1
  if (qty > current) {
    const [avail] = await getAvailability({ ...input, job_id: row.job_id }, row.type_id)
    if (!avail || qty - current > avail.free) throw unavailable(avail, qty - current)
  }
  await queryD1(`UPDATE jig_allocations SET qty = ?, updated_at = datetime('now') WHERE id = ?`, [qty, id])
  return getJobAllocations(row.job_id)
}

// ── Checking out and in ─────────────────────────────────────────────────────

/**
 * Take a planned jig out of the shop: { by, unit_id } (unit_id for jigs tracked one by one).
 * It's one conditional UPDATE, so two people can't both walk out with the last one.
 */
export async function checkOutAllocation(id: string, input: Record<string, unknown>): Promise<JigAllocation[]> {
  const by = cleanBy(input.by, true)
  const row = await getAllocationRow(id)
  if (row.status !== 'needed') {
    throw new JigError(
      row.status === 'out' ? 'That one is already checked out.' : 'That one has already been returned.',
      409,
      'not_needed'
    )
  }
  const now = new Date().toISOString()

  if (row.tracking === 'unit') {
    const unitId = cleanId(input.unit_id, 'unit to check out')
    const unit = (await queryD1('SELECT * FROM jig_units WHERE id = ?', [unitId]))[0]
    if (!unit || unit.type_id !== row.type_id) throw new JigError("That unit doesn't belong to this jig.")
    if (unit.status !== 'ok') {
      throw new JigError(
        `${row.type_name} ${unit.label} ${unit.status === 'needs_repair' ? 'needs repair' : 'is retired'}.`,
        409,
        'unit_unavailable'
      )
    }

    const moved = await queryD1(
      `UPDATE jig_allocations
       SET status = 'out', unit_id = ?, checked_out_by = ?, checked_out_at = ?, updated_at = datetime('now')
       WHERE id = ? AND status = 'needed'
         AND EXISTS (SELECT 1 FROM jig_units u WHERE u.id = ? AND u.type_id = jig_allocations.type_id AND u.status = 'ok')
         AND NOT EXISTS (SELECT 1 FROM jig_allocations o WHERE o.unit_id = ? AND o.status = 'out')
       RETURNING id`,
      [unitId, by, now, id, unitId, unitId]
    )
    if (moved.length === 0) {
      const holders = (await queryD1(`${OPEN_SQL} AND a.unit_id = ?`, [unitId])).map(holderFromRow)
      throw new JigError(`${row.type_name} ${unit.label} is already out.`, 409, 'unavailable', { holders })
    }
  } else {
    const moved = await queryD1(
      `UPDATE jig_allocations
       SET status = 'out', checked_out_by = ?, checked_out_at = ?, updated_at = datetime('now')
       WHERE id = ? AND status = 'needed'
         AND (SELECT COALESCE(SUM(o.qty), 0) FROM jig_allocations o
              WHERE o.type_id = jig_allocations.type_id AND o.status = 'out') + jig_allocations.qty
             <= (SELECT t.total_qty FROM jig_types t WHERE t.id = jig_allocations.type_id)
       RETURNING id`,
      [by, now, id]
    )
    if (moved.length === 0) {
      const holders = (await queryD1(`${OPEN_SQL} AND a.type_id = ?`, [row.type_id])).map(holderFromRow)
      const total = Number((await queryD1('SELECT total_qty FROM jig_types WHERE id = ?', [row.type_id]))[0]?.total_qty) || 0
      const out = holders.reduce((sum, h) => sum + h.qty, 0)
      throw new JigError('No more available.', 409, 'unavailable', {
        requested: Number(row.qty) || 1,
        free: Math.max(0, total - out),
        holders,
      })
    }
  }

  return getJobAllocations(row.job_id)
}

/**
 * Bring a jig back: { by, condition: 'ok' | 'needs_repair' | 'lost', notes? }.
 * Needs repair keeps that unit out of circulation; lost retires it (or shrinks a counted total).
 */
export async function checkInAllocation(id: string, input: Record<string, unknown>): Promise<JigAllocation[]> {
  const by = cleanBy(input.by, true)
  const condition = input.condition ?? 'ok'
  if (condition !== 'ok' && condition !== 'needs_repair' && condition !== 'lost') {
    throw new JigError('Condition has to be OK, Needs repair or Lost.')
  }
  const notes = cleanNotes(input.notes)

  const row = await getAllocationRow(id)
  if (row.status !== 'out') {
    throw new JigError(
      row.status === 'needed' ? "That one hasn't been checked out." : 'That one has already been returned.',
      409,
      'not_out'
    )
  }
  if (row.tracking === 'bulk' && condition === 'needs_repair') {
    throw new JigError('Counted jigs are either back or lost.')
  }

  const done = await queryD1(
    `UPDATE jig_allocations
     SET status = ?, return_condition = ?, checked_in_by = ?, checked_in_at = ?,
         notes = COALESCE(?, notes), updated_at = datetime('now')
     WHERE id = ? AND status = 'out'
     RETURNING id`,
    [condition === 'lost' ? 'lost' : 'returned', condition, by, new Date().toISOString(), notes, id]
  )
  if (done.length === 0) throw new JigError('That one was just checked in.', 409, 'not_out')

  if (row.unit_id) {
    if (condition !== 'ok') {
      await queryD1(`UPDATE jig_units SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
        condition === 'lost' ? 'retired' : 'needs_repair',
        row.unit_id,
      ])
    }
  } else if (condition === 'lost') {
    await queryD1(`UPDATE jig_types SET total_qty = MAX(0, total_qty - ?), updated_at = datetime('now') WHERE id = ?`, [
      Number(row.qty) || 1,
      row.type_id,
    ])
  }

  return getJobAllocations(row.job_id)
}

// ============================================================
// HISTORY
// ============================================================

const HISTORY_PAGE = 50

// Every time a jig left the shop or came back, one row each, read straight from the check-out/in records
const EVENTS_SQL = `
  SELECT a.id || ':out' AS event_id, 'out' AS kind, a.checked_out_at AS at, a.checked_out_by AS by_name,
         a.id AS allocation_id, a.job_id, a.type_id, a.unit_id, a.qty,
         NULL AS return_condition, NULL AS notes
  FROM jig_allocations a
  WHERE a.checked_out_at IS NOT NULL
  UNION ALL
  SELECT a.id || ':in', CASE WHEN a.status = 'lost' THEN 'lost' ELSE 'back' END, a.checked_in_at, a.checked_in_by,
         a.id, a.job_id, a.type_id, a.unit_id, a.qty,
         a.return_condition, a.notes
  FROM jig_allocations a
  WHERE a.checked_in_at IS NOT NULL
`

/**
 * Movement, newest first: { jig?, unit?, limit?, before?, before_id? }.
 * Page through it by passing the last event's `at` and `id` back as before / before_id.
 */
export async function getHistory(input: Record<string, unknown>): Promise<{ events: JigEvent[]; has_more: boolean }> {
  const limit = input.limit == null || input.limit === '' ? HISTORY_PAGE : cleanInt(input.limit, 'Limit', 1, 100)

  const where: string[] = []
  const params: unknown[] = []
  if (typeof input.jig === 'string' && input.jig) {
    where.push('e.type_id = ?')
    params.push(input.jig)
  }
  if (typeof input.unit === 'string' && input.unit) {
    where.push('e.unit_id = ?')
    params.push(input.unit)
  }
  if (typeof input.before === 'string' && input.before) {
    if (Number.isNaN(Date.parse(input.before))) throw new JigError("That page marker isn't a date.")
    const beforeId = typeof input.before_id === 'string' ? input.before_id : ''
    // Events at the very same moment are ordered by id, so a page boundary can't skip or repeat one
    where.push('(e.at < ? OR (e.at = ? AND e.event_id < ?))')
    params.push(input.before, input.before, beforeId)
  }

  const rows = await queryD1(
    `SELECT e.*, t.name AS type_name, t.tracking AS tracking, u.label AS unit_label,
            json_extract(f.data, '$.title') AS job_title
     FROM (${EVENTS_SQL}) e
     JOIN jig_types t ON t.id = e.type_id
     LEFT JOIN jig_units u ON u.id = e.unit_id
     LEFT JOIN fldrs f ON f.id = e.job_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY e.at DESC, e.event_id DESC
     LIMIT ?`,
    [...params, limit + 1]
  )

  const events: JigEvent[] = rows.slice(0, limit).map(row => ({
    id: row.event_id,
    kind: row.kind,
    at: toIso(row.at) as string,
    by: row.by_name ?? null,
    allocation_id: row.allocation_id,
    job_id: row.job_id,
    job_title: row.job_title ?? null,
    type_id: row.type_id,
    type_name: row.type_name,
    tracking: row.tracking === 'bulk' ? 'bulk' : 'unit',
    unit_id: row.unit_id ?? null,
    unit_label: row.unit_label ?? null,
    qty: Number(row.qty) || 1,
    condition: (row.return_condition ?? null) as JigReturnCondition | null,
    notes: row.notes ?? null,
  }))

  return { events, has_more: rows.length > limit }
}
