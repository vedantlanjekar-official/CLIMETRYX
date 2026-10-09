export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface FileKind {
  extensions: string[];
  contentTypes: string[];
  matches: (head: Uint8Array) => boolean;
}

const startsWith = (head: Uint8Array, signature: number[]) => signature.every((byte, index) => head[index] === byte);

const KINDS: Record<string, FileKind> = {
  pdf: { extensions: ["pdf"], contentTypes: ["application/pdf"], matches: (head) => startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  png: { extensions: ["png"], contentTypes: ["image/png"], matches: (head) => startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpeg: { extensions: ["jpg", "jpeg"], contentTypes: ["image/jpeg"], matches: (head) => startsWith(head, [0xff, 0xd8, 0xff]) },
  xlsx: {
    extensions: ["xlsx"],
    contentTypes: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"],
    matches: (head) => startsWith(head, [0x50, 0x4b, 0x03, 0x04]),
  },
  csv: {
    extensions: ["csv"],
    contentTypes: ["text/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream"],
    matches: (head) => head.length > 0 && head.every((byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte !== 0x7f)),
  },
};

export type UploadCheck =
  | { ok: true; kind: keyof typeof KINDS; extension: string; safeName: string }
  | { ok: false; message: string };

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.normalize("NFKD").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").replace(/^\.+/, "");
  return (cleaned || "file").slice(-120);
}

/** Checks size, extension, declared type and the file's leading bytes agree. */
export function checkUpload(input: { name: string; size: number; type: string; head: Uint8Array }): UploadCheck {
  if (input.size <= 0) return { ok: false, message: "The file is empty." };
  if (input.size > MAX_UPLOAD_BYTES) return { ok: false, message: "Files must be 10 MB or smaller." };
  const safeName = sanitizeFilename(input.name);
  const extension = safeName.includes(".") ? safeName.split(".").pop()!.toLowerCase() : "";
  const entry = Object.entries(KINDS).find(([, kind]) => kind.extensions.includes(extension));
  if (!entry) return { ok: false, message: "Use PDF, CSV, XLSX, PNG or JPEG." };
  const [kindName, kind] = entry;
  if (input.type && !kind.contentTypes.includes(input.type)) return { ok: false, message: "The file type does not match its extension." };
  if (!kind.matches(input.head)) return { ok: false, message: "The file contents do not match its extension." };
  return { ok: true, kind: kindName as keyof typeof KINDS, extension, safeName };
}
