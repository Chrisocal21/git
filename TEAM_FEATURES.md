# Team Features - Multi-User Implementation

**Status:** Infrastructure ready, authentication pending

This document outlines the team collaboration features that are prepared but require authentication to fully activate.

---

## 🎯 Current State

### ✅ What's Working Now (No Auth Required)
- All users see all jobs (team-wide visibility)
- View mode toggles (Team vs My Jobs) are in place but both show everything
- Role badge shows "Dev Mode" indicator
- Permission helpers return permissive values (everyone can edit everything)
- Data structure supports user assignments (fields exist, set to null)

### ⏳ What Activates After Auth
- User-specific job filtering
- Role-based edit permissions (admin vs viewer)
- Job assignment tracking
- Creator attribution
- "My Jobs" view shows only assigned jobs

---

## 👥 User Roles

### Admin Role
**Capabilities:**
- ✅ Create new jobs
- ✅ Edit any job
- ✅ Delete any job
- ✅ Assign team members to jobs
- ✅ View all jobs (team overview)
- ✅ Access all features

**Use Case:** You and other managers who create/manage jobs

### Viewer Role
**Capabilities:**
- ✅ View all jobs in "Team" mode
- ✅ View only assigned jobs in "My Jobs" mode
- ✅ Edit assigned jobs only (travel details, notes, checklist)
- ❌ Cannot create new jobs
- ❌ Cannot delete jobs
- ❌ Cannot edit unassigned jobs

**Use Case:** Team members who need to see job details and update their progress

---

## 🗺️ Map Views

### Team Overview Mode (Default)
**Shows:** All jobs with travel data from entire team
**Use Case:** 
- Admin sees where everyone is traveling
- Team coordination - avoid scheduling conflicts
- Overview of team travel patterns
- Airport statistics across all users

**Example:**
```
Team Overview: 5 jobs
- Chris: SAN → LAX (March 10)
- Mike: SAN → DFW (March 12)
- Sarah: Local job (no travel)
```

### My Jobs Mode
**Shows:** Only jobs assigned to current user
**Use Case:**
- Team member sees only their travel schedule
- Personal trip planning
- Individual airport visit history
- Personal travel statistics

**Example (as Mike):**
```
My Jobs: 2 jobs
- SAN → DFW → ORD (March 12-14)
- Local job (March 20)
```

---

## 📋 Job Assignment Flow

### Creating a Job (Admin)
1. Admin creates job with client/venue details
2. `created_by` automatically set to admin's user ID
3. `assigned_to` defaults to null (visible to all)

### Assigning Team Members (Admin)
1. Admin edits job
2. Opens "Team Assignment" section
3. Selects users from dropdown
4. Saves - users now see it in "My Jobs"

**UI (Future Enhancement):**
```tsx
<TeamAssignment>
  <UserCheckbox user={chris} checked />
  <UserCheckbox user={mike} checked />
  <UserCheckbox user={sarah} />
</TeamAssignment>
```

### Team Member View (Viewer)
- **Team tab:** Sees all jobs (read-only for unassigned)
- **My Jobs tab:** Sees only assigned jobs (editable)
- Can update travel details, notes, checklist for assigned jobs
- Cannot create or delete jobs

---

## 🔒 Permission Matrix

| Action | Admin | Viewer (Assigned) | Viewer (Unassigned) |
|--------|-------|-------------------|---------------------|
| Create Job | ✅ Yes | ❌ No | ❌ No |
| View Job Details | ✅ Yes | ✅ Yes | 👁️ Read-only |
| Edit Flight Info | ✅ Yes | ✅ Yes (assigned jobs) | ❌ No |
| Edit Hotel Info | ✅ Yes | ✅ Yes (assigned jobs) | ❌ No |
| Update Checklist | ✅ Yes | ✅ Yes (assigned jobs) | ❌ No |
| Add Photos | ✅ Yes | ✅ Yes (assigned jobs) | ❌ No |
| Edit Notes | ✅ Yes | ✅ Yes (assigned jobs) | ❌ No |
| Delete Job | ✅ Yes | ❌ No | ❌ No |
| Assign Team | ✅ Yes | ❌ No | ❌ No |

---

## 🎨 UI Components Ready

### RoleBadge Component
**Location:** `src/components/RoleBadge.tsx`
**Shows:**
- "Dev Mode" badge (until auth is implemented)
- "👑 Admin" or "👁️ Viewer" role badge
- User avatar (future: from auth provider)

**Placement:**
- Jobs list header
- Job detail page header
- Settings page

### View Mode Toggle
**Locations:**
- Jobs page (`/jobs`)
- Map page (`/map`)

**States:**
- **Team:** All jobs visible to entire team
- **My Jobs:** Only jobs assigned to current user

**Behavior:**
- Admins: Both modes show all (for now)
- Viewers: "My Jobs" filters to assigned only

### Conditional Edit Buttons
**Already implemented:**
```tsx
{canEditJob(fldr.created_by, fldr.assigned_to) && (
  <button>Edit Flight Info</button>
)}
```

