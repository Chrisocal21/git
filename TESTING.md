# GIT PWA Testing Checklist

## Phase 9: Manual Testing Guide

### 1. PWA Installation Testing

#### iOS (Safari)
- [ ] Open https://git-chrisoc.vercel.app in Safari
- [ ] Tap Share button → "Add to Home Screen"
- [ ] Verify app icon appears on home screen
- [ ] Launch app from home screen
- [ ] Verify it opens in standalone mode (no Safari UI)
- [ ] Check status bar style (should be dark)
- [ ] Verify app title shows as "GIT"

#### Android (Chrome)
- [ ] Open https://git-chrisoc.vercel.app in Chrome
- [ ] Look for "Install app" prompt or menu option
- [ ] Install the PWA
- [ ] Verify app icon appears in app drawer
- [ ] Launch app from app drawer
- [ ] Verify standalone mode (no browser chrome)
- [ ] Check theme color (dark)

#### Desktop (Chrome/Edge)
- [ ] Open https://git-chrisoc.vercel.app
- [ ] Click install icon in address bar (or menu → Install)
- [ ] Verify PWA opens in separate window
- [ ] Check that it behaves like a native app

### 2. Offline Mode Testing

#### Offline Creation
- [ ] Go offline (airplane mode or disable network)
- [ ] Create a new Fldr
- [ ] Verify it saves locally
- [ ] Check for offline indicator (red dot)
- [ ] Add modules and data
- [ ] Verify changes persist in localStorage

#### Offline Editing
- [ ] With existing Fldr open, go offline
- [ ] Edit Quick Reference fields
- [ ] Add checklist items
- [ ] Add people
- [ ] Write notes
- [ ] Verify "Unsynced changes" banner appears
- [ ] Check that edits persist on page refresh

#### Online Sync
- [ ] Go back online
- [ ] Verify online indicator (green dot) appears
- [ ] Click "Sync Now" button
- [ ] Verify sync completes without errors
- [ ] Refresh page and confirm data persisted
- [ ] Verify "Unsynced changes" banner disappears

#### Service Worker Caching
- [ ] Load app while online
- [ ] Go offline
- [ ] Navigate between pages (List → Detail → Create)
- [ ] Verify all UI loads (HTML, CSS, JS cached)
- [ ] Check that icons and images load
- [ ] Verify no broken resources

### 3. Data Import Testing

#### Import Flow
- [ ] Navigate to /import page
- [ ] Verify old trips load from D1
- [ ] Select multiple trips to import
- [ ] Click "Import Selected Jobs"
- [ ] Verify progress feedback
- [ ] Check console for errors
- [ ] Confirm jobs appear in main list

#### Import Data Integrity
- [ ] Open imported job
- [ ] Verify Quick Reference fields populated
- [ ] Check Job Info data
- [ ] Verify Pre-Trip Checklist items
- [ ] Check People/contacts imported
- [ ] Verify Notes present
- [ ] Confirm dates and status correct

### 4. Copy Button Testing

#### Quick Reference
- [ ] Open a Fldr with hotel address
- [ ] Click copy button on hotel address
- [ ] Verify button shows checkmark
- [ ] Paste into another app (verify clipboard)
- [ ] Test onsite address copy

#### Contact Info
- [ ] Test copy on client phone
- [ ] Test copy on client email
- [ ] Test copy on person phone (in People module)
- [ ] Test copy on person email
- [ ] Verify all show visual feedback

### 5. Status Flow Testing

#### Job Lifecycle
- [ ] Create new Fldr (should be 'incomplete')
- [ ] Fill in required data
- [ ] Click "Activate Job"
- [ ] Verify status changes to 'active'
- [ ] Click "Mark Complete"
- [ ] Verify status changes to 'complete'
- [ ] Test "Mark Ready" button (from active)

#### Filter Testing
- [ ] Go to list page
- [ ] Click "All" filter (should show all)
- [ ] Click "Upcoming" (show incomplete + ready)
- [ ] Click "Active" (show only active)
- [ ] Click "Complete" (show only complete)
- [ ] Verify counts are correct

### 6. UI/UX Polish Testing

#### Loading States
- [ ] Navigate to list page (clear cache first)
- [ ] Verify skeleton loader shows
- [ ] Navigate to detail page
- [ ] Verify skeleton loader shows
- [ ] Create new Fldr
- [ ] Check that save states are clear

#### Mobile Responsiveness
- [ ] Test on phone (<375px width)
- [ ] Test on tablet (768px width)
- [ ] Verify text is readable
- [ ] Check touch targets are large enough
- [ ] Verify forms are usable
- [ ] Test landscape orientation

#### Dark Mode
- [ ] Verify all components use dark theme
- [ ] Check contrast ratios for readability
- [ ] Verify form inputs are visible
- [ ] Check that borders are subtle but present

### 7. Edge Cases & Error Handling

#### Empty States
- [ ] New user with no Fldrs (verify empty state message)
- [ ] Fldr with no modules enabled
- [ ] Empty checklists / people arrays
- [ ] Missing optional fields (location, end date, etc.)

#### Validation
- [ ] Try to create Fldr without title
- [ ] Try to create Fldr without start date
- [ ] Try to save invalid data
- [ ] Test date picker behavior

#### Network Errors
- [ ] Kill network mid-save
- [ ] Verify graceful offline fallback
- [ ] Test reconnection handling
- [ ] Verify no data loss

### 8. Performance Testing

#### Load Time
- [ ] Measure FCP (First Contentful Paint)
- [ ] Check LCP (Largest Contentful Paint)
- [ ] Verify CLS (Cumulative Layout Shift) is low
- [ ] Test with throttled network (Fast 3G)

#### Lighthouse Audit
- [ ] Run Lighthouse audit (Chrome DevTools)
- [ ] Target scores:
  - Performance: 90+
  - Accessibility: 95+
  - Best Practices: 95+
  - SEO: 90+
  - PWA: 100

#### Bundle Size
- [ ] Check JS bundle size in network tab
- [ ] Verify lazy loading for modules
- [ ] Check for unnecessary dependencies

### 9. Cross-Browser Testing

#### Desktop
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

#### Mobile
- [ ] iOS Safari (latest)
- [ ] Android Chrome (latest)
- [ ] Android Firefox (if available)

### 10. AI Features Testing

#### Wrap-up Generation
- [ ] Add notes to a Fldr
- [ ] Click "Generate Wrap-up"
- [ ] Verify loading state ("Generating Wrap-up...")
- [ ] Check that wrap-up is coherent and useful
- [ ] Test with different note lengths
- [ ] Verify error handling if API fails

## Known Issues
(Document any issues found during testing here)

## Test Environment
- Deployment URL: https://git-chrisoc.vercel.app
- Test Date: ___________
- Tester: ___________
- Devices Tested: ___________

## Notes
(Add any additional observations or suggestions here)
