import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const location = searchParams.get('location')

    if (!location) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY

    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
      return NextResponse.json({ 
        error: 'OpenWeather API key not configured',
        message: 'Please add your API key to NEXT_PUBLIC_OPENWEATHER_API_KEY in .env'
      }, { status: 500 })
    }

    // Step 1: Geocode the location to get coordinates
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
    
    const geoResponse = await fetch(geoUrl)
    
    if (!geoResponse.ok) {
      const errorText = await geoResponse.text()
      console.error('Geocoding error:', geoResponse.status, errorText)
      
      if (geoResponse.status === 401) {
        return NextResponse.json({ 
          error: 'OpenWeather API key is invalid or not activated yet',
          message: 'New API keys can take up to 2 hours to activate. Please check: https://home.openweathermap.org/api_keys'
        }, { status: 401 })
      }
      
      throw new Error(`Geocoding failed: ${geoResponse.statusText}`)
    }

    const geoData = await geoResponse.json()

    if (!geoData || geoData.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const { lat, lon, name, state, country } = geoData[0]

    // Step 2: Get 5-day forecast using coordinates
    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    
    const weatherResponse = await fetch(weatherUrl)
    
    if (!weatherResponse.ok) {
      throw new Error(`Weather API failed: ${weatherResponse.statusText}`)
    }

    const weatherData = await weatherResponse.json()

    // Format the response to be more usable
    const formattedForecast = weatherData.list.map((item: any) => ({
      timestamp: item.dt,
      datetime: item.dt_txt,
      temp: Math.round(item.main.temp),
      feels_like: Math.round(item.main.feels_like),
      temp_min: Math.round(item.main.temp_min),
      temp_max: Math.round(item.main.temp_max),
      humidity: item.main.humidity,
      description: item.weather[0].description,
      main: item.weather[0].main,
      icon: item.weather[0].icon,
      wind_speed: Math.round(item.wind.speed),
      clouds: item.clouds.all,
      pop: Math.round(item.pop * 100), // Probability of precipitation as percentage
    }))

    // Group forecasts by day
    const dailyForecasts: Record<string, any[]> = {}
    formattedForecast.forEach((forecast: any) => {
      const date = forecast.datetime.split(' ')[0]
      if (!dailyForecasts[date]) {
        dailyForecasts[date] = []
      }
      dailyForecasts[date].push(forecast)
    })

    // Get daily summary (using noon forecast or closest available)
    const dailySummary = Object.entries(dailyForecasts).map(([date, forecasts]) => {
      // Find the forecast closest to noon (12:00)
      const noonForecast = forecasts.reduce((prev, curr) => {
        const prevTime = new Date(prev.datetime).getHours()
        const currTime = new Date(curr.datetime).getHours()
        return Math.abs(currTime - 12) < Math.abs(prevTime - 12) ? curr : prev
      })

      // Get high/low for the day
      const temps = forecasts.map(f => f.temp)
      const high = Math.max(...temps)
      const low = Math.min(...temps)

      return {
        date,
        high,
        low,
        temp: noonForecast.temp,
        description: noonForecast.description,
        main: noonForecast.main,
        icon: noonForecast.icon,
        pop: Math.max(...forecasts.map((f: any) => f.pop)), // Highest chance of precipitation
        humidity: noonForecast.humidity,
        wind_speed: noonForecast.wind_speed,
      }
    })

    return NextResponse.json({
      location: {
        name,
        state: state || null,
        country,
        lat,
        lon,
      },
      current: formattedForecast[0], // First forecast (closest to now)
      hourly: formattedForecast.slice(0, 24), // Next 24 hours (8 periods)
      daily: dailySummary,
      raw: weatherData, // Include raw data for debugging
    })
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
