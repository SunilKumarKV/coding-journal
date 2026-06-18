const DEFAULT_SERVER_URL = "http://localhost:4444/capture";
const DEDUPE_KEY = "captureHistory";
const SERVER_URL_KEY = "serverUrl";
const HISTORY_LIMIT = 200;

function debug(message, details) {
  if (details !== undefined) {
    console.debug(`[Capture] ${message}`, details);
  } else {
    console.debug(`[Capture] ${message}`);
  }
}

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function setStorage(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set(value, resolve);
  });
}

async function getServerUrl() {
  const stored = await getStorage([SERVER_URL_KEY]);
  return stored[SERVER_URL_KEY] || DEFAULT_SERVER_URL;
}

async function getCaptureHistory() {
  const stored = await getStorage([DEDUPE_KEY]);
  return stored[DEDUPE_KEY] || {};
}

async function rememberCapture(key) {
  const history = await getCaptureHistory();
  history[key] = Date.now();

  const entries = Object.entries(history)
    .sort((left, right) => right[1] - left[1])
    .slice(0, HISTORY_LIMIT);

  await setStorage({
    [DEDUPE_KEY]: Object.fromEntries(entries)
  });
}

function buildCaptureKey(payload) {
  return [
    payload.platform,
    payload.slug,
    payload.language,
    payload.acceptedAt,
    payload.url
  ].join("::");
}

function safeSend(sendResponse, payload) {
  try {
    sendResponse(payload);
  } catch (error) {
    debug("sendResponse failed", error instanceof Error ? error.message : String(error));
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await getStorage([SERVER_URL_KEY]);

  if (!stored[SERVER_URL_KEY]) {
    await setStorage({ [SERVER_URL_KEY]: DEFAULT_SERVER_URL });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "capture-submission") {
    return false;
  }

  let settled = false;

  const respond = (payload) => {
    if (settled) {
      return;
    }

    settled = true;
    safeSend(sendResponse, payload);
  };

  const timeout = setTimeout(() => {
    debug("Capture failed", "Background response timed out");
    respond({
      ok: false,
      error: "Background response timed out"
    });
  }, 15000);

  (async () => {
    const payload = message.payload;
    const captureKey = buildCaptureKey(payload);
    const history = await getCaptureHistory();

    if (history[captureKey]) {
      debug("Capture success", { duplicate: true, slug: payload.slug });
      respond({
        ok: true,
        duplicate: true
      });
      return;
    }

    const serverUrl = await getServerUrl();
    debug("Sending payload", { serverUrl, slug: payload.slug, language: payload.language });

    const response = await fetch(serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Capture request failed with status ${response.status}`);
    }

    const json = await response.json();
    await rememberCapture(captureKey);
    debug("Capture success", json);
    respond({
      ok: true,
      duplicate: false,
      result: json
    });
  })().catch((error) => {
    debug("Capture failed", error instanceof Error ? error.message : String(error));
    respond({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown capture error"
    });
  }).finally(() => {
    clearTimeout(timeout);
  });

  return true;
});
