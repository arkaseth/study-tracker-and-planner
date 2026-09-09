export const $ = (s) => document.querySelector(s);
export const uid = () => Math.random().toString(36).slice(2, 10);
export const escapeHTML = (text) =>
  String(text).replace(
    /[&<>'"]/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        c
      ],
  );

/**
 * Displays a brief, temporary notification message (toast) to the user.
 * @param {string} message - The text content to display.
 */
export function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/**
 * Shows a custom confirmation dialog modal.
 * Delegates to window.appConfirm which is set up by Modals.jsx.
 * Falls back to the native confirm() if the modal system isn't ready yet.
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function appConfirm(title, message) {
  if (typeof window.appConfirm === "function") {
    return window.appConfirm(title, message);
  }
  // Fallback if Modals haven't mounted yet
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}
