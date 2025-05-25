import { Plugin, TFile, PluginSettingTab, App, Setting } from 'obsidian';

interface DoubleClickNonNativeSettings {
	doubleClickDelay: number;
	enableForAllFiles: boolean;
}

// Extend the App interface to include the undocumented method
interface ExtendedApp extends App {
	openWithDefaultApp(filePath: string): void;
}

const DEFAULT_SETTINGS: DoubleClickNonNativeSettings = {
	doubleClickDelay: 300,
	enableForAllFiles: false
};

export default class DoubleClickNonNativePlugin extends Plugin {
	settings: DoubleClickNonNativeSettings;
	private clickTimeouts: Map<string, NodeJS.Timeout> = new Map();
	private fileExplorerView: any = null;

	// Obsidian native file extensions
	private readonly NATIVE_EXTENSIONS = new Set([
		'md',
		'base',
		'canvas',
		'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp',
		'flac', 'm4a', 'mp3', 'ogg', 'wav', '3gp',
		'mkv', 'mov', 'mp4', 'ogv', 'webm',
		'pdf'
	]);

	async onload() {
		await this.loadSettings();

		// Get reference to file explorer view
		this.app.workspace.onLayoutReady(() => {
			this.fileExplorerView = this.app.workspace.getLeavesOfType('file-explorer')[0]?.view;
		});

		// Register click event listener on the file explorer with capture phase
		this.registerDomEvent(document, 'click', this.handleFileClick.bind(this), true);
		// Register mousedown listener to clear focus styling early
		this.registerDomEvent(document, 'mousedown', this.handleFileMouseDown.bind(this), true);

		// Add settings tab
		this.addSettingTab(new DoubleClickNonNativeSettingTab(this.app, this));
	}

	onunload() {
		// Clear any pending timeouts
		this.clickTimeouts.forEach(timeout => clearTimeout(timeout));
		this.clickTimeouts.clear();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private handleFileClick(evt: MouseEvent) {
		const target = evt.target as HTMLElement;
		// Check if alt or shift modifier keys are pressed
		if (evt.altKey || evt.shiftKey) return;

		// Check if click is on a file in the explorer
		const fileEl = target.closest('.nav-file');
		if (!fileEl) return;

		const titleEl = fileEl.querySelector('.nav-file-title');
		if (!titleEl) return;
		
		const fileName = titleEl.getAttribute('data-path');
		if (!fileName) return;

		const extension = this.getFileExtension(fileName);
		const isNativeFile = this.NATIVE_EXTENSIONS.has(extension);

		// Scenario 1: Native file, plugin NOT overriding single click (enableForAllFiles is false)
		if (isNativeFile && !this.settings.enableForAllFiles) {
			// We want to ensure our plugin's selections are cleared,
			// and then let Obsidian handle the click entirely.
			this.clearSelections(true); // Clear our selections AND reset activeDom knowledge.
			this.setActiveFile(fileName); // Explicitly tell the tree this is the new active item.
			return; // Let Obsidian's default handlers run.
		}

		// If we reach here, the plugin IS involved:
		// - It's a non-native file (plugin handles single and double click).
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

			if (isNativeFile && this.settings.enableForAllFiles) {
				// Native file, enableForAllFiles=true: we are overriding double click.
				evt.preventDefault();
				evt.stopPropagation();
			} else if (!isNativeFile) {
				// Non-native file: we are overriding double click.
				// The first click (if it happened) should have already done this for non-native.
				evt.preventDefault();
				evt.stopPropagation();
			}
			this.openFileInDefaultApp(fileName);

		} else {
			// SINGLE-CLICK LOGIC
			if (isNativeFile && this.settings.enableForAllFiles) {
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
				// Non-native file.
				evt.preventDefault();
				evt.stopPropagation();
				this.selectFile(fileEl as HTMLElement); // This method selects the file AND sets it as active.
				
				const timeout = setTimeout(() => {
					this.clickTimeouts.delete(fileKey);
					// If timeout expires, it was a single click. File is already selected and active.
				}, this.settings.doubleClickDelay);
				this.clickTimeouts.set(fileKey, timeout);
			}
		}
	}

