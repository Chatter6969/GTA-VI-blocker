# GTA VI Warning

A tiny browser extension for Chrome and Firefox that protects you from GTA VI content.

When a page mentions GTA VI, the extension hides only the matching section (a Facebook post, a Google result, a comment, an article...) and leaves a small note in its place:

> GTA VI content · Open anyway

Click **Open anyway** and that section comes back. The rest of the page is untouched.

## What triggers it

The extension checks the page text for any of these (case-insensitive):

- `GTA VI`, `GTA 6`, `GTA6`
- `Grand Theft Auto VI`, `Grand Theft Auto 6`

- `Jason`, `Lucia`, `Vice City`, `Leonida` (characters and places from the game, so expect some false positives)

`GTA V` alone does not trigger it. Pages that load content dynamically are re-checked as new content appears.

## Installation

Download or clone this repository first:

```bash
git clone https://github.com/Chatter6969/GTA-VI-blocker.git
```

### Chrome (and Edge, Brave, other Chromium browsers)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right corner).
3. Click **Load unpacked** and select the folder with `manifest.json`.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Select the `manifest.json` file.

A temporary add-on in Firefox is removed when the browser restarts. To keep it permanently, the extension has to be packaged and signed through [addons.mozilla.org](https://addons.mozilla.org).

## Updating

After changing the files or pulling a new version, click the reload icon on the extension card in `chrome://extensions` (or **Reload** in `about:debugging` in Firefox), then refresh the page.

## Turning it off

Disable or remove the extension on the browser's extensions page, then refresh the page.

## Files

- `manifest.json` – extension manifest (Manifest V3)
- `content.js` – content script that detects GTA VI mentions and shows the warning

## Privacy

Everything runs locally in your browser. The extension does not collect or send any data.
