# ADR-010: React 19 + Vite + shadcn/ui for Frontend

**Status:** Accepted

**Date:** 2026-06-15

**Author:** Vinícius Raposo

---

## Context

V3 needs a production-quality frontend for the compliance review workflow. The frontend must:

1. Display real-time compliance decisions with trust scores and verdicts
2. Support PDF upload and text paste for WH-347 payroll analysis
3. Provide analytics dashboards for decision volume, approval rates, and cost tracking
4. Be type-safe and maintainable as a single-developer project

The frontend is an **internal tool** — SEO and server-side rendering are irrelevant. Developer experience and component quality matter most.

---

## Decision

Build the frontend with:

| Technology | Role |
|---|---|
| **React 19** | UI framework (latest stable, concurrent features) |
| **Vite** | Build tool (fastest HMR, ESM-native) |
| **TypeScript** | Type safety across the entire frontend |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | Composable Radix-based UI primitives |
| **TanStack Query** | Server state management and caching |
| **React Router** | Client-side routing |
| **Lucide** | Icon library |

**9 shadcn/ui primitives:** Button, Card, Badge, Skeleton, Input, Textarea, Select, Separator + `cn()` utility.

---

## Rationale

### Why React 19 over React 18?

- **Concurrent rendering** — better UX for real-time decision streaming
- **Latest stable** — no reason to start a new project on an older version
- **Ecosystem compatibility** — all dependencies (TanStack Query, Radix, etc.) support React 19

### Why Vite over Next.js?

- **No SSR needed** — this is an internal compliance tool, not a public website
- **Faster HMR** — sub-50ms hot reload vs Next.js's slower compilation
- **Simpler architecture** — no server component complexity, no API routes in frontend
- **Smaller bundle** — Vite tree-shakes more aggressively

### Why shadcn/ui over Material UI or Ant Design?

- **Composable** — copy-paste components you own, not a dependency black box
- **Radix primitives** — accessible by default (ARIA, keyboard nav)
- **Tailwind-native** — no CSS-in-JS runtime overhead
- **Customizable** — every component is a file in `src/components/ui/`

### Why TanStack Query over Redux/Zustand?

- **Server state, not client state** — 90% of frontend state comes from the API
- **Built-in caching** — stale-while-revalidate, background refetch
- **No boilerplate** — no reducers, actions, or stores for API calls
- **React state for UI** — `useState`/`useReducer` handles the remaining 10%

---

## Consequences

**Positive:**
- Type-safe end-to-end (TypeScript frontend ↔ Zod agent ↔ Pydantic backend)
- Fast development cycle (Vite HMR < 50ms)
- Accessible components out of the box (Radix primitives)
- Mock mode (`VITE_MOCK_API=true`) enables frontend development without backend
- Small bundle: 413kb JS, 21kb CSS (production build)

**Negative:**
- No SSR — irrelevant for internal tool
- shadcn/ui components are local files — manual updates (mitigated by `npx shadcn-ui@latest add`)
- React 19 is newest — some community packages may lag (no issues encountered)

---

## Alternatives Considered

| Approach | Verdict |
|---|---|
| Next.js | Rejected — SSR unnecessary, adds complexity |
| Vue 3 + Nuxt | Rejected — smaller ecosystem for enterprise UI |
| Svelte + SvelteKit | Rejected — fewer component libraries, team familiarity |
| Material UI | Rejected — heavier, less customizable, CSS-in-JS overhead |
| Ant Design | Rejected — opinionated styling, harder to customize |
| Redux Toolkit | Rejected — overkill for server-state-heavy app |

---

## Related

- ADR-001: Three-Service Architecture
- ADR-009: Excluded Technologies (Zustand exclusion rationale)
