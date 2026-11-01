"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { wantsNearbyChurches } from "@/lib/church-chat/intent";
import type { ChurchChatAnswer, ChurchChatCard, ChurchChatTurn } from "@/lib/church-chat/types";

type ErrorKind = "rate_limited" | "busy" | "failed";

type Exchange = {
  id: number;
  question: string;
  answer?: ChurchChatAnswer;
  error?: ErrorKind;
};

const KEEP_EXCHANGES = 3;

function getApproximateLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  });
}

export function useChurchChat(variant: string) {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);

  const ask = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim().slice(0, 400);
      if (!question || pending) return;
      const id = nextId.current++;
      const history = exchanges.filter((exchange) => exchange.answer);
      const followUp = history.length > 0;
      setExchanges((current) => [...current, { id, question }].slice(-KEEP_EXCHANGES));
      setPending(true);
      const startedAt = Date.now();
      const nearby = wantsNearbyChurches(question);
      posthog.capture("church_chat_asked", { variant, follow_up: followUp, near_me: nearby, length: question.length });

      const messages: ChurchChatTurn[] = [
        ...history.slice(-2).flatMap((exchange): ChurchChatTurn[] => [
          { role: "user", text: exchange.question },
          { role: "assistant", text: exchange.answer?.reply ?? "" },
        ]),
        { role: "user", text: question },
      ];

      let result: Pick<Exchange, "answer" | "error">;
      try {
        const location = nearby ? await getApproximateLocation() : null;
        const response = await fetch("/api/church-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, location }),
        });
        if (response.status === 429) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          result = { error: body.error === "busy" ? "busy" : "rate_limited" };
        } else if (!response.ok) {
          result = { error: "failed" };
        } else {
          result = { answer: (await response.json()) as ChurchChatAnswer };
        }
      } catch {
        result = { error: "failed" };
      }

      posthog.capture("church_chat_answered", {
        variant,
        ok: Boolean(result.answer),
        error: result.error,
        churches: result.answer?.churches.length ?? 0,
        has_guide: Boolean(result.answer?.guide),
        ms: Date.now() - startedAt,
      });
      setExchanges((current) => current.map((exchange) => (exchange.id === id ? { ...exchange, ...result } : exchange)));
      setPending(false);
    },
    [exchanges, pending, variant],
  );

  const reset = useCallback(() => setExchanges([]), []);

  return { exchanges, pending, ask, reset };
}

const ERROR_COPY: Record<ErrorKind, string> = {
  rate_limited: "That's a lot of questions in a short time. Try again in a few minutes, or search the directory.",
  busy: "The church guide has answered all it can for today. Search the directory instead, it has every church.",
  failed: "Something went wrong on our side. Search the directory instead, or try again.",
};

function ChurchRow({ church, variant }: { church: ChurchChatCard; variant: string }) {
  const tags = [...church.styles, church.denomination, church.language].filter(
    (tag, index, all): tag is string => Boolean(tag) && all.indexOf(tag) === index,
  );
  return (
    <li>
      <Link
        href={church.href}
        onClick={() => posthog.capture("church_chat_result_selected", { variant, church_slug: church.slug })}
        className="group flex min-h-11 flex-col gap-1.5 rounded-2xl border border-espresso/10 bg-white px-4 py-3.5 transition-colors hover:border-rose-gold/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-gold"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 font-semibold leading-snug text-espresso [overflow-wrap:anywhere]">{church.name}</span>
          <span aria-hidden="true" className="shrink-0 text-rose-gold transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
        {church.place || church.distanceKm != null ? (
          <span className="text-sm text-warm-brown">
            {church.place}
            {church.distanceKm != null ? `${church.place ? " · " : ""}${church.distanceKm} km away` : ""}
          </span>
        ) : null}
        {church.serviceTime ? (
          <span className="text-sm font-medium text-espresso">
            <span className="sr-only">Service: </span>
            {church.serviceTime}
          </span>
        ) : null}
        {tags.length > 0 ? (
          <span className="flex flex-wrap gap-1.5 pt-0.5">
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-full bg-linen px-2.5 py-0.5 text-xs capitalize text-warm-brown">
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </Link>
    </li>
  );
}

function AnswerSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <div className="h-4 w-4/5 animate-pulse rounded-full bg-espresso/[0.07]" />
      <div className="h-4 w-3/5 animate-pulse rounded-full bg-espresso/[0.07]" />
      <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
        <div className="h-[92px] animate-pulse rounded-2xl bg-espresso/[0.05]" />
        <div className="h-[92px] animate-pulse rounded-2xl bg-espresso/[0.05]" />
      </div>
    </div>
  );
}

