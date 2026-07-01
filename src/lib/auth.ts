/**
 * Profile-Based User System
 * 
 * Instead of traditional authentication, users select their profile.
 * Each profile sees only the jobs they were on (listed in the people array).
 * All data lives in the same place, filtered by profile.
 */

export type UserRole = 'admin' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  active?: boolean // true = current team member, false = inactive/archived
}

// Default team profiles
const DEFAULT_TEAM_PROFILES: User[] = [
  { id: 'chris', name: 'Chris', email: 'chris@example.com', role: 'admin' as UserRole, active: true },
  { id: 'michael', name: 'Michael', email: 'michael@example.com', role: 'admin' as UserRole, active: true },
  { id: 'jaclyn', name: 'Jaclyn', email: 'jaclyn@example.com', role: 'admin' as UserRole, active: true },
  { id: 'zemirah', name: 'Zemirah', email: 'zemirah@example.com', role: 'admin' as UserRole, active: true },
  { id: 'cody', name: 'Cody', email: 'cody@example.com', role: 'viewer' as UserRole, active: true },
  { id: 'taylor', name: 'Taylor', email: 'taylor@example.com', role: 'viewer' as UserRole, active: true },
  { id: 'matt', name: 'Matt', email: 'matt@example.com', role: 'viewer' as UserRole, active: false },
  { id: 'jim', name: 'Jim', email: 'jim@example.com', role: 'viewer' as UserRole, active: false },
  { id: 'mark', name: 'Mark', email: 'mark@example.com', role: 'viewer' as UserRole, active: false },
]

/**
 * Auto-mark profiles as inactive if they're not in any jobs
 */
export function autoMarkInactiveProfiles(): void {
  if (typeof window === 'undefined') return
  
  try {
    const jobsCache = localStorage.getItem('git-fldrs')
    if (!jobsCache) return
    
    const jobs = JSON.parse(jobsCache)
    
    // Extract all unique people names from CURRENT/UPCOMING jobs only
    // Skip: archived, completed, OR past jobs
    const peopleInJobs = new Set<string>()
    const today = new Date()
    today.setHours(0, 0, 0, 0) // Start of today
    
    jobs.forEach((job: any) => {
      // Skip archived or completed jobs
      if (job.archived === true || job.status === 'complete') {
        return
      }
      
      // Skip jobs that have already ended (past jobs)
      if (job.date_end) {
        const endDate = new Date(job.date_end)
        if (endDate < today) {
          return // Job is in the past
        }
      }
      
      if (job.people && Array.isArray(job.people)) {
        job.people.forEach((person: any) => {
          if (person.name && person.name.trim()) {
            peopleInJobs.add(person.name.toLowerCase().trim())
          }
        })
      }
    })
    
    // Update profiles
    const profiles = getTeamProfiles()
    let updated = false
    
    const updatedProfiles = profiles.map(profile => {
      const isInJobs = peopleInJobs.has(profile.name.toLowerCase())
      
      if (isInJobs && profile.active === false) {
        updated = true
        return { ...profile, active: true }
      } else if (!isInJobs && profile.active !== false) {
        updated = true
        return { ...profile, active: false }
      }
      
      return profile
    })
    
    if (updated) {
      localStorage.setItem('team-profiles', JSON.stringify(updatedProfiles))
    }
  } catch (e) {
    console.error('[Profile] Failed to auto-mark inactive profiles:', e)
  }
}

/**
 * Get all team profiles from localStorage (or defaults if not set)
 */
export function getTeamProfiles(): User[] {
  if (typeof window === 'undefined') return DEFAULT_TEAM_PROFILES
  
  const stored = localStorage.getItem('team-profiles')
  
  if (stored) {
    try {
      const savedProfiles = JSON.parse(stored)
      
      // Merge with defaults: add any missing default profiles
      const merged = [...savedProfiles]
      for (const defaultProfile of DEFAULT_TEAM_PROFILES) {
        const exists = merged.find(p => p.id === defaultProfile.id)
        if (!exists) {
          merged.push(defaultProfile)
        }
      }
      
      // Save back if we added any
      if (merged.length > savedProfiles.length) {
        localStorage.setItem('team-profiles', JSON.stringify(merged))
      }
      
      return merged
    } catch (e) {
      console.error('Failed to parse team profiles:', e)
    }
  }
  
  // Initialize with defaults
  localStorage.setItem('team-profiles', JSON.stringify(DEFAULT_TEAM_PROFILES))
  return DEFAULT_TEAM_PROFILES
}

/**
 * Add or update a profile in the team profiles list
 */
