// ============================================================
// Achieved Nothing — Background Service Worker
// ============================================================

const enabledTabs = new Map();

chrome.tabs.onRemoved.addListener((tabId) => {
  enabledTabs.delete(tabId);
});

// --- Extension Icon Toggle ---
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;

  const nextEnabled = !(enabledTabs.get(tab.id) ?? false);
  enabledTabs.set(tab.id, nextEnabled);

  chrome.action.setBadgeText({ tabId: tab.id, text: nextEnabled ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#000000" });

  chrome.tabs.sendMessage(tab.id, { type: "an:toggle", enabled: nextEnabled }, () => {
    void chrome.runtime.lastError;
  });
});

// --- Grok API Handler ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== "an:grok") return;

  chrome.storage.local.get("an_api_key", async (data) => {
    const apiKey = data.an_api_key;
    if (!apiKey) {
      sendResponse({ error: "no_key" });
      return;
    }

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4-fast-non-reasoning",
          messages: [
            {
              role: "system",
              content: msg.prompt,
            },
            {
              role: "user",
              content: msg.content,
            },
          ],
          max_tokens: 30,
          temperature: 1,
        }),
      });

      const json = await res.json();
      if (json.error) {
        sendResponse({ error: json.error.message || JSON.stringify(json.error) });
        return;
      }
      const text = json.choices?.[0]?.message?.content?.trim();
      sendResponse({ text: text || "", raw: JSON.stringify(json).slice(0, 300) });
    } catch (e) {
      sendResponse({ error: e.message });
    }
  });

  return true;
});
