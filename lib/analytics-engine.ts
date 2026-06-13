/**
 * Analytics Engine - Pure calculation functions for productivity analytics.
 * All functions are pure: same input → same output. Easy to test.
 */

export interface TimeEntry {
  userId: string;
  date: string; // ISO date string 'YYYY-MM-DD'
  hour: number; // 0-23
  minutes: number; // minutes worked in that hour
}

export interface DayActivity {
  date: string;
  totalMinutes: number;
  taskCount: number;
}

export interface HourProductivity {
  hour: number;
  label: string;
  averageMinutes: number;
}

export interface WorkloadForecast {
  week: string; // 'YYYY-WW'
  label: string;
  estimatedHours: number;
  isOverloaded: boolean;
}

export interface ClientProfitEntry {
  clientId: string;
  clientName: string;
  revenue: number;
  totalHoursWorked: number;
  averageHourlyRate: number;
  profit: number;
  profitMargin: number; // percentage 0-100
}

// ──────────────────────────────────────────────────────────────
// 1. Hourly Productivity
// ──────────────────────────────────────────────────────────────

const HOUR_LABELS: Record<number, string> = {
  0: '00:00', 1: '01:00', 2: '02:00', 3: '03:00',
  4: '04:00', 5: '05:00', 6: '06:00', 7: '07:00',
  8: '08:00', 9: '09:00', 10: '10:00', 11: '11:00',
  12: '12:00', 13: '13:00', 14: '14:00', 15: '15:00',
  16: '16:00', 17: '17:00', 18: '18:00', 19: '19:00',
  20: '20:00', 21: '21:00', 22: '22:00', 23: '23:00',
};

/**
 * Given an array of time entries, compute average minutes worked per hour-of-day.
 */
export function computeHourlyProductivity(entries: TimeEntry[]): HourProductivity[] {
  const minutesByHour: Record<number, number[]> = {};

  for (const entry of entries) {
    if (!minutesByHour[entry.hour]) minutesByHour[entry.hour] = [];
    minutesByHour[entry.hour].push(entry.minutes);
  }

  return Array.from({ length: 24 }, (_, h) => {
    const values = minutesByHour[h] ?? [];
    const avg = values.length > 0
      ? Math.round(values.reduce((s, v) => s + v, 0) / values.length)
      : 0;
    return { hour: h, label: HOUR_LABELS[h], averageMinutes: avg };
  });
}

/**
 * Find the peak productivity window (contiguous 4-hour block with highest avg).
 */
export function findPeakHours(productivity: HourProductivity[]): { start: number; end: number; label: string } {
  let bestStart = 0;
  let bestSum = 0;

  for (let i = 0; i <= 20; i++) {
    const sum = productivity.slice(i, i + 4).reduce((s, p) => s + p.averageMinutes, 0);
    if (sum > bestSum) { bestSum = sum; bestStart = i; }
  }

  return {
    start: bestStart,
    end: bestStart + 3,
    label: `${HOUR_LABELS[bestStart]} - ${HOUR_LABELS[bestStart + 3]}`,
  };
}

// ──────────────────────────────────────────────────────────────
// 2. Activity Heatmap (days)
// ──────────────────────────────────────────────────────────────

/**
 * Buckets activity intensity into 0-4 levels for heatmap rendering.
 */
export function computeHeatmapLevel(minutes: number, maxMinutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes === 0 || maxMinutes === 0) return 0;
  const ratio = minutes / maxMinutes;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

/**
 * Build heatmap data from daily activities (last N days).
 */
export function buildHeatmapData(
  activities: DayActivity[],
  days = 90
): Array<{ date: string; minutes: number; level: 0 | 1 | 2 | 3 | 4 }> {
  const maxMinutes = Math.max(...activities.map((a) => a.totalMinutes), 1);
  const activityMap = new Map(activities.map((a) => [a.date, a.totalMinutes]));

  const result = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const minutes = activityMap.get(dateStr) ?? 0;
    result.push({ date: dateStr, minutes, level: computeHeatmapLevel(minutes, maxMinutes) });
  }
  return result;
}

// ──────────────────────────────────────────────────────────────
// 3. Financial Calculations
// ──────────────────────────────────────────────────────────────

export interface ClientRevenueInput {
  clientId: string;
  clientName: string;
  revenue: number; // total invoiced €
  hoursWorked: number; // total hours by team
  averageHourlyRate: number; // team avg hourly cost €/h
}

/**
 * Calculates profit and margin for a client.
 * Profit = Revenue - (hoursWorked * averageHourlyRate)
 */
export function calculateClientProfit(input: ClientRevenueInput): ClientProfitEntry {
  const laborCost = input.hoursWorked * input.averageHourlyRate;
  const profit = input.revenue - laborCost;
  const profitMargin = input.revenue > 0 ? (profit / input.revenue) * 100 : 0;

  return {
    clientId: input.clientId,
    clientName: input.clientName,
    revenue: input.revenue,
    totalHoursWorked: input.hoursWorked,
    averageHourlyRate: input.averageHourlyRate,
    profit: Math.round(profit * 100) / 100,
    profitMargin: Math.round(profitMargin * 10) / 10,
  };
}

export interface ProjectROIInput {
  projectId: string;
  projectName: string;
  contractValue: number;   // € received from client
  laborCost: number;       // hours × hourly rate
  otherCosts?: number;     // tools, ads, etc.
}

/**
 * ROI = (Value Generated - Total Costs) / Total Costs × 100
 */
export function calculateProjectROI(input: ProjectROIInput): {
  projectId: string;
  projectName: string;
  roi: number;
  totalCosts: number;
  profit: number;
} {
  const totalCosts = input.laborCost + (input.otherCosts ?? 0);
  const profit = input.contractValue - totalCosts;
  const roi = totalCosts > 0 ? (profit / totalCosts) * 100 : 0;

  return {
    projectId: input.projectId,
    projectName: input.projectName,
    roi: Math.round(roi * 10) / 10,
    totalCosts: Math.round(totalCosts * 100) / 100,
    profit: Math.round(profit * 100) / 100,
  };
}

/**
 * Simple linear trend extrapolation: given N months of spend, project next M months.
 */
export function forecastMonthlyBudget(
  monthlySpends: number[],
  forecastMonths = 3
): number[] {
  if (monthlySpends.length < 2) return Array(forecastMonths).fill(monthlySpends[0] ?? 0);

  // Slope via simple linear regression
  const n = monthlySpends.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = monthlySpends.reduce((s, v) => s + v, 0);
  const sumXY = monthlySpends.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = monthlySpends.reduce((s, _, i) => s + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return Array.from({ length: forecastMonths }, (_, i) => {
    const projected = intercept + slope * (n + i);
    return Math.max(0, Math.round(projected * 100) / 100);
  });
}
