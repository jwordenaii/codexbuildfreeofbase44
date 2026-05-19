// noaa.lib.ts
// src/lib/noaa.ts
// ─────────────────────────────────────────────────────────────────────────────
// Shared NOAA api.weather.gov helper — consumed by both:
//   netlify/functions/dispatch.ts   (DispatchWeatherStation)
//   netlify/functions/precon.ts     (PreConOmniNode)
//
// NO API KEY REQUIRED — NOAA api.weather.gov is a free US government service.
// Rate limit: ~1 req/sec per IP. Responses cached 5 min by the Netlify function.
// ─────────────────────────────────────────────────────────────────────────────

import type { NoaaForecastPeriod, WeatherDay } from '../types/dispatch-weather.types';

const NOAA_BASE = 'https://api.weather.gov';
const UA = 'WordenStandard/1.0 (jwordenaii@wordenstandard.com)'; // NOAA requires User-Agent

/** Step 1 — resolve lat/lon → NOAA grid point meta */
export interface NoaaGridMeta {
  gridId: string;
  gridX: number;
  gridY: number;
  forecastUrl: string;
  forecastHourlyUrl: string;
  radarStation: string;
  timeZone: string;
}

export async function resolveNoaaGrid(lat: number, lon: number): Promise<NoaaGridMeta> {
  const res = await fetch(`${NOAA_BASE}/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
    headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NOAA points API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const p = json.properties;
  return {
    gridId: p.gridId,
    gridX: p.gridX,
    gridY: p.gridY,
    forecastUrl: p.forecast,
    forecastHourlyUrl: p.forecastHourly,
    radarStation: p.radarStation,
    timeZone: p.timeZone,
  };
}

/** Step 2 — fetch daily forecast periods (typically 7-14 days, daytime only) */
export async function fetchNoaaDailyPeriods(forecastUrl: string): Promise<NoaaForecastPeriod[]> {
  const res = await fetch(forecastUrl, {
    headers: { 'User-Agent': UA, Accept: 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NOAA forecast API ${res.status}`);
  const json = await res.json();
  return (json.properties?.periods ?? []) as NoaaForecastPeriod[];
}

/** Step 3 — normalize NOAA periods into WeatherDay array */
export function normalizeNoaaPeriods(periods: NoaaForecastPeriod[]): WeatherDay[] {
  // NOAA returns day + night pairs. Merge day/night pairs into single WeatherDay.
  const days: WeatherDay[] = [];
  let i = 0;
  let idx = 1;
  while (i < periods.length) {
    const day = periods[i];
    const night = periods[i + 1];

    if (!day) break;

    const isDayPeriod = day.isDaytime;
    const dayPeriod = isDayPeriod ? day : night;
    const nightPeriod = isDayPeriod ? night : day;

    const startDate = new Date(day.startTime);
    const dateStr = startDate.toISOString().split('T')[0];
    const dow = startDate.toLocaleDateString('en-US', { weekday: 'short' });
    const monthName = startDate.toLocaleDateString('en-US', { month: 'long' });
    const dom = startDate.getDate();
    const isWeekend = startDate.getDay() === 0 || startDate.getDay() === 6;

    const tempHigh = dayPeriod?.temperature ?? 70;
    const tempLow = nightPeriod?.temperature ?? (tempHigh - 15);

    // Parse wind speed string "10 mph" → number
    const parseWind = (s?: string): number => {
      if (!s) return 0;
      const m = s.match(/(\d+)/g);
      if (!m) return 0;
      return m.length > 1 ? Math.max(...m.map(Number)) : Number(m[0]);
    };

    const windSpeed = Math.max(
      parseWind(dayPeriod?.windSpeed),
      parseWind(nightPeriod?.windSpeed)
    );

    const precipProb = Math.max(
      dayPeriod?.probabilityOfPrecipitation?.value ?? 0,
      nightPeriod?.probabilityOfPrecipitation?.value ?? 0
    );

    // Estimate mm from probability (heuristic: 0.4mm per % point when > 20%)
    const precipMM = precipProb > 20 ? Math.round((precipProb - 20) * 0.4) : 0;

    const humidity = dayPeriod?.relativeHumidity?.value ??
                     nightPeriod?.relativeHumidity?.value ?? 60;

    // Dewpoint from NOAA is Celsius — convert
    const dewpointC = dayPeriod?.dewpoint?.value ?? null;
    const dewPoint = dewpointC !== null ? Math.round(dewpointC * 9 / 5 + 32) : Math.round(tempLow - 5);

    // Ground temp heuristic: 3-day rolling average of avg air temp, lag 2°F
    const groundTemp = Math.round((tempHigh + tempLow) / 2 - 4);

    days.push({
      dayIndex: idx++,
      date: dateStr,
      month: monthName,
      dayOfMonth: dom,
      dayOfWeek: dow,
      tempHigh,
      tempLow,
      groundTemp,
      windSpeed,
      precipMM,
      precipProbability: precipProb,
      humidity,
      dewPoint,
      shortForecast: dayPeriod?.shortForecast,
      detailedForecast: dayPeriod?.detailedForecast,
      isWeekend,
      source: 'noaa',
    });

    // Advance by 2 periods (day+night) if available
    i += (isDayPeriod && night && !night.isDaytime) ? 2 : 1;
  }
  return days;
}

/** Virginia-climate synthetic filler — used when NOAA is unavailable */
export function syntheticFallback(startDate: Date, count: number): WeatherDay[] {
  const days: WeatherDay[] = [];
  const seasonalHigh: Record<number, number> = {
    0: 42, 1: 47, 2: 57, 3: 67, 4: 76, 5: 84,
    6: 88, 7: 87, 8: 80, 9: 68, 10: 57, 11: 46,
  };
  const sr = (seed: number) => { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); };

  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const month = d.getMonth();
    const r1 = sr(i * 7 + 1), r2 = sr(i * 7 + 2), r3 = sr(i * 7 + 3);
    const r4 = sr(i * 7 + 4), r5 = sr(i * 7 + 5), r6 = sr(i * 7 + 6);
    const base = seasonalHigh[month] ?? 65;
    const tempHigh = Math.round(base + (r1 - 0.5) * 18);
    const tempLow = Math.round(tempHigh - 12 - r2 * 10);
    const groundTemp = Math.round((tempHigh + tempLow) / 2 - 4 - r3 * 6);
    const windSpeed = Math.round(3 + r4 * 22);
    const rainProb = [3, 4, 9, 10].includes(month) ? 35 : [11, 0, 1].includes(month) ? 25 : 18;
    const precipMM = r5 * 100 < rainProb ? Math.round(r5 * 60 + 2) : 0;
    const humidity = Math.round(45 + r6 * 40);
    const dewPoint = Math.round(tempLow - 5 + r1 * 8);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    days.push({
      dayIndex: i + 1,
      date: d.toISOString().split('T')[0],
      month: d.toLocaleDateString('en-US', { month: 'long' }),
      dayOfMonth: d.getDate(),
      dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
      tempHigh, tempLow, groundTemp, windSpeed,
      precipMM, precipProbability: rainProb,
      humidity, dewPoint,
      isWeekend, source: 'synthetic',
    });
  }
  return days;
}
