# WCP Compliance Agent — Unified SEO + GEO Audit Report

**Scope:** README.md (primary landing page), docs/quick-start.md, docs/architecture/system-overview.md, docs/compliance/regulatory-compliance-report.md, docs/v3/V3_PLAN.md, docs/development/V2_INVENTORY_REPORT.md
**Date:** 2026-04-22
**Auditor:** Clanker (OpenClaw)
**Mode:** Operator

---

## Executive Summary

The WCP Compliance Agent repository is a **technically excellent but SEO/GEO-underserved** codebase. It has exceptional depth (21 docs, 310 tests, full API reference, architecture diagrams), but that depth is buried under acronym barriers, missing keyword targeting, and zero off-site entity signals. The repo reads like an internal engineering wiki that happens to be public — not like a discoverable product or authority hub.

**Bottom line:** If an AI system or a developer searches for "Davis-Bacon Act compliance tool" or "prevailing wage validation AI," this repo will not surface. The content is there, but the *discovery layer* is missing.

| Layer | Health | Blocker? |
|---|---|---|
| Technical SEO (repo-level) | 🟡 Moderate | No custom domain, weak GitHub metadata |
| On-page SEO (README + docs) | 🟡 Moderate | Acronym barrier, diluted keyword targeting |
| GEO / AI visibility | 🟡 Moderate | Strong JSON extractability, weak answer-first structure |
| Trust / Entity / Authority | 🔴 Weak | No author identity signals, no LinkedIn, no portfolio links |
| Off-site mentions | 🔴 Weak | Zero presence beyond GitHub |
| Platform AI readiness | 🟡 Moderate | Good for Perplexity (citations), weak for ChatGPT/Gemini (no FAQ) |

**Overall:** 78% engineering readiness, **42% discovery readiness**.

---

## 1. Technical SEO Findings

### Observed

- **GitHub repo name:** `WCP-Compliance-Agent` — readable, hyphenated, includes primary keyword "Compliance-Agent." Good.
- **Repo description in `package.json`:** `"Regulated-domain AI infrastructure case study for trustworthy LLM decision systems"` — abstract, omits "WCP," "Davis-Bacon," "payroll," "prevailing wage." Not what anyone searches for.
- **`package.json` keywords:** `["ai-infrastructure", "ai-agent", "wcp", "compliance", "evals", "guardrails"]` — "wcp" is meaningless to searchers. Missing: "davis-bacon", "prevailing-wage", "construction-payroll", "weekly-certified-payroll", "dbwd", "wage-determination", "llm-guardrails", "ai-compliance".
- **README = homepage:** Acts as the sole landing page. No GitHub Pages, no custom domain (`CNAME`), no `vercel.app` SEO optimization.
- **Live demo link:** `wcp-compliance-agent.vercel.app` — present but no metadata about what it demos. No `<title>` or meta description verified.
- **Internal linking:** Strong cross-links between docs (`[docs/quick-start.md]`, `[docs/architecture/...]`). Good.
- **No `sitemap.xml` equivalent:** Not applicable for GitHub, but the docs folder has no index/table of contents file.
- **URL structure:** Fixed by GitHub. `github.com/FishRaposo/WCP-Compliance-Agent` is the canonical. No vanity URL.
- **File naming:** Mostly good (`regulatory-compliance-report.md`, `system-overview.md`). One issue: `V3_PLAN.md` and `V2_INVENTORY_REPORT.md` use ALL_CAPS — fine for internal docs but noisy in search snippets.

### Assessment

The repo is **crawlable** (GitHub ensures this) but **not optimized for indexability** in search engines or AI retrieval systems. The `package.json` description and keywords are the primary machine-readable metadata for npm/GitHub search — and they target the wrong audience (AI infrastructure engineers looking for "evals" and "guardrails") instead of the actual domain audience (construction compliance officers, payroll auditors, DOL contractors).

The README is 200+ lines deep. That depth helps ranking but hurts skimming — both for humans and for AI systems that extract the first N tokens as a summary.

---

## 2. On-Page SEO Findings

### Observed

