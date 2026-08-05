# AGENTS.md

## Project overview

**Poem's Ulysses (诗歌漂流)** — a static poetry reading/publishing platform deployed on GitHub Pages (`zhege712-crypto/Poem_Ulysses`). Seven flat HTML pages with inline CSS/JS, no build step, no framework, no package manager.

Design context lives in `PRODUCT.md` (product truth) and `DESIGN.md` (design system + tokens, with machine-readable YAML frontmatter). Re-run the detector after UI changes: `node C:\Users\10141\.agents\skills\impeccable\scripts\detect.mjs --json <targets>`.

## No toolchain

- There is **no `package.json`, no bundler, no build step**. The `.opencode/.gitignore` explicitly ignores `package.json`, `package-lock.json`, and `bun.lock` — never add these.
- Local preview: `python -m http.server` (or any static file server) from the repo root.
- All HTML, CSS, and JavaScript live inline in each `.html` file. There are no external `.css` or `.js` files.

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
```

Poems are ordered by series then date (not by array position). All pages that consume this data follow that ordering convention: sort by series occurrence order, then `getDateWeight` (constant weights per year/month/day part) descending, then `localeCompare` ascending. Copy this exact comparator from `read.html`; do not "improve" it.

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
| `directory.html` | Catalog with list/tree views and search | — |
| `read.html` | Poem reader with prev/next nav, lightbox, comments | `?id=<poem id>` (required) |
| `authors.html` | Author card wall ("同志们"), alias-merged with poems | — |
| `author.html` | Single-author detail: bio, stats, works list; subseries poems grouped under subseries headers (same convention as directory) | `?id=<author id>` (required) |
| `about.html` | About page with project background | — |
| `admin.html` | Admin backend (GitHub API CRUD + image upload) | — |

Navigation appears on the five public pages (not `admin.html`): 首页 / 目录 / 同志们 / 关于 / 投稿. New pages must match this header, side-theme, and footer structure exactly.

## Design conventions (shared across all pages)

- **CSS custom properties** defined on `:root`: `--paper`, `--ink`, `--gold`, `--clay`, and many more. Three themes (light / dark / eye-care) via `data-theme` attribute on `<html>`. Always set `--theme-*` variables when adding styled elements.
- **Fonts**: Cormorant Garamond (serif), Inter (sans), JetBrains Mono (mono), Noto Sans/Serif SC (Chinese), Kaiti SC (poem body). All loaded via Google Fonts `<link>`.
- **Visual language**: Greek meander SVG borders, gold-toned accents, glassmorphism blur on nav, pill-shaped buttons, warm paper/ink palette. Use existing patterns rather than introducing new ones.
- **JS convention**: Vanilla ES6, IIFE pattern for scoping, `sessionStorage`/`localStorage` for state, `fetch` for data, `IntersectionObserver` for scroll reveal, `Date.now()` cache busters on fetches.
- **Responsive**: `clamp()` and media queries at 640px / 820px.

## Admin panel (`admin.html`)

- Uses GitHub API to read/write `data/poems.json` (panel ②③) and `data/authors.json` (panel ④) and upload images directly to the repo.
- Falls back to `raw.githubusercontent.com` for reads (avoids GitHub API cache).
- Default password: `umbrella2026`. Token/repo settings persisted via `localStorage`.
- Deleting a poem also deletes its associated images from the repo.
- Panel ④ edits author profiles: id/name/aliases (顿号- or comma-separated), bio, tags, link. The author form pre-fills from clicking 编辑 on a listed author.

## Comments

Uses Giscus (GitHub Discussions integration) on `read.html`. Theme changes on the page are forwarded to the Giscus iframe via `postMessage`.

## Image handling

- Images stored under `images/` in the repo root.
- On `read.html`, images display with a grayscale filter; click to open a lightbox (full color). Escape or click-outside closes it.
- Generated images from AI tools go in `generated_images/` (git-ignorable temp area).

## Preview/debug

- `index.html?preview=1` — freeze the intro animation at its final frame (for screenshots/design review).
- Screenshot reference images are in `_preview_shots/`. These are not production assets.
