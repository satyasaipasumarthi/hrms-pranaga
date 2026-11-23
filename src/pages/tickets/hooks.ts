// [ticket-management] React Query hooks + Supabase Realtime for tickets.
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  fetchActivity,
  fetchComments,
  fetchLinks,
  fetchSavedViews,
  fetchTickets,
} from "./api";

export const ticketKeys = {
  all: ["tickets"] as const,
  detail: (id: string) => ["tickets", "detail", id] as const,
  comments: (id: string) => ["tickets", "detail", id, "comments"] as const,
  activity: (id: string) => ["tickets", "detail", id, "activity"] as const,
  links: (id: string) => ["tickets", "detail", id, "links"] as const,
  views: ["tickets", "views"] as const,
};

export const useTicketList = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ticketKeys.all, queryFn: fetchTickets, enabled, staleTime: 30_000 });

  // Live board: refetch (debounced) when anything ticket-related changes.
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void queryClient.invalidateQueries({ queryKey: ticketKeys.all }), 300);
    };
    const channel = supabase
      .channel("tickets-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_watchers" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_attachments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_comments" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_activity" }, refresh)
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  return query;
};

export const useTicketComments = (id: string | null) =>
  useQuery({ queryKey: ticketKeys.comments(id ?? "-"), queryFn: () => fetchComments(id!), enabled: Boolean(id) });

export const useTicketActivity = (id: string | null) =>
  useQuery({ queryKey: ticketKeys.activity(id ?? "-"), queryFn: () => fetchActivity(id!), enabled: Boolean(id) });

export const useTicketLinks = (id: string | null) =>
  useQuery({ queryKey: ticketKeys.links(id ?? "-"), queryFn: () => fetchLinks(id!), enabled: Boolean(id) });

export const useSavedViews = (enabled = true) =>
  useQuery({ queryKey: ticketKeys.views, queryFn: fetchSavedViews, enabled });

