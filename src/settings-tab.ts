import { App, PluginSettingTab, Setting } from 'obsidian';

export class DoubleClickNonNativeSettingTab extends PluginSettingTab {
	plugin: any; // Using any to avoid circular import issue

	constructor(app: App, plugin: any) {
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

		new Setting(containerEl)
			.setName('Enable dummy view for non-native files')
			.setDesc('When enabled, single-clicking non-native files will open them in a dummy view within Obsidian instead of just selecting them. This makes the file appear "active" in the workspace while still providing access to open in default app.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableDummyView)
				.onChange(async (value) => {
					this.plugin.settings.enableDummyView = value;
					await this.plugin.saveSettings();
				}));
	}
}
