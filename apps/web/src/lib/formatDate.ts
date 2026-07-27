// Genuinely shared across features (reports, admin, projects each had their
// own raw `.toLocaleString()`/`.toLocaleDateString()` call with no helper) --
// unlike duration formatting, which stays feature-local since its two
// variants each have exactly one caller today.
export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString()
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}
