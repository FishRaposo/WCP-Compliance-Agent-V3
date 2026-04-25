## 2024-04-20 - Missing ARIA Labels and Focus States on Icon-Only Inputs
**Learning:** Found an accessibility pattern where icon-only buttons (like password visibility toggles) lacked `aria-label` attributes and keyboard focus styles, and inputs lacked proper explicit label associations.
**Action:** Next time, search for interactive elements with only icon children and ensure they have `aria-label`s, proper focus indicators using `.focus-visible`, and explicit labels mapping for text inputs.
