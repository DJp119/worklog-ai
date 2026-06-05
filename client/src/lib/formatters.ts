import i18n from '../i18n'

function locale(): string {
  return (typeof navigator !== 'undefined' && navigator.language) || i18n.language || 'en'
}

export function formatDate(
  date: Date | string,
  style: 'short' | 'medium' | 'long' = 'medium'
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const opts: Record<string, Intl.DateTimeFormatOptions> = {
    short: { month: 'short', day: 'numeric' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
  }
  return new Intl.DateTimeFormat(locale(), opts[style]).format(d)
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(d)
}

export function formatNumber(value: number, decimals = 1): string {
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: decimals }).format(value)
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = d.getTime() - Date.now()
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' })
  const seconds = Math.abs(diffMs / 1000)
  if (seconds < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  if (seconds < 3600) return rtf.format(Math.round(diffMs / 60000), 'minute')
  if (seconds < 86400) return rtf.format(Math.round(diffMs / 3600000), 'hour')
  if (seconds < 604800) return rtf.format(Math.round(diffMs / 86400000), 'day')
  return rtf.format(Math.round(diffMs / 604800000), 'week')
}

export function getLocalizedDayNames(): { value: number; label: string }[] {
  const fmt = new Intl.DateTimeFormat(locale(), { weekday: 'long' })
  return Array.from({ length: 7 }, (_, i) => ({
    value: i,
    label: fmt.format(new Date(2024, 0, 7 + i)),
  }))
}

export function formatHourOption(hour: number): string {
  return new Intl.DateTimeFormat(locale(), { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2024, 0, 1, hour, 0, 0)
  )
}
