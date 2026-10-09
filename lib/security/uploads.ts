const ALLOWED = new Set([
  "text/csv",
  "application/json",
  "application/geo+json",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/geopackage+sqlite3",
  "image/tiff",
  "application/x-netcdf",
]);

const DENIED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "js",
  "mjs",
  "sh",
  "bat",
  "cmd",
  "ps1",
  "sql",
  "msi",
  "com",
  "scr",
]);

export interface UploadCheck {
  ok: boolean;
  errors: string[];
}

export function validateUpload(input: {
  filename: string;
  contentType: string;
  sizeBytes: number;
  zipEntries?: string[];
}): UploadCheck {
  const errors: string[] = [];
  const extension = input.filename.split(".").pop()?.toLowerCase() ?? "";
  if (DENIED_EXTENSIONS.has(extension)) errors.push("This file type cannot be uploaded.");
  if (!ALLOWED.has(input.contentType)) errors.push("Content type is not in the allowed import list.");
  if (input.sizeBytes <= 0 || input.sizeBytes > 52_428_800) {
    errors.push("File size must be between 1 byte and 50 MB for this upload path.");
  }
  if (input.filename.includes("..") || input.filename.includes("/") || input.filename.includes("\\")) {
    errors.push("Filename must not include a path.");
  }
  for (const entry of input.zipEntries ?? []) {
    if (entry.startsWith("/") || entry.includes("..") || entry.includes("\\")) {
      errors.push(`Archive entry is not allowed: ${entry}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
