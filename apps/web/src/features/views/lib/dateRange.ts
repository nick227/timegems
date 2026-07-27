export type ActivityPeriod = 'day' | 'week' | 'month'

function localDate(year: number, month: number, day: number) {
  return new Date(year, month, day, 0, 0, 0, 0)
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDateKey(value: string) {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number)
  return localDate(year, month - 1, day)
}

export function activityRange(period: ActivityPeriod, dateKey: string) {
  const selected = parseLocalDateKey(dateKey)
  let start = selected
  let end = localDate(selected.getFullYear(), selected.getMonth(), selected.getDate() + 1)

  if (period === 'week') {
    const mondayOffset = (selected.getDay() + 6) % 7
    start = localDate(selected.getFullYear(), selected.getMonth(), selected.getDate() - mondayOffset)
    end = localDate(start.getFullYear(), start.getMonth(), start.getDate() + 7)
  } else if (period === 'month') {
    start = localDate(selected.getFullYear(), selected.getMonth(), 1)
    end = localDate(selected.getFullYear(), selected.getMonth() + 1, 1)
  }

  return { start, end, from: start.toISOString(), to: end.toISOString() }
}

export function shiftActivityDate(period: ActivityPeriod, dateKey: string, amount: -1 | 1) {
  const selected = parseLocalDateKey(dateKey)
  if (period === 'day') selected.setDate(selected.getDate() + amount)
  if (period === 'week') selected.setDate(selected.getDate() + 7 * amount)
  if (period === 'month') selected.setMonth(selected.getMonth() + amount)
  return localDateKey(selected)
}

export function activityRangeLabel(period: ActivityPeriod, dateKey: string) {
  const selected = parseLocalDateKey(dateKey)
  if (period === 'day') {
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }).format(selected)
  }
  if (period === 'week') {
    const { start, end } = activityRange(period, dateKey)
    const lastDay = new Date(end)
    lastDay.setDate(lastDay.getDate() - 1)
    const startLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(start)
    const endLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(lastDay)
    return `${startLabel} – ${endLabel}`
  }
  if (period === 'month') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(selected)
  }
  return ''
}

export function isCurrentActivityPeriod(period: ActivityPeriod, dateKey: string) {
  const selected = parseLocalDateKey(dateKey)
  const today = new Date()
  if (period === 'day') return localDateKey(selected) === localDateKey(today)
  if (period === 'week') {
    return activityRange(period, dateKey).from === activityRange(period, localDateKey(today)).from
  }
  if (period === 'month') return selected.getFullYear() === today.getFullYear() && selected.getMonth() === today.getMonth()
  return false
}
