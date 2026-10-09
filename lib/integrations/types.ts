export type SourceStatus =
  | "verified"
  | "implemented_unverified"
  | "needs_credentials"
  | "needs_download"
  | "requires_license_check"
  | "unavailable"
  | "needs_configuration";

export interface Provenance {
  sourceId: string;
  retrievedAt: string;
  validFrom: string | null;
  validTo: string | null;
  licence: string;
  attribution: string;
  spatialResolution: string;
  temporalResolution: string;
  transformationVersion: string;
}

export interface AdapterHealth {
  sourceId: string;
  status: SourceStatus;
  detail: string;
  configured: boolean;
}
