# Svelte 5 + Vite + TypeScript for the PWA

The app is built with SvelteKit on Svelte 5 (runes reactivity), Vite, and TypeScript. SvelteKit is used purely as the app framework (routing, project structure) with `@sveltejs/adapter-static`: every *static* route is prerendered to static files and dynamic-segment routes are served by a prerendered SPA fallback (`200.html`), so there is no server runtime, preserving the no-server constraint of [ADR-0003](./0003-offline-first-pwa.md). PWA capability (manifest, service worker, offline asset caching) comes from `@vite-pwa/sveltekit`, the SvelteKit integration of `vite-plugin-pwa`. Tests run under Vitest: domain logic against plain objects, the persistence edge against `fake-indexeddb` (per [ADR-0006](./0006-plain-store-in-memory-model.md)).

## Why

[ADR-0003](./0003-offline-first-pwa.md) mandates an offline-first PWA; [ADR-0006](./0006-plain-store-in-memory-model.md) mandates an in-memory Library as the single source of truth with pure, synchronous domain logic. Svelte 5's runes give fine-grained reactivity over mutable state, so the UI can observe the in-memory Library directly — no immutable-update discipline and no separate state-management framework between the domain model and the views. The compiled output is small, which suits a phone-first offline app. Vite is Svelte's standard toolchain and hosts both `vite-plugin-pwa` and Vitest.

## Considered options

- **React + Vite** — rejected: React's immutable-update model conflicts with a mutable in-memory Library; it would force either an extra state layer (Zustand/Redux/immer) or copy-on-write conventions across the domain logic, duplicating what runes provide natively.
- **Vue 3 + Vite** — viable (proxy-based reactivity would also wrap the Library naturally); Svelte chosen for the smaller runtime and lighter component model.
- **Lit / vanilla + Vite** — rejected: fewest dependencies but the most manual UI wiring; slows every UI-bearing slice for no architectural gain.

## Consequences

- The in-memory Library is held in Svelte `$state`, so mutations are observable by the UI automatically. Runes proxies behave as plain objects, so domain functions stay framework-free plain TypeScript and unit tests run without Svelte — the ADR-0006 purity requirement holds.
- Runes usage is confined to the UI layer and the thin reactive holder of the Library; domain modules must not import from `svelte`.
- Test stack: Vitest for unit tests, `fake-indexeddb` for the persistence edge, `@testing-library/svelte` where component tests are warranted.
- Svelte's ecosystem is smaller than React's; accepted trade-off.
- SvelteKit's server-side features (server routes, form actions, `+page.server.*`) must not be used — the static adapter has no runtime to execute them. Everything renders at build time (prerender) or in the browser.

## Amendment 2026-08-13 — dynamic-segment routes and the update prompt

The UI design effort (`.scratch/ui-design/`) replaced `?id=<uuid>` query addressing with path parameters (`/event/<id>/…`, `/person/<id>`), which `adapter-static` cannot prerender because the ids are runtime data. Verified against a real offline build under a service worker:

- **Mixed prerender + fallback works.** `adapter({ fallback: '200.html' })`, `paths: { relative: false }`, `kit: { adapterFallback: '200.html', spa: true }` in the PWA plugin options, plus `export const prerender = false` in a `+layout.ts` under each dynamic subtree. Static routes keep their own precached HTML and their own `<title>`; dynamic ones get `200.html`. No `navigateFallbackDenylist` is needed. **`ssr` and `trailingSlash` stay untouched** — the docs' SPA recipe would wrongly de-prerender the static routes.
- **`kit.spa: true` is mandatory, not decorative.** `adapter-static` writes `200.html` after the PWA plugin globs the output, so a plain `fallback:` yields a service worker whose precache lacks the fallback — cold offline deep links then fail **silently**.
- **`paths.relative` defaults to `true`**, which makes `wb.register()` 404 on any depth-≥2 route, so the service worker registration rejects and **update checking has never worked**. Setting it to `false` fixes a pre-existing bug and costs nothing.
- **`registerType` moves from `'autoUpdate'` to `'prompt'`, and `workbox.clientsClaim: true` is set by hand.** The plugin sets `skipWaiting` and `clientsClaim` together under `autoUpdate`, so the new worker takes control whether or not the page reloads — suppressing only the reload leaves a live page whose chunks are gone from the precache. Under `prompt` neither flag is set, so `clientsClaim` must be restored explicitly or a first install is online-only until relaunch. **The split is deliberate; do not "fix" it back to `autoUpdate`.** The reason `prompt` is needed at all is the Import review, which holds a parsed file and 150 row decisions in component state that a reload destroys and that cannot be re-read from the `File`.
- **Hosting is the one genuinely new cost, and no deployment target is documented anywhere.** A first-ever deep link 404s without a host rewrite rule, because the service worker is not installed yet (`start_url: '/'` means an installed PWA never hits this). Independently: on an exact-files-only host the service worker **cannot install at all**, today, `?id=` or not — the first 404 aborts the whole precache. `file://` is dead either way, since ES modules are CORS-blocked from a `null` origin. Choosing the host is a separate decision this ADR states as a constraint rather than resolving.
