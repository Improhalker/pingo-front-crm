// Civil dates and instants in the organization timezone (IANA), independent of the browser timezone.

function parts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  return values as Record<
    'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
    string
  >
}

/** Today's civil date (YYYY-MM-DD) for the organization. */
export function todayIn(timeZone: string, now = new Date()): string {
  const p = parts(now, timeZone)
  return `${p.year}-${p.month}-${p.day}`
}

/** Current wall time "YYYY-MM-DDTHH:mm" in the organization timezone (for datetime-local inputs). */
export function nowLocalIn(timeZone: string, now = new Date()): string {
  const p = parts(now, timeZone)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

/**
 * Converts a wall time typed for the organization ("YYYY-MM-DDTHH:mm") into a UTC ISO instant. The offset is
 * resolved for that wall time in the IANA zone (handles historical/DST rules), not the browser's offset.
 */
export function zonedLocalToIso(local: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!match) throw new Error('Invalid local date-time')
  const [, y, mo, d, h, mi] = match.map(Number) as number[]
  const wallAsUtc = Date.UTC(y!, mo! - 1, d!, h!, mi!)
  let instant = wallAsUtc
  for (let attempt = 0; attempt < 2; attempt++) {
    const p = parts(new Date(instant), timeZone)
    const shown = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
    instant += wallAsUtc - shown
  }
  return new Date(instant).toISOString()
}

/** "2026-10-06" → "06/10/2026" without timezone conversion (civil date). */
export function formatCivilDate(date: string): string {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

/** ISO instant → "06/10/2026 14:30" in the organization timezone. */
export function formatInstant(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso))
}
