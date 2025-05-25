import { Plugin, TFile, PluginSettingTab, App, Setting } from 'obsidian';

interface DoubleClickNonNativeSettings {
	doubleClickDelay: number;
}

const DEFAULT_SETTINGS: DoubleClickNonNativeSettings = {
	doubleClickDelay: 300
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

		// Only handle non-native file types
		if (this.NATIVE_EXTENSIONS.has(extension)) {
			return;
		}

		// Prevent the default click behavior for non-native files
		evt.preventDefault();
		evt.stopPropagation();

		// Immediately deselect all other files when we intercept any click
		this.deselectAllFiles();

		const fileKey = fileName;
		// Check if this is a double-click
		if (this.clickTimeouts.has(fileKey)) {
			clearTimeout(this.clickTimeouts.get(fileKey)!);
			this.clickTimeouts.delete(fileKey);
			this.openFileInDefaultApp(fileName);
		} else {
			this.selectFile(fileEl as HTMLElement);
			// Set timeout to detect if this becomes a double-click
			const timeout = setTimeout(() => {
				this.clickTimeouts.delete(fileKey);
				// File is already selected, nothing more to do
			}, this.settings.doubleClickDelay);
			this.clickTimeouts.set(fileKey, timeout);
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
		const titleEl = fileEl.querySelector('.nav-file-title');
		if (!titleEl) return;
		
		const fileName = titleEl.getAttribute('data-path');
		if (!fileName) return;

		if (this.fileExplorerView?.fileItems && this.fileExplorerView?.tree) {
			const fileItem = this.fileExplorerView.fileItems[fileName];
			if (fileItem) {
				this.fileExplorerView.tree.selectedDoms.add(fileItem);
				fileItem.el?.classList.add('is-selected');
				fileItem.selfEl?.classList.add('is-selected');
				return;
			}
		}
	}
	
	private async openFileInDefaultApp(fileName: string) {
		const file = this.app.vault.getAbstractFileByPath(fileName);
		if (file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf(false);
			await leaf.openFile(file);
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
	}
}
