# Authentication Setup Guide

**Status:** Prepared but not implemented  
**When you're ready:** Follow this guide to add user authentication and roles

---

## 🎯 What's Already Prepared

Your app is **auth-ready**. All the groundwork is done:

### ✅ Data Structures
- **User fields added to Fldr type:**
  - `created_by: string | null` - User ID of job creator
  - `assigned_to: string[] | null` - Array of user IDs assigned to job
- **Currently set to `null`** - will populate automatically once auth is active

### ✅ Helper Functions
- `src/lib/auth.ts` - Complete auth utility library (currently returns mock data)
  - `getCurrentUser()` - Get logged-in user
  - `isAdmin()` - Check admin role
  - `canEditJob()` - Permission checking
  - `filterJobsByUser()` - Filter jobs by user/team
  - `getUserDisplayName()` - User name lookup

### ✅ UI Components
- **RoleBadge** component (`src/components/RoleBadge.tsx`)
  - Shows admin/viewer badge
  - Currently shows "Dev Mode" indicator
- **View mode toggles** in Jobs and Map pages
  - Team view (all jobs)
  - My Jobs view (assigned jobs only)
- **Permission-based UI** ready to conditionally hide edit buttons

### ✅ Database Schema
See [SCHEMA.sql](schema.sql) - ready for user tables

---

## 🚀 Implementation Steps (When Ready)

### **Option 1: Clerk.com (Recommended - 2-3 hours)**

#### Why Clerk?
- ✅ Free tier: 5,000 monthly active users
- ✅ Built-in UI components
- ✅ Google SSO + email/password
- ✅ Role management via metadata
- ✅ Production-ready security

#### Step 1: Sign up & Create App
```bash
# Visit https://clerk.com and create account
# Create new application
# Get your publishable key and secret key
```

#### Step 2: Install Clerk
```bash
npm install @clerk/nextjs
```

#### Step 3: Add Environment Variables
```env
# .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Optional: Customize appearance
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/jobs
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/jobs
```

#### Step 4: Wrap App with ClerkProvider
**File:** `src/app/layout.tsx`

```tsx
import { ClerkProvider } from '@clerk/nextjs'

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

#### Step 5: Create Auth Pages
```bash
# Create sign-in and sign-up pages
npx @clerk/nextjs@latest
```

Or manually:

**File:** `src/app/sign-in/[[...sign-in]]/page.tsx`
```tsx
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn />
    </div>
  )
}
```

**File:** `src/app/sign-up/[[...sign-up]]/page.tsx`
```tsx
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp />
    </div>
  )
}
```

#### Step 6: Protect Routes with Middleware
**File:** `src/middleware.ts` (create this file)

```typescript
import { authMiddleware } from '@clerk/nextjs'

