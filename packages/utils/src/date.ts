/** Returns the number of working days in a given month (Mon–Sat by default). */
export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0) count++ // exclude Sundays
  }
  return count
}

/** Returns YYYY-MM-DD string for a given Date. */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]!
}

/** Parses a YYYY-MM-DD string into a Date object (midnight UTC). */
export function fromDateString(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z')
}

/** Returns the difference in calendar days between two dates. */
export function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((to.getTime() - from.getTime()) / msPerDay)
}

/** Returns an array of YYYY-MM-DD strings for a date range (inclusive). */
export function dateRange(from: string, to: string): string[] {
  const result: string[] = []
  const cur = fromDateString(from)
  const end = fromDateString(to)
  while (cur <= end) {
    result.push(toDateString(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return result
}

/** Returns a human-readable period label, e.g. "June 2025". */
export function monthLabel(month: number, year: number): string {
  return new Date(year, month - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  })
}
