import { useEffect, useState } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFileSize, getPdfObjectUrl, getPdfRecord } from "@/lib/fileStore";

export function PdfAttachmentLink({
  fileId,
  fileName,
}: {
  fileId?: string | undefined;
  fileName?: string | undefined;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    if (!fileId) {
      setUrl(null);
      setSize(null);
      setMissing(false);
      return;
    }
    setLoading(true);
    void (async () => {
      const record = await getPdfRecord(fileId);
      if (cancelled) return;
      if (!record) {
        setMissing(true);
        setLoading(false);
        return;
      }
      const objectUrl = await getPdfObjectUrl(fileId);
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      revoked = objectUrl;
      setUrl(objectUrl);
      setSize(record.size);
      setMissing(false);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fileId]);

  if (!fileId) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{fileName ?? "Attachment.pdf"}</p>
        {size != null && <p className="text-xs text-muted-foreground">{formatFileSize(size)}</p>}
        {missing && <p className="text-xs text-destructive">File missing from this browser</p>}
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : url ? (
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" /> Open PDF
          </a>
        </Button>
      ) : null}
    </div>
  );
}
