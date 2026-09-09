import { render } from "preact";
import { App } from "./ui/App.jsx";
import { initializeState } from "./core/state.js";
import { setupAuthListeners } from "./core/auth.js";

// Initialize core state and auth listeners
initializeState();
setupAuthListeners();

// Catch errors and show them on screen to help debug
window.onerror = function (msg, url, lineNo, columnNo, error) {
  alert("Error: " + msg + "\nLine: " + lineNo + "\nColumn: " + columnNo);
  return false;
};
window.addEventListener('unhandledrejection', function (event) {
  alert("Unhandled promise rejection: " + event.reason);
});

// Mount the Preact application
render(<App />, document.getElementById("app"));
