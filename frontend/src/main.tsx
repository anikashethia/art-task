import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import LandingFlow from "./LandingFlow";
import PilotApp from "./PilotApp";

// If launched from a Prolific URL (has PROLIFIC_PID), go straight to the
// online flow (no landing page, avatar codes come from URL params).
// Otherwise show the landing page for in-person / researcher use.
const params = new URLSearchParams(window.location.search);
const hasProlificPid = params.has("PROLIFIC_PID") || params.has("prolific_pid");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {hasProlificPid ? <PilotApp /> : <LandingFlow />}
  </StrictMode>,
);
