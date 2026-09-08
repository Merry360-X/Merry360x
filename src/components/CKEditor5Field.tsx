import React, { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    ClassicEditor?: any;
  }
}

interface CKEditor5FieldProps {
  label?: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minChars?: number;
  minHeight?: number;
  className?: string;
  required?: boolean;
  error?: string | null;
}

let ckEditorScriptLoadingPromise: Promise<any> | null = null;

const loadCKEditor5 = (): Promise<any> => {
  if (window.ClassicEditor) {
    return Promise.resolve(window.ClassicEditor);
  }
  if (ckEditorScriptLoadingPromise) {
    return ckEditorScriptLoadingPromise;
  }

  ckEditorScriptLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.ckeditor.com/ckeditor5/41.4.2/classic/ckeditor.js";
    script.async = true;
    script.onload = () => {
      if (window.ClassicEditor) {
        resolve(window.ClassicEditor);
      } else {
        reject(new Error("CKEditor 5 failed to load on window"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load CKEditor 5 script"));
    document.head.appendChild(script);
  });

  return ckEditorScriptLoadingPromise;
};

export const getPlainTextLength = (html: string): number => {
  if (!html) return 0;
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim().length;
};

export const CKEditor5Field: React.FC<CKEditor5FieldProps> = ({
  label,
  value,
  onChange,
  placeholder = "Write details here...",
  minChars,
  minHeight = 160,
  className = "",
  required = false,
  error,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const isUpdatingFromSelf = useRef(false);

  const charLength = getPlainTextLength(value);
  const hasCharRequirement = typeof minChars === "number" && minChars > 0;
  const isBelowMinChars = hasCharRequirement && charLength > 0 && charLength < minChars;

  useEffect(() => {
    let isMounted = true;
    let editorInstance: any = null;

    loadCKEditor5()
      .then((ClassicEditor) => {
        if (!isMounted || !containerRef.current) return;

        return ClassicEditor.create(containerRef.current, {
          placeholder: placeholder,
          toolbar: [
            "heading",
            "|",
            "bold",
            "italic",
            "link",
            "bulletedList",
            "numberedList",
            "|",
            "blockQuote",
            "insertTable",
            "|",
            "undo",
            "redo",
          ],
          table: {
            contentToolbar: ["tableColumn", "tableRow", "mergeTableCells"],
          },
        }).then((editor: any) => {
          if (!isMounted) {
            editor.destroy();
            return;
          }

          editorRef.current = editor;
          editorInstance = editor;

          // Set initial data
          if (value) {
            editor.setData(value);
          }

          editor.model.document.on("change:data", () => {
            if (isUpdatingFromSelf.current) return;
            const data = editor.getData();
            isUpdatingFromSelf.current = true;
            onChange(data);
            setTimeout(() => {
              isUpdatingFromSelf.current = false;
            }, 10);
          });

          setLoading(false);
        });
      })
      .catch((err) => {
        console.error("[CKEditor5] Initialization error:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (editorInstance) {
        editorInstance.destroy().catch((e: any) => console.warn("[CKEditor5] destroy error:", e));
        editorRef.current = null;
      }
    };
  }, []);

  // Update editor data when value prop changes externally
  useEffect(() => {
    if (editorRef.current && !isUpdatingFromSelf.current) {
      const currentData = editorRef.current.getData();
      if (currentData !== value && (value || currentData)) {
        isUpdatingFromSelf.current = true;
        editorRef.current.setData(value || "");
        setTimeout(() => {
          isUpdatingFromSelf.current = false;
        }, 10);
      }
    }
  }, [value]);

  return (
    <div className={`ckeditor-wrapper space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <Label className="text-sm font-normal block">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
            {hasCharRequirement && (
              <span
                className={`text-xs ml-1.5 font-normal ${
                  isBelowMinChars ? "text-destructive font-medium" : "text-muted-foreground"
                }`}
              >
                ({charLength}/{minChars} chars min)
              </span>
            )}
          </Label>
        </div>
      )}

      <div
        className={`relative rounded-md border transition-all ${
          isBelowMinChars || error ? "border-destructive ring-1 ring-destructive/30" : "border-input"
        } bg-background text-foreground`}
        style={{ minHeight: `${minHeight + 42}px` }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 rounded-md backdrop-blur-xs">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-xs text-muted-foreground">Loading CKEditor 5...</span>
          </div>
        )}

        <div
          ref={containerRef}
          style={{ minHeight: `${minHeight}px` }}
          className="ck-editor-container"
        />
      </div>

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}

      <style>{`
        .ckeditor-wrapper .ck-editor__editable_inline {
          min-height: ${minHeight}px;
          padding: 0.75rem 1rem;
          color: hsl(var(--foreground));
          background-color: hsl(var(--background));
          border-bottom-left-radius: calc(var(--radius) - 2px) !important;
          border-bottom-right-radius: calc(var(--radius) - 2px) !important;
        }
        .ckeditor-wrapper .ck.ck-toolbar {
          background-color: hsl(var(--muted)) !important;
          border-top-left-radius: calc(var(--radius) - 2px) !important;
          border-top-right-radius: calc(var(--radius) - 2px) !important;
          border-color: hsl(var(--border)) !important;
        }
        .ckeditor-wrapper .ck.ck-editor__main > .ck-editor__editable {
          border-color: hsl(var(--border)) !important;
        }
        .ckeditor-wrapper .ck.ck-editor__editable:not(.ck-editor__nested-editable).ck-focused {
          border-color: hsl(var(--primary)) !important;
          box-shadow: none !important;
        }
        .ckeditor-wrapper .ck.ck-button {
          color: hsl(var(--foreground)) !important;
        }
        .ckeditor-wrapper .ck.ck-button:hover {
          background: hsl(var(--accent)) !important;
        }
        .ckeditor-wrapper .ck.ck-button.ck-on {
          background: hsl(var(--primary) / 0.15) !important;
          color: hsl(var(--primary)) !important;
        }
        .ckeditor-wrapper .ck-content h1,
        .ckeditor-wrapper .ck-content h2,
        .ckeditor-wrapper .ck-content h3 {
          font-weight: 600;
          margin-top: 0.5rem;
          margin-bottom: 0.25rem;
        }
        .ckeditor-wrapper .ck-content ul {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .ckeditor-wrapper .ck-content ol {
          list-style-type: decimal;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .ckeditor-wrapper .ck-content p {
          margin-bottom: 0.5rem;
        }
        .ckeditor-wrapper .ck-content blockquote {
          border-left: 3px solid hsl(var(--primary));
          padding-left: 0.75rem;
          margin: 0.5rem 0;
          color: hsl(var(--muted-foreground));
        }
      `}</style>
    </div>
  );
};

export default CKEditor5Field;
