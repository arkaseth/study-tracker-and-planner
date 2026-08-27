import { store, save } from "../core/state.js";
import { toast } from "../utils/helpers.js";

/**
 * Applies the currently selected theme from the application state
 * to the root HTML body element.
 */
export function setTheme() {
  document.body.dataset.theme = store.state.theme;
}

/**
 * Cycles to the next theme and applies it.
 */
export function toggleTheme() {
  const themes = ["night", "light", "ink", "lavender"];
  store.state.theme = themes[(themes.indexOf(store.state.theme) + 1) % themes.length];
  save();
  setTheme();
  toast(`Theme: ${store.state.theme}`);
}
