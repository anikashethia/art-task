import { useState, useCallback } from "react";
import TimelineRunner from "./components/TimelineRunner";
import { createSession } from "./api";
import type { TaskContext } from "./timeline";

type Mode = "test" | "full";
type AppPhase =
  | { name: "landing" }
  | { name: "loading" }
  | { name: "running"; ctx: TaskContext }
  | { name: "done" };

function StartRow({
  label,
  value,
  onChange,
  onStart,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onStart: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <span className="text-sm font-medium text-slate-600 w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="number"
          min={1}
          max={24}
          placeholder="1–24"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 border border-slate-200 rounded-lg px-3 py-2 text-sm text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          onClick={onStart}
          disabled={disabled}
          className="flex-1 bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Start
        </button>
      </div>
    </div>
  );
}

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400 text-sm tracking-wide">Setting up session…</p>
      </div>
    );
  }

  if (phase.name === "running") {
    return <TimelineRunner ctx={phase.ctx} onComplete={handleComplete} />;
  }

  if (phase.name === "done") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-sm w-full text-center">
          <p className="text-2xl mb-3">✓</p>
          <h2 className="text-lg font-semibold text-slate-800 mb-2">All done — thank you!</h2>
          <p className="text-slate-400 text-sm">Responses have been saved.</p>
          <button
            onClick={() => { setPhase({ name: "landing" }); setInPersonNum(""); setOnlineNum(""); }}
            className="mt-8 text-xs text-slate-300 hover:text-slate-400 transition-colors"
          >
            Back to landing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 w-full max-w-md">

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-800">Art Task</h1>
        </div>

        {/* Mode toggle */}
        <div className="mb-6">
          <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase mb-3">
            Mode
          </p>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(["test", "full"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {m === "test" ? "Test" : "Full study"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400 text-center">
            {mode === "test"
              ? "12 trials — for setup and piloting only"
              : "120 trials — real data collection"}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-100 mb-2" />

        {/* In-person */}
        <StartRow
          label="In-person"
          value={inPersonNum}
          onChange={setInPersonNum}
          onStart={() => start(parseInt(inPersonNum), mode)}
          disabled={!numValid(inPersonNum)}
        />

        {/* Divider */}
        <div className="border-t border-slate-100" />

        {/* Online */}
        <StartRow
          label="Online"
          value={onlineNum}
          onChange={setOnlineNum}
          onStart={() => start(parseInt(onlineNum), mode)}
          disabled={!numValid(onlineNum)}
        />

        {error && (
          <p className="mt-4 text-xs text-red-500 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
