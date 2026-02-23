# GIT - Development Roadmap
**Ship small, learn fast**

---

## 🎯 Core Project - Still Needed

### Waste/Loss Tracking Module ✅
**Why:** Track materials lost/wasted during jobs  
**What:** Quantity lost, reason/context, cost impact, aggregated view  
**Status:** Shipped - +/- controls on each product, live summary stats (Feb 22)

### Notes Enhancements
**Why:** Better note-taking experience  
**What:** Full-screen editing mode, rich text (bold/bullets), separate personal notes  
**Status:** Original spec enhancement

### Mini Workspace (Docs/Sheets)
**Why:** Personal documents not tied to jobs  
**What:** Simple spreadsheet (20x20 grid), plain text docs, CSV export  
**Where:** Prod tab or side menu  
**Status:** Planned workspace feature

### Google Maps Autocomplete ✅
**Why:** Faster address entry  
**What:** Address autocomplete when typing  
**Setup:** Need to add API key to Vercel  
**Status:** Shipped - Code ready, just add API key (see GOOGLE_MAPS_SETUP.md)

---

## 🚀 Quick Wins (1-2 hrs each)

### Duplicate Job ✅
**What:** Copy existing job to new dates  
**Why:** Recurring clients/venues = huge time saver  
**Status:** Shipped - "Duplicate" button in fldr header

### Time Zone Display ✅
**What:** Show current time at destination  
**Why:** Coordinate calls, know venue hours  
**Status:** Shipped - San Diego home clock (always visible) + location time in job header

### Export Job as PDF
**What:** Print/save job details  
**Why:** Send to client, archive records

### QR Code Generation
**What:** QR for venue address, WiFi, contacts  
**Why:** Easy sharing with team/client

### Currency Converter
**What:** Show USD equivalent for international jobs  
**Why:** Instant cost clarity

---

## 📦 Essential Modules (3-5 hrs each)

### Expenses Tracker
**What:** Track per-job expenses (meals, Uber, materials)  
**Features:** Running total vs budget, photo receipts, export CSV  
**Why:** Every job has expenses, currently untracked

### Equipment Checklist
**What:** Master packing list + per-job tracker  
**Features:** Check off as packed, maintenance notes, "Did I pack...?" search  
**Why:** Never forget critical equipment

### Time Tracker
**What:** Clock in/out for billable hours  
**Features:** Break tracking, export timesheet  
**Why:** Accurate billing, labor compliance

### Job Templates
**What:** Save job configs as reusable templates  
**Examples:** "Vineyard Wedding", "Medical Conference"  
**Why:** 10+ recurring job types = massive speed boost

---

## 🤖 AI Features (5-8 hrs each)
*Uses existing OpenAI API key*

### Email Parser
**What:** Paste email → auto-extract data  
**Extracts:** Flights, hotels, dates, confirmations, client info  
**Why:** Eliminates 80% of manual data entry

### Photo Intelligence
**What:** AI analyzes photos  
**Uses:** Count items, receipt OCR, setup verification  
**Why:** Quality control, expense tracking

### Voice Transcription
**What:** Record audio → auto-transcribed  
**Why:** Hands-free note-taking while setting up

### Predictive Assistant
**What:** AI suggests based on past jobs  
**Examples:** "You usually pack X for this type", "WiFi was poor here last time"  
**Why:** Learn from experience

---

## ⚙️ Workflow Automation (8-12 hrs each)

### Flight Status Tracker
**What:** Live flight updates and alerts  
**Why:** Real-time delays, gate changes

### Email Integration
**What:** Forward confirmations → auto-import  
**Why:** Zero manual entry

### Offline Maps
**What:** Download venue maps for offline use  
**Why:** Navigate without WiFi

### Analytics Dashboard
**What:** Insights across all jobs  
**Why:** Business intelligence, identify patterns

---

## 🔮 Future Ideas (Complex)

### Client Portal
Share limited job info with client (read-only link)

### Multi-User Collaboration  
Share fldrs with team members (major architecture change)

### Smart Search
Natural language search: "Show me all San Diego jobs"

### Cloud Backup
Auto-backup to Google Drive/Dropbox

### AI Chat Assistant
"What's my schedule next week?" conversational interface

### AR Venue Visualization
Point camera → see power outlets, WiFi zones (experimental)

---

## 📋 Priority Order

**Do Now:**
1. ~~Duplicate Job~~ ✅ Shipped
2. ~~Time Zone Display~~ ✅ Shipped
3. ~~Waste/Loss Tracking~~ ✅ Shipped (Feb 22)
4. ~~Google Maps Autocomplete~~ ✅ Ready (just add API key)
5. Expenses Module (essential, high value)

**Do Next:**
5. Notes Enhancements (core project)
6. Equipment Checklist (essential)
7. Email Parser (AI, huge time saver)

**Plan Ahead:**
7. Job Templates (medium effort, high value)
8. Mini Workspace (core project)
9. Time Tracker (essential for billing)

**Future:**
- Advanced AI features
- Workflow automation
- Complex integrations

---

## ✅ Next Action
~~Pick **one** item from "Do Now" → Ship it this weekend → Get feedback → Repeat~~

**Latest Ships:**
- ✅ Duplicate Job - Copy any job with one click (Feb 18)
- ✅ Time Zone Display - San Diego clock always visible + location time (Feb 18)
- ✅ Waste/Loss Tracking - Track damaged/lost items per product with +/- controls (Feb 22)
- ✅ Google Maps Autocomplete - Address suggestions ready, just add API key (Feb 22)

**Next:** Notes Enhancements or Expenses Module

*Updated: February 22, 2026*
