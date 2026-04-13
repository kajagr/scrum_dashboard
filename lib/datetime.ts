export function formatTimeDot(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}.${mm}`;
}

export function formatDateDot(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}.${mm}.${yyyy}`;
}

export function formatDateTimeDot(
  input: Date | string,
  _options: Record<string, never> = {},
): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return `${formatDateDot(d)}, ${formatTimeDot(d)}`;
}

