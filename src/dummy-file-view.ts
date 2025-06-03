import { FileView, TFile, WorkspaceLeaf, Notice } from 'obsidian';
import { VIEW_TYPE_DUMMY } from './settings';

export class DummyFileView extends FileView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_DUMMY;
	}

	getDisplayText(): string {
		return this.file ? this.file.basename : "Non-native file";
	}

	getIcon(): string {
		return "file";
	}

	async onLoadFile(file: TFile): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		// Create a simple dummy interface
		const container = contentEl.createDiv({ cls: "dummy-file-container" });
		
		const header = container.createEl("div", { 
			text: file.name,
			cls: "inline-title"
		});
        
        const info = container.createDiv({ cls: "dummy-file-info" });
		info.createEl("p", { text: `File type: ${file.extension.toUpperCase()} file` });
		info.createEl("p", { text: `Size: ${this.formatFileSize(file.stat.size)}` });
		info.createEl("p", { text: `Created: ${new Date(file.stat.ctime).toLocaleString()}` });
		info.createEl("p", { text: `Modified: ${new Date(file.stat.mtime).toLocaleString()}` });const message = container.createDiv({ 
			cls: "callout",
			attr: {
				"data-callout": "warning",
				"data-callout-metadata": "",
				"data-callout-fold": ""
			}
		});
		
		const calloutTitle = message.createDiv({ cls: "callout-title" });
		calloutTitle.setAttribute("dir", "auto");
		
		const calloutIcon = calloutTitle.createDiv({ cls: "callout-icon" });
		calloutIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`;
		
		const calloutTitleInner = calloutTitle.createDiv({ 
			cls: "callout-title-inner",
			text: "Unsupported file"
		});
		
		const calloutContent = message.createDiv({ cls: "callout-content" });
		const contentPara = calloutContent.createEl("p");
		contentPara.setAttribute("dir", "auto");
		contentPara.textContent = "This file type cannot be viewed in Obsidian.";
		
		const actions = container.createDiv({ cls: "dummy-file-actions" });
		const openButton = actions.createEl("button", { 
			text: "Open in default app",
			cls: "mod-cta"
		});
		
		openButton.addEventListener("click", () => {
			try {
				(this.app as any).openWithDefaultApp(file.path);
			} catch (error) {
				console.error('Failed to open file in default app:', error);
			}
		});

		// Check if sidecars plugin is enabled and add sidecar button
		if (this.isSidecarsPluginEnabled()) {
			const sidecarButton = actions.createEl("button", { 
				text: "Open sidecar",
				cls: "mod-secondary"
			});
			
			sidecarButton.addEventListener("click", async () => {
				await this.openSidecar(file);
			});
		}
	}
	private isSidecarsPluginEnabled(): boolean {
		// Check if the sidecars plugin is enabled
		// @ts-ignore - accessing internal API
		return this.app.plugins?.enabledPlugins?.has('sidecars') || false;
	}

	private getSidecarSuffix(): string {
		// Get the sidecar suffix from the sidecars plugin settings
		// @ts-ignore - accessing internal API
		const sidecarsPlugin = this.app.plugins?.plugins?.['sidecars'];
		if (sidecarsPlugin?.settings?.sidecarSuffix) {
			return sidecarsPlugin.settings.sidecarSuffix;
		}
		// Default fallback to 'side' if plugin not found or setting not available
		return 'side';
	}
	private async openSidecar(file: TFile): Promise<void> {
		// Create sidecar filename using the configured suffix
		const sidecarSuffix = this.getSidecarSuffix();
		const sidecarPath = `${file.path}.${sidecarSuffix}.md`;
		
		try {
			// Check if sidecar file exists
			const sidecarFile = this.app.vault.getAbstractFileByPath(sidecarPath);
			
			if (!sidecarFile) {
				// Display notice if sidecar doesn't exist
				new Notice(`Couldn't find ${file.basename}.${sidecarSuffix}.md`);
				return;
			}
			
			if (sidecarFile instanceof TFile) {
				// Open the sidecar file in a new leaf
				const leaf = this.app.workspace.getLeaf(false);
				await leaf.openFile(sidecarFile);
			}
		} catch (error) {
			console.error('Failed to open sidecar file:', error);
			new Notice(`Failed to open sidecar file: ${file.basename}.${sidecarSuffix}.md`);
		}
	}

	private formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	async onClose(): Promise<void> {
		// Clean up if needed
	}
}
