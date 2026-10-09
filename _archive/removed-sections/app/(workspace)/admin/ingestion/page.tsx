"use client";

import { useState } from "react";
import { validateUpload } from "@/lib/security/uploads";
import { Button, Field, TextInput } from "@/components/ui/primitives";

export default function IngestionPage() {
  const [report, setReport] = useState<string>("");
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-4xl">Ingestion</h1>
      <p className="text-sm">Files are checked for type, size, and archive paths. They are not executed. Saving the file requires Supabase Storage and an owner or admin role.</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const file = data.get("file");
          if (!(file instanceof File)) return;
          const check = validateUpload({ filename: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size });
          setReport(check.ok ? `${file.name} passed the local checks. It has not been uploaded.` : check.errors.join(" "));
        }}
      >
        <Field label="Import file"><TextInput name="file" type="file" required /></Field>
        <Button type="submit">Validate</Button>
      </form>
      {report ? <p className="text-sm" role="status">{report}</p> : null}
    </div>
  );
}
