// The Event key is runtime data, so this subtree cannot be prerendered — it is served by
// the adapter's 200.html fallback. `ssr` stays untouched: the static routes above keep
// their own prerendered documents. See ADR-0008, Amendment 2026-08-13.
export const prerender = false;
