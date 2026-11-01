"use client";

import type { ComponentPropsWithoutRef } from "react";
import { ChurchAskPanel, useChurchChat } from "@/components/ChurchAskPanel";
import { TrackedChurchSearchForm } from "@/components/ChurchJourneyAnalytics";
import { isConversationalQuery } from "@/lib/church-chat/intent";

const EXAMPLE_QUESTION = "Contemporary worship church in London";

type Props = Omit<ComponentPropsWithoutRef<"form">, "onSubmit"> & {
  showExample?: boolean;
};

// The directory search form, plus the church guide: a sentence or question is
// answered in place instead of running a keyword search for it.
export function ChurchAskDirectoryForm({ children, className = "", showExample = true, ...formProps }: Props) {
  const chat = useChurchChat("directory");

  return (
    <div className={className}>
      <TrackedChurchSearchForm
        {...formProps}
        variant="directory"
        onSubmit={(event) => {
          const query = String(new FormData(event.currentTarget).get("q") || "").trim();
          if (!isConversationalQuery(query)) return;
          event.preventDefault();
          // Blur closes the autocomplete list so it does not cover the answer.
          (document.activeElement as HTMLElement | null)?.blur();
          void chat.ask(query);
        }}
      >
        {children}
      </TrackedChurchSearchForm>

      {showExample && chat.exchanges.length === 0 ? (
        <p className="mt-3 pl-1 text-sm text-warm-brown">
          You can also ask a question, like{" "}
          <button
            type="button"
            onClick={() => void chat.ask(EXAMPLE_QUESTION)}
            className="inline min-h-11 font-semibold text-rose-gold-deep underline decoration-rose-gold/40 underline-offset-4 hover:decoration-rose-gold"
          >
            &ldquo;{EXAMPLE_QUESTION}&rdquo;
          </button>
        </p>
      ) : null}

      <ChurchAskPanel
        exchanges={chat.exchanges}
        pending={chat.pending}
        onAsk={(question) => void chat.ask(question)}
        onClose={chat.reset}
        variant="directory"
        tone="light"
        className="mt-4"
      />
    </div>
  );
}
