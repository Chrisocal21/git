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

    // Step 1: Geocode the location
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`
    
    const geoResponse = await fetch(geoUrl)
    
    if (!geoResponse.ok) {
      if (geoResponse.status === 401) {
        return NextResponse.json({ 
          error: 'OpenWeather API key is invalid or not activated yet'
        }, { status: 401 })
      }
      throw new Error(`Geocoding failed: ${geoResponse.statusText}`)
    }

    const geoData = await geoResponse.json()

    if (!geoData || geoData.length === 0) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const { lat, lon, name, state, country } = geoData[0]

    // Step 2: Get weather forecast
    const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=imperial`
    
    const weatherResponse = await fetch(weatherUrl)
    
    if (!weatherResponse.ok) {
      throw new Error(`Weather API failed: ${weatherResponse.statusText}`)
    }

    const weatherData = await weatherResponse.json()

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
        temp: Math.round(weatherData.list[0].main.temp),
        feels_like: Math.round(weatherData.list[0].main.feels_like),
        description: weatherData.list[0].weather[0].description,
        main: weatherData.list[0].weather[0].main,
        icon: weatherData.list[0].weather[0].icon,
        humidity: weatherData.list[0].main.humidity,
        wind_speed: Math.round(weatherData.list[0].wind.speed),
      },
      hourly,
      daily,
    })
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}
