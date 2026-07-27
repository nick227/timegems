// "H:MM AM/PM" clock-time -- used by the session start-time line and each
// note's timestamp. Two real call sites within this feature; kept
// feature-local rather than promoted to shared lib/ since nothing outside
// work-sessions needs it.
export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}
