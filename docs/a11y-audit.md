# claw42 a11y Audit

Date: 2026-05-07
Scope: `/zh_CN`, `/en_US`, `/ar_SA`, `/agent`, `/zh_CN/agent`

## Color Contrast

`scripts/verify-a11y.mjs` runs axe-core with WCAG 2.0/2.1 A + AA tags and fails the run on `critical` or `serious` violations, including color contrast. Generated JSON reports are written to `reports/a11y/YYYY-MM-DD.json`.

Current run found serious `color-contrast` violations in:

- Home primary hero CTA text over `#7c5cff` (`.hover:shadow-[0_0_24px_rgba(124,92,255,0.5)]`)
- Agent focus label text using `text-white/45` inside the focus chip
- Agent row `details > summary` muted text

Suggested replacements for Dan decision:

- Raise muted label text from `text-white/45` to at least `text-white/70`, or use `#c9c3e8` on the current dark chip background.
- Raise summary text from current muted gray to `text-white/72` or stronger.
- For the hero primary CTA, either darken the purple fill or increase text/background separation with a non-color-dependent treatment before changing brand color.

No brand color changes were made in this PR.

## Focus Management

Global focus-visible styling is applied to links, buttons, inputs, selects, textareas, and focusable custom elements. The coin modal already moves focus into the dialog on open and restores focus to the trigger on close.

The verifier focuses visible interactive elements on each checked route and records whether a visible outline, ring, or border treatment is present.

## aria-label

Icon-only and compact controls were audited. The quick-start copy control now exposes an `aria-label`; existing coin, modal close, language, dismiss, and back-to-top controls already carry accessible labels or visible text.

Decorative images remain hidden from assistive technology with empty alt text and/or `aria-hidden="true"`.

Status dots use `role="img"` with an accessible label so the label is valid for assistive technology.