Will automatically hide/disable for viewers when looking at unassigned jobs.

---

## 📊 Data Structure

### Fldr Type Extensions
```typescript
interface Fldr {
  // ... existing fields ...
  
  // Team fields (added)
  created_by: string | null        // User ID of creator
  assigned_to: string[] | null     // Array of assigned user IDs
}
```

### When Auth is Active
```typescript
// Example job:
{
  id: "job-123",
  title: "Acme Corp Event",
  created_by: "user_abc123",      // Chris (admin)
  assigned_to: ["user_abc123", "user_def456"], // Chris + Mike
  // ... rest of job data
}
```

---

## 🔄 Migration Strategy

### Phase 1: Current (No Auth)
- Everyone sees everything
- Everyone can edit everything
- created_by = null
- assigned_to = null

### Phase 2: Auth Added (Admin Only)
1. Install Clerk/NextAuth
2. Set yourself as admin
3. Test: You can still do everything
4. No data migration needed (nulls are valid)

### Phase 3: Invite Team (Viewers)
1. Invite coworkers
2. Set them as "viewer" role
3. They can see all jobs (read-only initially)
4. Start assigning jobs to them
5. They can now edit their assigned jobs

### Phase 4: Full Team Adoption
- All existing jobs visible to team
- New jobs get created_by set automatically
- Assign jobs as needed
- Team filters work as expected

**No data loss - existing jobs remain accessible to everyone**

---

## 🚀 Launch Checklist

Before inviting team:
- [ ] Authentication configured (Clerk/NextAuth)
- [ ] Your account set as admin
- [ ] Test account created as viewer
- [ ] Verified viewer cannot create jobs
- [ ] Verified viewer can edit assigned jobs
- [ ] Verified assignment filtering works
- [ ] Map views toggle correctly
- [ ] Role badges display properly

Inviting team:
- [ ] Send invite links
- [ ] Set roles appropriately
- [ ] Assign existing jobs if needed
- [ ] Walk through UI with team
- [ ] Collect feedback

---

## 💡 Future Team Features

### Notifications (Phase 4)
- Job assigned to you → notification
- Job details updated → notify assigned users
- Day-before reminder → push notification
- Weather alert → notify if severe weather

### Team Chat (Maybe Later)
- Per-job chat thread
- Team-wide announcements
- Question/answer on specific jobs

### Performance Tracking (Analytics)
- Jobs completed per team member
- Travel frequency by user
- Equipment usage patterns
- Client preferences per user

### Resource Scheduling
- Equipment assignment tracking
- Vehicle assignment
- Prevent double-booking

---

## 📞 Team Communication Flow

### Job Created (Admin)
1. Admin creates job
2. (Future) Notification sent to team: "New job: Acme Corp Event"
3. Team can view in Team tab

### Job Assigned (Admin)
1. Admin assigns Chris + Mike
2. (Future) Notification: "You've been assigned to Acme Corp Event"
3. Appears in their "My Jobs" tab
4. They can edit travel details

### Job Updated (Anyone)
1. Mike updates hotel check-in time
2. (Future) Notification to Chris: "Mike updated Acme Corp Event"
3. Changes visible to admin immediately

### Job Completed (Admin)
1. Admin marks job complete
2. (Future) Notification to team: "Acme Corp Event completed"
3. Wrap-up generated and shared

---

## 🎯 Benefits of Team Mode

### For Admin (You)
- See all team travel at once (map overview)
- Coordinate schedules - avoid conflicts
- Track who's working what jobs
- Delegate job updates to team
- Less manual data entry

### For Team (Coworkers)
- Access job details anytime (mobile-friendly)
- Update their own travel info
- Check checklists on-site
- Add photos from events
- View complete briefings

### For Business
- Better team coordination
- Reduced communication overhead
- Historical job data for all team
- Knowledge sharing (venue notes, client preferences)
- Professional job tracking

---

## 🔐 Security & Privacy

### What Team Sees
✅ **Can See:**
- All job details (client, venue, dates)
- All travel info (flights, hotels)
- Job notes and checklists
- Photos and products
- Contact information

❌ **Cannot See:**
- Other users' personal data (beyond name/avatar)
- Financial information (unless you add it)
- Private admin notes (if you implement that)

### Data Access
- Everyone in your organization sees everything
- No job-level privacy (all team needs access)
- If need privacy: Use different workspace/org

---

## 📝 Getting Started Today

Even without auth, you can start using team features mentally:

1. **Create jobs with team in mind**
   - Add team member names to job notes
   - Use consistent naming for recurring team events
   
2. **Build the habit**
   - Update jobs in real-time
   - Add photos from events
   - Document venue issues for next time

3. **Prepare for handoff**
   - When auth is added, invite team
   - They'll see all existing jobs
   - No migration or data transfer needed

---

**Everything is ready - just add auth when you're ready to invite the team! 🎉**
