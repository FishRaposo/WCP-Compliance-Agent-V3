## 2024-05-14 - React Performance - Memoizing lists and components
**Learning:** Found an opportunity to improve frontend rendering performance by using React.memo on components like `TrustScoreBadge` and breaking out row elements into their own memoized components like `DecisionCardMemo` in `HumanReviewQueue.tsx`.
**Action:** Always check frequently-rendered components and list elements for missing `React.memo()`.

## 2024-05-14 - Python Performance - DBWD Fuzzy Match
**Learning:** The DBWD pipeline uses a custom `_levenshtein_distance` implementation that recalculates distance for all corpus items on cache miss. This O(N*M) calculation takes significant time if the corpus is large. Adding an early-exit or memoization could speed it up.
**Action:** Consider optimizing `_levenshtein_distance` or adding memoization to `_fuzzy_match` results.
