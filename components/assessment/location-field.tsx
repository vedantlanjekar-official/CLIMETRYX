"use client";

import { useState, useTransition } from "react";
import { MapPin, Search } from "lucide-react";
import { geocodeAction } from "@/lib/actions/workspace";
import { SiteMap } from "@/components/maps/site-map";
import { geopointKeys } from "@/lib/questionnaire/engine";
import type { AnswerValue } from "@/lib/questionnaire/types";

type Candidate = { name: string; latitude: number; longitude: number; country?: string };

function parseCoordinate(text: string): AnswerValue {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : trimmed;
}

export function LocationField({
  id,
  fieldKey,
  values,
  searchHint,
  onPatch,
  error,
}: {
  id: string;
  fieldKey: string;
  values: Record<string, AnswerValue>;
  searchHint: string;
  onPatch: (patch: Record<string, AnswerValue>) => void;
  error?: string;
}) {
  const keys = geopointKeys(fieldKey);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const lat = values[keys.lat];
  const lon = values[keys.lon];
  const [latText, setLatText] = useState(lat === null || lat === undefined ? "" : String(lat));
  const [lonText, setLonText] = useState(lon === null || lon === undefined ? "" : String(lon));
  const confirmation = values[keys.confirmation];
  const hasPoint = typeof lat === "number" && typeof lon === "number" && !(lat === 0 && lon === 0);

  function search() {
    const term = (query || searchHint).trim();
    if (term.length < 2) {
      setMessage("Enter a town or locality to search.");
      return;
    }
    startTransition(async () => {
      const result = await geocodeAction(term);
      setMessage(result.message);
      setCandidates(result.results ?? []);
    });
  }

  function pick(candidate: Candidate) {
    setLatText(String(candidate.latitude));
    setLonText(String(candidate.longitude));
    onPatch({ [keys.lat]: candidate.latitude, [keys.lon]: candidate.longitude, [keys.source]: "open-meteo-geocoding", [keys.match]: "place_name_candidate", [keys.confirmation]: null });
    setCandidates([]);
    setMessage(`Using ${candidate.name}. This is a place-level match, not the building. Adjust the coordinates if needed, then confirm below.`);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          id={id}
          className="ax-control"
          placeholder={searchHint ? `Search, e.g. ${searchHint}` : "Search town or locality"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />
        <button type="button" className="ax-btn ax-btn-secondary shrink-0" onClick={search} disabled={pending}>
          <Search className="h-4 w-4" aria-hidden /> {pending ? "Searching" : "Find"}
        </button>
      </div>
      {message ? <p className="ax-help" role="status">{message}</p> : null}
      {candidates.length ? (
        <ul className="ax-choices" aria-label="Place candidates">
          {candidates.slice(0, 6).map((candidate) => (
            <li key={`${candidate.latitude}-${candidate.longitude}-${candidate.name}`}>
              <button type="button" className="ax-choice w-full text-left" onClick={() => pick(candidate)}>
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ax-green)]" aria-hidden />
                <span>
                  {candidate.name}
                  {candidate.country ? `, ${candidate.country}` : ""}
                  <span className="block text-xs tabular-nums text-[var(--ax-muted)]">{candidate.latitude.toFixed(4)}, {candidate.longitude.toFixed(4)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <label className="ax-field">
          <span className="ax-help">Latitude</span>
          <input
            className="ax-control tabular-nums"
            inputMode="decimal"
            value={latText}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setLatText(event.target.value);
              onPatch({ [keys.lat]: parseCoordinate(event.target.value), [keys.source]: "manual", [keys.match]: "manual_coordinates", [keys.confirmation]: null });
            }}
          />
        </label>
        <label className="ax-field">
          <span className="ax-help">Longitude</span>
          <input
            className="ax-control tabular-nums"
            inputMode="decimal"
            value={lonText}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) => {
              setLonText(event.target.value);
              onPatch({ [keys.lon]: parseCoordinate(event.target.value), [keys.source]: "manual", [keys.match]: "manual_coordinates", [keys.confirmation]: null });
            }}
          />
        </label>
      </div>
      {hasPoint ? (
        <>
          <SiteMap latitude={lat} longitude={lon} label={typeof values.label === "string" && values.label ? values.label : "Selected position"} />
          <fieldset className="ax-choices">
            <legend className="sr-only">Confirm the position</legend>
            <label className="ax-choice">
              <input type="radio" name={`${id}-confirm`} checked={confirmation === "confirmed_pin"} onChange={() => onPatch({ [keys.confirmation]: "confirmed_pin" })} />
              <span>The pin marks the site.</span>
            </label>
            <label className="ax-choice">
              <input type="radio" name={`${id}-confirm`} checked={confirmation === "accepted_low_precision"} onChange={() => onPatch({ [keys.confirmation]: "accepted_low_precision" })} />
              <span>
                Use as an approximate position.
                <span className="block text-xs text-[var(--ax-muted)]">Hazard data is then reported for the area, not the premises.</span>
              </span>
            </label>
          </fieldset>
        </>
      ) : null}
    </div>
  );
}
