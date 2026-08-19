// Backend timestamps (audit logs, notifications, access grants, etc.) are stored
// and serialized as naive UTC datetimes with no timezone suffix, e.g.
// "2026-08-18T08:09:32.116617". JavaScript's Date parser treats a date-time
// string with no offset as LOCAL time, not UTC, which silently shifts every
// displayed timestamp by the browser's UTC offset. Treat such strings as UTC
// explicitly so the local time shown to the user is actually correct.
const HAS_TZ = /[zZ]$|[+-]\d{2}:?\d{2}$/;

export function parseServerDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" && !HAS_TZ.test(value)) {
    return new Date(value + "Z");
  }
  return new Date(value);
}

export function formatDateTime(value, options) {
  const d = parseServerDate(value);
  if (!d || isNaN(d.getTime())) return "-";
  return options ? d.toLocaleString(undefined, options) : d.toLocaleString();
}

export function formatTime(value) {
  const d = parseServerDate(value);
  if (!d || isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString();
}
