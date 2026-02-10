# GIT - Get It Together

Personal Operations System - A PWA for managing job trips, events, and communications.

## Development

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

**Write Mode (AI Polish):** Requires OpenAI API key in `.env`:
```
OPENAI_API_KEY=your_key_here
```

Without an API key, Write mode will return a mock polished response for testing.

## Tech Stack

- **Framework:** Next.js 14 with App Router
- **Styling:** Tailwind CSS
- **Language:** TypeScript
- **Hosting:** Vercel
- **Database:** Cloudflare D1 (to be configured)
- **PWA:** Service Worker with offline support

## Project Structure

```
src/
├── app/              # Next.js app router pages
│   ├── fldr/        # Folders mode
│   ├── write/       # Write mode
│   └── prod/        # Production mode
├── components/      # React components
└── hooks/           # Custom React hooks

public/
├── manifest.json    # PWA manifest
└── sw.js           # Service worker
```

## Build Phases

Currently on: **Phase 5 - Write Mode** ✓

**Completed:**
- ✅ Phase 1: Foundation (PWA, nav, dark mode)
- ✅ Phase 2: Fldr Core (create, list, detail views)
- ✅ Phase 3: Fldr Editing (all fields, auto-save)
- ✅ Phase 4: Flexible Modules (checklist, people, job info)
- ✅ Phase 5: Write Mode (message polisher with tone profile)

**Next:** Phase 6 - Wrap-up Assist

See `PROJECT.md` for full build plan and specifications.
