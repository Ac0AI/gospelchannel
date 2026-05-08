"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import {
  QUIZ_QUESTIONS,
  buildChurchDirectoryHrefForLane,
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
  const directoryHref = results[0]
    ? buildChurchDirectoryHrefForLane(results[0], { area: deferredAreaQuery, answers })
    : "/church";

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

    fetch(`/api/guides/church-fit?${params.toString()}`, { signal: controller.signal })
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
    <div className="space-y-12">
      {/* Progress bar */}
      <div>
        <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em]">
          <span className="text-mauve">Question {Math.min(answeredCount + 1, QUIZ_QUESTIONS.length)} of {QUIZ_QUESTIONS.length}</span>
          {isComplete ? (
            <button
              type="button"
              onClick={restart}
              className="text-rose-gold underline transition-colors hover:text-rose-gold-deep"
            >
              Retake quiz
            </button>
          ) : (
            <span className="text-muted-warm">{answeredCount}/{QUIZ_QUESTIONS.length} answered</span>
          )}
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-rose-gold/[0.10]">
          <div
            className="h-full rounded-full bg-rose-gold transition-all duration-300"
            style={{ width: `${(answeredCount / QUIZ_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </div>

      {!isComplete && currentQuestion ? (
        <section>
          <h2
            className="m-0 font-serif font-semibold leading-[1.1] tracking-[-0.01em] text-espresso"
            style={{ fontSize: "clamp(28px, 4.5vw, 48px)" }}
          >
            {currentQuestion.title}
          </h2>
          {currentQuestion.description && (
            <p className="mt-3 max-w-[640px] text-base leading-relaxed text-warm-brown sm:text-lg">
              {currentQuestion.description}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            {currentQuestion.options.map((option) => {
              const isSelected = answers[currentQuestion.id] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => chooseOption(currentQuestion.id, option.value)}
                  className={`rounded-[16px] px-6 py-5 text-left transition-all duration-150 ${
                    isSelected
                      ? "border-2 border-rose-gold bg-rose-gold text-white"
                      : "border border-rose-gold/[0.18] bg-white hover:-translate-y-px hover:border-rose-gold/40 hover:shadow-[var(--shadow-sm)]"
                  }`}
                >
                  <span className={`block font-serif text-lg font-medium leading-[1.3] sm:text-xl ${isSelected ? "text-white" : "text-espresso"}`}>
                    {option.label}
                  </span>
                  {option.description && (
                    <span className={`mt-2 block text-sm leading-[1.5] ${isSelected ? "text-white/85" : "text-warm-brown"}`}>
                      {option.description}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goBack}
              disabled={answeredCount === 0}
              className="rounded-full border border-rose-gold/30 px-5 py-2.5 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06] disabled:cursor-not-allowed disabled:opacity-40"
            >
              &larr; Back
            </button>
            <button
              type="button"
              onClick={restart}
              disabled={answeredCount === 0}
              className="rounded-full px-5 py-2.5 text-sm font-semibold text-muted-warm underline transition-colors hover:text-rose-gold disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start over
            </button>
          </div>
        </section>
      ) : null}

      {isComplete ? (
        <>
          <section>
            <p className="gc-eyebrow">Your matches</p>
            <h2
              className="mt-3 m-0 font-serif font-semibold leading-[1.05] tracking-[-0.02em] text-espresso"
              style={{ fontSize: "clamp(36px, 6vw, 64px)" }}
            >
              Three churches <em className="gc-italic">for you</em>.
            </h2>
            <p className="mt-4 max-w-[580px] text-base leading-relaxed text-warm-brown sm:text-lg">
              Based on your answers. Visit one this Sunday &mdash; or save them and decide later.
            </p>

            <div className="mt-10 grid gap-4 xl:grid-cols-3">
              {results.map((lane) => (
                <ToolActionCard
                  key={lane.id}
                  eyebrow="Best-fit lane"
                  title={lane.title}
                  description={`${lane.description} ${lane.whyItFits}`}
                  href={buildChurchDirectoryHrefForLane(lane, { area: deferredAreaQuery, answers })}
                  label="See matching churches"
                  toolName="church_fit_quiz"
                  resultType="browse_lane"
                  resultLabel={lane.id}
                  markComplete
                />
              ))}
            </div>
          </section>

          <section className="mt-20 space-y-6">
            <div>
              <p className="gc-eyebrow">Real churches to open next</p>
              <h2 className="mt-3 m-0 font-serif text-3xl font-semibold tracking-[-0.01em] text-espresso sm:text-4xl">
                {showAreaFallback
                  ? "Broader churches to start with."
                  : deferredAreaQuery
                    ? <>Best-fit churches for <em className="gc-italic">{deferredAreaQuery}</em>.</>
                    : "Start with these churches."}
              </h2>
              <p className="mt-3 max-w-[640px] text-base leading-relaxed text-warm-brown">
                If you know your area, add it below and we&rsquo;ll tighten the matches without making you start over.
              </p>
            </div>
            <div
              className="rounded-[18px] border border-rose-gold/[0.14] p-6 sm:p-7"
              style={{ background: "var(--linen-deep)" }}
            >
              <label htmlFor="quiz-area" className="gc-eyebrow">
                Know the area already?
              </label>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  id="quiz-area"
                  type="search"
                  value={areaQuery}
                  onChange={(event) => setAreaQuery(event.target.value.slice(0, 80))}
                  placeholder="Try Stockholm, Malaga, Spain, Texas..."
                  className="w-full rounded-full border border-rose-gold/20 bg-white px-5 py-3 text-base text-espresso outline-none transition-colors placeholder:text-warm-brown/50 focus:border-rose-gold focus:ring-2 focus:ring-rose-gold/20"
                />
                {areaQuery ? (
                  <button
                    type="button"
                    onClick={() => setAreaQuery("")}
                    className="rounded-full border border-rose-gold/30 px-5 py-3 text-sm font-semibold text-espresso transition-colors hover:bg-rose-gold/[0.06]"
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
                {isLoadingMatches ? <p className="text-mauve">Updating church suggestions&hellip;</p> : null}
                {matchesError ? <p className="text-amber-700">{matchesError}</p> : null}
                {showAreaFallback && !isLoadingMatches ? (
                  <p className="text-warm-brown">
                    No strong matches turned up in that area yet, so we&rsquo;re showing the broader best-fit churches below instead.
                  </p>
                ) : null}
              </div>
            </div>
            <ToolActionCard
              eyebrow="Personalized directory"
              title={deferredAreaQuery ? `Browse your matches near ${deferredAreaQuery}` : "Browse your personalized church matches"}
              description="Open a filterable church directory result built from your quiz answers. The URL is shareable and loads as a normal paginated directory page."
              href={directoryHref}
              label="Open all matching churches"
              toolName="church_fit_quiz"
              resultType="browse_directory"
              resultLabel={topResultId ?? "unknown"}
              markComplete
            />
            {isLoadingMatches ? (
              <div className="rounded-2xl border border-rose-200/60 bg-white/75 px-5 py-10 text-center text-sm text-warm-brown shadow-sm">
                Loading church matches...
              </div>
            ) : (
              <ToolChurchGrid churches={visibleChurches} toolName="church_fit_quiz" labelPrefix="quiz_match" />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
