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

	constructor() {
		this.liveRegion = document.createElement("div");
		this.liveRegion.setAttribute("aria-live", "polite");
		this.liveRegion.setAttribute("role", "status");
		Object.assign(this.liveRegion.style, SR_ONLY_STYLE);
		document.body.appendChild(this.liveRegion);

		this.bodyObserver = new MutationObserver((mutations) => this.onBodyMutation(mutations));
		this.bodyObserver.observe(document.body, { childList: true });
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
				if (!(node instanceof HTMLElement)) continue;
				const popup = this.findSuggestionPopup(node);
				if (popup) this.onPopupOpened(popup);
			}
			for (const node of Array.from(mutation.removedNodes)) {
				if (!(node instanceof HTMLElement)) continue;
				if (node === this.activePopup || node.contains(this.activePopup)) {
					this.onPopupClosed();
				}
			}
		}
	}

	private findSuggestionPopup(node: HTMLElement): HTMLElement | null {
		if (node.matches(".suggestion-container")) return node;
		return node.querySelector<HTMLElement>(".suggestion-container");
	}

	private onPopupOpened(popup: HTMLElement): void {
		const host = document.activeElement;
		if (!(host instanceof HTMLElement)) return;

		this.activePopup = popup;
		this.activeHost = host;

		const listEl = popup.querySelector<HTMLElement>(".suggestion") ?? popup;
		if (!listEl.id) listEl.id = nextId("ariadne-listbox");
		listEl.setAttribute("role", "listbox");

		host.setAttribute("aria-expanded", "true");
		host.setAttribute("aria-controls", listEl.id);
		host.setAttribute("aria-autocomplete", "list");

		this.syncItems(popup, /* announceCount */ true);

		this.itemObserver?.disconnect();
		this.itemObserver = new MutationObserver((mutations) => {
			const itemsChanged = mutations.some((m) => m.type === "childList");
			this.syncItems(popup, itemsChanged);
		});
		this.itemObserver.observe(popup, {
			attributes: true,
			attributeFilter: ["class"],
			subtree: true,
			childList: true,
		});
	}

	private syncItems(popup: HTMLElement, announceCount: boolean): void {
		const items = popup.querySelectorAll<HTMLElement>(".suggestion-item");
		let selected: HTMLElement | null = null;

		for (const item of Array.from(items)) {
			if (!item.id) item.id = nextId("ariadne-option");
			item.setAttribute("role", "option");
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

		if (announceCount) {
			const count = items.length;
			this.announce(`${count} suggestion${count === 1 ? "" : "s"} available`);
		}
	}

	private onPopupClosed(): void {
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
