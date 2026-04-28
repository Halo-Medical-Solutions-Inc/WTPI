import { endOfDay, parseISO, startOfDay } from "date-fns";

export function localDateToUtcStartOfDay(dateString: string): string {
  const localDate = parseISO(dateString);
  const startOfLocalDay = startOfDay(localDate);
  return startOfLocalDay.toISOString();
}

export function localDateToUtcEndOfDay(dateString: string): string {
  const localDate = parseISO(dateString);
  const endOfLocalDay = endOfDay(localDate);
  return endOfLocalDay.toISOString();
}
