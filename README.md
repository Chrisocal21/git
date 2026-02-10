# GIT - Get It Together

Personal Operations System - A PWA for managing job trips, events, and communications.

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

Currently on: **Phase 1 - Foundation** ✓

See `PROJECT.md` for full build plan and specifications.
