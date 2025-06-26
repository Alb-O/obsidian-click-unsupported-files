# Click Unsupported Files

A simple Obsidian plugin that changes the behavior of clicking file formats that don't natively open in Obsidian's File Explorer.

-   **Single-click**: Sets the active view to the file, but in a 'dummy' view that simply shows some file info and provides a button to open in default app. This behavior can be turned off in settings in favor of focusing the item in file explorer but not opening a new view.
-   **Double-click**: Opens the file in the default application.

The purpose of this plugin is to prevent accidental launches of programs, and allow other plugins that act on the actively viewd file to work for unsuported files.

## Limitations

Only works with simple clicks in the File Explorer. Other methods of opening e.g. open in new tab, split right, etc. will revert to the default open in app behavior.
