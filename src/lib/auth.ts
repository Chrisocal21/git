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
}

// Pre-defined team profiles
export const TEAM_PROFILES = [
  { id: 'chris', name: 'Chris', email: 'chris@example.com', role: 'admin' as UserRole },
  { id: 'michael', name: 'Michael', email: 'michael@example.com', role: 'admin' as UserRole },
  { id: 'jaclyn', name: 'Jaclyn', email: 'jaclyn@example.com', role: 'admin' as UserRole },
  { id: 'zemirah', name: 'Zemirah', email: 'zemirah@example.com', role: 'admin' as UserRole },
]

/**
 * Get currently selected profile from localStorage
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  
  const selectedProfile = localStorage.getItem('selected-profile')
  if (!selectedProfile) {
    // Default to first profile (Chris) if none selected
    return TEAM_PROFILES[0]
  }
  
  const profile = TEAM_PROFILES.find(p => p.id === selectedProfile)
  return profile || TEAM_PROFILES[0]
}

/**
 * Set the active profile
 */
export function setCurrentProfile(profileId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('selected-profile', profileId)
  // Reload to apply new profile filter
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
  if (!user) return []
  
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
