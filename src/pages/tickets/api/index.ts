// [ticket-management] All database access for tickets. Every file below talks to one part of Supabase;
// the tables, policies and functions are defined in supabase/ticket-management.sql.
export * from "./activity";
export * from "./attachments";
export * from "./automation";
export * from "./comments";
export * from "./links";
export * from "./notifications";
export * from "./savedViews";
export * from "./tickets";
export * from "./watchers";
