import { Plugin } from "obsidian";
import { SuggestionAccessibility } from "./suggestion-accessibility";

interface AriadneAutocompleteSettings {
	debugLogging: boolean;
}

const DEFAULT_SETTINGS: AriadneAutocompleteSettings = {
	debugLogging: false,
};

export default class AriadneAutocompletePlugin extends Plugin {
	settings: AriadneAutocompleteSettings = DEFAULT_SETTINGS;
	private suggestionA11y: SuggestionAccessibility | null = null;

	async onload() {
		const loadedData = (await this.loadData()) as Partial<AriadneAutocompleteSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		// No settings UI yet — flip this in data.json (or via the console:
		// `app.plugins.plugins["ariadne-autocomplete"].settings.debugLogging = true`)
		// until there's a proper toggle. Passed as a callback so a future
		// settings tab can flip it live without needing a plugin reload.
		this.suggestionA11y = new SuggestionAccessibility(() => this.settings.debugLogging);
	}

	onunload() {
		this.suggestionA11y?.destroy();
		this.suggestionA11y = null;
	}
}
