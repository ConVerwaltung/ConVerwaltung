# Svelte 5 + Vite + TypeScript for the PWA

The app is built with SvelteKit on Svelte 5 (runes reactivity), Vite, and TypeScript. SvelteKit is used purely as the app framework (routing, project structure) with `@sveltejs/adapter-static`: every route is prerendered to static files and there is no server runtime, preserving the no-server constraint of [ADR-0003](./0003-offline-first-pwa.md). PWA capability (manifest, service worker, offline asset caching) comes from `@vite-pwa/sveltekit`, the SvelteKit integration of `vite-plugin-pwa`. Tests run under Vitest: domain logic against plain objects, the persistence edge against `fake-indexeddb` (per [ADR-0006](./0006-plain-store-in-memory-model.md)).

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
