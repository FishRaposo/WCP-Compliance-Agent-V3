## 2024-05-18 - Avoid Unnecessary Recalculation on Re-renders with useMemo
**Learning:** React components that calculate aggregate data (e.g. dashboards) often compute expensive operations such as `.reduce()` and `.map()` on the component render. These can significantly impact performance, especially when handling analytics data arrays.
**Action:** When calculating derived aggregate states (like `totalDecisions`, averages, sums, etc.) from props or fetched arrays, always wrap them in `useMemo` hooks with proper dependency arrays to prevent recalculating them on every re-render.
