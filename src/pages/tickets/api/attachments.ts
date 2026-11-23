// [ticket-management] Documents on a ticket (table: ticket_attachments, files in the "ticket-attachments" bucket).
import { supabase } from "@/lib/supabase";
import type { TicketAttachment, TicketPerson } from "../types";
import { logActivity } from "./activity";
import { fail, type Row } from "./shared";

export const BUCKET = "ticket-attachments";
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const toAttachment = (row: Row): TicketAttachment => ({
  id: row.id,
  ticketId: row.ticket_id,
  commentId: row.comment_id ?? null,
  path: row.storage_path,
  name: row.name,
  size: Number(row.size ?? 0),
  type: row.mime_type ?? "application/octet-stream",
  uploadedBy: { id: row.uploaded_by, name: row.uploaded_by_name },
  uploadedAt: row.created_at,
});

const safeName = (name: string) => name.replace(/[^\w.-]+/g, "_").slice(-120);

export const uploadAttachments = async (ticketId: string, files: File[], me: TicketPerson, commentId: string | null = null) => {
  const uploaded: TicketAttachment[] = [];
  for (const file of files) {
    const path = `${ticketId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
    if (uploadError) fail(uploadError, `upload ${file.name}`);
    const { data, error } = await supabase
      .from("ticket_attachments")
      .insert({
        ticket_id: ticketId,
        comment_id: commentId,
        storage_path: path,
        name: file.name,
        size: file.size,
        mime_type: file.type || "application/octet-stream",
        uploaded_by: me.id,
        uploaded_by_name: me.name,
      })
      .select("*")
      .single();
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      fail(error, `save ${file.name}`);
    }
    uploaded.push(toAttachment(data!));
  }
  if (uploaded.length && !commentId) {
    await logActivity(ticketId, me.name, `attached ${uploaded.map((a) => a.name).join(", ")}`);
  }
  return uploaded;
};

export const removeAttachment = async (attachment: TicketAttachment, me: TicketPerson) => {
  const { error } = await supabase.from("ticket_attachments").delete().eq("id", attachment.id);
  if (error) fail(error, "remove attachment");
  await supabase.storage.from(BUCKET).remove([attachment.path]);
  await logActivity(attachment.ticketId, me.name, `removed attachment ${attachment.name}`);
};

export const attachmentUrl = async (attachment: TicketAttachment, download = false) => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(attachment.path, 60 * 10, download ? { download: attachment.name } : undefined);
  if (error) fail(error, "open attachment");
  return data!.signedUrl;
};
