// [ticket-management] Attachment picker + list (PDF, images, docs: any file type), stored in Supabase Storage.
import { useEffect, useRef, useState } from "react";
import { Download, Eye, File, FileImage, FileText, Paperclip, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MAX_FILE_BYTES, attachmentUrl } from "./api";
import { formatBytes, type TicketAttachment } from "./types";

export const FileIcon = ({ type, className }: { type: string; className?: string }) => {
  if (type.startsWith("image/")) return <FileImage className={cn("text-sky-600", className)} />;
  if (type === "application/pdf") return <FileText className={cn("text-red-600", className)} />;
  return <File className={cn("text-slate-500", className)} />;
};

/** Drops oversized files (with a toast) and returns the rest. */
export const acceptFiles = (list: FileList | File[] | null) => {
  const files = Array.from(list ?? []);
  const tooBig = files.filter((f) => f.size > MAX_FILE_BYTES);
  if (tooBig.length)
    toast({
      title: "Some files were skipped",
      description: `${tooBig.map((f) => f.name).join(", ")} ${tooBig.length > 1 ? "are" : "is"} over ${formatBytes(MAX_FILE_BYTES)}.`,
      variant: "destructive",
    });
  return files.filter((f) => f.size <= MAX_FILE_BYTES);
};

export const StagedFiles = ({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) =>
  files.length ? (
    <ul className="space-y-1.5">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-slate-200 px-2.5 py-1.5 text-sm">
          <FileIcon type={file.type} className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-slate-700">{file.name}</span>
          <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
          <button
            type="button"
            title="Remove"
            onClick={() => onChange(files.filter((_, i) => i !== index))}
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  ) : null;

/** Drop zone + staged file list used in the create-ticket form. */
export const FileDropZone = ({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const add = (list: FileList | null) => {
    const next = acceptFiles(list);
    const seen = new Set(files.map((f) => `${f.name}:${f.size}`));
    onChange([...files, ...next.filter((f) => !seen.has(`${f.name}:${f.size}`))]);
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-4 text-center text-sm transition-colors",
          dragging ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:border-orange-300 hover:bg-slate-50",
        )}
      >
        <Upload className="h-5 w-5 text-slate-400" />
        <span className="font-medium text-slate-700">Click to upload or drag files here</span>
        <span className="text-xs text-slate-500">PDF, JPG, PNG, Word, Excel or any file · up to {formatBytes(MAX_FILE_BYTES)} each</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <StagedFiles files={files} onChange={onChange} />
    </div>
  );
};

const openAttachment = async (attachment: TicketAttachment, download: boolean) => {
  try {
    const url = await attachmentUrl(attachment, download);
    if (download) {
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.name;
      link.click();
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    toast({ title: "Could not open file", description: (error as Error).message, variant: "destructive" });
  }
};

const previewable = (type: string) => type.startsWith("image/") || type === "application/pdf" || type.startsWith("text/");

/** Thumbnail that loads a short-lived signed URL. */
const ImageThumb = ({ attachment, onOpen }: { attachment: TicketAttachment; onOpen: (url: string) => void }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    attachmentUrl(attachment)
      .then((u) => !cancelled && setUrl(u))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [attachment]);
  return (
    <button
      type="button"
      onClick={() => url && onOpen(url)}
      title={attachment.name}
      className="group relative aspect-video overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
    >
      {url ? (
        <img src={url} alt={attachment.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      ) : (
        <span className="flex h-full items-center justify-center"><FileImage className="h-5 w-5 text-slate-300" /></span>
      )}
    </button>
  );
};

/** Inline image previews (used in the detail panel and on comments). */
export const ImageGallery = ({ attachments }: { attachments: TicketAttachment[] }) => {
  const images = attachments.filter((a) => a.type.startsWith("image/"));
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  if (!images.length) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {images.map((a) => (
          <ImageThumb key={a.id} attachment={a} onOpen={(url) => setLightbox({ url, name: a.name })} />
        ))}
      </div>
      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">{lightbox?.name}</DialogTitle>
          {lightbox && <img src={lightbox.url} alt={lightbox.name} className="max-h-[80vh] w-full rounded object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
};

/** Compact list of files (name, size, uploader, view/download/remove). */
export const AttachmentRows = ({
  attachments,
  canRemove,
  onRemove,
}: {
  attachments: TicketAttachment[];
  canRemove: (attachment: TicketAttachment) => boolean;
  onRemove: (attachment: TicketAttachment) => void;
}) => (
  <ul className="space-y-1.5">
    {attachments.map((a) => (
      <li key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <FileIcon type={a.type} className="h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{a.name}</p>
          <p className="text-xs text-slate-500">
            {formatBytes(a.size)} · {a.uploadedBy.name}
          </p>
        </div>
        {previewable(a.type) && (
          <button type="button" title="View" onClick={() => openAttachment(a, false)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            <Eye className="h-4 w-4" />
          </button>
        )}
        <button type="button" title="Download" onClick={() => openAttachment(a, true)} className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <Download className="h-4 w-4" />
        </button>
        {canRemove(a) && (
          <button type="button" title="Remove" onClick={() => onRemove(a)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </li>
    ))}
  </ul>
);

/** Attachment section on the ticket detail panel. */
export const AttachmentList = ({
  attachments,
  canUpload,
  canRemove,
  onUpload,
  onRemove,
}: {
  attachments: TicketAttachment[];
  canUpload: boolean;
  canRemove: (attachment: TicketAttachment) => boolean;
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (attachment: TicketAttachment) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Paperclip className="h-3.5 w-3.5" />Documents ({attachments.length})
        </p>
        {canUpload && (
          <>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />{busy ? "Uploading…" : "Add documents"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = acceptFiles(e.target.files);
                e.target.value = "";
                if (!files.length) return;
                setBusy(true);
                try {
                  await onUpload(files);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </>
        )}
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-slate-400">No documents attached.</p>
      ) : (
        <>
          <ImageGallery attachments={attachments} />
          <AttachmentRows attachments={attachments} canRemove={canRemove} onRemove={onRemove} />
        </>
      )}
    </div>
  );
};
