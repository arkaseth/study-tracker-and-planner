import { render } from "preact";
import { App } from "./ui/App.jsx";
import { initializeState } from "./core/state.js";
import { setupAuthListeners } from "./core/auth.js";
import { initPwa } from "./core/pwa.js";

// Initialize core state, auth listeners, and PWA install events
initializeState();
setupAuthListeners();
initPwa();

// Log unhandled errors and rejections without blocking the UI
window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error("Uncaught error:", msg, "at", `${url}:${lineNo}:${columnNo}`, error);
  return false;
};
window.addEventListener('unhandledrejection', function (event) {
  console.error("Unhandled promise rejection:", event.reason);
});

// Mount the Preact application
render(<App />, document.getElementById("app"));
