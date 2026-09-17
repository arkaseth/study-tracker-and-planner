let deferredPrompt = null;

export function initPwa() {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa-installable", { detail: true }));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installable", { detail: false }));
  });
}

export function isPwaInstallable() {
  return Boolean(deferredPrompt);
}

export async function promptPwaInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installable", { detail: false }));
    return true;
  }
  return false;
}
