"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { uploadAssessmentDocument } from "@/lib/actions/assessment";
import { DOCUMENT_TYPES } from "@/lib/questionnaire/steps-risk";
import { MAX_UPLOAD_BYTES } from "@/lib/questionnaire/uploads";

export function UploadPanel({ enabled, disabledReason, onUploaded }: { enabled: boolean; disabledReason: string; onUploaded: (row: { assetId: string; filename: string; documentType: string }) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState("other");
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function upload() {
    const file = input.current?.files?.[0];
    if (!file) {
      setMessage({ tone: "bad", text: "Choose a file first." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setMessage({ tone: "bad", text: "Files must be 10 MB or smaller." });
      return;
    }
    const data = new FormData();
    data.set("file", file);
    data.set("documentType", documentType);
    startTransition(async () => {
      const result = await uploadAssessmentDocument(data);
      if (result.ok) {
        onUploaded({ assetId: result.assetId, filename: result.filename, documentType });
        setMessage({ tone: "ok", text: `${result.filename} stored privately for your organisation.` });
        if (input.current) input.current.value = "";
      } else {
        setMessage({ tone: "bad", text: result.message });
      }
    });
  }

  if (!enabled) return <p className="ax-notice ax-warn">{disabledReason}</p>;

  return (
    <div className="ax-section">
      <p className="ax-section-title">Add a document</p>
      <div className="ax-grid">
        <label className="ax-field">
          <span className="ax-label">File</span>
          <input ref={input} type="file" className="ax-control" accept=".pdf,.csv,.xlsx,.png,.jpg,.jpeg" />
          <span className="ax-help">The file type is checked against its contents. Files are not read or parsed for figures.</span>
        </label>
        <label className="ax-field">
          <span className="ax-label">Document type</span>
          <select className="ax-control" value={documentType} onChange={(event) => setDocumentType(event.target.value)}>
            {DOCUMENT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" className="ax-btn ax-btn-secondary mt-4" onClick={upload} disabled={pending}>
        <Upload className="h-4 w-4" aria-hidden /> {pending ? "Uploading" : "Upload"}
      </button>
      {message ? <p className={message.tone === "ok" ? "ax-notice" : "ax-notice ax-bad"} role="status">{message.text}</p> : null}
    </div>
  );
}
