import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// WMO weather code → { main, description }
function wmoToCondition(code: number): { main: string; description: string } {
  if (code === 0) return { main: 'Clear', description: 'Clear sky' }
  if (code === 1) return { main: 'Clear', description: 'Mainly clear' }
  if (code === 2) return { main: 'Clouds', description: 'Partly cloudy' }
  if (code === 3) return { main: 'Clouds', description: 'Overcast' }
  if (code === 45 || code === 48) return { main: 'Fog', description: 'Foggy' }
  if (code === 51) return { main: 'Drizzle', description: 'Light drizzle' }
  if (code === 53) return { main: 'Drizzle', description: 'Moderate drizzle' }
  if (code === 55 || code === 56 || code === 57) return { main: 'Drizzle', description: 'Heavy drizzle' }
  if (code === 61) return { main: 'Rain', description: 'Light rain' }
  if (code === 63) return { main: 'Rain', description: 'Moderate rain' }
  if (code === 65 || code === 66 || code === 67) return { main: 'Rain', description: 'Heavy rain' }
  if (code === 71) return { main: 'Snow', description: 'Light snow' }
  if (code === 73) return { main: 'Snow', description: 'Moderate snow' }
  if (code === 75 || code === 77) return { main: 'Snow', description: 'Heavy snow' }
  if (code >= 80 && code <= 82) return { main: 'Rain', description: 'Rain showers' }
  if (code === 85 || code === 86) return { main: 'Snow', description: 'Snow showers' }
  if (code === 95) return { main: 'Thunderstorm', description: 'Thunderstorm' }
  if (code === 96 || code === 99) return { main: 'Thunderstorm', description: 'Thunderstorm with hail' }
  return { main: 'Clouds', description: 'Unknown' }
}