	// Handle mousedown to remove lingering has-focus classes immediately
	private handleFileMouseDown(evt: MouseEvent) {
		const fileEl = (evt.target as HTMLElement).closest('.nav-file');
		if (!fileEl) return;
		const explorer = document.querySelector('.nav-files-container');
		if (explorer) {
			explorer.querySelectorAll('.nav-file-title.has-focus').forEach(el => el.classList.remove('has-focus'));
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
			if (dom.el) dom.el.classList.remove('is-selected');
			if (dom.selfEl) {
				dom.selfEl.classList.remove('is-selected');
				if (clearActiveDom) dom.selfEl.classList.remove('has-focus');
			}
		});
		tree.selectedDoms.clear();

		if (clearActiveDom) {
			const explorer = document.querySelector('.nav-files-container');
			if (explorer) {
				const focusedTitles = explorer.querySelectorAll('.tree-item-self.nav-file-title.has-focus, .nav-file-title.has-focus');
				focusedTitles.forEach(el => el.classList.remove('has-focus'));
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

	private getFileExtension(fileName: string): string {
		const lastDot = fileName.lastIndexOf('.');
		if (lastDot === -1) return '';
		return fileName.substring(lastDot + 1).toLowerCase();
	}

	private setActiveFile(fileName: string) {
		if (this.fileExplorerView?.fileItems && this.fileExplorerView?.tree) {
			const tree = this.fileExplorerView.tree;
			const fileItem = this.fileExplorerView.fileItems[fileName];
			if (fileItem) {
				// Set as active item so shift-click selections work properly
				tree.activeDom = fileItem;
				tree.focusedItem = fileItem;
			}
		}
	}

	private selectFile(fileEl: HTMLElement) {
		// Remove 'has-focus' from any file title that has it
		const explorer = document.querySelector('.nav-files-container');
		if (explorer) {
			const focusedTitles = explorer.querySelectorAll('.tree-item-self.nav-file-title.has-focus');
			focusedTitles.forEach(el => el.classList.remove('has-focus'));
		}

		const titleEl = fileEl.querySelector('.nav-file-title');
		if (!titleEl) return;
		
		const fileName = titleEl.getAttribute('data-path');
		if (!fileName) return;

		if (this.fileExplorerView?.fileItems && this.fileExplorerView?.tree) {
			const tree = this.fileExplorerView.tree;
			const fileItem = this.fileExplorerView.fileItems[fileName];
			if (fileItem) {
				// Set as active item
				tree.activeDom = fileItem;
				tree.focusedItem = fileItem;
			}
		}

		// DOM visual selection for non-native files
		titleEl.classList.add('has-focus');
	}

	private async openFileInDefaultApp(fileName: string) {
		const file = this.app.vault.getAbstractFileByPath(fileName);
		if (file instanceof TFile) {
			const extension = this.getFileExtension(fileName);

			// Check if we should open externally or in Obsidian
			const shouldOpenExternally = this.settings.enableForAllFiles || !this.NATIVE_EXTENSIONS.has(extension);

			if (shouldOpenExternally) {
				// Open file in default external application
				try {
					// Use Obsidian's internal method to open with default app
					(this.app as ExtendedApp).openWithDefaultApp(file.path);
				} catch (error) {
					console.error('Failed to open file in default app:', error);
					// Fallback to opening in Obsidian if possible
					if (this.NATIVE_EXTENSIONS.has(extension)) {
						const leaf = this.app.workspace.getLeaf(false);
						await leaf.openFile(file);
					}
				}
			} else {
				// Open native files in Obsidian (when enableForAllFiles is false)
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(file);
			}
		}
	}
}

class DoubleClickNonNativeSettingTab extends PluginSettingTab {
	plugin: DoubleClickNonNativePlugin;

	constructor(app: App, plugin: DoubleClickNonNativePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}
	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Double-click timeout')
			.setDesc('Time in milliseconds to wait for a second click to register as a double-click.')
			.addText(text => text
				.setPlaceholder('300')
				.setValue(this.plugin.settings.doubleClickDelay.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.doubleClickDelay = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Enable double-click for all files')
			.setDesc('When enabled, double-clicking any file (including native Obsidian files like .md) will open it in the default application.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableForAllFiles)
				.onChange(async (value) => {
					this.plugin.settings.enableForAllFiles = value;
					await this.plugin.saveSettings();
				}));
	}
}
