import { useState, useCallback } from "react";
import TimelineRunner from "./components/TimelineRunner";
import EnvironmentGate from "./components/EnvironmentGate";
import { createSession } from "./api";
import type { TaskContext } from "./timeline";

type Mode = "test" | "full";
type AppPhase =
  | { name: "landing" }
  | { name: "loading" }
  | { name: "running"; ctx: TaskContext }
  | { name: "done" };

export default function LandingFlow() {
  const [phase, setPhase] = useState<AppPhase>({ name: "landing" });
  const [mode, setMode] = useState<Mode>("test");
  const [inPersonNum, setInPersonNum] = useState("");
  const [onlineNum, setOnlineNum] = useState("");
  const [error, setError] = useState<string | null>(null);

  const numValid = (val: string) => {
    const n = parseInt(val);
    return !isNaN(n) && n >= 1 && n <= 24;
  };

  const start = useCallback(async (participantNumber: number, selectedMode: Mode) => {
    setPhase({ name: "loading" });
    setError(null);
    try {
      const s = await createSession({
        participant_id: `P${participantNumber}`,
        mode: selectedMode,
        participant_number: participantNumber,
      });
      setPhase({
        name: "running",
        ctx: { sessionId: s.session_id, token: s.session_token, mode: selectedMode, trials: s.trials },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
      setPhase({ name: "landing" });
    }
  }, []);

  const handleComplete = useCallback(() => setPhase({ name: "done" }), []);

  if (phase.name === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-400 text-sm">Setting up session…</p>
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

  if (phase.name === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="max-w-xl w-full p-10 bg-white rounded-lg shadow text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">All done — thank you!</h2>
          <p className="text-gray-500 mb-6">Responses have been saved.</p>
          <button
            onClick={() => { setPhase({ name: "landing" }); setInPersonNum(""); setOnlineNum(""); }}
            className="text-xs text-gray-300 hover:text-gray-400 transition-colors"
          >
            Back to landing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-xl w-full p-10 bg-white rounded-lg shadow">

        {/* Title */}
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center leading-snug">
          Art Task
        </h1>

        {/* Mode toggle */}
        <div className="mb-8 p-4 border border-gray-200 rounded">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3 text-center">
            Mode
          </div>
          <div className="flex gap-6 justify-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="timing-mode"
                value="test"
                checked={mode === "test"}
                onChange={() => setMode("test")}
                className="w-4 h-4"
              />
              <span className="text-base text-gray-900">Test</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="timing-mode"
                value="full"
                checked={mode === "full"}
                onChange={() => setMode("full")}
                className="w-4 h-4"
              />
              <span className="text-base text-gray-900">Full</span>
            </label>
          </div>
          <p className="mt-3 text-sm text-gray-400 text-center">
            {mode === "test"
              ? "12 trials — for setup and piloting only"
              : "120 trials — real data collection"}
          </p>
        </div>

        {/* In-person */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            In-person
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              min={1}
              max={24}
              placeholder="1–24"
              value={inPersonNum}
              onChange={(e) => setInPersonNum(e.target.value)}
              className="w-24 px-4 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              onClick={() => start(parseInt(inPersonNum), mode)}
              disabled={!numValid(inPersonNum)}
              className="flex-1 py-3 bg-gray-900 text-white rounded text-base font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Start in-person
            </button>
          </div>
        </div>

        {/* Online */}
        <div className="mb-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            Online
          </div>
          <div className="flex gap-3">
            <input
              type="number"
              min={1}
              max={24}
              placeholder="1–24"
              value={onlineNum}
              onChange={(e) => setOnlineNum(e.target.value)}
              className="w-24 px-4 py-3 border border-gray-300 rounded text-base focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              onClick={() => start(parseInt(onlineNum), mode)}
              disabled={!numValid(onlineNum)}
              className="flex-1 py-3 bg-gray-900 text-white rounded text-base font-semibold hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              Start online
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-gray-900 font-semibold">{error}</p>
        )}
      </div>
    </div>
  );
}
