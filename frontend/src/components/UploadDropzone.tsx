import { useRef, useState } from "react";

interface Props {
  onFile: (file: File) => void;
  accept?: string;
  label?: string;
}

export default function UploadDropzone({ onFile, accept = ".pdf,.csv", label = "Drop PDF or CSV here" }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
        dragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400"
      }`}
    >
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-xs text-gray-400 mt-1">or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}
