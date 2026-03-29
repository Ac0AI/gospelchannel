"use client";

import { useEffect, useRef } from "react";
import posthog from "posthog-js";

export function ToolPageTracker({ toolName }: { toolName: string }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    posthog.capture("tool_started", { tool_name: toolName });
  }, [toolName]);

  return null;
}
