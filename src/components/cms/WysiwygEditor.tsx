"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Minus,
  Undo,
  Redo,
  RemoveFormatting,
  Code,
  Eye,
  Edit3,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface WysiwygEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export function WysiwygEditor({
  value,
  onChange,
  placeholder = "Mulai tulis artikel atau liputan kegiatan di sini...",
  minHeight = "420px",
}: WysiwygEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState(value);
  const isUpdatingRef = useRef(false);

  // Sync initial value into editor
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value && !isUpdatingRef.current) {
      editorRef.current.innerHTML = value || "";
      setHtmlSource(value || "");
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isUpdatingRef.current = true;
    const content = editorRef.current.innerHTML;
    setHtmlSource(content);
    onChange(content);
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 50);
  };

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (viewMode !== "visual") return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    handleInput();
  };

  const handleInsertLink = () => {
    const url = prompt("Masukkan URL tautan (contoh: https://...):", "https://");
    if (url && url !== "https://") {
      executeCommand("createLink", url);
    }
  };

  const handleInsertImageUrl = () => {
    const url = prompt("Masukkan URL gambar (contoh: https://...):", "https://");
    if (url && url !== "https://") {
      executeCommand("insertImage", url);
    }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        executeCommand("insertImage", dataUrl);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSourceChange = (newHtml: string) => {
    setHtmlSource(newHtml);
    onChange(newHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = newHtml;
    }
  };

  return (
    <div className="border rounded-xl bg-card overflow-hidden shadow-sm flex flex-col focus-within:ring-1 focus-within:ring-primary/50 transition-all">
      {/* Hidden file input for inline image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleUploadImage}
      />

      {/* WYSIWYG Toolbar */}
      <div className="bg-muted/50 border-b p-2 flex flex-wrap items-center gap-1 text-xs select-none">
        {/* View mode toggle */}
        <div className="flex items-center bg-background rounded-md p-0.5 border mr-2">
          <button
            type="button"
            onClick={() => setViewMode("visual")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
              viewMode === "visual"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Visual Editor (WYSIWYG)"
          >
            <Edit3 className="h-3 w-3" /> Visual
          </button>
          <button
            type="button"
            onClick={() => setViewMode("html")}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
              viewMode === "html"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="HTML Source Code"
          >
            <Code className="h-3 w-3" /> HTML
          </button>
        </div>

        {viewMode === "visual" && (
          <>
            {/* Headings */}
            <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
              <button
                type="button"
                onClick={() => executeCommand("formatBlock", "<p>")}
                className="h-8 px-2 hover:bg-background rounded text-xs font-semibold text-muted-foreground hover:text-foreground"
                title="Paragraf Biasa"
              >
                P
              </button>
              <button
                type="button"
                onClick={() => executeCommand("formatBlock", "<h2>")}
                className="h-8 px-2 hover:bg-background rounded text-xs font-bold text-muted-foreground hover:text-foreground"
                title="Heading 2 (Subjudul Besar)"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => executeCommand("formatBlock", "<h3>")}
                className="h-8 px-2 hover:bg-background rounded text-xs font-bold text-muted-foreground hover:text-foreground"
                title="Heading 3 (Subjudul Sedang)"
              >
                H3
              </button>
            </div>

            {/* Inline Formatting */}
            <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
              <button
                type="button"
                onClick={() => executeCommand("bold")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Tebal (Ctrl+B)"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("italic")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Miring (Ctrl+I)"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("underline")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Garis Bawah (Ctrl+U)"
              >
                <Underline className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("strikeThrough")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Coretan"
              >
                <Strikethrough className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Lists & Quotes */}
            <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
              <button
                type="button"
                onClick={() => executeCommand("insertUnorderedList")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Daftar Poin (Bullet List)"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("insertOrderedList")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Daftar Angka (Numbered List)"
              >
                <ListOrdered className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("formatBlock", "<blockquote>")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Kutipan (Quote)"
              >
                <Quote className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
              <button
                type="button"
                onClick={() => executeCommand("justifyLeft")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Rata Kiri"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("justifyCenter")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Rata Tengah"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("justifyRight")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Rata Kanan"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("justifyFull")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Rata Kiri-Kanan (Justify)"
              >
                <AlignJustify className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Link & Media */}
            <div className="flex items-center gap-0.5 border-r pr-1.5 mr-1">
              <button
                type="button"
                onClick={handleInsertLink}
                className="h-8 px-2 flex items-center gap-1 hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Sisipkan Tautan"
              >
                <LinkIcon className="h-3.5 w-3.5" /> Tautan
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-2 flex items-center gap-1 hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Unggah Foto Langsung ke Konten"
              >
                <Upload className="h-3.5 w-3.5" /> Sisip Foto
              </button>
              <button
                type="button"
                onClick={handleInsertImageUrl}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Sisipkan Gambar dari URL"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("insertHorizontalRule")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Garis Pembatas (Divider)"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Undo / Redo & Clear */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => executeCommand("undo")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("redo")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand("removeFormat")}
                className="h-8 w-8 flex items-center justify-center hover:bg-background rounded text-muted-foreground hover:text-foreground"
                title="Hapus Format"
              >
                <RemoveFormatting className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Editor Content Area */}
      <div className="relative flex-1 bg-background">
        {viewMode === "visual" ? (
          <div
            ref={editorRef}
            contentEditable
            onInput={handleInput}
            style={{ minHeight }}
            data-placeholder={placeholder}
            className="p-5 sm:p-6 outline-none text-foreground text-sm sm:text-base leading-relaxed prose prose-slate max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-5 [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mt-4 [&>h3]:mb-1 [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>blockquote]:border-l-4 [&>blockquote]:border-primary/60 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:my-3 [&>img]:rounded-lg [&>img]:max-w-full [&>img]:my-3 [&>hr]:my-4 [&>a]:text-primary [&>a]:underline"
          />
        ) : (
          <textarea
            value={htmlSource}
            onChange={(e) => handleSourceChange(e.target.value)}
            style={{ minHeight }}
            className="w-full h-full p-4 font-mono text-xs outline-none bg-background text-foreground resize-y leading-relaxed border-0"
            placeholder="<html>...</html>"
          />
        )}
      </div>
    </div>
  );
}
