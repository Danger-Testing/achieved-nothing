// ============================================================
// Achieved Nothing — Twitter/X Content Script (Pokédex Style)
// ============================================================

(() => {
  // ==========================================================
  // Config
  // ==========================================================

  const HABITAT_PROMPT = `You generate Pokémon-style habitat descriptions that roast the VIEWER for reading this tweet/post on Twitter. You output TWO lines:

Line 1: A habitat name (like a Pokémon location). This should be a funny, roast-y place name that mocks the viewer for being here. Examples: "Doom Scroll Cave", "No Bitches Bay", "Incel Plateau", "Ratio Valley", "Copium Mines", "L Factory", "Simp Shores", "Brain Rot Basin", "Parasocial Peaks", "Gooner Grotto", "Delulu Desert"

Line 2: A short subtitle roasting the viewer. Format: "[Viewer's Pokémon name]'s natural habitat" or similar. The Pokémon name should be a fake one that roasts the viewer. Examples: "Scrollchu's den", "Doomander's lair", "Nolyfeon's burrow", "Simpsaur's nest", "Copiuma's hollow", "Brainrotter's cave"

RULES:
- EXACTLY two lines. Line 1 = habitat name. Line 2 = subtitle.
- Roast the VIEWER for choosing to read this content — don't describe the tweet.
- Use the tweet text, author, and engagement to make the roast SPECIFIC. If they're reading dating discourse, roast their loneliness. If reading tech Twitter, roast them for being terminally online.
- Internet slang encouraged. Be mean and funny.
- Profanity allowed (fuck, shit, ass, damn, hell). No racial or homophobic slurs.
- Keep each line under 25 characters.

Return ONLY the two lines. No quotes, no preamble.`;

  const DEBOUNCE_MS = 2500;
  const ZONE_PADDING = 4;

  // ==========================================================
  // State
  // ==========================================================

  let enabled = false;
  let hasKey = false;
  let inFlight = false;
  let requestId = 0;
  let lastTweetText = "";
  let lastUrl = "";
  let debounceTimer = null;
  let cardShown = false;
  let currentArticle = null;
  let scrollRaf = null;

  // ==========================================================
  // UI Creation — Pokédex Device Card
  // ==========================================================

  const card = document.createElement("div");
  card.id = "pd-card";

  const cardInner = document.createElement("div");
  cardInner.id = "pd-card-inner";

  // Top bar
  const topbar = document.createElement("div");
  topbar.id = "pd-topbar";

  const ledMain = document.createElement("div");
  ledMain.id = "pd-led-main";

  const ledRed = document.createElement("div");
  ledRed.className = "pd-led-sm pd-led-red";

  const ledYellow = document.createElement("div");
  ledYellow.className = "pd-led-sm pd-led-yellow";

  const ledGreen = document.createElement("div");
  ledGreen.className = "pd-led-sm pd-led-green";

  const topbarLabel = document.createElement("div");
  topbarLabel.id = "pd-topbar-label";
  topbarLabel.textContent = "POKÉDEX";

  topbar.appendChild(ledMain);
  topbar.appendChild(ledRed);
  topbar.appendChild(ledYellow);
  topbar.appendChild(ledGreen);
  topbar.appendChild(topbarLabel);

  // Body with screen
  const body = document.createElement("div");
  body.id = "pd-body";

  const screen = document.createElement("div");
  screen.id = "pd-screen";

  const screenTitle = document.createElement("div");
  screenTitle.id = "pd-screen-title";
  screenTitle.textContent = "Scanning…";

  screen.appendChild(screenTitle);
  body.appendChild(screen);

  // Divider
  const divider = document.createElement("div");
  divider.id = "pd-divider";

  // Bottom panel
  const bottom = document.createElement("div");
  bottom.id = "pd-bottom";

  const bottomText = document.createElement("div");
  bottomText.id = "pd-bottom-text";
  bottomText.textContent = "";

  const indicator = document.createElement("div");
  indicator.id = "pd-indicator";

  bottom.appendChild(bottomText);
  bottom.appendChild(indicator);

  // Key input (lives inside the screen)
  const keyRow = document.createElement("div");
  keyRow.id = "pd-key-row";

  const keyInput = document.createElement("input");
  keyInput.id = "pd-key-input";
  keyInput.type = "password";
  keyInput.placeholder = "Paste Grok API key…";

  const keySaveBtn = document.createElement("button");
  keySaveBtn.id = "pd-key-save";
  keySaveBtn.textContent = "Save Key";

  keyRow.appendChild(keyInput);
  keyRow.appendChild(keySaveBtn);
  screen.appendChild(keyRow);

  // Assemble inner
  cardInner.appendChild(topbar);
  cardInner.appendChild(body);
  cardInner.appendChild(divider);
  cardInner.appendChild(bottom);

  // Dismiss button (outside inner for overflow)
  const cardDismiss = document.createElement("button");
  cardDismiss.id = "pd-card-dismiss";
  cardDismiss.textContent = "✕";
  cardDismiss.addEventListener("click", () => hideCard());

  card.appendChild(cardInner);
  card.appendChild(cardDismiss);

  // Detection zone overlay
  const zone = document.createElement("div");
  zone.id = "pd-zone";

  // ==========================================================
  // Mount
  // ==========================================================

  document.documentElement.appendChild(card);
  document.documentElement.appendChild(zone);
  card.style.display = "none";
  zone.style.display = "none";

  // ==========================================================
  // Card Display
  // ==========================================================

  function revealCard() {
    return; // TEMP: card hidden
    if (cardShown) return;
    card.style.display = "flex";
    card.offsetHeight;
    card.classList.remove("pd-card-hide");
    card.classList.add("pd-card-show");
    cardShown = true;
  }

  function showKeyCard() {
    screenTitle.textContent = "Enter API Key";
    keyRow.style.display = "flex";
    bottom.style.display = "none";
    divider.style.display = "none";
    revealCard();
    setTimeout(() => keyInput.focus(), 400);
  }

  function showCard(habitat, subtitle) {
    screenTitle.textContent = habitat || "Unknown Habitat";
    keyRow.style.display = "none";
    bottomText.textContent = subtitle || "A wild viewer appeared";
    bottom.style.display = "flex";
    divider.style.display = "block";
    revealCard();
  }

  function hideCard() {
    card.classList.remove("pd-card-show");
    card.classList.add("pd-card-hide");
    cardShown = false;
    setTimeout(() => {
      card.style.display = "none";
      card.classList.remove("pd-card-hide");
    }, 400);
  }

  // ==========================================================
  // Key Save
  // ==========================================================

  function saveKey() {
    const key = keyInput.value.trim();
    if (!key) return;
    chrome.storage.local.set({ an_api_key: key }, () => {
      hasKey = true;
      screenTitle.textContent = "Key saved ✓";
      keyRow.style.display = "none";
      bottom.style.display = "flex";
      divider.style.display = "block";
      bottomText.textContent = "Scanning…";
      setTimeout(() => {
        if (enabled && !inFlight) onArticleChanged();
      }, 1000);
    });
  }

  keySaveBtn.addEventListener("click", saveKey);
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveKey();
  });
  card.addEventListener("click", (e) => e.stopPropagation());

  // ==========================================================
  // Viewport Zone Recognizer (from Cortisol Maxxer)
  // ==========================================================

  function findMostCenteredArticle() {
    const articles = document.querySelectorAll(
      'article, [data-testid="tweet"], [role="article"]'
    );
    if (articles.length === 0) return null;

    const vpCenter = window.innerHeight / 2;
    let best = null;
    let bestDist = Infinity;

    articles.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.height < 30 || rect.bottom < 0 || rect.top > window.innerHeight) return;
      const dist = Math.abs(rect.top + rect.height / 2 - vpCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = el;
      }
    });

    return best;
  }

  function snapZoneToArticle(article) {
    if (!article) {
      zone.style.display = "none";
      return;
    }
    const rect = article.getBoundingClientRect();
    zone.style.display = "block";
    zone.style.top = (rect.top - ZONE_PADDING) + "px";
    zone.style.left = (rect.left - ZONE_PADDING) + "px";
    zone.style.width = (rect.width + ZONE_PADDING * 2) + "px";
    zone.style.height = (rect.height + ZONE_PADDING * 2) + "px";
  }

  // ==========================================================
  // Content Extraction — from centered article
  // ==========================================================

  function getArticleContext(article) {
    if (!article) return "";

    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextEl?.textContent?.trim()?.slice(0, 500) || "";
    if (!tweetText || tweetText.length < 5) return "";

    const authorEl = article.querySelector(
      '[data-testid="User-Name"] a[role="link"] span'
    );
    const author = authorEl?.textContent?.trim() || "";

    const metrics = [];
    article.querySelectorAll('[data-testid="like"], [data-testid="reply"], [data-testid="retweet"]').forEach((el) => {
      const label = el.getAttribute("aria-label");
      if (label) metrics.push(label);
    });

    const parts = [`Tweet: "${tweetText}"`];
    if (author) parts.push(`Author: @${author}`);
    if (metrics.length) parts.push(`Engagement: ${metrics.slice(0, 3).join(", ")}`);

    return parts.join("\n");
  }

  // ==========================================================
  // Habitat Generation
  // ==========================================================

  function onArticleChanged() {
    if (!enabled || !hasKey) return;

    const context = getArticleContext(currentArticle);
    if (!context || context.length < 5) return;

    if (context === lastTweetText) return;
    lastTweetText = context;

    screenTitle.textContent = "Scanning…";
    bottomText.textContent = "";

    requestId++;
    const thisRequest = requestId;
    inFlight = true;

    chrome.runtime.sendMessage(
      {
        type: "an:grok",
        prompt: HABITAT_PROMPT,
        content: context,
        maxTokens: 60,
      },
      (res) => {
        if (thisRequest !== requestId) return;
        inFlight = false;

        if (res?.error === "no_key") {
          showKeyCard();
          return;
        }

        if (res?.error) {
          console.warn("[Achieved Nothing] Grok error:", res.error);
          return;
        }

        if (res?.text) {
          const lines = res.text.replace(/^["']|["']$/g, "").trim().split("\n").filter(Boolean);
          const habitat = lines[0]?.trim() || "Unknown Habitat";
          const subtitle = lines[1]?.trim() || "A wild viewer appeared";
          showCard(habitat, subtitle);
        }
      }
    );
  }

  // ==========================================================
  // Scroll-driven viewport tracking
  // ==========================================================

  function updateZoneOnScroll() {
    if (!enabled) return;
    const article = findMostCenteredArticle();
    if (article) {
      snapZoneToArticle(article);
      if (article !== currentArticle) {
        currentArticle = article;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!inFlight) onArticleChanged();
        }, DEBOUNCE_MS);
      }
    }
  }

  window.addEventListener("scroll", () => {
    if (!enabled) return;
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(updateZoneOnScroll);
  }, true);

  // ==========================================================
  // Twitter SPA Navigation Detection
  // ==========================================================

  function checkNavigation() {
    const currentUrl = location.href;
    if (currentUrl === lastUrl) return;
    lastUrl = currentUrl;

    lastTweetText = "";
    currentArticle = null;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      updateZoneOnScroll();
      onArticleChanged();
    }, DEBOUNCE_MS);
  }

  const urlObserver = new MutationObserver(() => {
    if (!enabled) return;
    checkNavigation();
  });

  window.addEventListener("popstate", () => {
    if (!enabled) return;
    checkNavigation();
  });

  // ==========================================================
  // Lifecycle
  // ==========================================================

  function startLoop() {
    enabled = true;
    lastUrl = location.href;
    lastTweetText = "";
    inFlight = false;
    requestId = 0;
    currentArticle = null;

    urlObserver.observe(document.body, { childList: true, subtree: true });

    chrome.storage.local.get("an_api_key", (data) => {
      if (data.an_api_key) {
        hasKey = true;
        showCard("Scanning…", "");
        setTimeout(() => {
          updateZoneOnScroll();
          onArticleChanged();
        }, 1000);
      } else {
        hasKey = false;
        showKeyCard();
      }
    });
  }

  function stopLoop() {
    enabled = false;
    inFlight = false;
    hasKey = false;
    requestId = 0;
    lastTweetText = "";
    lastUrl = "";
    currentArticle = null;
    hideCard();
    zone.style.display = "none";
    keyRow.style.display = "none";
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
    if (scrollRaf) { cancelAnimationFrame(scrollRaf); scrollRaf = null; }
    urlObserver.disconnect();
  }

  // ==========================================================
  // Message Listener
  // ==========================================================

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "an:toggle") {
      if (message.enabled) startLoop();
      else stopLoop();
    }
  });
})();
