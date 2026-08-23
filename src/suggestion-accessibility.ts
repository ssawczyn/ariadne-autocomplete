const SR_ONLY_STYLE: Partial<CSSStyleDeclaration> = {
	position: "absolute",
	width: "1px",
	height: "1px",
	padding: "0",
	margin: "-1px",
	overflow: "hidden",
	clip: "rect(0, 0, 0, 0)",
	whiteSpace: "nowrap",
	border: "0",
};

let idCounter = 0;
function nextId(prefix: string): string {
	idCounter += 1;
	return `${prefix}-${idCounter}`;
}

/**
 * Retrofits Obsidian's suggestion popups (the `[[` wikilink autocomplete,
 * and anything else built on the same popup pattern — e.g. tag suggest)
 * with ARIA combobox/listbox semantics. Obsidian's popup isn't built on
 * CodeMirror's accessible autocomplete widget, so none of this is wired
 * up natively: screen readers aren't told a popup opened, and arrow-key
 * highlighting isn't exposed via aria-activedescendant.
 *
 * The class names below (`.suggestion-container`, `.suggestion-item`,
 * `.is-selected`) are Obsidian's internal, undocumented markup, not a
 * published API — inferred from observed behavior and may need
 * adjustment against a specific Obsidian version.
 */
export class SuggestionAccessibility {
	private bodyObserver: MutationObserver;
	private itemObserver: MutationObserver | null = null;
	private liveRegion: HTMLElement;
	private activeHost: HTMLElement | null = null;
	private activePopup: HTMLElement | null = null;
	private lastAnnouncedCount = -1;
	private isDebugEnabled: () => boolean;

	constructor(isDebugEnabled: () => boolean = () => false) {
		this.isDebugEnabled = isDebugEnabled;

		this.liveRegion = createDiv({
			attr: { "aria-live": "polite", role: "status" },
			parent: document.body,
		});
		Object.assign(this.liveRegion.style, SR_ONLY_STYLE);

		this.bodyObserver = new MutationObserver((mutations) => this.onBodyMutation(mutations));
		this.bodyObserver.observe(document.body, { childList: true });

		this.log("watching for suggestion popups");
	}

	// Plain-text status log, not a UI element — meant to be readable in the
	// DevTools Console panel (a flat text stream) without needing to
	// navigate the Elements accessibility tree, which is its own
	// accessibility problem for a screen reader user trying to debug this
	// plugin. Off by default so real users don't get a console full of
	// noise; flip via settings.debugLogging (no UI for that yet).
	private log(message: string): void {
		if (!this.isDebugEnabled()) return;
		console.debug(`[Ariadne] ${message}`);
	}

	destroy(): void {
		this.bodyObserver.disconnect();
		this.itemObserver?.disconnect();
		this.teardownHost();
		this.liveRegion.remove();
	}

	private onBodyMutation(mutations: MutationRecord[]): void {
		for (const mutation of mutations) {
			for (const node of Array.from(mutation.addedNodes)) {
				if (!node.instanceOf(HTMLElement)) continue;
				const popup = this.findSuggestionPopup(node);
				if (popup) this.onPopupOpened(popup);
			}
			for (const node of Array.from(mutation.removedNodes)) {
				if (!node.instanceOf(HTMLElement)) continue;
				if (node === this.activePopup || node.contains(this.activePopup)) {
					this.onPopupClosed();
				}
			}
		}
	}

	// `.suggestion-container` is the inline popup used by EditorSuggest
	// (wikilink/tag autocomplete). `.prompt-results` is the results list
	// used by the modal-based Prompt component shared by the command
	// palette and Quick Switcher — confirmed by reading Obsidian's own
	// installed app bundle: both wire up the exact same `.suggestion-item`
	// / `.is-selected` mechanics underneath, just inside a different
	// container element. Only the container selector differs; everything
	// downstream (tagging items, tracking selection) is unchanged.
	private static readonly POPUP_SELECTOR = ".suggestion-container, .prompt-results";

	private findSuggestionPopup(node: HTMLElement): HTMLElement | null {
		if (node.matches(SuggestionAccessibility.POPUP_SELECTOR)) return node;
		return node.querySelector<HTMLElement>(SuggestionAccessibility.POPUP_SELECTOR);
	}

