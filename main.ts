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
	}	private handleFileClick(evt: MouseEvent) {
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

		// Determine if we should handle this file type
		const shouldHandle = this.settings.enableForAllFiles || !isNativeFile;
		
		if (!shouldHandle) {
			return;
		}

		const fileKey = fileName;

		// Check if this is a double-click
		if (this.clickTimeouts.has(fileKey)) {
			// This is a double-click
			clearTimeout(this.clickTimeouts.get(fileKey)!);
			this.clickTimeouts.delete(fileKey);
			
			// For native files with enableForAllFiles=true, prevent default and open externally
			if (isNativeFile && this.settings.enableForAllFiles) {
				evt.preventDefault();
				evt.stopPropagation();
			}
			
			this.openFileInDefaultApp(fileName);
		} else {
			// This is a first click
			if (isNativeFile && this.settings.enableForAllFiles) {
				// For native files with enableForAllFiles=true, allow normal Obsidian behavior on first click
				// Just set up the timeout to detect potential double-click
				const timeout = setTimeout(() => {
					this.clickTimeouts.delete(fileKey);
				}, this.settings.doubleClickDelay);
				this.clickTimeouts.set(fileKey, timeout);
			} else {
				// For non-native files, prevent default and handle selection ourselves
				evt.preventDefault();
				evt.stopPropagation();
				
				// Immediately deselect all other files when we intercept any click
				this.deselectAllFiles();
				this.selectFile(fileEl as HTMLElement);
				
				// Set timeout to detect if this becomes a double-click
				const timeout = setTimeout(() => {
					this.clickTimeouts.delete(fileKey);
					// File is already selected, nothing more to do
				}, this.settings.doubleClickDelay);
				this.clickTimeouts.set(fileKey, timeout);
			}
		}
	}

	private deselectAllFiles() {
		if (!this.fileExplorerView?.tree) {
			// Fallback to DOM manipulation
			const explorer = document.querySelector('.nav-files-container');
			if (explorer) {
				const selectedFiles = explorer.querySelectorAll('.nav-file.is-selected');
				selectedFiles.forEach(el => {
					el.classList.remove('is-selected');
					const titleEl = el.querySelector('.nav-file-title');
					if (titleEl) {
						titleEl.classList.remove('is-selected');
					}
				});
			}
			return;
		}

		// Use Obsidian's native selection system
		const tree = this.fileExplorerView.tree;
		
		// Clear all selected items from the tree's selectedDoms Set
		tree.selectedDoms.forEach((dom: any) => {
			if (dom.el) {
				dom.el.classList.remove('is-selected');
			}
			if (dom.selfEl) {
				dom.selfEl.classList.remove('is-selected');
			}
		});
		tree.selectedDoms.clear();
	}

	private getFileExtension(fileName: string): string {
		const lastDot = fileName.lastIndexOf('.');
		if (lastDot === -1) return '';
		return fileName.substring(lastDot + 1).toLowerCase();
	}

	private selectFile(fileEl: HTMLElement) {
		// Remove 'has-focus' from any file title that has it
		const explorer = document.querySelector('.nav-files-container');
		if (explorer) {
			const focusedTitles = explorer.querySelectorAll('.tree-item-self.nav-file-title.has-focus');
			focusedTitles.forEach(el => {
				el.classList.remove('has-focus');
			});
		}

		const titleEl = fileEl.querySelector('.nav-file-title');
		if (!titleEl) return;
		
		const fileName = titleEl.getAttribute('data-path');
		if (!fileName) return;

		if (this.fileExplorerView?.fileItems && this.fileExplorerView?.tree) {
			const tree = this.fileExplorerView.tree;
			const fileItem = this.fileExplorerView.fileItems[fileName];			if (fileItem) {
				// Deselect all previously selected items in the tree
				tree.selectedDoms.forEach((dom: any) => {
					dom.el?.classList.remove('is-selected');
					dom.selfEl?.classList.remove('is-selected');
					dom.selfEl?.classList.remove('has-focus');
				});
				tree.selectedDoms.clear();

				// Select and focus the new fileItem
				tree.selectedDoms.add(fileItem);
				fileItem.el?.classList.add('is-selected');
				fileItem.selfEl?.classList.add('is-selected');
				fileItem.selfEl?.classList.add('has-focus');
				
				// Set as active item
				tree.activeDom = fileItem;
				tree.focusedItem = fileItem;
			}
		}

		// Add 'has-focus' to the selected file's title element (for DOM fallback)
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
