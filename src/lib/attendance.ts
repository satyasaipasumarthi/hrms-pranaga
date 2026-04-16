export const ABSENT_THRESHOLD_MINUTES = 3 * 60;
export const FULL_DAY_THRESHOLD_MINUTES = 5 * 60;
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
const BUSINESS_UTC_OFFSET_MINUTES = 330;

export type AttendanceStatus = "Absent" | "Half Day" | "Full Day" | "Pending";

export const calculateAttendanceStatus = (
  totalMinutes: number,
  options?: { isOpenShift?: boolean },
): AttendanceStatus => {
  if (options?.isOpenShift) {
    return "Pending";
  }

  const normalizedMinutes = Math.max(Math.round(totalMinutes), 0);
  if (normalizedMinutes < ABSENT_THRESHOLD_MINUTES) {
    return "Absent";
  }

  if (normalizedMinutes < FULL_DAY_THRESHOLD_MINUTES) {
    return "Half Day";
  }

  return "Full Day";
};

export const calculateDurationMinutes = (
  startValue: string | null,
  endValue: string | null,
  options?: { useCurrentTimeIfOpen?: boolean; now?: Date },
) => {
  if (!startValue) {
    return 0;
  }

  const start = new Date(startValue);
  const end = endValue
    ? new Date(endValue)
    : options?.useCurrentTimeIfOpen
      ? (options.now ?? new Date())
      : null;

  if (!end) {
    return 0;
  }

  return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
};

export const formatWorkedDuration = (totalMinutes: number) => {
  const normalizedMinutes = Math.max(Math.round(totalMinutes), 0);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;

  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
};

const getBusinessDateParts = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return {
      year: date.getUTCFullYear().toString().padStart(4, "0"),
      month: `${date.getUTCMonth() + 1}`.padStart(2, "0"),
      day: `${date.getUTCDate()}`.padStart(2, "0"),
    };
  }

  return { year, month, day };
};

export const getBusinessDateKey = (value: string | Date = new Date()) => {
  const { year, month, day } = getBusinessDateParts(value);
  return `${year}-${month}-${day}`;
};

export const getBusinessDateRange = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0) - BUSINESS_UTC_OFFSET_MINUTES * 60000);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};
