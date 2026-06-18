const DEFAULT_SERVER_URL = "http://localhost:4444/capture";
const SERVER_URL_KEY = "serverUrl";

const serverUrlInput = document.getElementById("serverUrl");
const saveButton = document.getElementById("saveButton");
const statusElement = document.getElementById("status");

function setStatus(message) {
  statusElement.textContent = message;
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

async function loadOptions() {
  const stored = await getStorage([SERVER_URL_KEY]);
  serverUrlInput.value = stored[SERVER_URL_KEY] || DEFAULT_SERVER_URL;
}

async function saveOptions() {
  const value = serverUrlInput.value.trim() || DEFAULT_SERVER_URL;
  await setStorage({ [SERVER_URL_KEY]: value });
  setStatus("Saved.");
}

saveButton.addEventListener("click", () => {
  saveOptions().catch(() => setStatus("Could not save options."));
});

loadOptions().catch(() => setStatus("Could not load options."));
