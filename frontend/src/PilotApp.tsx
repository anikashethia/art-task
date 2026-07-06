/**
 * PilotApp.tsx — Prolific participant-facing flow.
 *
 * Reads PROLIFIC_PID (and optionally sc_session_id) from URL params,
 * creates a session using the counterbalancing table (same as in-person),
 * runs the full timeline, then redirects to Prolific.
 *
 * Avatar assignments come from the counterbalancing table via the backend —
 * not from URL params. When this task is merged with the social connection
 * task, the assignments will be passed through shared backend state instead.
 *
 * Prolific study URL format:
 *   https://test-social-influence-task.fly.dev/?PROLIFIC_PID={{%PROLIFIC_PID%}}
 */

import { useState, useEffect, useCallback } from "react";
import TimelineRunner from "./components/TimelineRunner";
import EnvironmentGate from "./components/EnvironmentGate";
import { createSession, completeSession } from "./api";
import type { TaskContext } from "./timeline";

type Phase =
  | { name: "loading" }
  | { name: "error"; message: string }
  | { name: "running"; ctx: TaskContext }
  | { name: "complete"; prolificUrl: string };

export default function PilotApp() {
  const [phase, setPhase] = useState<Phase>({ name: "loading" });

  const init = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pid = params.get("PROLIFIC_PID") ?? params.get("prolific_pid") ?? "PROLIFIC_ANON";
      const sc_session_id = params.get("sc_session_id") ?? undefined;

      const s = await createSession({
        participant_id: pid,
        mode: "full",
        sc_session_id,
      });

      setPhase({
        name: "running",
        ctx: { sessionId: s.session_id, token: s.session_token, mode: "full", trials: s.trials },
      });
    } catch (e) {
      setPhase({ name: "error", message: e instanceof Error ? e.message : "Setup failed" });
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  const handleComplete = useCallback(async () => {
    if (phase.name !== "running") return;
    try {
      const { prolific_completion_url } = await completeSession(phase.ctx.sessionId, phase.ctx.token);
      setPhase({ name: "complete", prolificUrl: prolific_completion_url });
    } catch {
      setPhase({ name: "complete", prolificUrl: "" });
    }
  }, [phase]);

  if (phase.name === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-sm">Setting up your session…</p>
      </div>
    );
  }

  if (phase.name === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md text-center p-8">
          <p className="text-red-600 font-medium mb-2">Something went wrong</p>
          <p className="text-slate-500 text-sm mb-4">{phase.message}</p>
          <p className="text-slate-400 text-sm">Please return to Prolific and contact the researcher.</p>
        </div>
      </div>
    );
  }

  if (phase.name === "running") {
    return (
      <EnvironmentGate sessionId={phase.ctx.sessionId} token={phase.ctx.token}>
        <TimelineRunner ctx={phase.ctx} onComplete={handleComplete} />
      </EnvironmentGate>
    );
  }

  // Complete — redirect to Prolific
  if (phase.prolificUrl) {
    setTimeout(() => { window.location.href = phase.prolificUrl; }, 3000);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md text-center p-8 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold text-slate-900 mb-3">Thank you — all done!</h2>
        <p className="text-slate-600 mb-4">Your responses have been saved.</p>
        {phase.prolificUrl
          ? <p className="text-slate-500 text-sm">Redirecting you back to Prolific…</p>
          : <p className="text-slate-500 text-sm">You may close this tab.</p>
        }
      </div>
    </div>
  );
}
