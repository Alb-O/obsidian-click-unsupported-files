import { Plugin, TFile, WorkspaceLeaf } from "obsidian";
import {
	DoubleClickNonNativeSettings,
	DEFAULT_SETTINGS,
	VIEW_TYPE_DUMMY,
} from "./settings";
import { ExtendedApp } from "./types";
import { DummyFileView } from "./dummy-file-view";
import { DoubleClickNonNativeSettingTab } from "./settings-tab";

export default class DoubleClickNonNativePlugin extends Plugin {
	settings: DoubleClickNonNativeSettings;
	private clickTimeouts: Map<string, NodeJS.Timeout> = new Map();
	private fileExplorerView: any = null;

	async onload() {
		await this.loadSettings();

		// Register dummy view for non-native files
		this.registerView(VIEW_TYPE_DUMMY, (leaf) => new DummyFileView(leaf));

		// Get reference to file explorer view
		this.app.workspace.onLayoutReady(() => {
			this.fileExplorerView =
				this.app.workspace.getLeavesOfType("file-explorer")[0]?.view;
		});

		// Register click event listener on the file explorer with capture phase
		this.registerDomEvent(
			document,
			"click",
			this.handleFileClick.bind(this),
			true
		);
		// Register mousedown listener to clear focus styling early
		this.registerDomEvent(
			document,
			"mousedown",
			this.handleFileMouseDown.bind(this),
			true
		);

		// Add settings tab
		this.addSettingTab(new DoubleClickNonNativeSettingTab(this.app, this));
	}

