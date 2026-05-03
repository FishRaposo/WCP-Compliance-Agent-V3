import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

interface Props {
  onFile: (file: File) => void;
  onTextSubmit?: (text: string) => void;
  accept?: string;
  label?: string;
  disabled?: boolean;
}

export default function UploadDropzone({
  onFile,
  onTextSubmit,
  accept = ".pdf,.csv",
  label = "Drop PDF or CSV here",
  disabled = false,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          disabled ? "opacity-50 cursor-not-allowed border-gray-200" :
          dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <p className="text-xs text-gray-400 mt-1">or click to browse &middot; Max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>

      {onTextSubmit && (
        <>
          <div className="relative flex items-center">
            <Separator className="flex-1" />
            <span className="px-3 text-xs text-muted-foreground">Or paste text</span>
            <Separator className="flex-1" />
          </div>

          <div className="flex gap-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste WH-347 payroll text here..."
              className="min-h-[120px] flex-1"
              disabled={disabled}
            />
            <Button
              onClick={() => { if (text.trim()) onTextSubmit(text.trim()); }}
              disabled={disabled || !text.trim()}
              className="self-end"
            >
              Analyze
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