	private onPopupOpened(popup: HTMLElement): void {
		const host = document.activeElement;
		if (!host || !host.instanceOf(HTMLElement)) {
			this.log("popup detected, but document.activeElement was not an element — skipping");
			return;
		}

		this.log(`popup detected, host is <${host.tagName.toLowerCase()}${host.id ? "#" + host.id : ""}${host.className ? "." + String(host.className).replace(/\s+/g, ".") : ""}>`);

		this.activePopup = popup;
		this.activeHost = host;

		const listEl = popup.querySelector<HTMLElement>(".suggestion") ?? popup;
		if (!listEl.id) listEl.id = nextId("ariadne-listbox");
		listEl.setAttribute("role", "listbox");

		host.setAttribute("aria-expanded", "true");
		host.setAttribute("aria-controls", listEl.id);
		host.setAttribute("aria-autocomplete", "list");

		this.lastAnnouncedCount = -1;
		this.syncItems(popup);

		this.itemObserver?.disconnect();
		this.itemObserver = new MutationObserver(() => this.syncItems(popup));
		this.itemObserver.observe(popup, {
			attributes: true,
			attributeFilter: ["class", "style", "hidden"],
			subtree: true,
			childList: true,
		});
	}

	// Obsidian appears to cap the popup at a fixed pool of rendered items
	// (observed: exactly 100) and hide non-matching ones via CSS as you
	// narrow the query, rather than adding/removing DOM nodes. So "how many
	// suggestions are available" has to mean "how many are actually
	// rendered visible," not "how many .suggestion-item elements exist" —
	// and since visibility changes via class/style attribute mutations
	// rather than childList mutations, re-announcing has to be driven by
	// whether the visible count changed, not by which mutation type fired.
	private isVisible(el: HTMLElement): boolean {
		if (el.hidden) return false;
		if (getComputedStyle(el).display === "none") return false;
		return el.getClientRects().length > 0;
	}

	private syncItems(popup: HTMLElement): void {
		const allItems = Array.from(popup.querySelectorAll<HTMLElement>(".suggestion-item"));
		let selected: HTMLElement | null = null;
		let visibleCount = 0;

		for (const item of allItems) {
			if (!item.id) item.id = nextId("ariadne-option");

			if (!this.isVisible(item)) {
				item.setAttribute("aria-hidden", "true");
				item.removeAttribute("role");
				item.removeAttribute("aria-selected");
				continue;
			}

			item.removeAttribute("aria-hidden");
			item.setAttribute("role", "option");
			visibleCount += 1;
			const isSelected = item.classList.contains("is-selected");
			item.setAttribute("aria-selected", isSelected ? "true" : "false");
			if (isSelected) selected = item;
		}

		if (this.activeHost) {
			if (selected) {
				this.activeHost.setAttribute("aria-activedescendant", selected.id);
			} else {
				this.activeHost.removeAttribute("aria-activedescendant");
			}
		}

		if (visibleCount !== this.lastAnnouncedCount) {
			this.lastAnnouncedCount = visibleCount;
			this.log(`visible suggestion count changed to ${visibleCount} (of ${allItems.length} rendered), selected: ${selected ? selected.id : "none"}`);
			this.announce(`${visibleCount} suggestion${visibleCount === 1 ? "" : "s"} available`);
		}
	}

	private onPopupClosed(): void {
		this.log("popup closed");
		this.teardownHost();
		this.itemObserver?.disconnect();
		this.itemObserver = null;
		this.activePopup = null;
		this.announce("");
	}

	private teardownHost(): void {
		const host = this.activeHost;
		if (!host) return;
		host.setAttribute("aria-expanded", "false");
		host.removeAttribute("aria-activedescendant");
		host.removeAttribute("aria-controls");
		this.activeHost = null;
	}

	private announce(text: string): void {
		// Clear-then-set on a delay so repeated identical announcements
		// (e.g. "5 suggestions available" twice in a row) still get
		// spoken — most screen readers only announce on a text change.
		this.liveRegion.textContent = "";
		if (!text) return;
		window.setTimeout(() => {
			this.liveRegion.textContent = text;
		}, 50);
	}
}
