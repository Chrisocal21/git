const CACHE_NAME = 'git-cache-v4' // Increment version to force refresh
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

// Fetch event - network first for everything, fallback to cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  
  // Network first strategy: Always try network, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for offline use
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse
          }
          // For API routes, return empty array if no cache
          if (url.pathname.startsWith('/api/')) {
            return new Response(JSON.stringify([]), {
              headers: { 'Content-Type': 'application/json' }
            })
          }
          // For other requests, let it fail naturally
          return new Response('Offline and no cache available', { status: 503 })
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

// Message event - handle SKIP_WAITING
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
