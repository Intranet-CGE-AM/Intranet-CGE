export function manausToday() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Manaus",
    year: "numeric",
  }).format(new Date());
}

/** "Bom dia" / "Boa tarde" / "Boa noite" for the current hour in Manaus. */
export function manausGreeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Manaus",
    }).format(now),
  );
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}