type PanelProps = {
  exchanges: Exchange[];
  pending: boolean;
  onAsk: (question: string) => void;
  onClose: () => void;
  variant: string;
  // "dark": floats over the photo hero. "light": sits on the linen page.
  tone?: "dark" | "light";
  className?: string;
};

const TONE_CLASSES = {
  dark: "bg-linen shadow-[0_24px_70px_rgba(20,12,8,0.38)]",
  light: "bg-white shadow-[0_12px_40px_rgba(59,42,34,0.08)] ring-1 ring-espresso/[0.08]",
} as const;

export function ChurchAskPanel({ exchanges, pending, onAsk, onClose, variant, tone = "dark", className = "" }: PanelProps) {
  const [followUp, setFollowUp] = useState("");
  const latestRef = useRef<HTMLDivElement>(null);
  const latestId = exchanges.at(-1)?.id;

  useEffect(() => {
    if (exchanges.length > 1) latestRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [latestId, exchanges.length]);

  if (exchanges.length === 0) return null;
  const last = exchanges.at(-1);
  const lastSearchHref =
    [...exchanges].reverse().find((exchange) => exchange.answer?.searchHref)?.answer?.searchHref ??
    `/church?q=${encodeURIComponent(last?.question ?? "")}`;

  return (
    <section
      aria-label="Answer from the church guide"
      className={`relative rounded-[28px] p-5 text-left text-espresso sm:p-7 ${TONE_CLASSES[tone]} ${className}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close the answer"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-warm-brown transition-colors hover:bg-espresso/[0.06] hover:text-espresso focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-gold"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>

      <div className="space-y-7">
        {exchanges.map((exchange) => {
          const isLatest = exchange.id === latestId;
          const { answer, error } = exchange;
          return (
            <div key={exchange.id} ref={isLatest ? latestRef : undefined} className="space-y-4">
              <p className="pr-12 text-sm text-warm-brown">
                <span className="sr-only">You asked: </span>
                <span className="font-medium text-espresso/80">&ldquo;{exchange.question}&rdquo;</span>
              </p>

              <div aria-live={isLatest ? "polite" : undefined} aria-busy={isLatest && pending && !answer && !error}>
                {!answer && !error ? <AnswerSkeleton /> : null}

                {error ? (
                  <p className="text-[15px] leading-relaxed text-espresso">
                    {ERROR_COPY[error]}{" "}
                    <Link href={lastSearchHref} className="font-semibold text-rose-gold-deep underline-offset-4 hover:underline">
                      Search the directory
                    </Link>
                  </p>
                ) : null}

                {answer ? (
                  <div className="space-y-4">
                    <p className="font-serif text-lg leading-snug text-espresso sm:text-xl">{answer.reply}</p>

                    {answer.churches.length > 0 ? (
                      <ul className="grid gap-2.5 sm:grid-cols-2">
                        {answer.churches.map((church) => (
                          <ChurchRow key={church.slug} church={church} variant={variant} />
                        ))}
                      </ul>
                    ) : null}

                    {answer.guide ? (
                      <Link
                        href={answer.guide.href}
                        className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-rose-gold/25 bg-blush-light/60 px-4 py-3 text-sm font-semibold text-espresso transition-colors hover:border-rose-gold/50"
                      >
                        <span>Read the guide: {answer.guide.title}</span>
                        <span aria-hidden="true" className="text-rose-gold">→</span>
                      </Link>
                    ) : null}

                    {answer.churches.some((church) => church.serviceTime) ? (
                      <p className="text-xs leading-relaxed text-warm-brown">
                        Times come from our directory and can change. Confirm with the church before you go.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="mt-6 flex items-center gap-2 border-t border-espresso/10 pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          const value = followUp.trim();
          if (!value) return;
          onAsk(value);
          setFollowUp("");
        }}
      >
        <label htmlFor={`church-ask-followup-${variant}`} className="sr-only">
          Ask a follow-up question
        </label>
        <input
          id={`church-ask-followup-${variant}`}
          name="followup"
          value={followUp}
          onChange={(event) => setFollowUp(event.target.value)}
          maxLength={400}
          autoComplete="off"
          placeholder="Ask a follow-up…"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-espresso/15 bg-white px-4 text-base text-espresso outline-none placeholder:text-warm-brown/55 focus:border-rose-gold"
        />
        <button
          type="submit"
          disabled={pending || !followUp.trim()}
          className="min-h-11 shrink-0 rounded-full bg-espresso px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-gold-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>
      <p className="mt-3 text-center text-xs text-warm-brown">
        <Link href={lastSearchHref} className="underline-offset-4 hover:text-espresso hover:underline">
          Browse every match in the directory
        </Link>
      </p>
    </section>
  );
}
