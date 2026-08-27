import { SUPABASE_URL, SUPABASE_KEY } from "../utils/constants.js";
import { store, loadFromCloud } from "./state.js";
import { $ } from "../utils/helpers.js";

// Initialize Supabase Client
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export function setupAuthListeners(renderAllCallback) {
  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      store.currentUser = session.user;
      if ($("#auth-dialog")?.open) $("#auth-dialog").close();
      $("#login-nav-button")?.classList.add("hidden");
      $("#logout-button")?.classList.remove("hidden");
      $("#mobile-login-button")?.classList.add("hidden");
      $("#mobile-logout-button")?.classList.remove("hidden");
      loadFromCloud(renderAllCallback);
    } else {
      store.currentUser = null;
      if ($("#auth-dialog") && !$("#auth-dialog").open) $("#auth-dialog").showModal();
      $("#login-nav-button")?.classList.remove("hidden");
      $("#logout-button")?.classList.add("hidden");
      $("#mobile-login-button")?.classList.remove("hidden");
      $("#mobile-logout-button")?.classList.add("hidden");
    }
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      store.currentUser = session.user;
      if ($("#auth-dialog")?.open) $("#auth-dialog").close();
      $("#login-nav-button")?.classList.add("hidden");
      $("#logout-button")?.classList.remove("hidden");
      $("#mobile-login-button")?.classList.add("hidden");
      $("#mobile-logout-button")?.classList.remove("hidden");
      loadFromCloud(renderAllCallback);
    } else {
      store.currentUser = null;
      $("#login-nav-button")?.classList.remove("hidden");
      $("#logout-button")?.classList.add("hidden");
      $("#mobile-login-button")?.classList.remove("hidden");
      $("#mobile-logout-button")?.classList.add("hidden");
    }
  });
}
