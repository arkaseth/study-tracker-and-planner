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
 * @param {string} title
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function appConfirm(title, message) {
  return new Promise((resolve) => {
    const titleEl = $("#confirm-title");
    const msgEl = $("#confirm-message");
    const dialog = $("#confirm-dialog");
    if (!dialog) return resolve(window.confirm(`${title}\n\n${message}`));

    titleEl.textContent = title;
    msgEl.textContent = message;
    dialog.showModal();
    const ok = $("#confirm-ok"),
      cancel = $("#confirm-cancel");

    function cleanup() {
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      dialog.close();
    }
    function onOk() {
      cleanup();
      resolve(true);
    }
    function onCancel() {
      cleanup();
      resolve(false);
    }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
  });
}
