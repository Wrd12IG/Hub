/**
 * GET /api/weather?city=Milano
 * Proxy server-side per OpenWeatherMap — nasconde la API key dal client
 */
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city') || 'Milano';
  const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key non configurata' }, { status: 503 });
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=it`;
    const res = await fetch(url, { next: { revalidate: 600 } }); // cache 10 min

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Errore OpenWeatherMap', code: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      temperature: Math.round(data.main.temp),
      feelsLike:   Math.round(data.main.feels_like),
      description: data.weather[0].description,
      humidity:    data.main.humidity,
      windSpeed:   Math.round(data.wind.speed * 3.6),
      pressure:    data.main.pressure,
      visibility:  Math.round(data.visibility / 1000),
      icon:        data.weather[0].icon,
      city:        data.name,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Errore di rete' },
      { status: 500 }
    );
  }
}
