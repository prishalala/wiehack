import { useRef, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { assertPdfFile, formatFileSize } from "@/lib/fileStore";
import { cn } from "@/lib/utils";

export function PdfUploadField({
  label = "PDF attachment",
  hint = "PDF only, up to 12 MB.",
  file,
  onChange,
  disabled,
}: {
  label?: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    if (!f) {
      onChange(null);
      return;
    }
    try {
      assertPdfFile(f);
      onChange(f);
    } catch (e) {
      onChange(null);
      setError(e instanceof Error ? e.message : "Invalid file");
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center sm:justify-between",
          error && "border-destructive",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </span>
          <div className="min-w-0">
            {file ? (
              <>
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No PDF selected</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> {file ? "Replace" : "Upload PDF"}
          </Button>
          {file && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                pick(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
