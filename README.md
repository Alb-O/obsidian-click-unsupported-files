# Double Click Non-Native Files - Obsidian Plugin

This plugin changes the behavior of clicking on non-native file formats in Obsidian's File Explorer.

## What it does

For files that are **not** natively supported by Obsidian (anything other than .md, .canvas, images, audio, video, PDF, etc.), this plugin changes the click behavior:

- **Single-click**: Selects the file (like Alt+click), but doesn't open it
- **Double-click**: Opens the file in the system's default application

This mimics the behavior of Windows File Explorer and other file managers.

## Supported Native Formats (unaffected by this plugin)

- **Markdown**: .md
- **Bases**: .base  
- **JSON Canvas**: .canvas
- **Images**: .avif, .bmp, .gif, .jpeg, .jpg, .png, .svg, .webp
- **Audio**: .flac, .m4a, .mp3, .ogg, .wav, .webm, .3gp
- **Video**: .mkv, .mov, .mp4, .ogv, .webm
- **PDF**: .pdf

## Installation

1. Copy the plugin files to your vault's `.obsidian/plugins/obsidian-double-click-non-native/` folder
2. Enable the plugin in Obsidian's settings under Community Plugins
3. That's it! The plugin works automatically with no configuration needed.

## Development

- Clone this repo
- `npm i` to install dependencies  
- `npm run dev` to start compilation in watch mode
- Make changes to `main.ts`
- Reload Obsidian to test changes

## Building

- `npm run build` to build for production
