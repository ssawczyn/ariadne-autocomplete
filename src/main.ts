import { Plugin } from "obsidian";
import { SuggestionAccessibility } from "./suggestion-accessibility";

export default class AriadneAutocompletePlugin extends Plugin {
	private suggestionA11y: SuggestionAccessibility | null = null;

	async onload() {
		this.suggestionA11y = new SuggestionAccessibility();
	}

	onunload() {
		this.suggestionA11y?.destroy();
		this.suggestionA11y = null;
	}
}
