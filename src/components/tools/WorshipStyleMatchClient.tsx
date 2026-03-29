"use client";

import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import {
  SOUND_QUESTIONS,
  collectTopChurchMatches,
  scoreSoundProfiles,
  type SoundProfile,
} from "@/lib/tooling";
import { ToolActionCard, ToolChurchGrid } from "@/components/tools/ToolCards";

export function WorshipStyleMatchClient({ profiles }: { profiles: SoundProfile[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const completionTrackedRef = useRef(false);

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = SOUND_QUESTIONS.find((question) => !answers[question.id]) ?? null;
  const isComplete = currentQuestion === null;
  const results = isComplete ? scoreSoundProfiles(answers, profiles) : [];
  const sampleChurches = isComplete ? collectTopChurchMatches(results) : [];

  useEffect(() => {
    if (!isComplete || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    posthog.capture("tool_completed", {
      tool_name: "worship_style_match",
      top_result: results[0]?.id,
      result_count: results.length,
    });
  }, [isComplete, results]);

  function chooseOption(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function goBack() {
    const answeredIds = SOUND_QUESTIONS.filter((question) => answers[question.id]).map((question) => question.id);
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
    setAnswers({});
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-rose-200/60 bg-gradient-to-br from-espresso to-warm-brown px-6 py-8 text-white shadow-sm sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Church Sound Match</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold sm:text-4xl">Match your worship taste to a church lane</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/80">
              Choose the sound, feeling, and artist lane closest to your taste. We&apos;ll turn that into three church directions and real churches to open next.
            </p>
          </div>
          <div className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
            {answeredCount}/{SOUND_QUESTIONS.length} answered
          </div>
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-amber-200 transition-all"
            style={{ width: `${(answeredCount / SOUND_QUESTIONS.length) * 100}%` }}
          />
        </div>
      </section>

      {!isComplete && currentQuestion ? (
        <section className="rounded-3xl border border-rose-200/60 bg-white/85 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">
            Step {answeredCount + 1} of {SOUND_QUESTIONS.length}
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
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Your strongest sound lanes</p>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Start with these worship directions</h2>
              </div>
              <button
                type="button"
                onClick={restart}
                className="rounded-full border border-rose-200/80 px-4 py-2 text-sm font-semibold text-warm-brown transition-colors hover:border-rose-300 hover:bg-blush-light"
              >
                Retake match
              </button>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {results.map((profile) => (
                <ToolActionCard
                  key={profile.id}
                  eyebrow="Sound lane"
                  title={profile.title}
                  description={`${profile.description} ${profile.artistCue}`}
                  href={profile.browse.href}
                  label={profile.browse.label}
                  toolName="worship_style_match"
                  resultType="sound_lane"
                  resultLabel={profile.id}
                  markComplete
                />
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-mauve">Churches to try next</p>
              <h2 className="mt-2 font-serif text-2xl font-semibold text-espresso sm:text-3xl">Open these churches first</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-warm-brown">
                These pages are pulled from the sound lanes above, so you can go from artist taste to real church pages in one click.
              </p>
            </div>
            <ToolChurchGrid churches={sampleChurches} toolName="worship_style_match" labelPrefix="sound_match" />
          </section>
        </>
      ) : null}
    </div>
  );
}
