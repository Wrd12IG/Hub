'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSnow, Wind, Droplets, Eye, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherData {
    temperature: number;
    feelsLike: number;
    description: string;
    humidity: number;
    windSpeed: number;
    pressure: number;
    visibility: number;
    icon: string;
    city: string;
}

interface WeatherWidgetProps {
    apiKey?: string; // OpenWeather API key (opzionale)
    city?: string;   // Città specifica (opzionale, altrimenti usa geolocation)
    compact?: boolean;
}

export function WeatherWidget({ apiKey, city, compact = false }: WeatherWidgetProps) {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchWeather();
    }, [city]);

    const fetchWeather = async () => {
        try {
            setLoading(true);
            setError(null);

            // Se non c'è API key, usa dati mock
            if (!apiKey) {
                // Simula caricamento
                await new Promise(resolve => setTimeout(resolve, 500));

                setWeather({
                    temperature: 18,
                    feelsLike: 16,
                    description: 'Parzialmente nuvoloso',
                    humidity: 65,
                    windSpeed: 12,
                    pressure: 1013,
                    visibility: 10,
                    icon: '02d',
                    city: city || 'Milano'
                });
                setLoading(false);
                return;
            }

            let url: string;

            if (city) {
                // Usa città specificata
                url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=it`;
            } else {
                // Usa geolocation
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });

                const { latitude, longitude } = position.coords;
                url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric&lang=it`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Impossibile recuperare i dati meteo');
            }

            const data = await response.json();

            setWeather({
                temperature: Math.round(data.main.temp),
                feelsLike: Math.round(data.main.feels_like),
                description: data.weather[0].description,
                humidity: data.main.humidity,
                windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
                pressure: data.main.pressure,
                visibility: Math.round(data.visibility / 1000), // m to km
                icon: data.weather[0].icon,
                city: data.name
            });

            setLoading(false);
        } catch (err: any) {
            console.error('Weather fetch error:', err);
            setError(err.message || 'Errore nel caricamento meteo');
            setLoading(false);
        }
    };

    const getWeatherIcon = (iconCode: string) => {
        const code = iconCode.substring(0, 2);

        switch (code) {
            case '01': return <Sun className="w-8 h-8 text-yellow-500" />;
            case '02': return <Cloud className="w-8 h-8 text-gray-400" />;
            case '03':
            case '04': return <Cloud className="w-8 h-8 text-gray-500" />;
            case '09':
            case '10': return <CloudRain className="w-8 h-8 text-blue-500" />;
            case '11': return <CloudRain className="w-8 h-8 text-purple-500" />;
            case '13': return <CloudSnow className="w-8 h-8 text-blue-300" />;
            case '50': return <Wind className="w-8 h-8 text-gray-400" />;
            default: return <Cloud className="w-8 h-8 text-gray-400" />;
        }
    };

    const getBackgroundGradient = (iconCode: string) => {
        const code = iconCode.substring(0, 2);

        switch (code) {
            case '01': return 'from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20';
            case '02': return 'from-blue-50 to-gray-50 dark:from-blue-950/20 dark:to-gray-950/20';
            case '03':
            case '04': return 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20';
            case '09':
            case '10': return 'from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20';
            case '11': return 'from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20';
            case '13': return 'from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20';
            default: return 'from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20';
        }
    };

    if (loading) {
        return (
            <div className={cn(
                "bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-950/20 dark:to-slate-950/20 p-4 rounded-lg border border-gray-200 dark:border-gray-800",
                compact && "p-3"
            )}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-20"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-32"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !weather) {
        return (
            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error || 'Meteo non disponibile'}
                </p>
                {!apiKey && (
                    <p className="text-xs text-muted-foreground mt-1">
                        Aggiungi API key OpenWeather per dati reali
                    </p>
                )}
            </div>
        );
    }

    if (compact) {
        return (
            <div className={cn(
                "bg-gradient-to-br p-3 rounded-lg border",
                getBackgroundGradient(weather.icon),
                "border-gray-200 dark:border-gray-800"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {getWeatherIcon(weather.icon)}
                        <div>
                            <div className="text-2xl font-bold">{weather.temperature}°C</div>
                            <div className="text-xs text-muted-foreground capitalize">
                                {weather.description}
                            </div>
                        </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                        <div>{weather.city}</div>
                        <div className="flex items-center gap-1 justify-end mt-1">
                            <Droplets className="w-3 h-3" />
                            {weather.humidity}%
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "bg-gradient-to-br p-4 rounded-lg border",
            getBackgroundGradient(weather.icon),
            "border-gray-200 dark:border-gray-800"
        )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-lg">{weather.city}</h3>
                    <p className="text-sm text-muted-foreground capitalize">
                        {weather.description}
                    </p>
                </div>
                {getWeatherIcon(weather.icon)}
            </div>

            {/* Temperatura principale */}
            <div className="mb-4">
                <div className="text-5xl font-bold">{weather.temperature}°C</div>
                <div className="text-sm text-muted-foreground">
                    Percepita {weather.feelsLike}°C
                </div>
            </div>

            {/* Dettagli */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <div>
                        <div className="font-medium">{weather.humidity}%</div>
                        <div className="text-xs text-muted-foreground">Umidità</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <Wind className="w-4 h-4 text-gray-500" />
                    <div>
                        <div className="font-medium">{weather.windSpeed} km/h</div>
                        <div className="text-xs text-muted-foreground">Vento</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <Gauge className="w-4 h-4 text-purple-500" />
                    <div>
                        <div className="font-medium">{weather.pressure} hPa</div>
                        <div className="text-xs text-muted-foreground">Pressione</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-cyan-500" />
                    <div>
                        <div className="font-medium">{weather.visibility} km</div>
                        <div className="text-xs text-muted-foreground">Visibilità</div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            {!apiKey && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                    <p className="text-xs text-muted-foreground text-center">
                        📍 Dati simulati - Aggiungi API key per dati reali
                    </p>
                </div>
            )}
        </div>
    );
}
