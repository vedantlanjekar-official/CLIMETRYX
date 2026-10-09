"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { refreshAssessmentData } from "@/lib/actions/reports";

export function RefreshData({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshAssessmentData({ businessId });
      if (!result.ok) setError(result.message);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" disabled={busy} onClick={refresh} title="Re-run the climate and risk analysis for the latest submitted answers">
        <RefreshCw aria-hidden className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh climate data
      </Button>
      {error ? <span className="text-xs text-warn-700">{error}</span> : null}
    </span>
  );
}
