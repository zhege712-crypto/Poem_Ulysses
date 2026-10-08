# AGENTS.md

## Project overview

**Poem's Ulysses (诗歌漂流)** — a static poetry reading/publishing platform deployed on GitHub Pages (`zhege712-crypto/Poem_Ulysses`). Public pages use flat HTML with inline CSS/JS, no build step, no framework, no package manager. The optional submission service lives in `submissions/` and is deployed separately to Cloudflare Workers.

Design context lives in `PRODUCT.md` (product truth) and `DESIGN.md` (design system + tokens, with machine-readable YAML frontmatter). Re-run the detector after UI changes: `node C:\Users\10141\.agents\skills\impeccable\scripts\detect.mjs --json <targets>`.

The accepted public redesign is recorded in `docs/design/release-2026-10-06.md`, with page-specific records in `docs/design/public-ui.md`, `docs/design/voyage.md`, and `docs/design/intro.md`. These records describe the current public pages; older public intro/Animus descriptions in `DESIGN.md` are historical. Worker workspaces retain their existing design and security conventions.

The subsequent static art extension is recorded in `docs/design/art-2026-10-07.md` and `docs/design/public-art-2026-10-06.md`: one decorative Greek relief on the homepage, sourced copy only, paper/ink/rust geometry, rounded glass controls, and restrained inner pages. This extension preserves the existing interactions; its work branch is local until explicitly published.

## No toolchain

- There is **no `package.json`, no bundler, no build step**. The `.opencode/.gitignore` explicitly ignores `package.json`, `package-lock.json`, and `bun.lock` — never add these.
- Local preview: `python -m http.server` (or any static file server) from the repo root.
- Page CSS and behavior live inline in each `.html` file. The public, secret-free `submission-config.js` supplies the submission API URL and Turnstile site key to `submit.html` and `status.html`.

## Data layer

`data/poems.json` is the sole database of poems. Schema:

```
id        — string (timestamp)
title     — string
date      — string (YYYY-MM-DD or freeform)
content   — string (newline-separated poem text)
series    — string (e.g. "天一篇", "匡园篇", "洛社篇", "最初的序列", "拾遗记")
subseries — string (optional)
author    — string
images    — string[] (paths relative to repo root, e.g. "images/1784094796315-wanchunqiuqibyeno.jpeg")
publishedAt / updatedAt — optional server-owned ISO timestamps for new publications / changed poems
writing — optional public-only {start?, end?, place?}; dates retain YYYY / YYYY-MM / YYYY-MM-DD precision
writingRevision — optional opaque pointer to an immutable private D1 snapshot; never resolves through a public API
```

Optional writing information is documented in `docs/writing-info.md` and `docs/design/writing-info-2026-10-08.md`. Full values and the visibility choice belong to the protected D1 layer, not the public repository. All server poem writes must keep the `projectWriting` boundary; do not write hydrated private metadata into JSON or Git history. Apply `submissions/writing-schema.sql` once before deploying the review Worker, then the public Worker, then static pages. Preserve the review config's `keep_names = false` because browser form functions are embedded into nonce-protected HTML. Use `writing-preview.mjs` only as an isolated localhost fixture, never as a production entry point.

Poems are ordered by series then date (not by array position). All pages that consume this data follow that ordering convention: sort by series occurrence order, then `getDateWeight` (constant weights per year/month/day part) descending, then `localeCompare` ascending. Copy this exact comparator from `read.html`; do not "improve" it.

Exception: homepage “最近更新” and “最近的诗” use `updatedAt`, then `publishedAt`, then legacy numeric timestamp IDs, descending. They describe publication/edit activity, not the work's date. Server write paths stamp changed poems only; no-op saves and reordering do not change timestamps.

`data/authors.json` holds author profiles. Schema:

```
id      — string (slug)
name    — string (display name)
aliases — string[] (author-string variants merged to this author, e.g. 逍遥/逍之遥/逍遙, eno/Eno)
bio     — string (placeholder-friendly; empty means "no bio yet")
tags    — string[] (poem-style tags; empty shows "待题记")
link    — string (optional external link)
```

Not all `poems.json` `author` strings are in `authors.json`; unlisted names render in the "待题名" (pending) section on `authors.html`. When adding a poem with a new author, also add an entry (or alias) in `authors.json`.

## Page architecture

