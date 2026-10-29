import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { initializeApplication } from "./app/bootstrap/initializeApplication";
import { GameShell } from "./ui/GameShell";
import "./styles.css";

// Developer pages load on demand: the rig lab pulls in Phaser, which the game itself defers.
const DevEconomySimulatorPage = lazy(async () => ({ default: (await import("./ui/DevEconomySimulatorPage")).DevEconomySimulatorPage }));
const DevRigLabPage = lazy(async () => ({ default: (await import("./ui/DevRigLabPage")).DevRigLabPage }));

const rootElement = document.getElementById("app");

if (!rootElement) {
  throw new Error("The React root element #app was not found.");
}

const isEconomySimulator = window.location.pathname === "/dev/economy-simulator";
const isRigLab = window.location.pathname === "/dev/rig-lab";

// The developer pages are intentionally pure and isolated from game saves.
if (!isEconomySimulator && !isRigLab) initializeApplication();
createRoot(rootElement).render(isEconomySimulator || isRigLab
  ? <Suspense fallback={null}>{isEconomySimulator ? <DevEconomySimulatorPage /> : <DevRigLabPage />}</Suspense>
  : <GameShell />);
