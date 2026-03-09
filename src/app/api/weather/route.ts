import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const location = searchParams.get('location')

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY

    if (!apiKey) {
      return NextResponse.json({ 
        error: 'OpenWeather API key not configured'
      }, { status: 500 })
    }

    // Step 1: Geocode the location - try multiple formats
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

    console.log('[Weather] Found location:', { name, state, country, lat, lon })

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
