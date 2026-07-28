export function manausToday() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Manaus",
    year: "numeric",
  }).format(new Date());
}
