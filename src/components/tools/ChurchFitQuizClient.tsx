"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import {
  QUIZ_QUESTIONS,
  collectTopChurchMatches,
  scoreQuizLanes,
  type ToolChurchPreview,
  type DiscoveryLane,
} from "@/lib/tooling";
import { ToolActionCard, ToolChurchGrid } from "@/components/tools/ToolCards";

export function ChurchFitQuizClient({ lanes }: { lanes: DiscoveryLane[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [areaQuery, setAreaQuery] = useState("");
  const [matchResponse, setMatchResponse] = useState<{
    key: string;
    churches: ToolChurchPreview[];
    error: string | null;
  }>({
    key: "",
    churches: [],
    error: null,
  });
  const completionTrackedRef = useRef(false);
  const fetchRequestRef = useRef(0);

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = QUIZ_QUESTIONS.find((question) => !answers[question.id]) ?? null;
  const isComplete = currentQuestion === null;
  const results = isComplete ? scoreQuizLanes(answers, lanes) : [];
  const topResultId = results[0]?.id ?? null;
  const resultCount = results.length;
  const fallbackChurches = isComplete ? collectTopChurchMatches(results) : [];
  const deferredAreaQuery = useDeferredValue(areaQuery.trim());
  const laneKey = results.map((lane) => lane.id).join(",");
  const requestKey = laneKey ? `${laneKey}::${deferredAreaQuery}` : "";
  const matchedChurches = matchResponse.key === requestKey ? matchResponse.churches : [];
  const matchesError = matchResponse.key === requestKey ? matchResponse.error : null;
  const isLoadingMatches = Boolean(requestKey) && isComplete && matchResponse.key !== requestKey;
  const showAreaFallback = Boolean(deferredAreaQuery) && matchedChurches.length === 0;
  const visibleChurches = showAreaFallback
    ? fallbackChurches
    : matchedChurches.length > 0
      ? matchedChurches
      : fallbackChurches;

  useEffect(() => {
    if (!isComplete || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    posthog.capture("tool_completed", {
      tool_name: "church_fit_quiz",
      top_result: topResultId,
      result_count: resultCount,
    });
  }, [isComplete, resultCount, topResultId]);

  useEffect(() => {
    if (!isComplete || !laneKey || !requestKey) {
      return;
    }

    const requestId = fetchRequestRef.current + 1;
    fetchRequestRef.current = requestId;
    const controller = new AbortController();
    const params = new URLSearchParams({ lanes: laneKey });

    if (deferredAreaQuery) {
      params.set("area", deferredAreaQuery);
    }

    fetch(`/api/tools/church-fit?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load matching churches");
        }

        return response.json() as Promise<{ churches?: ToolChurchPreview[] }>;
      })
      .then((payload) => {
        if (fetchRequestRef.current !== requestId) return;
        startTransition(() => {
          setMatchResponse({
            key: requestKey,
            churches: payload.churches ?? [],
            error: null,
          });
        });
      })
      .catch((error) => {
        if (controller.signal.aborted || fetchRequestRef.current !== requestId) return;
        console.error("[church-fit-quiz] failed to load church matches", error);
        startTransition(() => {
          setMatchResponse({
            key: requestKey,
            churches: [],
            error: "Could not refresh area-specific church matches right now.",
          });
        });
      });

    return () => controller.abort();
  }, [deferredAreaQuery, isComplete, laneKey, requestKey]);

  function chooseOption(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function goBack() {
    const answeredIds = QUIZ_QUESTIONS.filter((question) => answers[question.id]).map((question) => question.id);
    const lastId = answeredIds[answeredIds.length - 1];
    if (!lastId) return;
    setAnswers((current) => {
      const next = { ...current };
      delete next[lastId];
      return next;
    });
  }

  function restart() {
    completionTrackedRef.current = false;
    setAreaQuery("");
    setMatchResponse({ key: "", churches: [], error: null });
    setAnswers({});
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-white to-blush-light/45 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-mauve">Church Fit Quiz</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-espresso sm:text-4xl">Take the Church Fit Quiz</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-warm-brown">
              Find where you&apos;ll fit before your first visit. Answer seven fast questions about worship feel, social comfort, family needs, and sermon style, and we&apos;ll point you to three strong church lanes.
            </p>
          </div>
          <div className="rounded-full border border-rose-200/70 bg-white/80 px-4 py-2 text-sm font-semibold text-espresso shadow-sm">
            {answeredCount}/{QUIZ_QUESTIONS.length} answered
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-rose-gold transition-all"
            style={{ width: `${(answeredCount / QUIZ_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </section>

      {!isComplete && currentQuestion ? (
        <section className="rounded-3xl border border-rose-200/60 bg-white/85 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">
            Question {answeredCount + 1} of {QUIZ_QUESTIONS.length}
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">{currentQuestion.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-warm-brown">{currentQuestion.description}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {currentQuestion.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => chooseOption(currentQuestion.id, option.value)}
                className="rounded-2xl border border-rose-200/70 bg-white px-5 py-4 text-left transition-all hover:border-rose-300 hover:bg-blush-light/60 hover:shadow-sm"
              >
                <span className="block font-serif text-xl font-semibold text-espresso">{option.label}</span>
                <span className="mt-2 block text-sm leading-relaxed text-warm-brown">{option.description}</span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={answeredCount === 0}
              className="rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={restart}
              disabled={answeredCount === 0}
              className="rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start over
            </button>
          </div>
        </section>
      ) : null}

      {isComplete ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Your best-fit lanes</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Start with these three directions</h2>
              </div>
              <button
                type="button"
                onClick={restart}
                className="rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light"
              >
                Retake quiz
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {results.map((lane) => (
                <ToolActionCard
                  key={lane.id}
                  eyebrow="Best-fit lane"
                  title={lane.title}
                  description={`${lane.description} ${lane.whyItFits}`}
                  href={lane.browse.href}
                  label={lane.browse.label}
                  toolName="church_fit_quiz"
                  resultType="browse_lane"
                  resultLabel={lane.id}
                  markComplete
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Real churches to open next</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">
                {showAreaFallback
                  ? "Broader churches to start with"
                  : deferredAreaQuery
                    ? `Best-fit churches for ${deferredAreaQuery}`
                    : "Start with these churches"}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-warm-brown">
                We now move from abstract lane advice to real church suggestions. If you already know your area, add it below and the quiz will tighten the church matches directly.
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200/60 bg-white/80 p-4 shadow-sm sm:p-5">
              <label htmlFor="quiz-area" className="text-sm font-semibold text-espresso">
                Know the area already?
              </label>
              <p className="mt-1 text-sm leading-relaxed text-warm-brown">
                Add a city, country, or area and we&apos;ll narrow the church suggestions without making you start over.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  id="quiz-area"
                  type="search"
                  value={areaQuery}
                  onChange={(event) => setAreaQuery(event.target.value.slice(0, 80))}
                  placeholder="Try Stockholm, Malaga, Spain, Texas..."
                  className="w-full rounded-full border border-rose-200/80 bg-white px-5 py-3 text-base text-espresso shadow-sm outline-none transition-colors placeholder:text-warm-brown/50 focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
                />
                {areaQuery ? (
                  <button
                    type="button"
                    onClick={() => setAreaQuery("")}
                    className="rounded-full border border-rose-200/80 px-5 py-3 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light"
                  >
                    Clear area
                  </button>
                ) : null}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-warm-brown">
                  {deferredAreaQuery
                    ? `Filtering church suggestions for ${deferredAreaQuery}.`
                    : "No area set yet. Showing the strongest church matches overall."}
                </p>
                {isLoadingMatches ? <p className="text-mauve">Updating church suggestions…</p> : null}
                {matchesError ? <p className="text-amber-700">{matchesError}</p> : null}
                {showAreaFallback && !isLoadingMatches ? (
                  <p className="text-warm-brown">
                    No strong matches turned up in that area yet, so we&apos;re showing the broader best-fit churches below instead.
                  </p>
                ) : null}
              </div>
            </div>
            <ToolChurchGrid churches={visibleChurches} toolName="church_fit_quiz" labelPrefix="quiz_match" />
          </section>
        </>
      ) : null}
    </div>
  );
}
