// ============================================================
// Achieved Nothing — Content Script
// ============================================================

(() => {
  // ==========================================================
  // Config
  // ==========================================================

  const ACHIEVEMENT_PROMPT = `You write fake Xbox 360 "achievement unlocked" toasts for YouTube videos.

THE JOKE: The viewer clicked a normal, harmless video — but the toast treats it like a catastrophic, life-ruining decision. The humor is DARK ABSURD CONSEQUENCE, not description.

TITLE = the consequence itself. A punishment, disaster, or irreversible life event. NOT a label, NOT a persona, NOT a fandom name.
SUBTITLE = a short accusatory line implying this video caused it. End with "!"

CONSEQUENCE DOMAINS to draw from: unemployment, homelessness, divorce, custody loss, family disownment, financial ruin, public humiliation, spiritual collapse, restraining orders, FBI watchlists, therapy referrals.

FORBIDDEN:
- Identity labels (stan, bro, fan, enjoyer, addict)
- Fandom names or personality types
- Summarizing the video topic
- Anything that sounds like a badge or playlist title
- The phrase "Achievement Unlocked"
- The word "binge" or "binging"

INTERNAL PROCESS:
1. What is banal about this video?
2. Brainstorm 5 catastrophic consequences in different life domains.
3. Pick the one with the BIGGEST gap between the video's triviality and the consequence's severity.
4. If it reads like a label or description, rewrite it.

Profanity okay (damn, hell, ass, shit). No slurs. Return ONLY valid JSON: {"title":"...","subtitle":"..."}`;

  const DEBOUNCE_MS = 2000;
  const TOAST_DURATION = 5000;

  // ==========================================================
  // State
  // ==========================================================

  let enabled = false;
  let hasKey = false;
  let inFlight = false;
  let requestId = 0; // Incrementing ID to invalidate stale responses
  let lastTitle = "";
  let lastUrl = "";
  let debounceTimer = null;
  let toastTimeout = null;

  // ==========================================================
  // UI Creation — Achievement Toast
  // ==========================================================

  const toast = document.createElement("div");
  toast.id = "an-toast";

  const toastIcon = document.createElement("img");
  toastIcon.id = "an-toast-icon";
  toastIcon.src = chrome.runtime.getURL("toast-icon.png");

  const toastText = document.createElement("div");
  toastText.id = "an-toast-text";

  const toastTitle = document.createElement("div");
  toastTitle.id = "an-toast-title";
  toastTitle.textContent = "ACHIEVEMENT UNLOCKED";

  const toastSub = document.createElement("div");
  toastSub.id = "an-toast-sub";
  toastSub.textContent = "";

  // Key input row (lives inside the toast)
  const keyRow = document.createElement("div");
  keyRow.id = "an-key-row";

  const keyInput = document.createElement("input");
  keyInput.id = "an-key-input";
  keyInput.type = "password";
  keyInput.placeholder = "Paste Grok API key…";

  const keySaveBtn = document.createElement("button");
  keySaveBtn.id = "an-key-save";
  keySaveBtn.textContent = "→";

  keyRow.appendChild(keyInput);
  keyRow.appendChild(keySaveBtn);

  const toastDismiss = document.createElement("button");
  toastDismiss.id = "an-toast-dismiss";
  toastDismiss.textContent = "✕";
  toastDismiss.addEventListener("click", () => dismissToast());

  toastText.appendChild(toastTitle);
  toastText.appendChild(toastSub);
  toastText.appendChild(keyRow);
  toast.appendChild(toastIcon);
  toast.appendChild(toastText);
  toast.appendChild(toastDismiss);

  // ==========================================================
  // UI Creation — Dev Panel
  // ==========================================================

  const devToggle = document.createElement("button");
  devToggle.id = "an-dev-toggle";
  devToggle.textContent = "DEV";
  let devVisible = true;

  devToggle.addEventListener("click", () => {
    devVisible = !devVisible;
    devPanel.style.display = devVisible ? "flex" : "none";
    devToggle.textContent = devVisible ? "DEV" : "DEV";
    devToggle.style.opacity = devVisible ? "1" : "0.5";
  });

  const devPanel = document.createElement("div");
  devPanel.id = "an-dev-panel";

  const devTitle = document.createElement("div");
  devTitle.id = "an-dev-title";
  devTitle.textContent = "ACHIEVED NOTHING — DEV";

  const devUrl = document.createElement("div");
  devUrl.className = "an-dev-row";

  const devDetected = document.createElement("div");
  devDetected.className = "an-dev-section";

  const devRequest = document.createElement("div");
  devRequest.className = "an-dev-section";

  const devOutput = document.createElement("div");
  devOutput.className = "an-dev-section";

  const devTiming = document.createElement("div");
  devTiming.className = "an-dev-section";

  const devLog = document.createElement("div");
  devLog.id = "an-dev-log";

  devPanel.appendChild(devTitle);
  devPanel.appendChild(devUrl);
  devPanel.appendChild(devDetected);
  devPanel.appendChild(devRequest);
  devPanel.appendChild(devOutput);
  devPanel.appendChild(devTiming);
  devPanel.appendChild(devLog);

  function devSetUrl(url) {
    devUrl.innerHTML = `<span class="an-dev-label">URL</span> <span class="an-dev-value">${escHtml(url)}</span>`;
  }

  function devSetDetected(text) {
    devDetected.innerHTML = `<span class="an-dev-label">DETECTED</span><pre class="an-dev-pre">${escHtml(text)}</pre>`;
  }

  function devSetRequest(systemPrompt, userContent) {
    devRequest.innerHTML = `<span class="an-dev-label">FULL REQUEST TO GROK</span><pre class="an-dev-pre"><b style="color:#4ade80">SYSTEM:</b> ${escHtml(systemPrompt)}\n\n<b style="color:#fbbf24">USER:</b> ${escHtml(userContent)}</pre>`;
  }

  function devSetOutput(text) {
    devOutput.innerHTML = `<span class="an-dev-label">OUTPUT</span><span class="an-dev-value an-dev-output">${escHtml(text)}</span>`;
  }

  function devSetTiming(label) {
    devTiming.innerHTML = `<span class="an-dev-label">STATUS</span> <span class="an-dev-value">${escHtml(label)}</span>`;
  }

  function devLogEntry(msg) {
    const ts = new Date().toLocaleTimeString();
    const line = document.createElement("div");
    line.className = "an-dev-log-line";
    line.textContent = `[${ts}] ${msg}`;
    devLog.appendChild(line);
    devLog.scrollTop = devLog.scrollHeight;
    while (devLog.children.length > 50) devLog.removeChild(devLog.firstChild);
  }

  function escHtml(s) {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ==========================================================
  // Mount Elements
  // ==========================================================

  document.documentElement.appendChild(toast);
  document.documentElement.appendChild(devToggle);
  document.documentElement.appendChild(devPanel);
  toast.style.display = "none";
  devToggle.style.display = "none";
  devPanel.style.display = "none";

  // ==========================================================
  // Toast Display
  // ==========================================================

  function showKeyToast() {
    toastTitle.textContent = "Enter your Grok API key";
    toastSub.textContent = "";
    toastSub.style.display = "none";
    keyRow.style.display = "flex";
    toast.style.pointerEvents = "auto";
    toast.style.display = "flex";
    toast.offsetHeight;
    toast.classList.remove("an-toast-hide");
    toast.classList.add("an-toast-show");
    if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    setTimeout(() => keyInput.focus(), 500);
  }

  function showToast(title, subtitle) {
    toastTitle.textContent = title || "Achievement unlocked";
    toastSub.style.display = "block";
    toastSub.textContent = subtitle;
    keyRow.style.display = "none";
    toastDismiss.style.display = "block";
    toast.style.pointerEvents = "auto";
    toast.style.display = "flex";
    toast.offsetHeight;
    toast.classList.remove("an-toast-hide");
    toast.classList.add("an-toast-show");

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  function dismissToast() {
    toast.classList.remove("an-toast-show");
    toast.classList.add("an-toast-hide");
    setTimeout(() => {
      toast.style.display = "none";
      toast.classList.remove("an-toast-hide");
    }, 500);
  }

  // ==========================================================
  // Key Save Logic
  // ==========================================================

  function saveKey() {
    const key = keyInput.value.trim();
    if (!key) return;
    chrome.storage.local.set({ an_api_key: key }, () => {
      hasKey = true;
      toastTitle.textContent = "Key saved ✓";
      keyRow.style.display = "none";
      toast.style.pointerEvents = "none";
      devLogEntry("API key saved");
      setTimeout(() => {
        dismissToast();
        if (enabled && !inFlight) {
          onContentChanged();
        }
      }, 1000);
    });
  }

  keySaveBtn.addEventListener("click", saveKey);
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveKey();
  });

  toast.addEventListener("click", (e) => e.stopPropagation());

  // ==========================================================
  // Content Extraction
  // ==========================================================

  function getPageContext() {
    const title = document.title.replace(/^\(\d+\)\s*/, "").replace(" - YouTube", "").trim();

    const channel = document.querySelector(
      "#owner #channel-name a, ytd-video-owner-renderer #channel-name a, #upload-info #channel-name a"
    )?.textContent?.trim() || "";

    // Get the first top-level comment
    const commentEl = document.querySelector(
      "ytd-comment-thread-renderer #content-text"
    );
    const topComment = commentEl?.textContent?.trim()?.slice(0, 120) || "";

    const parts = [`Video: "${title}"`];
    if (channel) parts.push(`Channel: ${channel}`);
    if (topComment) parts.push(`Top comment: "${topComment}"`);

    return parts.join("\n");
  }

  // ==========================================================
  // Achievement Generation
  // ==========================================================

  function onContentChanged() {
    if (!enabled || !hasKey) return;

    const context = getPageContext();
    if (!context || context.length < 5) return;

    // Invalidate any in-flight request
    requestId++;
    const thisRequest = requestId;
    inFlight = true;

    const startTime = performance.now();

    // Update dev panel
    devSetUrl(location.href);
    devSetDetected(context);
    devSetRequest(ACHIEVEMENT_PROMPT, context);
    devSetOutput("…");
    devSetTiming("⏳ Loading…");
    devLogEntry(`Request #${thisRequest} — sending to Grok`);

    chrome.runtime.sendMessage(
      {
        type: "an:grok",
        prompt: ACHIEVEMENT_PROMPT,
        content: context,
      },
      (res) => {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);

        // Stale response — a new request was fired while this was in flight
        if (thisRequest !== requestId) {
          devLogEntry(`Request #${thisRequest} — STALE (took ${elapsed}s), discarded`);
          return;
        }

        inFlight = false;

        if (res?.error === "no_key") {
          devSetTiming(`❌ No API key`);
          devSetOutput("—");
          devLogEntry(`Request #${thisRequest} — no API key`);
          showKeyToast();
          return;
        }

        if (res?.error) {
          devSetTiming(`❌ Error (${elapsed}s): ${res.error}`);
          devSetOutput("—");
          devLogEntry(`Request #${thisRequest} — error: ${res.error}`);
          return;
        }

        if (res?.text) {
          let title = "Achievement unlocked";
          let subtitle = res.text;

          // Try to parse JSON response
          try {
            const parsed = JSON.parse(res.text);
            if (parsed.title) title = parsed.title;
            if (parsed.subtitle) subtitle = parsed.subtitle;
          } catch {
            // Not JSON — use raw text as subtitle
          }

          devSetTiming(`✅ Done in ${elapsed}s`);
          devSetOutput(`${title} — ${subtitle}`);
          devLogEntry(`Request #${thisRequest} — "${title}: ${subtitle}" (${elapsed}s)`);
          showToast(title, subtitle);
        } else {
          devSetTiming(`⚠️ Empty response (${elapsed}s)`);
          devSetOutput(`RAW: ${res?.raw || "no data"}`);
          devLogEntry(`Request #${thisRequest} — empty response`);
        }
      }
    );
  }

  // ==========================================================
  // YouTube SPA Navigation Detection
  // ==========================================================

  function checkForContentChange() {
    const currentTitle = document.title;
    const currentUrl = location.href;

    if (currentTitle === lastTitle && currentUrl === lastUrl) return;

    lastTitle = currentTitle;
    lastUrl = currentUrl;

    devLogEntry(`Navigation detected → ${currentUrl}`);
    devSetUrl(currentUrl);
    devSetDetected("(debouncing…)");
    devSetOutput("…");
    devSetTiming("⏳ Waiting for debounce…");

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onContentChanged();
    }, DEBOUNCE_MS);
  }

  document.addEventListener("yt-navigate-finish", () => {
    if (!enabled) return;
    devLogEntry("yt-navigate-finish event");
    checkForContentChange();
  });

  const titleObserver = new MutationObserver(() => {
    if (!enabled) return;
    checkForContentChange();
  });

  window.addEventListener("popstate", () => {
    if (!enabled) return;
    devLogEntry("popstate event");
    checkForContentChange();
  });

  // ==========================================================
  // Lifecycle — Start / Stop
  // ==========================================================

  function startLoop() {
    enabled = true;
    lastTitle = "";
    lastUrl = "";
    inFlight = false;
    requestId = 0;
    devToggle.style.display = "flex";
    devPanel.style.display = "flex";
    devVisible = true;
    devToggle.style.opacity = "1";

    devSetUrl(location.href);
    devSetDetected("—");
    devSetRequest(ACHIEVEMENT_PROMPT, "(waiting for content)");
    devSetOutput("—");
    devSetTiming("Idle");
    devLog.innerHTML = "";
    devLogEntry("Extension started");

    const titleEl = document.querySelector("title");
    if (titleEl) {
      titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    chrome.storage.local.get("an_api_key", (data) => {
      if (data.an_api_key) {
        hasKey = true;
        devLogEntry("API key found");
        checkForContentChange();
      } else {
        hasKey = false;
        devLogEntry("No API key — showing key input");
        showKeyToast();
      }
    });
  }

  function stopLoop() {
    enabled = false;
    inFlight = false;
    hasKey = false;
    requestId = 0;
    lastTitle = "";
    lastUrl = "";
    toast.style.display = "none";
    toast.classList.remove("an-toast-show", "an-toast-hide");
    keyRow.style.display = "none";
    devToggle.style.display = "none";
    devPanel.style.display = "none";
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (toastTimeout) { clearTimeout(toastTimeout); toastTimeout = null; }
    titleObserver.disconnect();
  }

  // ==========================================================
  // Message Listener — Toggle from Background
  // ==========================================================

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "an:toggle") {
      if (message.enabled) startLoop();
      else stopLoop();
    }
  });
})();
