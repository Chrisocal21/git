/**
 * Authentication & Authorization Utilities
 * 
 * This file is prepared for future authentication implementation.
 * Current state: All functions return permissive values (all users are admins, see all jobs)
 * 
 * TODO: Implement with Clerk.com or similar auth provider
 * - Replace mock functions with real authentication
 * - Connect to actual user session
 * - Implement role-based access control
 */

export type UserRole = 'admin' | 'viewer'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

/**
 * Get current user (mock - returns admin user for now)
 * TODO: Replace with real auth provider (Clerk.useUser())
 */
export function getCurrentUser(): User | null {
  // Mock user for development - all users are admins until auth is implemented
  return {
    id: 'dev-user-1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin'
  }
}

/**
 * Check if current user is admin
 * TODO: Replace with real role check from auth provider
 */
export function isAdmin(): boolean {
  const user = getCurrentUser()
  // For now, everyone is admin (no auth yet)
  return true // TODO: return user?.role === 'admin'
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
 * Filter jobs based on current user's permissions
 */
export function filterJobsByUser<T extends { created_by?: string | null; assigned_to?: string[] | null; attending?: boolean }>(
  jobs: T[],
  viewMode: 'team' | 'my' = 'team'
): T[] {
  const user = getCurrentUser()
  if (!user) return []
  
  // Team mode: show all jobs
  if (viewMode === 'team') {
    return jobs
  }
  
  // My Jobs mode: filter by attending flag
  if (viewMode === 'my') {
    // Filter to only jobs where attending === true
    return jobs.filter(job => job.attending === true)
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
