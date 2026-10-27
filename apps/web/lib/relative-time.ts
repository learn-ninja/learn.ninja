/** "today", "3 days ago", "on 2 Oct 2026": when something on the settings page was made or used. */
export function relative(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5)
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} days ago`
  return `on ${new Date(iso).toLocaleDateString("en", { dateStyle: "medium" })}`
}