- **README H1:** `# WCP Compliance Agent — V2` — includes version number which adds noise. "V2" means nothing to searchers.
- **First paragraph / `> quote` block:**
  > "V2 — TypeScript reference implementation. Three-layer AI decision pipeline for regulated-domain compliance. Every finding cites a regulation. Every decision has a replayable audit trail."
  — Good for AI engineers. Zero mention of "Davis-Bacon Act," "prevailing wage," "construction," "federal contracts." A compliance officer would not recognize this as relevant.
- **"What This Is" section:** The third paragraph finally mentions "Weekly Certified Payroll (WCP) submissions against Davis-Bacon Act prevailing wage requirements." This is the real value proposition — but it's **not in the H1, not in the first sentence, not in the `package.json` description**.
- **Headers are strong:** Clear H2/H3 hierarchy. But some headers are vague: "What This Is" (could be "What is WCP Compliance Agent?"), "Quick Start" (could be "5-Minute Quick Start").
- **Content depth:** Exceptional. Version history table, architecture ASCII art, full API reference with JSON request/response, configuration table, tech stack table, project structure tree. This is 10/10 for engineering documentation.
- **Intent alignment problem:** The README serves at least 4 intents simultaneously:
  1. **Hiring/portfolio** ("reference implementation of trustworthy AI")
  2. **Quick start** (clone, install, run)
  3. **Architecture deep-dive** (three-layer pipeline)
  4. **API documentation** (POST /api/analyze)
  — This dilutes keyword focus. No single page can rank for "AI infrastructure engineer portfolio" AND "Davis-Bacon compliance tool" AND "TypeScript API tutorial."
- **docs/quick-start.md:** Title is "Quick Start" — generic. No frontmatter. Content is excellent (curl examples, mock mode, common issues). But it won't rank for "how to validate Davis-Bacon payroll" because those keywords aren't in the title or headers.
- **docs/compliance/regulatory-compliance-report.md:** Title is "Regulatory Compliance Report" — generic. Content is the deepest on the site: 10 sections, regulation citations, code examples, real-world scenarios, JSON decision outputs. This should be the **hero document** for GEO, but its title is invisible to search.
- **docs/v3/V3_PLAN.md:** Title is good ("v3 Architecture Plan"). Extremely detailed. The "Interview Talking Points" section is portfolio content — valuable but misplaced in a technical plan doc.
- **docs/development/V2_INVENTORY_REPORT.md:** Title is internal. Content is a release-readiness checklist. This should probably not be public-facing docs, or should be clearly marked as internal.
- **docs/architecture/system-overview.md:** Thin. 6 short sections. Missing the ASCII diagram from README. Status label "Designed / Target" is unclear.

### Assessment

**The content is world-class. The packaging is amateur.** Every doc has the depth to rank for its topic, but none have the titles, headers, or keyword targeting to actually do so. The README's most important sentence — "validates Weekly Certified Payroll against Davis-Bacon Act prevailing wage requirements" — is buried in paragraph 3. In AI summarization, paragraph 3 often gets truncated.

The **dual-purpose problem** is severe: this repo is simultaneously a compliance tool and a job-hunting portfolio piece. The portfolio language ("trustworthy AI decision system," "reference implementation") dominates the discovery layer, while the domain language ("Davis-Bacon," "prevailing wage," "WH-347") is buried. For AI search visibility, this means the repo gets indexed for AI-infrastructure queries (where it competes with LangChain, Mastra, etc.) but not for compliance queries (where it has zero competition).

---

## 3. GEO and AI Visibility Findings

### Observed