	onunload() {
		// Clear any pending timeouts
		this.clickTimeouts.forEach((timeout) => clearTimeout(timeout));
		this.clickTimeouts.clear();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private handleFileClick(evt: MouseEvent) {
		const target = evt.target as HTMLElement;
		// Check if alt or shift modifier keys are pressed
		if (evt.altKey || evt.shiftKey) return;

		// Check if click is on a file in the explorer
		const fileEl = target.closest(".nav-file");
		if (!fileEl) return;

		const titleEl = fileEl.querySelector(".nav-file-title");
		if (!titleEl) return;

		const fileName = titleEl.getAttribute("data-path");
		if (!fileName) return;

		// Use Obsidian's built-in class to check if file is non-native (unsupported)
		const isUnsupported = titleEl.classList.contains("is-unsupported");

		// Scenario 1: Native file (supported by Obsidian), plugin NOT overriding single click (enableForAllFiles is false)
		if (!isUnsupported && !this.settings.enableForAllFiles) {
			// We want to ensure our plugin's selections are cleared,
			// and then let Obsidian handle the click entirely.
			this.clearSelections(true); // Clear our selections AND reset activeDom knowledge.
			this.setActiveFile(fileName); // Explicitly tell the tree this is the new active item.
			return; // Let Obsidian's default handlers run.
		}

		// If we reach here, the plugin IS involved:
		// - It's a non-native file (unsupported, plugin handles single and double click).
		// - OR It's a native file but enableForAllFiles is true (plugin handles double-click, Obsidian handles single).

		// First, clear any visual selection classes from items previously selected by the plugin.
		// This call preserves activeDom, which is important for the (isNativeFile && enableForAllFiles)
		// single-click case, before we explicitly set it later.
		this.deselectAllFiles(); // Calls clearSelections(false)

		const fileKey = fileName;

		if (this.clickTimeouts.has(fileKey)) {
			// DOUBLE-CLICK LOGIC
			clearTimeout(this.clickTimeouts.get(fileKey)!);
			this.clickTimeouts.delete(fileKey);
			// If enableForAllFiles is true, override double-click for all files
			// Otherwise, only override for unsupported files
			if (this.settings.enableForAllFiles || isUnsupported) {
				evt.preventDefault();
				evt.stopPropagation();
				this.openFileInDefaultApp(fileName);
			}
		} else {
			// SINGLE-CLICK LOGIC
			if (!isUnsupported && this.settings.enableForAllFiles) {
				// Native file, enableForAllFiles=true.
				// Obsidian handles the actual single click (selection, opening if folder, etc.).
				// We do not preventDefault or stopPropagation here.
				// We set up a timeout to detect a potential double-click.
				this.setActiveFile(fileName); // Make sure this file is the active one for subsequent shift-clicks.
				const timeout = setTimeout(() => {
					this.clickTimeouts.delete(fileKey);
					// If timeout expires, it was a single click. Obsidian has handled it.
				}, this.settings.doubleClickDelay);
				this.clickTimeouts.set(fileKey, timeout);
			} else {
				// Non-native file (unsupported).
				evt.preventDefault();
				evt.stopPropagation();

				// If dummy view is enabled, open the file in a dummy view instead of just selecting
				if (this.settings.enableDummyView) {
					this.openFileInDummyView(fileName);
				} else {
					this.selectFile(fileEl as HTMLElement); // This method selects the file AND sets it as active.
				}

				const timeout = setTimeout(() => {
					this.clickTimeouts.delete(fileKey);
					// If timeout expires, it was a single click. File is already handled above.
				}, this.settings.doubleClickDelay);
				this.clickTimeouts.set(fileKey, timeout);
			}
		}
	}

	// Handle mousedown to remove lingering has-focus classes immediately
	private handleFileMouseDown(evt: MouseEvent) {
		const fileEl = (evt.target as HTMLElement).closest(".nav-file");
		if (!fileEl) return;
		const explorer = document.querySelector(".nav-files-container");
		if (explorer) {
			explorer
				.querySelectorAll(".nav-file-title.has-focus")
				.forEach((el) => el.classList.remove("has-focus"));
		}
	}

	private clearSelections(clearActiveDom: boolean = true) {
		// If Obsidian's native tree is not ready, skip manual styling
		if (!this.fileExplorerView?.tree) {
			return;
		}

		// Use Obsidian's native selection system
		const tree = this.fileExplorerView.tree;
		const preservedActiveDom = clearActiveDom ? null : tree.activeDom;
		const preservedFocusedItem = clearActiveDom ? null : tree.focusedItem;

		tree.selectedDoms.forEach((dom: any) => {
			if (dom.el) dom.el.classList.remove("is-selected");
			if (dom.selfEl) {
				dom.selfEl.classList.remove("is-selected");
				if (clearActiveDom) dom.selfEl.classList.remove("has-focus");
			}
		});
		tree.selectedDoms.clear();

		if (clearActiveDom) {
			const explorer = document.querySelector(".nav-files-container");
			if (explorer) {
				const focusedTitles = explorer.querySelectorAll(
					".tree-item-self.nav-file-title.has-focus, .nav-file-title.has-focus"
				);
				focusedTitles.forEach((el) => el.classList.remove("has-focus"));
			}
		}

		if (!clearActiveDom && preservedActiveDom) {
			tree.activeDom = preservedActiveDom;
			tree.focusedItem = preservedFocusedItem;
		} else if (clearActiveDom) {
			if (tree.activeDom) tree.activeDom = null;
			if (tree.focusedItem) tree.focusedItem = null;
		}
	}

	private deselectAllFiles() {
		this.clearSelections(false); // By default, preserve activeDom
	}

	private setActiveFile(fileName: string) {
		if (this.fileExplorerView?.fileItems && this.fileExplorerView?.tree) {
			const tree = this.fileExplorerView.tree;
			const fileItem = this.fileExplorerView.fileItems[fileName];
			if (fileItem) {
				// Set as active item so shift-click selections work properly
				tree.activeDom = fileItem;
				tree.focusedItem = fileItem;
			} else {
				// fileItem not found
			}
		} else {
			// fileExplorerView.fileItems or tree missing
		}
	}

	private selectFile(fileEl: HTMLElement) {
		const titleEl = fileEl.querySelector(".nav-file-title");
		if (!titleEl) return;
		const fileName = titleEl.getAttribute("data-path");
		if (!fileName) return;
		if (this.fileExplorerView?.fileItems && this.fileExplorerView?.tree) {
			const tree = this.fileExplorerView.tree;
			const fileItem = this.fileExplorerView.fileItems[fileName];
			if (fileItem) {
				tree.activeDom = fileItem;
				tree.focusedItem = fileItem;
			}
		}
		// DOM visual selection for non-native files
		titleEl.classList.add("has-focus");
	}
	private async openFileInDummyView(fileName: string) {
		const file = this.app.vault.getAbstractFileByPath(fileName);
		if (file instanceof TFile) {
			try {
				// Check if the file is already open in a dummy view
				const leaves =
					this.app.workspace.getLeavesOfType(VIEW_TYPE_DUMMY);
				let existingLeaf: WorkspaceLeaf | undefined;
				for (const leaf of leaves) {
					await this.app.workspace.revealLeaf(leaf);
					if (
						leaf.view instanceof DummyFileView &&
						leaf.view.file?.path === fileName
					) {
						existingLeaf = leaf;
						break;
					}
				}

				let leaf;
				if (existingLeaf) {
					// File is already open, reuse that leaf and activate it
					leaf = existingLeaf;
					this.app.workspace.setActiveLeaf(leaf);
				} else {
					// Get or create a leaf for the dummy view
					leaf = this.app.workspace.getLeaf(false);
					// Open the file using our custom dummy view
					await leaf.setViewState({
						type: VIEW_TYPE_DUMMY,
						state: { file: fileName },
					});
				}

				// After opening in dummy view, make sure the file has focus in the explorer
				const fileEl = document
					.querySelector(`[data-path="${fileName}"]`)
					?.closest(".nav-file") as HTMLElement;
				if (fileEl) {
					this.selectFile(fileEl);
				}
			} catch (error) {
				console.error("Failed to open file in dummy view:", error);
				// Fallback to just selecting the file
				const fileEl = document
					.querySelector(`[data-path="${fileName}"]`)
					?.closest(".nav-file") as HTMLElement;
				if (fileEl) {
					this.selectFile(fileEl);
				}
			}
		}
	}

	private async openFileInDefaultApp(fileName: string) {
		const file = this.app.vault.getAbstractFileByPath(fileName);
		if (file instanceof TFile) {
			try {
				// Use Obsidian's internal method to open with default app
				(this.app as ExtendedApp).openWithDefaultApp(file.path);
			} catch (error) {
				console.error("Failed to open file in default app:", error);
				// Fallback to opening in Obsidian
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(file);
			}
		}
	}
}
