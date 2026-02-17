import { Fldr, NewFldr } from '@/types/fldr'

// Temporary in-memory store (will be replaced with D1)
let fldrs: Fldr[] = []

export const fldrStore = {
  getAll: (): Fldr[] => {
    return [...fldrs].sort((a, b) => {
      // Sort by date_start, upcoming first
      return new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    })
  },

  getById: (id: string): Fldr | undefined => {
    return fldrs.find(f => f.id === id)
  },

  getUpcoming: (): Fldr | undefined => {
    const now = new Date()
    const upcoming = fldrs
      .filter(f => new Date(f.date_start) >= now)
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
    return upcoming[0]
  },

  create: (newFldr: NewFldr): Fldr => {
    const now = new Date().toISOString()
    const fldr: Fldr = {
      id: crypto.randomUUID(),
      title: newFldr.title,
      date_start: newFldr.date_start,
      date_end: newFldr.date_end || null,
      location: newFldr.location || null,
      status: 'incomplete',
      attending: false,
      flight_info: null,
      hotel_info: null,
      venue_info: null,
      rental_car_info: null,
      job_info: null,
      checklist: null,
      people: null,
      photos: null,
      products: null,
      notes: '',
      wrap_up: null,
      polished_messages: [],
      created_at: now,
      updated_at: now,
    }
    fldrs.push(fldr)
    return fldr
  },

  update: (id: string, updates: Partial<Fldr>): Fldr | undefined => {
    const index = fldrs.findIndex(f => f.id === id)
    if (index === -1) return undefined
    
    fldrs[index] = {
      ...fldrs[index],
      ...updates,
      updated_at: new Date().toISOString(),
    }
    return fldrs[index]
  },

  delete: (id: string): boolean => {
    const index = fldrs.findIndex(f => f.id === id)
    if (index === -1) return false
    fldrs.splice(index, 1)
    return true
  },

  // Add pre-made fldr (for migrations)
  add: (fldr: Fldr): void => {
    fldrs.push(fldr)
  },
}
