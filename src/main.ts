import { Plugin } from "obsidian";

export default class AriadneAutocompletePlugin extends Plugin {
	async onload() {
		// TODO: retrofit Obsidian's EditorSuggest-based popups (starting with
		// the wikilink `[[` suggester) with proper ARIA combobox semantics:
		// role="listbox"/"option" on the popup, aria-activedescendant tracking
		// the highlighted suggestion, aria-expanded on the editor, and a
		// live-region announcement when suggestions appear. See
		// https://github.com/ssawczyn/Ariadne/blob/main/docs/CATALOG.md#1
	}

	onunload() {}
}
