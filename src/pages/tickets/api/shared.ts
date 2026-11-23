// [ticket-management] Helpers shared by every file in api/.

// Supabase rows are loosely typed here (no generated types in this project).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

/** Logs a database error and throws a readable message. */
export const fail = (error: unknown, what: string): never => {
  console.error(`[tickets] ${what}`, error);
  const message = (error as { message?: string })?.message ?? String(error);
  if (/relation .*tickets.* does not exist|Could not find the table/i.test(message)) {
    throw new Error("Ticket tables are missing. Run supabase/ticket-management.sql in the Supabase SQL editor.");
  }
  throw new Error(message);
};
