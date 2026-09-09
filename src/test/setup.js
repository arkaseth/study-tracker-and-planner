import '@testing-library/jest-dom';

// jsdom already provides localStorage — no stub needed.

// Stub window.location so constants.js (which reads hostname at module level)
// does not throw in the test environment.
delete window.location;
window.location = { hostname: 'localhost', protocol: 'http:' };

// auth.js calls window.supabase.createClient() at module evaluation time.
// This stub must be in place BEFORE any module is imported so it is available
// when the ES module graph is resolved.
window.supabase = {
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ error: null }),
      signOut: async () => ({}),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      upsert: async () => ({ error: null }),
      delete: () => ({ eq: async () => ({}) }),
    }),
  }),
};