export default authMiddleware({
  // Public routes (no auth required)
  publicRoutes: ['/'],
  
  // All other routes require authentication
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

#### Step 7: Update Auth Helper Functions
**File:** `src/lib/auth.ts`

Replace mock functions with real Clerk functions:

```typescript
import { useUser, useAuth } from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server' // for server components

export function getCurrentUser(): User | null {
  const { user } = useUser() // Client component
  // OR const user = await currentUser() // Server component
  
  if (!user) return null
  
  return {
    id: user.id,
    name: user.fullName || user.username || 'User',
    email: user.primaryEmailAddress?.emailAddress || '',
    role: (user.publicMetadata.role as UserRole) || 'viewer',
    avatar: user.imageUrl
  }
}

export function isAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'admin'
}

// Rest of the functions stay the same - they already check user.role
```

#### Step 8: Set User Roles in Clerk Dashboard
1. Go to Clerk Dashboard → Users
2. Click on a user
3. Go to "Metadata" tab
4. Add to **Public Metadata**:
   ```json
   {
     "role": "admin"
   }
   ```
5. For admins: `"role": "admin"`
6. For viewers: `"role": "viewer"`

#### Step 9: Update Job Creation to Set Creator
**File:** `src/app/api/fldrs/route.ts`

```typescript
import { auth } from '@clerk/nextjs'

export async function POST(request: NextRequest) {
  const { userId } = auth() // Get current user ID
  
  // ... existing code ...
  
  const fldr = fldrStore.create({
    ...newFldrData,
    created_by: userId, // Set creator
    assigned_to: null   // Can be set later
  })
}
```

#### Step 10: Add User Assignment UI
Add to job detail page:

```tsx
import { useUser } from '@clerk/nextjs'

// In job detail page component:
const [assignedUsers, setAssignedUsers] = useState<string[]>(fldr.assigned_to || [])

// UI for assigning users (admin only)
{isAdmin() && (
  <div className="card">
    <h3>Assign Team Members</h3>
    <UserSelector 
      selected={assignedUsers}
      onChange={setAssignedUsers}
    />
  </div>
)}
```

---

### **Option 2: NextAuth (Auth.js) - More Control**

If you want more control and don't want third-party dependency:

1. Install NextAuth: `npm install next-auth`
2. Create `src/app/api/auth/[...nextauth]/route.ts`
3. Set up providers (Google, Email, etc.)
4. Create user database table
5. Replace functions in `src/lib/auth.ts` with NextAuth calls

**Pros:**
- More control over user data
- No external dependency
- Store users in your own database

**Cons:**
- More setup time (6-8 hours)
- You manage security yourself
- Need to handle edge cases

---

## 📊 Database Updates Required

Once auth is implemented, update your D1 database:

### Add Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK(role IN ('admin', 'viewer')) DEFAULT 'viewer',
  avatar TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_email ON users(email);
```

### Update Fldrs Table
```sql
-- Add user columns to existing fldrs table
ALTER TABLE fldrs ADD COLUMN created_by TEXT REFERENCES users(id);
-- Note: SQLite doesn't support arrays, so assigned_to will need a junction table

CREATE TABLE fldr_assignments (
  fldr_id TEXT NOT NULL REFERENCES fldrs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (fldr_id, user_id)
);

CREATE INDEX idx_fldr_assignments_user ON fldr_assignments(user_id);
CREATE INDEX idx_fldr_assignments_fldr ON fldr_assignments(fldr_id);
```

---

## 🎨 UI Updates After Auth

### 1. Header with User Info
```tsx
import { UserButton } from '@clerk/nextjs' // Shows user avatar + dropdown

<div className="flex items-center gap-3">
  <RoleBadge />
  <UserButton afterSignOutUrl="/" />
</div>
```

### 2. Conditional Edit Buttons
Already prepared! The `canEditJob()` function will work automatically.

```tsx
// Already in your code - will work once auth is active
{canEditJob(fldr.created_by, fldr.assigned_to) && (
  <button onClick={handleEdit}>Edit</button>
)}
```

### 3. Filter Views
Already working! The view toggles will automatically filter based on user.

---

## 🧪 Testing with Multiple Users

### Test Accounts Setup
1. Create 2-3 test accounts
2. Set one as admin: `"role": "admin"` in Clerk metadata
3. Set others as viewer: `"role": "viewer"`
4. Create jobs as admin
5. Assign jobs to specific viewers
6. Log in as viewer - should only see assigned jobs in "My Jobs" view

### Test Scenarios
- ✅ Admin can see all jobs
- ✅ Viewer can see all jobs in "Team" view
- ✅ Viewer only sees assigned jobs in "My Jobs" view
- ✅ Admin can edit any job
- ✅ Viewer can only edit assigned jobs
- ✅ Job creator is tracked
- ✅ Assigned users are saved

---

## 💰 Cost Estimate

**Clerk Free Tier:**
- 5,000 monthly active users
- Unlimited applications
- Social logins (Google, etc.)
- Email/password
- Basic features

**You'll stay free with a team of 3-10 users easily.**

**If you exceed limits:**
- Clerk Pro: $25/month (10,000 MAU)
- Still way cheaper than custom auth maintenance

---

## 🔐 Security Checklist

Before going live:
- [ ] All API routes check `auth()` from Clerk
- [ ] Viewer role cannot delete jobs
- [ ] Viewer role cannot edit unassigned jobs
- [ ] Created_by field is set on all new jobs
- [ ] Assigned_to field can only be modified by admins
- [ ] Test with multiple browsers/incognito
- [ ] Test permission boundaries thoroughly

---

## 📝 Next Steps When Ready

1. **Choose Clerk** (recommended) or NextAuth
2. **Install and configure** (2-3 hours)
3. **Invite team members** (5 minutes)
4. **Set roles** in dashboard (5 minutes)
5. **Test with real team** (30 minutes)
6. **Go live!** 🎉

---

## 🆘 Need Help?

- **Clerk Docs:** https://clerk.com/docs
- **Clerk Discord:** https://discord.com/invite/clerk
- **NextAuth Docs:** https://authjs.dev/

**Everything is ready - just plug in the auth provider of your choice!**
