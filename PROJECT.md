# Project Handoff Document
### GIT - Get It Together
#### Personal Operations System
**Version:** 1.0  
**Date:** February 8, 2026  
**For:** Claude in VS Code (Builder)

---

## 📑 Document Navigation

| Section | What It Covers |
|---------|----------------|
| [1. Project Overview](#1-project-overview) | What this app is, who it's for, core philosophy |
| [2. Tech Stack](#2-tech-stack) | Framework, hosting, database, app type |
| [3. App Structure](#3-app-structure) | Three modes, bottom nav, naming |
| [4. UI Structure](#4-ui-structure) | App open state, navigation, layout |
| [5. Data Structure](#5-data-structure) | Fldr object schema, all fields |
| [6. Screens & Flows](#6-screens--flows) | Each mode's screens and user journeys |
| [7. Tone Profile](#7-tone-profile) | Chris's writing voice for AI polish features |
| [8. Offline Requirements](#8-offline-requirements) | What caches locally, what needs connection |
| [9. Design Specs](#9-design-specs) | Dark mode, mobile-first, visual indicators |
| [10. Existing Assets](#10-existing-assets) | What to preserve, what to discard |
| [11. Future Considerations](#11-future-considerations) | Layers to add later |
| [12. Build Phases](#12-build-phases) | Step-by-step build order |

---

## 1. Project Overview
> **What this section covers:** The big picture - what we're building and why

### What It Is
A personal operations system for a production manager who travels for on-site laser engraving jobs and manages in-house production. 

Three modes:
- **Fldr** - Job/event folders with organized info, notes, wrap-up assist
- **Write** - Message polisher using personal tone profile
- **Prod** - Production management (future, placeholder for now)

### Who It's For
Single user (Chris). Solo tool - no collaboration features, no shared access, no multi-user.

### Core Philosophy
- **Control and clarity in chaos** - one place for everything
- **Mobile-first, desktop-capable** - phone is primary, browser for prep/wrap-up
- **Copy/paste over API integrations** - no dependencies on external services
- **Offline access for critical info** - works without connection
- **User is the hub** - the app organizes and elevates, user stays in control

---

## 2. Tech Stack
> **What this section covers:** Technical foundation and requirements

| Component | Choice |
|-----------|--------|
| **Framework** | Next.js |
| **Hosting** | Vercel |
| **Database** | Cloudflare D1 (existing job history to preserve) |
| **App Type** | PWA (Progressive Web App) |

### PWA Requirements
- Installable on phone home screen
- Works in desktop browser
- **Hard refresh capability** - user can force clear cache and sync fresh data
- Offline caching for critical trip info (see [Section 8](#8-offline-requirements))

---

## 3. App Structure
> **What this section covers:** The three modes and how they're named

### Bottom Navigation (Always Visible)
Three icons, always accessible:

| Nav Item | Full Name | Purpose |
|----------|-----------|---------|
| **Fldr** | Folders | Job trips + personal events organized in folders |
| **Write** | Write | Message polisher with tone profile |
| **Prod** | Production | In-house production management (future) |

### Mode Details

**Fldr (Primary)**
- Work trips with full job info, travel details, notes
- Personal events (birthdays, plans) with flexible fields
- One flexible template - use the fields you need

**Write**
- Standalone message composition
- Two polish levels: Light / Full Suit
- Optional: paste original message for reply context

**Prod**
- Placeholder for now
- Shows "Coming soon" or empty state when tapped
- Will be built once user understands job requirements

---

## 4. UI Structure
> **What this section covers:** What the user sees and how they navigate

### App Open State
When the app opens → **Show next upcoming Fldr** (by date)

If no upcoming Fldrs → Show Fldr list or empty state with create option

### Navigation Pattern
- **Bottom nav** - 3 icons always visible (Fldr / Write / Prod)
- Tap to switch modes
- Current mode highlighted

### Inside a Fldr
Expandable/collapsible cards, stacked top to bottom:

| Order | Card | Purpose |
|-------|------|---------|
| 1 | **Quick Reference** | Addresses, flight, hotel - need constantly while traveling |
| 2 | **Pre-trip Info** | Team members, pre-engrave details - need before leaving |
| 3 | **Job Info** | Client contact, event details, reference links - need on-site |
| 4 | **Notes** | Capture throughout, wrap-up at end - grows over time |

Cards expand/collapse on tap. Start collapsed by default.

### Visual Indicators
- **Incomplete Fldr** - subtle highlight on card (color border, icon, or background shift) indicating missing info
- **Complete Fldr** - clean/normal appearance

---

## 5. Data Structure
> **What this section covers:** The Fldr object schema - all fields and their types

### Fldr Object (Flexible Container)

```javascript
Fldr {
  // Core (required)
  id: string
  title: string
  date_start: date
  
  // Core (optional)
  date_end: date | null
  location: string | null  // city, state
  status: enum ["incomplete", "ready", "active", "complete"]
  
  // === MODULES (all optional, add as needed) ===
  
  // Quick Reference Module
  quick_reference: {
    flight_info: string | null
    hotel_name: string | null
    hotel_address: string | null
    onsite_address: string | null
    local_airport: string | null
    departure_airport: string | null
  } | null
  
  // Job Info Module (for work trips)
  job_info: {
    client_name: string | null
    item: string | null  // product being engraved
    quantity: number | null
    job_type: enum ["caricatures", "names_monograms"] | null
    client_contact_name: string | null
    client_contact_phone: string | null
    client_contact_email: string | null
    event_details: string | null
    reference_links: [
      { label: string, url: string }
    ]
    team_members: [string]
    pre_engrave_details: string | null
  } | null
  
  // Checklist Module (for any Fldr type)
  checklist: [
    { item: string, completed: boolean }
  ] | null
  
  // People Module (for any Fldr type)
  people: [
    { 
      name: string, 
      role: string | null, 
      phone: string | null, 
      email: string | null 
    }
  ] | null
  
  // Notes (always available)
  notes: string  // open text field
  
  // Meta
  created_at: timestamp
  updated_at: timestamp
}
```

### Usage Patterns

**Work Trip:**
- Uses: quick_reference, job_info, notes
- Full fields populated over time as info trickles in

**Personal Event (birthday, vacation):**
- Uses: checklist, people, notes
- Simpler, flexible

**Both:**
- Same container, different modules activated
- User adds what they need

---

## 6. Screens & Flows
> **What this section covers:** Each screen and how users move through them

### Fldr Mode Screens

**1. Fldr List**
- Shows all Fldrs
- Upcoming first (sorted by date_start)
- Subtle highlight on incomplete Fldrs
- Tap card → opens that Fldr

**2. Fldr Detail View**
- Shows the four expandable cards (Quick Ref, Pre-trip, Job Info, Notes)
- Cards collapse/expand on tap
- All fields editable inline
- Wrap-up Assist button inside Notes card

**3. Create Fldr**
- Minimal required: title, date_start
- Everything else optional/blank
- Can add modules as needed (checklist, people, job_info, etc.)
- Save creates Fldr, user fills in as info arrives

**4. Edit Fldr**
- Tap any field to update
- Auto-saves or explicit save button
- Add/remove modules as needed

**5. Wrap-up Assist (inside Fldr)**
- Button in Notes card
- Takes notes content → generates wrap-up draft using tone profile
- User reviews, edits, copies to Slack
- Uses "Full Suit" tone by default

### Write Mode Screens

**1. Compose Screen**
- Two text fields:
  - **Original message** (optional) - paste what you're replying to
  - **Your draft** - write your raw message
- Toggle: **Light** / **Full Suit**
- Button: Polish

**2. Output Screen (or inline)**
- Shows polished text
- Copy button
- Option to re-polish or edit

### Write Polish Levels

| Level | What It Does |
|-------|--------------|
| **Light** | Grammar + clarity, stays close to original, still sounds like Chris |
| **Full Suit** | Restructured, professional, thorough - dressed up version of Chris |

### Prod Mode Screens

**1. Placeholder**
- "Coming soon" message
- Or empty state
- No functionality yet

---

## 7. Tone Profile
> **What this section covers:** Chris's writing voice for AI-powered polish features

### Tone Profile v1.2

```javascript
ToneProfile {
  // How to handle different situations
  problems: "Soften delivery, explain what happened + how it was resolved"
  accountability: "Own mistakes with reflection - 'In hindsight, I should have...' - not self-deprecation"
  credit_to_others: "Simple and direct - don't over-explain why someone was good"
  external_issues: "Acknowledge without blame, give context without over-saturating"
  good_news: "Let it breathe - share positive feedback with warmth"
  followups: "Add closure - show the thread is handed off, not dangling"
  
  // Overall characteristics
  vibe: "Thorough and considerate - reader feels you thought it through"
  length: "Always give substance, even on smooth jobs"
  signoff: "Cheers!"  // Always end with this
  
  // Polish levels
  polish_levels: {
    light: "Grammar + clarity, stays close to original, maintains Chris's voice"
    full_suit: "Restructured, professional, thorough - polished but still Chris"
  }
}
```

### Example Application

**Raw input (notes):**
> "table got bumped a few times, lost 6 tags. staff was nice tho. client happy overall"

**Full Suit output:**
> "We worked around some space limitations that contributed to a few issues. The table provided was not fully stable, and occasional bumps caused some mirror misfires, resulting in 6 luggage tags lost. The event staff was great and very accommodating despite the constraints. Overall, feedback from the client was positive.
>
> Cheers!"

---

## 8. Offline Requirements
> **What this section covers:** What works without internet, what needs connection

### Cached Locally (Available Offline)

| Data | Why |
|------|-----|
| All Quick Reference data | Need addresses, flight, hotel while traveling |
| Job Info | Need client contact, event details on-site |
| Notes | Must be able to capture without connection |
| Checklist | Need to check off items anywhere |

### Offline Behavior
- Notes save locally, sync when back online
- No data loss if connection drops mid-job
- Visual indicator if unsynced data exists

### Requires Connection

| Feature | Why |
|---------|-----|
| Creating new Fldrs | Needs database write |
| Wrap-up Assist | Needs AI processing |
| Write mode polish | Needs AI processing |
| Syncing changes | Needs database connection |

---

## 9. Design Specs
> **What this section covers:** Visual design requirements

### Theme
- **Dark mode** - primary and only theme (no light mode toggle needed)

### Responsive Priority
- **Mobile-first** - designed for phone, works on desktop
- Touch targets sized for thumbs
- Bottom nav for easy one-handed use

### Visual States

| State | Indicator |
|-------|-----------|
| Incomplete Fldr | Subtle highlight (border, background, or icon) |
| Complete Fldr | Clean/normal appearance |
| Unsynced data | Small indicator showing pending sync |
| Offline mode | Subtle banner or icon |

### Interaction Patterns
- **Copy buttons** - for any info user might need in another app (addresses, flight info, etc.)
- **Tap to expand** - cards in Fldr detail view
- **Inline editing** - tap field to edit, no separate edit screen needed
- **No external app integrations** - everything is copy/paste out

---

## 10. Existing Assets
> **What this section covers:** What to keep vs. rebuild

### Preserve
- **Cloudflare D1 database** - contains past job history
- Connect new app to existing database
- Import/display historical job data

### Discard
- **Old TripFldr codebase** - full rebuild, fresh start
- No code migration needed

### Database Consideration
- May need schema migration to support new Fldr structure
- Preserve old job data, map to new format where possible

---

## 11. Future Considerations
> **What this section covers:** Features to add later, not in initial build

### Layer 2: Contextual Intelligence (Future)
- **Maps** - tap address to copy, or mini-map showing locations
- **Weather** - auto-pull forecast for trip location/dates
- **Time zone awareness** - know when team is available
- **Local spots** - restaurants, coffee near hotel/job site
- **Photo uploader** - module for uploading and organizing trip photos

### Layer 3: Timeline View (Future)
- Timestamped notes within a Fldr
- Chronological view of what happened when
- Makes wrap-up writing easier

### Layer 4: Cross-Trip Memory (Future)
- "Last time at this hotel..."
- "This client prefers..."
- Historical context surfaced when relevant

### Layer 5: Prod Mode (Future)
- In-house job tracking
- Team/operator status
- Communication log
- Still feeds through tone profile for outbound messages

### Reply Analysis (Future)
- In Write mode, analyze original message
- Pull out key points/questions as checklist
- Ensure reply addresses everything

---

## Quick Reference for Builder

### Immediate Build Priority
1. Fldr mode - create, view, edit Fldrs with expandable cards
2. Write mode - compose with Light/Full Suit polish
3. Offline caching for critical data
4. PWA setup with hard refresh

### Don't Build Yet
- Prod mode (placeholder only)
- Maps/weather/local spots
- Timeline view
- Cross-trip memory
- Any external API integrations

### Key Principles to Remember
- Mobile-first, always
- Copy/paste, never deep integrations
- User is the hub
- Dark mode only
- Offline-capable for critical info
- Tone profile powers all AI features

---

## 12. Build Phases
> **What this section covers:** Step-by-step build order - complete each phase before moving to next

### Phase 1: Foundation
**Goal:** App shell with navigation

- [x] Next.js project setup
- [x] Vercel deployment configuration
- [x] PWA manifest and service worker setup
- [x] Dark mode theme/styling foundation
- [x] Bottom nav with three icons (Fldr / Write / Prod)
- [x] Prod shows placeholder "Coming soon"
- [x] Mobile-first responsive layout

**Milestone:** App opens, nav works, dark mode, installable as PWA ✅

---

### Phase 2: Fldr Core
**Goal:** Create and view Fldrs

- [x] Cloudflare D1 database connection (using in-memory store for development)
- [x] Fldr data schema implementation
- [x] Create Fldr screen (minimal: title, date_start)
- [x] Fldr list view (sorted by date, upcoming first)
- [x] Fldr detail view with expandable cards
- [x] Card order: Quick Reference → Pre-trip → Job Info → Notes
- [x] Expand/collapse interaction

**Milestone:** Can create a Fldr, see it in list, tap to view cards ✅

---

### Phase 3: Fldr Editing
**Goal:** Fill in and update Fldr info

- [x] Inline field editing (tap to edit)
- [x] All Quick Reference fields editable
- [x] All Job Info fields editable
- [x] Reference links with label + URL
- [x] Team members list
- [x] Notes open text field
- [x] Auto-save or explicit save
- [x] Incomplete Fldr visual indicator

**Milestone:** Can fully populate a work trip Fldr ✅

---

### Phase 4: Flexible Modules
**Goal:** Support personal events, not just work trips

- [x] Checklist module (add items, check off)
- [x] People module (name, role, phone, email)
- [x] Add/remove modules from any Fldr
- [x] Modules only show if activated

**Milestone:** Can create birthday or vacation Fldr with checklist ✅

---

### Phase 5: Write Mode
**Goal:** Message polisher standalone

- [x] Compose screen with two fields (original message, draft)
- [x] Light / Full Suit toggle
- [x] AI integration for polish (OpenAI or similar)
- [x] Tone profile implementation (see Section 7)
- [x] Output display with copy button
- [x] Both polish levels use tone profile

**Milestone:** Can write message, polish it, copy to clipboard ✅

---

### Phase 6: Wrap-up Assist
**Goal:** Turn Fldr notes into wrap-up draft

- [x] Wrap-up Assist button in Notes card
- [x] Takes notes → generates wrap-up using Full Suit tone
- [x] Output displays in-app for review
- [x] User can edit before copying
- [x] Copy button for Slack paste

**Milestone:** Can write notes during trip, generate wrap-up at end ✅

---

### Phase 7: Offline & Sync
**Goal:** Works without connection

- [x] Cache Quick Reference data locally
- [x] Cache Job Info locally
- [x] Cache Notes locally with local saves
- [x] Sync when connection restored
- [x] Unsynced data indicator
- [x] Hard refresh option (clear cache, force sync)

**Milestone:** Can view trip info and take notes without internet ✅

---

### Phase 8: History Migration
**Goal:** Bring in old job data

- [x] Connect to existing Cloudflare D1 with past jobs
- [x] Map old schema to new Fldr structure
- [x] Import historical jobs as completed Fldrs
- [x] Display in Fldr list (past jobs section or filter)
- [x] Add manual job activation buttons
- [x] Fix status logic for imported jobs

**Milestone:** Old TripFldr job history accessible in new app ✅

---

### Phase 9: Polish & QA
**Goal:** Production ready

**Completed:**
- [x] Copy buttons on all address/contact/phone/email fields
- [x] Edit mode for fldr title, dates, and location
- [x] Skeleton loaders for better loading states
- [x] Fixed PWA manifest deprecation warnings
- [x] Debounced auto-save with "last saved" timestamp
- [x] Service worker cache optimization (network-first for APIs)
- [x] Storage health monitoring and defensive caching
- [x] D1 database integration for cross-device sync
- [x] Comprehensive console logging for debugging

**Ready to Test:**
- [ ] Test D1 sync between devices (edit on Computer A, see on Computer B)
- [ ] Test all flows on mobile
- [ ] Test all flows on desktop browser
- [ ] PWA install flow tested (iOS + Android)
- [ ] Offline mode tested thoroughly
- [ ] Performance optimization (Lighthouse audit)
- [ ] Final bug sweep

**What Works Now:**
- Auto-save with visual feedback
- Cross-device sync via Cloudflare D1
- Offline-first architecture with localStorage
- PWA installable on all platforms
- Service worker caching for offline use
- Edit mode for all core properties
- Copy buttons for mobile convenience

**Milestone:** App ready for daily use ✅

---

### Future Phases (Not Now)
- Maps integration
- Weather for trip locations
- Timeline view for notes
- Cross-trip memory
- Prod mode buildout

---

*End of Handoff Document*
