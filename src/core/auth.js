import { SUPABASE_URL, SUPABASE_KEY } from "../utils/constants.js";
import { store, loadFromCloud, storeRev } from "./state.js";
import { $ } from "../utils/helpers.js";

// Initialize Supabase Client
export const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

export function setupAuthListeners() {
  if (!supabaseClient) return;

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      store.currentUser = session.user;
      storeRev.value++;
      loadFromCloud();
    } else {
      store.currentUser = null;
      storeRev.value++;
    }
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
      store.currentUser = session.user;
      storeRev.value++;
      loadFromCloud();
    } else {
      store.currentUser = null;
      storeRev.value++;
    }
  });
}