async function fetchFromOpenMeteo(location: string) {
  // Geocode
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
    { cache: 'no-store' }
  )
  if (!geoRes.ok) throw new Error('Open-Meteo geocoding failed')
  const geoData = await geoRes.json()
  if (!geoData.results?.length) throw new Error('Open-Meteo: location not found')

  const { latitude, longitude, name, admin1, country_code } = geoData.results[0]

  // Weather
  const wxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=5&timezone=auto`,
    { cache: 'no-store' }
  )
  if (!wxRes.ok) throw new Error('Open-Meteo forecast failed')
  const wx = await wxRes.json()

  const curr = wx.current
  const currCondition = wmoToCondition(curr.weather_code)

  const daily = wx.daily.time.map((date: string, i: number) => {
    const cond = wmoToCondition(wx.daily.weather_code[i])
    return {
      date,
      temp: Math.round((wx.daily.temperature_2m_max[i] + wx.daily.temperature_2m_min[i]) / 2),
      low: Math.round(wx.daily.temperature_2m_min[i]),
      high: Math.round(wx.daily.temperature_2m_max[i]),
      main: cond.main,
      description: cond.description,
      pop: wx.daily.precipitation_probability_max[i] ?? 0,
      humidity: 0,
      wind_speed: 0,
    }
  })

  return {
    location: { name, state: admin1 || null, country: country_code || '' },
    timezone: wx.timezone || null,
    current: {
      temp: Math.round(curr.temperature_2m),
      feels_like: Math.round(curr.apparent_temperature),
      description: currCondition.description,
      main: currCondition.main,
      humidity: curr.relative_humidity_2m,
      wind_speed: Math.round(curr.wind_speed_10m),
      pressure: null,
      visibility: null,
    },
    hourly: [],
    daily,
    alerts: [],
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get('location')

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    // Try Open-Meteo first (free, no key required)
    try {
      const result = await fetchFromOpenMeteo(location)
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        }
      })
    } catch (meteoErr) {
      console.warn('[Weather] Open-Meteo failed, falling back to OpenWeather:', meteoErr)
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY

    if (!apiKey) {
      return NextResponse.json({ 
        error: 'Weather service unavailable'
      }, { status: 500 })
    }

    // OpenWeather fallback — Step 1: Geocode the location - try multiple formats
    let geoData: any[] = []
    const locationVariants = [
      location,
      `${location}, US`,
      location.replace(/,\s*([A-Z]{2})$/, ', $1, US'), // "City, ST" -> "City, ST, US"
    ]
    
    for (const variant of locationVariants) {
      const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(variant)}&limit=1&appid=${apiKey}`
      
      console.log('[Weather] Trying geocoding:', { variant })
      
      const geoResponse = await fetch(geoUrl)
      
      if (!geoResponse.ok) {
        console.error('[Weather] Geocoding failed:', geoResponse.status, geoResponse.statusText)
        if (geoResponse.status === 401) {
          return NextResponse.json({ 
            error: 'OpenWeather API key is invalid or not activated yet'
          }, { status: 401 })
        }
        continue
      }

      const data = await geoResponse.json()
      if (data && data.length > 0) {
        geoData = data
        console.log('[Weather] Geocoding success with variant:', variant, data)
        break
      }
    }

    if (!geoData || geoData.length === 0) {
      console.error('[Weather] Location not found after all attempts:', location)
      return NextResponse.json({ 
        error: 'Location not found',
        details: `Could not find location: "${location}". Try "City, State" or "City, Country" format.`
      }, { status: 404 })
    }

    const { lat, lon, name, state, country } = geoData[0]

    // Fetch IANA timezone from Open-Meteo using the coordinates
    let owTimezone: string | null = null
    try {
      const tzRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1&current=temperature_2m`,
        { cache: 'no-store' }
      )
      if (tzRes.ok) {
        const tzData = await tzRes.json()
        owTimezone = tzData.timezone || null
      }
    } catch {}

    // Step 2: Get CURRENT weather (actual real-time data)
    const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    
    console.log('[Weather] Current weather request:', { lat, lon })
    
    const currentWeatherResponse = await fetch(currentWeatherUrl)
    
    if (!currentWeatherResponse.ok) {
      console.error('[Weather] Current weather API failed:', currentWeatherResponse.status, currentWeatherResponse.statusText)
      throw new Error(`Current weather API failed: ${currentWeatherResponse.statusText}`)
    }

    const currentWeatherData = await currentWeatherResponse.json()
    console.log('[Weather] Current weather retrieved:', {
      location: `${name}, ${state || country}`,
      coords: { lat, lon },
      temp: currentWeatherData.main.temp,
      condition: currentWeatherData.weather[0].main,
      timestamp: new Date().toISOString()
    })

    // Step 3: Get weather forecast for hourly/daily
    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    
    const weatherResponse = await fetch(weatherUrl)
    
    if (!weatherResponse.ok) {
      console.error('[Weather] Forecast API failed:', weatherResponse.status, weatherResponse.statusText)
      throw new Error(`Forecast API failed: ${weatherResponse.statusText}`)
    }

    const weatherData = await weatherResponse.json()
    console.log('[Weather] Forecast data retrieved:', weatherData.list?.length, 'forecasts')

    // Step 4: Get weather alerts from One Call API 3.0 (free tier includes alerts)
    let alerts = []
    try {
      const oneCallUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial&exclude=minutely,hourly,daily`
      const oneCallResponse = await fetch(oneCallUrl)
      
      if (oneCallResponse.ok) {
        const oneCallData = await oneCallResponse.json()
        alerts = oneCallData.alerts || []
        console.log('[Weather] Alerts retrieved:', alerts.length)
      } else {
        console.log('[Weather] One Call API not accessible (may require paid plan):', oneCallResponse.status)
      }
    } catch (alertError) {
      console.log('[Weather] Could not fetch alerts (likely requires paid plan):', alertError)
    }

    // Format hourly forecast
    const hourly = weatherData.list.slice(0, 8).map((item: any) => ({
      dt: item.dt,
      datetime: item.dt_txt,
      temp: Math.round(item.main.temp),
      feels_like: Math.round(item.main.feels_like),
      description: item.weather[0].description,
      icon: item.weather[0].icon,
      pop: Math.round(item.pop * 100),
    }))

    // Group by day for daily forecast
    const dailyMap = new Map()
    weatherData.list.forEach((item: any) => {
      const date = item.dt_txt.split(' ')[0]
      const hour = new Date(item.dt * 1000).getHours()
      
      // Take forecast closest to noon
      if (!dailyMap.has(date) || Math.abs(hour - 12) < Math.abs(new Date(dailyMap.get(date).dt * 1000).getHours() - 12)) {
        dailyMap.set(date, item)
      }
    })
    
    const daily = Array.from(dailyMap.values()).slice(0, 5).map((item: any) => ({
      date: item.dt_txt.split(' ')[0],
      dt: item.dt,
      temp: Math.round(item.main.temp),
      low: Math.round(item.main.temp_min),
      high: Math.round(item.main.temp_max),
      description: item.weather[0].description,
      main: item.weather[0].main,
      icon: item.weather[0].icon,
      pop: Math.round(item.pop * 100),
      humidity: item.main.humidity,
      wind_speed: Math.round(item.wind.speed),
    }))

    return NextResponse.json({
      location: {
        name,
        state: state || null,
        country,
      },
      timezone: owTimezone,
      current: {
        temp: Math.round(currentWeatherData.main.temp),
        feels_like: Math.round(currentWeatherData.main.feels_like),
        description: currentWeatherData.weather[0].description,
        main: currentWeatherData.weather[0].main,
        icon: currentWeatherData.weather[0].icon,
        humidity: currentWeatherData.main.humidity,
        wind_speed: Math.round(currentWeatherData.wind.speed),
        pressure: currentWeatherData.main.pressure,
        visibility: currentWeatherData.visibility ? Math.round(currentWeatherData.visibility / 1609.34) : null, // meters to miles
      },
      hourly,
      daily,
      alerts: alerts.map((alert: any) => ({
        event: alert.event,
        start: alert.start,
        end: alert.end,
        description: alert.description,
        sender_name: alert.sender_name,
      })),
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}
