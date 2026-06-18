# leetcode-capture

Chrome Manifest V3 extension for capturing real accepted LeetCode submissions and sending them to the local `coding-journal` capture server.

## Files

```text
extensions/leetcode-capture/
├── manifest.json
├── options.html
├── README.md
└── src/
    ├── content/
    │   └── leetcode.js
    ├── background.js
    ├── options.js
    └── styles.css
```

## What It Does

- runs on `https://leetcode.com/problems/*`
- detects accepted submissions
- extracts:
  - title
  - slug
  - difficulty
  - tags
  - language
  - accepted code
  - acceptedAt
  - url
- sends that payload to `http://localhost:4444/capture`
- shows a success toast:
  - `Saved to coding-journal`
- shows a failure toast:
  - `Start coding-journal server: cj serve`

## Load Unpacked Extension

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select:
   `extensions/leetcode-capture`

## Run Local Receiver

From the repository root:

```bash
node ./bin/cj.js serve
```

The server should print:

```text
Capture server listening at http://localhost:4444
```

## Configure Server URL

1. Open the extension details page in Chrome.
2. Click `Extension options`.
3. Set the server URL.

Default:

```text
http://localhost:4444/capture
```

## Manual Capture Test

1. Start the local server with `cj serve`.
2. Open a solved LeetCode problem page or a submission detail page.
3. Open an accepted submission view where the accepted code is visible.
4. Wait for the page to settle.
5. Look for the toast:
   `Saved to coding-journal`
6. Confirm the repo now contains:
   `problems/leetcode/<slug>/`

If the server is not running, the extension shows:

```text
Start coding-journal server: cj serve
```

If accepted status is visible but code extraction fails, the extension shows:

```text
Accepted detected but code could not be extracted.
```

## Debugging

Inspect the extension:

1. Open `chrome://extensions`
2. Find `coding-journal LeetCode Capture`
3. Open:
   `Service Worker` -> `Inspect`

Use the page debug helper from DevTools on a LeetCode page:

```js
window.__codingJournalCaptureDebug()
```

It will:

- extract the current page data
- log the payload
- attempt a send
- return the result

Common issues:

- server not running
- code extraction failed
- selector mismatch
- localhost unreachable

Sample logs:

```text
[Capture] Accepted detected
[Capture] Extracting title
[Capture] Extracting language
[Capture] Extracting code
[Capture] Sending payload
[Capture] Capture success
```

## Notes

- The extension is plain JavaScript with no framework.
- It uses `chrome.storage.local` for the configurable server URL and duplicate-prevention history.
- It does not generate code. It only sends code that is actually visible on the LeetCode page.
