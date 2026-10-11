// Weather for a city barely changes in a few hours, so there is no reason to ask for it again
// each time a page opens. The answer is kept on the phone for a while and reused; the list of
// jobs, a job's own page and the menu all share it, so a city is only ever asked about once.

const STORAGE_KEY = 'burrow-weather-v1'

/** How long an answer counts as current */
export const WEATHER_FRESH_MS = 3 * 60 * 60 * 1000
/** Answers older than this are dropped (an old one is still shown if the phone is offline and there is nothing newer) */
const KEEP_MS = 24 * 60 * 60 * 1000

export interface WeatherReply {
  location?: { name?: string; state?: string; country?: string }
  current?: { temp: number; feels_like: number; description: string; main: string; humidity: number; wind_speed: number }
  daily?: { date: string; high: number; low: number; main: string; description: string; pop: number }[]
}

interface Saved {
  at: number
  data: WeatherReply
}

const keyFor = (location: string) => location.trim().toLowerCase()

function readAll(): Record<string, Saved> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function save(location: string, data: WeatherReply) {
  try {
    const now = Date.now()
    const all = readAll()
    for (const key of Object.keys(all)) {
      if (!all[key] || now - all[key].at > KEEP_MS) delete all[key]
    }
    all[keyFor(location)] = { at: now, data }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {}
}

/** What the phone already knows about a city, straight away. `fresh` says whether it's recent enough to leave alone. */
export function readCachedWeather(location: string): { data: WeatherReply; fresh: boolean } | null {
  const saved = readAll()[keyFor(location)]
  if (!saved?.data?.current) return null
  return { data: saved.data, fresh: Date.now() - saved.at < WEATHER_FRESH_MS }
}

// Two cards for the same city, or the list and a job page opening together, share one request
const inFlight = new Map<string, Promise<WeatherReply | null>>()

/**
 * The weather for a city. A recent saved answer is used as it is; otherwise it is asked for once
 * and saved. If the ask fails, an older saved answer is better than nothing. `force` (pull to
 * refresh) always asks.
 */
export function fetchWeather(location: string, options: { force?: boolean } = {}): Promise<WeatherReply | null> {
  const cached = readCachedWeather(location)
  if (cached?.fresh && !options.force) return Promise.resolve(cached.data)

  const key = keyFor(location)
  const running = inFlight.get(key)
  if (running) return running

  const request = fetch(`/api/weather?location=${encodeURIComponent(location)}`)
    .then(res => (res.ok ? res.json() : null))
    .then((data: WeatherReply | null) => {
      if (data?.current && typeof data.current.temp === 'number') {
        save(location, data)
        return data
      }
      return cached?.data ?? null
    })
    .catch(() => cached?.data ?? null)
    .finally(() => {
      inFlight.delete(key)
    })
  inFlight.set(key, request)
  return request
}