export function addOrUpdateProfile(name: string, role: UserRole = 'viewer'): User {
  if (typeof window === 'undefined') {
    throw new Error('Cannot add profile on server side')
  }
  
  // Don't create profiles for very short names (likely typing in progress)
  if (name.length < 3) {
    console.log(`[Profile] Skipping profile creation for short name: "${name}"`)
    throw new Error('Name too short')
  }
  
  const profiles = getTeamProfiles()
  
  // Check if profile already exists (case-insensitive)
  const existing = profiles.find(p => p.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    return existing
  }
  
  // Create new profile
  const id = name.toLowerCase().replace(/\s+/g, '-')
  const email = `${id}@example.com`
  const newProfile: User = { id, name, email, role, active: true }
  
  const updated = [...profiles, newProfile]
  localStorage.setItem('team-profiles', JSON.stringify(updated))
  
  console.log(`[Profile] Created new profile: ${name} (${id})`)
  return newProfile
}

/**
 * Clean up incomplete/invalid profiles (names shorter than 3 characters)
 */
export function cleanupIncompleteProfiles(): void {
  if (typeof window === 'undefined') return
  
  const profiles = getTeamProfiles()
  const cleaned = profiles.filter(p => p.name.length >= 3)
  
  const removed = profiles.length - cleaned.length
  if (removed > 0) {
    localStorage.setItem('team-profiles', JSON.stringify(cleaned))
    console.log(`[Profile] Cleaned up ${removed} incomplete profiles`)
    // Force reload to update cached TEAM_PROFILES
    window.location.reload()
  }
}

/**
 * Toggle profile active status
 */
export function toggleProfileActive(profileId: string): void {
  if (typeof window === 'undefined') return
  
  const profiles = getTeamProfiles()
  const updated = profiles.map(p => 
    p.id === profileId 
      ? { ...p, active: p.active === false ? true : false }
      : p
  )
  
  localStorage.setItem('team-profiles', JSON.stringify(updated))
  console.log(`[Profile] Toggled active status for profile: ${profileId}`)
  window.location.reload()
}

// Cached profiles array - updated by getTeamProfiles()
export let TEAM_PROFILES = DEFAULT_TEAM_PROFILES
if (typeof window !== 'undefined') {
  TEAM_PROFILES = getTeamProfiles()
  // Auto-cleanup on load
  const profiles = getTeamProfiles()
  const hasIncomplete = profiles.some(p => p.name.length < 3)
  if (hasIncomplete) {
    cleanupIncompleteProfiles()
  }
}

/**
 * Get currently selected profile from localStorage
 * Returns null when no profile is selected ("All" / guest mode)
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  
  const selectedProfile = localStorage.getItem('selected-profile')
  if (!selectedProfile) return null
  
  const profiles = getTeamProfiles()
  return profiles.find(p => p.id === selectedProfile) || null
}

/**
 * Set the active profile
 */
export function setCurrentProfile(profileId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('selected-profile', profileId)
  window.location.reload()
}

/**
 * Clear the active profile — returns to "All" / guest mode
 */
export function clearProfile(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('selected-profile')
  window.location.reload()
}

/**
 * Check if current user is admin
 */
export function isAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin' || false
}

/**
 * Check if current user can edit a job
 * TODO: Implement proper permission checking
 */
export function canEditJob(jobCreatedBy?: string | null, jobAssignedTo?: string[] | null): boolean {
  const user = getCurrentUser()
  if (!user) return false
  
  // Admins can edit everything
  if (user.role === 'admin') return true
  
  // TODO: Viewers can only edit jobs assigned to them (when auth is implemented)
  // if (jobAssignedTo?.includes(user.id)) return true
  
  return true // For now, everyone can edit
}

/**
 * Filter jobs based on current user's profile
 */
export function filterJobsByUser<T extends { 
  created_by?: string | null; 
  assigned_to?: string[] | null; 
  attending?: boolean;
  people?: Array<{ name: string; role?: string | null; phone?: string | null; email?: string | null }> | null;
}>(
  jobs: T[],
  viewMode: 'team' | 'my' = 'team'
): T[] {
  const user = getCurrentUser()
  // No profile selected (guest/all mode) — always show everything
  if (!user) return jobs
  
  // Team mode: show all jobs
  if (viewMode === 'team') {
    return jobs
  }
  
  // My Jobs mode: show only jobs where this user is listed in the people array
  if (viewMode === 'my') {
    return jobs.filter(job => {
      // If no people array, fall back to attending flag
      if (!job.people || job.people.length === 0) {
        return job.attending === true
      }
      
      // Check if user's name appears in the people array
      return job.people.some(person => 
        person.name.toLowerCase() === user.name.toLowerCase()
      )
    })
  }
  
  return jobs
}

/**
 * Get user display name for UI
 * TODO: Fetch from auth provider's user database
 */
export function getUserDisplayName(userId: string): string {
  // TODO: Lookup user by ID from auth provider
  return 'Team Member' // Placeholder
}

/**
 * Check if user is authenticated
 * TODO: Replace with real auth check
 */
export function isAuthenticated(): boolean {
  // For now, assume everyone is authenticated (no auth wall yet)
  return true
}
