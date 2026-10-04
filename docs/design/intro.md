# Intro · 航迹成诗

Surface mode: Experience; the single opening moment hands off to Read. Scope: opening-only markup, CSS and controller in `index.html`. Shared homepage structure, navigation styles, data and services remain intact.

## Motion thesis

Four site-name glyphs form a diagonal, join a horizontal route, then travel to the measured live homepage heading. Flat rust band, ink disc, brass arc, two transparent planes and one short meander establish the approved constructivist composition. No bitmap, canvas loop, external asset or dependency is required. No demonstration poem, date or place from the storyboard is copied.

0–0.6s establishes geometry; 0.6–1.4s reveals offset glyphs through clipping; 1.4–2.2s aligns glyphs and draws the route; 2.2–3s withdraws geometry and reveals the prepared homepage. The underlying title is revealed once both titles align, avoiding overlap during travel and a blank fade at completion. The 3s CSS sequence has a 3.1s independent timer fallback.

The opening inherits paper, ink, gold and theme contrast variables. `--intro-rust: #A3462E` intentionally preserves the confirmed rust book-cover accent across all three themes; it is decorative. Display uses the incumbent serif; the small margin note uses the incumbent Kai face. Controls use existing sans and a 44px hit area.

## Access and failure behavior

The overlay is hidden by default. The old homepage arrival delays are overridden within the intro block so normal content prepares immediately, including with scripts absent. After initialization succeeds, background body siblings become inert, scroll is locked through a temporary class, and the named skip control receives focus. Tab stays on that control; Enter/Space activate it and Escape exits. Completion or interruption restores each sibling's previous inert value, body overflow and focus (the prior element, or the homepage logo). A changed viewport cancels normal playback rather than retaining a stale measured title position; frozen development previews instead remeasure the heading. Synthetic resize events with unchanged dimensions are ignored.

The existing `intro_poem_shown` session key is reserved before playback. Ordinary later visits bypass playback. Storage reads or writes that fail, reduced-motion preference, and browsers without native inert directly show the homepage. Caught controller failures, subsequent window errors or unhandled rejections release the overlay. Timers also release it when animation completion is not delivered. No async asset is required by the opening.

## Local review controls

- `/?intro=replay`: replay without changing normal session behavior.
- `/?intro=replay&intro-frame=800`: freeze the actual animation timeline at the requested millisecond (0–2900).
- `/?preview=1`: retain the existing final-frame review route, now frozen at 2760ms over the real homepage.
- Every frozen review remains skippable. Reduced-motion preference continues to take precedence.

Evidence and report: `D:/poem_ulysses_web/design-drafts/2026-10-04/implementation/intro/`. The preview server runs at `http://127.0.0.1:8123/` from this worktree.
