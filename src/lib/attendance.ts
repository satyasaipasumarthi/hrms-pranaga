export const ABSENT_THRESHOLD_MINUTES = 3 * 60;
export const FULL_DAY_THRESHOLD_MINUTES = 5 * 60;

export type AttendanceStatus = "Absent" | "Half Day" | "Full Day" | "Pending";

export const calculateAttendanceStatus = (
  totalMinutes: number,
  _options?: { isOpenShift?: boolean },
): AttendanceStatus => {
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

export const getUtcDateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().split("T")[0];
};

export const getUtcDateRange = (dateKey: string) => {
  const start = new Date(`${dateKey}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
};
