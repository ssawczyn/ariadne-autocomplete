# Ariadne Autocomplete

An [Obsidian](https://obsidian.md) plugin that retrofits screen reader and keyboard accessibility onto Obsidian's suggestion popups — starting with the `[[` wikilink autocomplete.

Part of the [Ariadne](https://github.com/ssawczyn/Ariadne) project. See [issue #1 in the catalog](https://github.com/ssawczyn/Ariadne/blob/main/docs/CATALOG.md) for the background on why this is needed and what's already known about the problem.

## The problem

Obsidian's `[[` wikilink suggestion popup doesn't announce itself to screen readers, and doesn't expose keyboard navigation state to assistive tech — even though you can visually see a highlighted suggestion move as you press arrow keys, nothing tells a screen reader which option is selected or that a list of suggestions exists at all.

This appears to be because the popup is Obsidian's own bespoke `EditorSuggest`-based UI, not built on CodeMirror 6's `@codemirror/autocomplete` package (which already implements the accessible ARIA combobox pattern). See the catalog entry for more detail.

## Status

Early — plugin skeleton only, the actual ARIA retrofit hasn't been implemented yet.

## Development

```
npm install
npm run dev
```

This builds `main.js` in watch mode. Symlink or copy this directory into a test vault's `.obsidian/plugins/ariadne-autocomplete/` folder to load it.

## License

[MIT](LICENSE)
