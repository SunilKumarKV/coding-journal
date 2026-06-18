(function () {
  const STATE = {
    lastCaptureKey: null,
    observer: null,
    timer: null
  };

  function debug(message, details) {
    if (details !== undefined) {
      console.debug(`[Capture] ${message}`, details);
    } else {
      console.debug(`[Capture] ${message}`);
    }
  }

  function text(selector, root = document) {
    const node = root.querySelector(selector);
    return node ? node.textContent.trim() : "";
  }

  function firstNonEmpty(values) {
    return values.find((value) => typeof value === "string" && value.trim()) || "";
  }

  function showToast(message, variant) {
    const existing = document.querySelector(".cj-capture-toast");
    if (existing) {
      existing.remove();
    }

    const toast = document.createElement("div");
    toast.className = `cj-capture-toast is-${variant}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => toast.remove(), 250);
    }, 2400);
  }

  function extractSlug() {
    const match = window.location.pathname.match(/\/problems\/([^/]+)/i);
    return match ? match[1] : "";
  }

  function extractTitle() {
    debug("Extracting title");
    return firstNonEmpty([
      text("div.text-title-large a"),
      text("[data-cy='question-title']"),
      text("h1"),
      document.title.replace(/\s*-\s*LeetCode$/, "").trim()
    ]);
  }

  function extractDifficulty() {
    const candidates = Array.from(document.querySelectorAll("div, span, p"));
    const match = candidates.find((node) => /^(Easy|Medium|Hard)$/i.test(node.textContent.trim()));
    return match ? match.textContent.trim() : "";
  }

  function extractTags() {
    const tags = new Set();

    document.querySelectorAll("a[href*='/tag/'], a[href*='/topics/'], a[href*='/problem-list/']").forEach((node) => {
      const value = node.textContent.trim();
      if (value) {
        tags.add(value);
      }
    });

    return Array.from(tags);
  }

  function extractLanguage() {
    debug("Extracting language");
    const selectors = [
      "[data-cy='lang-select']",
      "[data-mode-id]",
      "[class*='lang-select']",
      "button[aria-haspopup='listbox']",
      "[id*='lang']"
    ];

    for (const selector of selectors) {
      const value = text(selector);
      if (value && value.length < 40) {
        return value;
      }
    }

    const pageText = document.body.innerText;
    const match = pageText.match(/\b(JavaScript|TypeScript|Python|Python3|Java|C\+\+|C)\b/);
    return match ? match[1] : "";
  }

  function extractCodeFromTextarea() {
    const textarea = document.querySelector("textarea");
    if (textarea?.value?.trim()) {
      return textarea.value;
    }

    return "";
  }

  function extractCodeFromMonaco() {
    const lines = Array.from(document.querySelectorAll(".view-lines .view-line"))
      .map((node) => node.textContent.replace(/\u00a0/g, " "))
      .join("\n")
      .trim();

    return lines;
  }

  function extractCodeFromCodeMirror() {
    const lines = Array.from(document.querySelectorAll(".cm-content .cm-line"))
      .map((node) => node.textContent.replace(/\u00a0/g, " "))
      .join("\n")
      .trim();

    return lines;
  }

  function extractCodeFromPreCode() {
    const preCode = Array.from(document.querySelectorAll("pre code, pre, code"))
      .map((node) => node.textContent.trim())
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    return preCode[0] || "";
  }

  function extractCode() {
    debug("Extracting code");

    const strategies = [
      { name: "textarea", value: extractCodeFromTextarea() },
      { name: "monaco", value: extractCodeFromMonaco() },
      { name: "codemirror", value: extractCodeFromCodeMirror() },
      { name: "pre/code", value: extractCodeFromPreCode() }
    ];

    for (const strategy of strategies) {
      if (strategy.value) {
        debug(`Code extracted using ${strategy.name}`);
        return strategy.value;
      }
    }

    debug("Code extraction failed", {
      availableTextareas: document.querySelectorAll("textarea").length,
      availablePreBlocks: document.querySelectorAll("pre, code").length,
      availableMonacoLines: document.querySelectorAll(".view-lines .view-line").length,
      availableCodeMirrorLines: document.querySelectorAll(".cm-content .cm-line").length,
      path: window.location.pathname
    });

    return "";
  }

  function isAcceptedState() {
    const pageText = document.body.innerText;
    return /\bAccepted\b/.test(pageText);
  }

  function extractAcceptedAt() {
    const timeElement = document.querySelector("time");
    if (timeElement?.dateTime) {
      return new Date(timeElement.dateTime).toISOString();
    }

    return new Date().toISOString();
  }

  function collectPayload() {
    if (!isAcceptedState()) {
      return {
        status: "not-accepted"
      };
    }

    debug("Accepted detected");

    const slug = extractSlug();
    const title = extractTitle();
    const difficulty = extractDifficulty();
    const tags = extractTags();
    const language = extractLanguage();
    const code = extractCode();
    const acceptedAt = extractAcceptedAt();

    const missing = [];
    if (!slug) missing.push("slug");
    if (!title) missing.push("title");
    if (!difficulty) missing.push("difficulty");
    if (!language) missing.push("language");
    if (!code) missing.push("code");

    if (missing.length > 0) {
      return {
        status: code ? "incomplete" : "code-missing",
        diagnostics: {
          slug,
          title,
          difficulty,
          language,
          tags,
          acceptedAt,
          missing,
          url: window.location.href
        }
      };
    }

    return {
      status: "ready",
      payload: {
        platform: "leetcode",
        slug,
        title,
        difficulty,
        url: window.location.href,
        tags,
        language,
        code,
        acceptedAt
      }
    };
  }

  function buildCaptureKey(payload) {
    return [payload.slug, payload.language, payload.acceptedAt, payload.code.length].join("::");
  }

  function sendCapture(payload) {
    debug("Sending payload", payload);

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "capture-submission",
          payload
        },
        (response) => {
          if (chrome.runtime.lastError) {
            debug("Capture failed", chrome.runtime.lastError.message);
            resolve({
              ok: false,
              error: chrome.runtime.lastError.message
            });
            return;
          }

          if (!response?.ok) {
            debug("Capture failed", response);
            resolve({
              ok: false,
              error: response?.error || "Unknown capture response"
            });
            return;
          }

          debug("Capture success", response);
          resolve(response);
        }
      );
    });
  }

  async function maybeCapture() {
    const extraction = collectPayload();

    if (extraction.status === "not-accepted") {
      return {
        ok: false,
        skipped: true,
        reason: "not-accepted"
      };
    }

    if (extraction.status === "code-missing") {
      debug("Accepted detected but code could not be extracted.", extraction.diagnostics);
      showToast("Accepted detected but code could not be extracted.", "error");
      return {
        ok: false,
        skipped: true,
        reason: "code-missing",
        diagnostics: extraction.diagnostics
      };
    }

    if (extraction.status !== "ready") {
      debug("Capture skipped due to incomplete payload", extraction.diagnostics);
      return {
        ok: false,
        skipped: true,
        reason: "incomplete",
        diagnostics: extraction.diagnostics
      };
    }

    const payload = extraction.payload;
    console.debug(payload);

    const captureKey = buildCaptureKey(payload);
    if (STATE.lastCaptureKey === captureKey) {
      return {
        ok: true,
        duplicate: true
      };
    }

    STATE.lastCaptureKey = captureKey;
    const response = await sendCapture(payload);

    if (!response.ok) {
      showToast("Start coding-journal server: cj serve", "error");
      return response;
    }

    if (!response.duplicate) {
      showToast("Saved to coding-journal", "success");
    }

    return response;
  }

  function scheduleCapture() {
    window.clearTimeout(STATE.timer);
    STATE.timer = window.setTimeout(() => {
      maybeCapture().catch((error) => {
        debug("Capture failed", error instanceof Error ? error.message : String(error));
        showToast("Start coding-journal server: cj serve", "error");
      });
    }, 900);
  }

  function watchPage() {
    if (STATE.observer) {
      STATE.observer.disconnect();
    }

    STATE.observer = new MutationObserver(() => {
      scheduleCapture();
    });

    STATE.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    scheduleCapture();
  }

  window.__codingJournalCaptureDebug = async function __codingJournalCaptureDebug() {
    const extraction = collectPayload();

    if (extraction.status !== "ready") {
      debug("Debug capture extraction result", extraction);
      return extraction;
    }

    console.debug(extraction.payload);
    const result = await sendCapture(extraction.payload);
    debug("Debug capture result", result);
    return result;
  };

  watchPage();
})();