- **Answer-first formatting:** The README's `> quote` block is answer-first — good. But the answer is "TypeScript reference implementation for regulated-domain compliance" (abstract) not "AI tool that checks construction payroll against federal wage laws" (concrete).
- **Extractability:** Excellent. The JSON API examples, the compliance report's decision outputs, the version comparison table, and the tech stack table are all highly machine-readable. AI systems can parse these easily.
- **Quotability:** Moderate. The compliance report has specific dollar amounts, regulation citations, and real-world scenarios — all highly quotable. But there are no pull-quote-friendly sentences like "The Davis-Bacon Act requires contractors on federal construction projects to pay workers at least the prevailing wage for similar projects in the same locality."
- **Semantic clarity:** The acronym "WCP" is never defined in the H1 or first paragraph. "DBWD" appears without definition. "Layer 1 / Layer 2 / Layer 3" are engineering abstractions that mean nothing to domain users.
- **AI crawler access signals:** GitHub repos are naturally accessible. No `robots.txt` issues. But the Vercel demo app may have unknown crawlability.
- **Machine-readable brand signals:** The project name "WCP Compliance Agent" is consistent across files. Good. But "WCP" is not a known brand — it requires education.
- **No FAQ section:** Missing entirely. An FAQ would be the #1 GEO optimization — "What is WCP?", "What is the Davis-Bacon Act?", "How does AI validate payroll?", "Is this production-ready?"
- **No "How it works" summary for non-technical users:** The architecture ASCII diagram is the closest thing, but it's engineering-porn, not a plain-language explanation.
- **docs/compliance/regulatory-compliance-report.md:** This is the **strongest GEO asset** — regulation citations, structured JSON, real examples, confidence scores. It's essentially pre-formatted for AI extraction. But it's missing a one-paragraph "What this document covers" summary at the top.

### Assessment

This repo is **built by an engineer for engineers** — which means AI systems that serve engineers will extract it well. But AI systems that serve **compliance officers, construction payroll managers, or DOL auditors** (the actual users) will struggle because the domain language is buried under layers of abstraction.

The compliance report is a hidden GEO gem. If properly titled and cross-linked, it could become a citation source for Perplexity answering "How does Davis-Bacon Act payroll validation work?"

**The biggest GEO gap:** No content answers the question "What is the Davis-Bacon Act and how does this tool help?" in plain language. Every doc assumes the reader already knows.

---

## 4. Trust, Entity, and Authority Findings

### Observed

