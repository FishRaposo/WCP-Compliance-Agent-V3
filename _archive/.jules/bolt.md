## 2025-04-20 - Date object allocation bottleneck in array sorting and iterations

**Learning:** When sorting or reducing over arrays of ISO 8601 string dates (e.g., `listPending` or `getStats` in queue services), doing `new Date(string).getTime()` creates unnecessary intermediate `Date` objects inside loops, causing significant GC pressure and performance slowdowns.

**Action:** Use direct string comparison (`a < b ? -1 : a > b ? 1 : 0`) for sorting lexicographically correct ISO 8601 strings, and `Date.parse(string)` when only the timestamp numeric value is needed for math.
