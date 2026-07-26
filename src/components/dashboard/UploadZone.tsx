"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

export default function UploadZone({
  onFileSelected,
}: {
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files && files.length > 0) {
      onFileSelected(files[0]);
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition ${
        isDragging
          ? "border-[#2563EB] bg-[#2563EB]/5"
          : "border-gray-300 dark:border-gray-700 hover:border-[#2563EB]/50"
      }`}
    >
      <UploadCloud size={40} className="text-[#2563EB] mb-3" />
      <p className="font-medium text-[#111827] dark:text-white">
        Drag & drop a file here, or click to browse
      </p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Supports CSV, XLSX, and XLS
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}