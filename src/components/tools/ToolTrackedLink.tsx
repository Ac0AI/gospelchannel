"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";
import posthog from "posthog-js";

type ToolTrackedLinkProps = ComponentProps<typeof Link> & {
  toolName: string;
  resultType: string;
  resultLabel: string;
  markComplete?: boolean;
};

export function ToolTrackedLink({
  toolName,
  resultType,
  resultLabel,
  markComplete = false,
  onClick,
  href,
  ...props
}: ToolTrackedLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    posthog.capture("tool_result_clicked", {
      tool_name: toolName,
      result_type: resultType,
      result_label: resultLabel,
      href: typeof href === "string" ? href : undefined,
    });
    if (markComplete) {
      posthog.capture("tool_completed", {
        tool_name: toolName,
        completion_source: "cta_click",
        result_type: resultType,
        result_label: resultLabel,
      });
    }
    onClick?.(event);
  }

  return <Link {...props} href={href} onClick={handleClick} />;
}
