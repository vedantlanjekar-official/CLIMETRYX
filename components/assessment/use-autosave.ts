"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveAssessmentDraft } from "@/lib/actions/assessment";
import type { AssessmentAnswers } from "@/lib/questionnaire/types";

export type SaveState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "local"; message: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; serverAnswers: AssessmentAnswers; serverSavedAt: string; serverRevision: number };

export const LOCAL_KEY = "climetryx.assessment.draft.v1";

export interface LocalBackup {
  answers: AssessmentAnswers;
  savedAt: string;
  revision: number | null;
  currentStep: string;
}

export function readLocalBackup(): LocalBackup | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as LocalBackup) : null;
  } catch {
    return null;
  }
}

export function clearLocalBackup() {
  try {
    window.localStorage.removeItem(LOCAL_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

const DEBOUNCE_MS = 1200;

export function useAutosave(answers: AssessmentAnswers, currentStep: string, initialRevision: number | null, enabled: boolean) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const revision = useRef<number | null>(initialRevision);
  const dirty = useRef(false);
  const latest = useRef({ answers, currentStep });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(2000);
  const inFlight = useRef<Promise<void> | null>(null);
  const firstRender = useRef(true);
  const blocked = useRef(false);
  const saveRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    latest.current = { answers, currentStep };
  }, [answers, currentStep]);

  const save = useCallback(async (force = false) => {
    if (inFlight.current) await inFlight.current;
    if (!dirty.current && !force) return;
    const snapshot = latest.current;
    dirty.current = false;
    setState({ kind: "saving" });
    const run = (async () => {
      try {
        const result = await saveAssessmentDraft({ answers: snapshot.answers, baseRevision: revision.current, currentStep: snapshot.currentStep, force });
        if (result.status === "saved") {
          revision.current = result.revision;
          retryDelay.current = 2000;
          blocked.current = false;
          setState({ kind: "saved", at: result.savedAt });
          window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...snapshot, savedAt: result.savedAt, revision: result.revision } satisfies LocalBackup));
        } else if (result.status === "conflict") {
          blocked.current = true;
          setState({ kind: "conflict", serverAnswers: result.serverAnswers, serverSavedAt: result.serverSavedAt, serverRevision: result.serverRevision });
        } else if (result.status === "local_only") {
          setState({ kind: "local", message: result.message });
        } else {
          dirty.current = true;
          setState({ kind: "error", message: result.message });
          const delay = retryDelay.current;
          retryDelay.current = Math.min(30000, delay * 2);
          timer.current = setTimeout(() => void saveRef.current(), delay);
        }
      } catch {
        dirty.current = true;
        setState({ kind: "error", message: navigator.onLine ? "Could not reach the server. Retrying." : "You are offline. Changes are kept in this browser." });
        const delay = retryDelay.current;
        retryDelay.current = Math.min(30000, delay * 2);
        timer.current = setTimeout(() => void saveRef.current(), delay);
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
  }, []);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ answers, currentStep, savedAt: new Date().toISOString(), revision: revision.current } satisfies LocalBackup));
    } catch {
      // Ignore quota or privacy-mode errors; the server save still runs.
    }
    if (!enabled || blocked.current) return;
    dirty.current = true;
    setState((current) => (current.kind === "conflict" ? current : { kind: "pending" }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [answers, currentStep, enabled, save]);

  useEffect(() => {
    const online = () => {
      if (dirty.current && enabled && !blocked.current) void save();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current && enabled) event.preventDefault();
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [enabled, save]);

  /** Writes the current answers to the server now, even when nothing changed since the last autosave. */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    if (!enabled || blocked.current) return;
    dirty.current = true;
    await save();
  }, [enabled, save]);

  /** Resolve a conflict: keep mine overwrites the server copy, use saved adopts it. */
  const resolveConflict = useCallback(
    async (choice: "keep_mine" | "use_saved") => {
      if (state.kind !== "conflict") return null;
      revision.current = state.serverRevision;
      blocked.current = false;
      if (choice === "keep_mine") {
        dirty.current = true;
        await save(true);
        return null;
      }
      setState({ kind: "saved", at: state.serverSavedAt });
      return state.serverAnswers;
    },
    [save, state],
  );

  return { state, flush, resolveConflict };
}