| File | Purpose | Key query params |
|---|---|---|
| `index.html` | Homepage with intro animation, stats, recent poems | `?preview=1` freezes intro animation frame |
| `voyage.html` | Regional map and synchronized travel log/poem reading; explicit optional globe | — |
| `directory.html` | Catalog with list/tree views and search | — |
| `read.html` | Poem reader with prev/next nav, lightbox, comments | `?id=<poem id>` (required) |
| `authors.html` | Author card wall ("同志们"), alias-merged with poems | — |
| `author.html` | Single-author detail: bio, stats, works list; subseries poems grouped under subseries headers (same convention as directory) | `?id=<author id>` (required) |
| `about.html` | About page with project background | — |
| `submit.html` | Public text submission and live preview | — |
| `status.html` | Private receipt status and pre-review withdrawal | `#<receipt token>` |
| `admin.html` | Redirect to the protected Worker management page | — |
| `partners.html` | Redirect to Google-login collaborator workspace on the review Worker | — |
| `privacy.html` | Submission and collaborator account privacy policy | — |

Public navigation includes 首页 / 目录 / 同志们 / 漂流 / 关于 / 投稿. The submission and status pages inherit the warm paper, ink, gold, and three-theme system. `submissions/README.md` documents the public and protected Workers.

## Design conventions (shared across all pages)

- **CSS custom properties** defined on `:root`: `--paper`, `--ink`, `--gold`, `--clay`, and many more. Three themes (light / dark / eye-care) via `data-theme` attribute on `<html>`. Always set `--theme-*` variables when adding styled elements.
- **Fonts**: Cormorant Garamond (serif), Inter (sans), JetBrains Mono (mono), Noto Sans/Serif SC (Chinese), Kaiti SC (poem body). All loaded via Google Fonts `<link>`.
- **Visual language**: Greek meander SVG borders, gold-toned accents, glassmorphism blur on nav, pill-shaped buttons, warm paper/ink palette. Use existing patterns rather than introducing new ones.
- **JS convention**: Vanilla ES6, IIFE pattern for scoping, `sessionStorage`/`localStorage` for state, `fetch` for data, `IntersectionObserver` for scroll reveal, `Date.now()` cache busters on fetches.
- **Responsive**: `clamp()` and media queries at 640px / 820px.

## Admin panel (`/admin` on the review Worker)

- `admin.html` redirects to the review Worker's `/admin` page, which uses the same reviewer login as the submission queue. The protected page lives in `submissions/admin-ui.mjs`.
- Its server-side API reads and writes `data/poems.json`, `data/authors.json`, and `data/logs.json` with a GitHub file SHA check. The browser never receives a GitHub token.
- Image uploads use `/api/images`. Removing an image reference or deleting a poem does not delete the image file from the repository.
- Collaborators use separate Google authentication at `/partners`; only maintainer-approved fixed author and poem ownership bindings grant access. Pending manuscript edits use versions and expected submission timestamps. Published changes require the maintainer's `/revisions` approval. Apply `submissions/partners-schema.sql` before deploying this feature; never associate private drafts by matching pen names.
- Security extension requires additive `submissions/security-schema.sql` before either Worker deployment. `/security` and `/partner-security` expose only each account's sessions; operation audit and new-submission pause controls require maintainer identity. Never expose session hashes to the browser. GitHub mode requires a login within 30 minutes for important writes, with re-login in a separate tab to retain editor inputs.
- The author panel edits id/name/aliases/bio/tags/link; the travel log panel supports editing and ordering map points.

## Comments

Uses Giscus (GitHub Discussions integration) on `read.html`. Theme changes on the page are forwarded to the Giscus iframe via `postMessage`.

## Image handling

- Images stored under `images/` in the repo root.
- On `read.html`, images display with a grayscale filter; click to open a lightbox (full color). Escape or click-outside closes it.
- Generated images from AI tools go in `generated_images/` (git-ignorable temp area).

## Preview/debug

- `index.html?preview=1` — freeze the intro animation at its final frame (for screenshots/design review).
- `index.html?intro=replay` — replay the three-second constructivist opening; `&intro-frame=1600` freezes a development frame. Reduced-motion and unsupported storage skip the opening. The intro title follows the actual homepage typography.
- Screenshot reference images are in `_preview_shots/`. These are not production assets.
