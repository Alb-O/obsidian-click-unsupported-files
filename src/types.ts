import { App } from 'obsidian';

// Extend the App interface to include the undocumented method
export interface ExtendedApp extends App {
	openWithDefaultApp(filePath: string): void;
}