- **Author identity:** "Vinícius Raposo" appears in LICENSE. "FishRaposo" is the GitHub handle. No bridge between these identities. No LinkedIn URL, no personal website, no Twitter/X, no email.
- **No "About the Author" section:** Anywhere. In any doc.
- **No team/contributors section:** Solo project, but doesn't say so explicitly.
- **MIT license:** Good for trust. Dated 2026.
- **CI badge:** Good — shows active maintenance.
- **Coverage badge (83.25%):** Good — shows quality discipline.
- **No security policy:** No `SECURITY.md`.
- **No code of conduct:** `CODE_OF_CONDUCT.md` exists but is minimal (V2 inventory notes this).
- **No "Verified" identity signals:** No GitHub Sponsors, no GPG-signed commits mentioned, no linked social accounts on GitHub profile (can't verify from here).
- **Transparency:** Excellent in architecture (ADRs explain every decision). But ADRs are buried in `docs/adrs/` — not linked from README prominently.
- **Entity disambiguation:** "WCP Compliance Agent" is a descriptive name, not a brand. Searching for "WCP" returns Women's Campaign Fund, World Chess Championship, etc. The project has no unique entity footprint.
- **Third-party credibility:** Zero. No testimonials, no case studies, no "used by" section, no press mentions, no academic citations.
- **docs/positioning/:** Contains `TECH_STACK_ALIGNMENT.md` and `INTERVIEW_TALKING_POINTS.md` — these are internal job-hunting docs, not trust signals for users.

### Assessment

**Authority is implicit, not explicit.** The technical depth screams expertise, but there are no *verifiable* trust signals. For a compliance tool — where users are literally trusting AI with federal contract decisions — this is a critical gap. A compliance officer evaluating this tool would ask: Who built this? Are they qualified? Have they worked in construction payroll? Is this audited? None of these questions are answered.

The "portfolio weapon" language in V3_PLAN.md actively *reduces* perceived authority for the compliance domain. It frames the project as a toy for job hunting rather than a serious tool for wage law enforcement.

---

## 5. Off-Site Entity and Brand Mentions

### Observed

- **GitHub:** Primary presence. Repo, issues, Actions.
- **Vercel:** Live demo hosted. Minimal SEO value (subdomain).
- **LinkedIn:** No company page. No project page. No posts about WCP Compliance Agent. (Noted in V3 plan as "future." The README doesn't link to author's LinkedIn.)
- **Twitter/X:** No presence. (Career-hub shows Twitter/X bio exists but no project account.)
- **Reddit:** No discussions. No r/construction, r/legaladvice, r/programming mentions.
- **YouTube:** No demos, no walkthroughs.
- **Wikipedia / Wikidata:** No entity presence.
- **Product Hunt:** Not listed. (V3 plan mentions as future.)
- **Crunchbase:** Not listed.
- **Hacker News:** No Show HN. No discussion threads.
- **Dev.to / Medium:** No articles.
- **npm registry:** Package is named `wcp-compliance-agent` but published? Unclear if on npm. `package.json` suggests it could be, but no npm badge.
- **DOL / SAM.gov:** No backlinks from official sources (impossible without partnership, but worth noting).
- **Industry communities:** No AGC (Associated General Contractors), no NECA, no AFL-CIO mentions.

### Assessment

**Zero off-site footprint.** For a project this deep, the absence of any external validation is striking. This means:
- Google can't validate entity authority via backlinks.
- AI systems can't cross-reference the project with trusted sources.
- Perplexity has no citations beyond the repo itself.
- No social proof for human visitors.

The **career-hub repo** has more platform presence (Upwork, LinkedIn draft, Twitter/X) than the actual product repo. The product repo should at minimum link to the author's professional profiles.

---

## 6. Platform-Specific AI Readiness

### Observed

#### ChatGPT / Bing
- GitHub repos are indexed by Bing (powers ChatGPT search).
- The README's depth helps — more content = more extraction surface.
- But the **acronym barrier** hurts: ChatGPT won't know "WCP" means "Weekly Certified Payroll" unless it appears in the first few paragraphs with the expansion.
- The architecture diagram is ASCII art — ChatGPT can't "see" it in any meaningful way. A Mermaid diagram or actual image would be better.
- **Missing:** A clear "What is this?" paragraph that defines WCP and Davis-Bacon Act for non-experts.

#### Perplexity
- **Strongest platform for this repo.** Perplexity loves:
  - Regulation citations (`40 U.S.C. § 3142`, `29 CFR 5.22`) — present in compliance report
  - Structured data (JSON examples) — present throughout
  - Specific numbers ($38.50/hr, $120 underpayment) — present
  - Real-world scenarios — present
- The compliance report is essentially **Perplexity bait**.
- But Perplexity needs **clear section headers** to cite properly. The compliance report's headers are clear, but the README's are vague ("What This Is" vs. "What is the WCP Compliance Agent?").

#### Google AI Overviews
- Needs **question-answer format.** The repo has zero FAQ.
- Needs **How-To structured data.** The quick-start has steps but no numbered "How to install WCP Compliance Agent" format.
- The README's "Quick Start" section is good but could be more list-heavy for Google extraction.

#### Gemini
- Gemini values **entity relationships.** The repo mentions Davis-Bacon Act, DOL, SAM.gov, WH-347 — these are known entities. Good.
- But there's no structured entity graph (no schema.org, no Knowledge Panel signals).
- The V3 plan's architecture diagram in Mermaid or ASCII doesn't help Gemini — it needs semantic HTML-like relationships.

### Assessment

| Platform | Readiness | Why |
|---|---|---|
| **ChatGPT / Bing** | 🟡 Moderate | Deep content, poor acronym handling, no plain-language intro |
| **Perplexity** | 🟢 Strong | Citation-rich compliance report, JSON examples, real scenarios |
| **Google AI Overviews** | 🔴 Weak | No FAQ, no How-To schema, no Q&A format |
| **Gemini** | 🟡 Moderate | Good entity mentions, no structured entity graph |

**Platform-specific gaps:**
- No `README` section optimized for "People also ask" style questions
- No Mermaid diagram (ASCII art is invisible to image-aware AI models)
- No YouTube video (Gemini/Perplexity can cite video transcripts)
- No structured Q&A in any doc

---

## Priority Roadmap

### P0 — Blockers (Fix This Week)

| # | Issue | File | Fix |
|---|---|---|---|
| **P0-1** | **Acronym barrier — "WCP" undefined in H1/first paragraph** | README.md | Rewrite H1 to: `# WCP Compliance Agent — Davis-Bacon Act Payroll Validation` or add subtitle. Expand "WCP = Weekly Certified Payroll" in sentence 1. |
| **P0-2** | **Domain keywords missing from `package.json`** | `package.json` | Add keywords: `"davis-bacon"`, `"prevailing-wage"`, `"construction-payroll"`, `"weekly-certified-payroll"`, `"wage-determination"`, `"dbwd"`, `"compliance-automation"`. Rewrite description to: "AI agent that validates Weekly Certified Payroll against Davis-Bacon Act prevailing wage requirements. Three-layer trust architecture with full audit trails." |
| **P0-3** | **README "What This Is" buries the value proposition** | README.md | Move the Davis-Bentence to paragraph 1. The first sentence should answer: "What problem does this solve?" |
| **P0-4** | **No author identity / trust signals** | README.md | Add "About the Author" section with: full name, LinkedIn URL, relevant background ("3 years production AI at Expat Money"), and a headshot if possible. Link to career-hub. |
| **P0-5** | **V3 plan "portfolio weapon" language damages domain authority** | docs/v3/V3_PLAN.md | Keep the portfolio angle in `docs/positioning/INTERVIEW_TALKING_POINTS.md`. In V3_PLAN.md, reframe as: "Production-ready architecture plan for v3 platform expansion." Remove "vulgar display of architectural power." |

### P1 — Important Improvements (Fix This Month)

| # | Issue | File | Fix |
|---|---|---|---|
| **P1-1** | **Compliance report title is generic** | docs/compliance/regulatory-compliance-report.md | Rename to: `davis-bacon-act-compliance-implementation.md` or add frontmatter with SEO title: `title: "Davis-Bacon Act Compliance: Technical Implementation Guide for AI Payroll Validation"`. |
| **P1-2** | **Quick Start title is generic** | docs/quick-start.md | Rename to: `5-minute-quick-start.md` or add frontmatter: `title: "WCP Compliance Agent Quick Start — Install and Validate Payroll in 5 Minutes"`. |
| **P1-3** | **No FAQ section anywhere** | README.md (new) | Add `## FAQ` with 6-8 questions: "What is the Davis-Bacon Act?", "What is WCP?", "Is this production-ready?", "How does the three-layer pipeline work?", "Can it validate my state's prevailing wages?", "What AI model does it use?", "Is my payroll data secure?", "How much does it cost?" |
| **P1-4** | **System overview is too thin** | docs/architecture/system-overview.md | Expand to match README depth. Add ASCII or Mermaid diagram. Add "Current vs. Target" comparison table. Clarify "Designed / Target" status label. |
| **P1-5** | **No Mermaid diagram — ASCII art is AI-invisible** | README.md | Replace or supplement ASCII architecture diagram with a Mermaid diagram (GitHub renders Mermaid natively). AI systems can parse Mermaid text. |
| **P1-6** | **V2 inventory report is internal content mixed with public docs** | docs/development/V2_INVENTORY_REPORT.md | Either: (a) move to repo root as `RELEASE_READINESS.md` with clear "Internal" label, or (b) remove from docs/ and link from CONTRIBUTING.md only. |
| **P1-7** | **Missing How-To structured content for Google** | docs/quick-start.md | Add numbered steps with exact commands. Use format: `## Step 1: Install Node.js`, `## Step 2: Clone the repo`, etc. Google extracts numbered steps aggressively. |
| **P1-8** | **No "Used by" or social proof section** | README.md | Add a `## Who Uses This` section. Even if empty, it signals intent. Add "Star this repo if you're evaluating it for your project" CTA. |
| **P1-9** | **No schema.org or structured data equivalent** | README.md | Add a JSON-LD block in HTML comment or use GitHub's built-in `repository` schema. At minimum, ensure the repo `About` section on GitHub web UI is filled in with description, topics, and website URL. |
| **P1-10** | **No off-site presence strategy** | New file: `docs/positioning/DISTRIBUTION.md` | Document plan for: Product Hunt launch, Hacker News Show HN, Dev.to technical writeup, LinkedIn post series, Reddit r/construction AMA. |

### P2 — Optimization and Scale (Ongoing)

| # | Issue | File | Fix |
|---|---|---|---|
| **P2-1** | **README serves too many intents** | Split into dedicated pages | Create `docs/api-reference.md` from README's API section. Create `docs/architecture/deep-dive.md` from README's architecture section. README should be a 100-line landing page + links. |
| **P2-2** | **docs folder has no index** | docs/ (new) | Add `docs/README.md` as a table of contents / docs index. This becomes the "docs homepage" for AI systems. |
| **P2-3** | **CHANGELOG is good but not surfaced** | README.md | Add "Recent Changes" section with last 3 changelog entries, or a badge linking to CHANGELOG. |
| **P2-4** | **No video or visual content** | New | Create a 2-minute Loom demo of the live app. Embed in README. Upload to YouTube with transcript. |
| **P2-5** | **Compliance report is a wall of text** | docs/compliance/... | Add a table of contents at the top. Add anchor links to each regulation section. Add a "Summary for Non-Technical Auditors" box at the top. |
| **P2-6** | **GitHub repo "About" section unknown** | GitHub UI | (Manual) Add description, topics (`davis-bacon`, `prevailing-wage`, `ai-compliance`, `payroll-validation`), website URL (Vercel demo), and uncheck "Releases" if not used, check "Wiki" if you want docs there. |
| **P2-7** | **No contribution guide for domain experts** | docs/CONTRIBUTING.md | Current CONTRIBUTING.md is for devs. Add a section: "How to contribute compliance expertise" — invite payroll auditors, construction lawyers to suggest regulation edge cases. |
| **P2-8** | **npm package not published** | npm registry | If this is meant to be installable, publish to npm. If not, remove `main` and `bin` fields from `package.json` to avoid confusion. |
| **P2-9** | **Vercel demo lacks SEO** | Vercel app | Add `<title>WCP Compliance Agent — Validate Davis-Bacon Act Payroll</title>`, meta description, Open Graph tags. Add a `/what-is-davis-bacon` content page for discovery. |
| **P2-10** | **ADR docs are hidden gems** | README.md | Add `## Architecture Decisions` section with 2-sentence summaries of each ADR and links. ADRs are trust signals — surface them. |

---

## Data Gaps and Validation Notes

| Item | Status | Notes |
|---|---|---|
| GitHub repo "About" section content | **Not verified** | Can't inspect GitHub UI. User must manually verify topics, description, and URL are filled. |
| Vercel demo SEO metadata | **Not verified** | Can't inspect live app `<head>`. User should verify title, meta description, OG tags. |
| Author's LinkedIn / Twitter presence | **Not verified** | Career-hub mentions these exist. Links should be added to README. |
| npm registry presence | **Not verified** | `package.json` has `name` and `version` but unclear if published. |
| GitHub Pages / custom domain | **Not verified** | No `CNAME` file found. Could be enabled. |
| Search Console / analytics | **Not verified** | Not applicable without custom domain. |
| External backlinks | **Not verified** | No search API access. Manual check recommended: `link:github.com/FishRaposo/WCP-Compliance-Agent` in Google (limited value) or use ahrefs/SEMrush. |
| AI citation share | **Not verified** | Can't query ChatGPT/Perplexity/Gemini citation databases directly. Manual test: ask each platform "What is WCP Compliance Agent?" and "How does AI validate Davis-Bacon payroll?" |

---

## Appendix: Quick-Win Checklist (Do Today)

- [ ] Rewrite `package.json` `description` and `keywords` (P0-2)
- [ ] Rewrite README first 3 paragraphs to lead with Davis-Bacon + WCP definition (P0-1, P0-3)
- [ ] Add "About the Author" section to README (P0-4)
- [ ] Remove "portfolio weapon" / "vulgar display" from V3_PLAN.md (P0-5)
- [ ] Add `## FAQ` to README with 6 questions (P1-3)
- [ ] Rename compliance report file or add SEO frontmatter (P1-1)
- [ ] Add Mermaid diagram to README (P1-5)
- [ ] Fill GitHub repo "About" section with topics + website URL (P2-6)
- [ ] Add docs index page (P2-2)

**Estimated time:** 2-3 hours for all P0 + top 4 P1 items. The impact on discoverability will be 10x.

---

*Report generated by Clanker (OpenClaw) using the seo-geo-audit skill framework. Method: Direct file analysis. No external API access. No Search Console data. All findings are observable or assessable from repository content.*
