const CACHE_NAME = 'git-cache-v2' // Increment version to force refresh
const urlsToCache = [
  '/',
  '/fldr',
  '/write',
  '/prod',
]

// Install event
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting()
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache)
    })
  )
})

// Fetch event - network first for API, cache for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // For API routes and data, always use network
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )
    return
  }
  
  // For everything else, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response
      }
      return fetch(event.request).then(response => {
        // Cache successful responses
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
    })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Claim all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
    ])
  )
})
