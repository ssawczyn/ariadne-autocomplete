# Ariadne Autocomplete

An [Obsidian](https://obsidian.md) plugin that retrofits screen reader and keyboard accessibility onto Obsidian's suggestion popups — starting with the `[[` wikilink autocomplete.

Part of the [Ariadne](https://github.com/ssawczyn/Ariadne) project. See [issue #1 in the catalog](https://github.com/ssawczyn/Ariadne/blob/main/docs/CATALOG.md) for the background on why this is needed and what's already known about the problem.

## The problem

Obsidian's `[[` wikilink suggestion popup doesn't announce itself to screen readers, and doesn't expose keyboard navigation state to assistive tech — even though you can visually see a highlighted suggestion move as you press arrow keys, nothing tells a screen reader which option is selected or that a list of suggestions exists at all.

This appears to be because the popup is Obsidian's own bespoke `EditorSuggest`-based UI, not built on CodeMirror 6's `@codemirror/autocomplete` package (which already implements the accessible ARIA combobox pattern). See the catalog entry for more detail.

## How it works

Obsidian's suggestion popups all appear to share one internal DOM pattern: a `.suggestion-container` holding a list of `.suggestion-item` elements, with `.is-selected` toggled on whichever one is currently highlighted. This plugin watches for that pattern with a `MutationObserver` and layers standard ARIA combobox/listbox semantics on top of it, without touching Obsidian's own rendering or keyboard handling:

- `role="listbox"` / `role="option"` on the popup and its items
- `aria-expanded`, `aria-controls`, `aria-autocomplete="list"` on whichever element had focus when the popup opened (the editor's contenteditable for inline suggesters like `[[`, or a modal `<input>` for others)
- `aria-activedescendant` kept in sync with the `.is-selected` item as you arrow through
- A polite live-region announcement of how many suggestions are available, so screen readers know a popup opened at all

Because it's generic to the popup pattern rather than wikilink-specific, it should also apply to any other Obsidian UI built on the same suggestion component (see [catalog issue #6](https://github.com/ssawczyn/Ariadne/blob/main/docs/CATALOG.md) re: the command palette) — that's untested, not a design goal we're claiming credit for yet.

**Important caveat:** the class names above (`.suggestion-container`, `.suggestion-item`, `.is-selected`) are Obsidian's internal, undocumented markup, inferred from known/observed behavior, not a published API. They may shift in future Obsidian versions. If they do, the retrofit will silently do nothing rather than error.

## Status

**Confirmed working for both `[[` wikilink and `#` tag autocomplete**, tested live on macOS with VoiceOver, with zero code changes needed between the two — confirms the fix is genuinely generic to Obsidian's shared suggestion-popup component, not wikilink-specific:

- ✅ Announces suggestion availability when the popup opens
- ✅ Arrow-key navigation reads the correct highlighted suggestion
- ✅ Suggestion count stays accurate as the query narrows (fixed in [ede864e](https://github.com/ssawczyn/ariadne-autocomplete/commit/ede864e) — Obsidian renders a fixed pool of items and hides non-matches via CSS rather than removing them, so the count has to track visible items, not DOM node count)
- ✅ Escape cleanly dismisses and returns focus state to normal

Not yet tested: other suggestion contexts (embeds, frontmatter property values, the command palette — plausible given two-for-two so far, but unconfirmed), Windows/NVDA and other screen reader + OS combinations.

## Development

```
npm install
npm run dev
```

This builds `main.js` in watch mode. Symlink or copy this directory into a test vault's `.obsidian/plugins/ariadne-autocomplete/` folder to load it.

## Testing

The plugin logs plain-text status lines to the console (`[Ariadne] ...`) at each step — popup detected, items tagged, popup closed — as a debugging aid that doesn't require navigating DevTools' Elements accessibility tree, which is a poor experience for screen reader users in its own right. Reading the console log is optional, though; the actual test is simpler:

1. With the plugin enabled, open a note and type `[[`.
2. Listen for an announcement that suggestions are available.
3. Press the down arrow and listen for whether the highlighted suggestion changes what's announced.
4. Press Escape and confirm things go quiet.

What you hear (or don't) at each step is itself the diagnostic — it doesn't need to be paired with a DevTools inspection to be useful for narrowing down what's broken.

## License

[MIT](LICENSE)
