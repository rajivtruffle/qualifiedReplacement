// assets/piper.js
(function () {
  // --- Localized strings ---
  const L10N = {
    en: {
      name: "Piper",
      role: "AI SDR Agent",
      greeting:
        "Hey there! I’m Piper, your friendly AI SDR agent. What can I help you with today?",
      btn1: "Schedule a Demo",
      btn2: "Chat with Our Team",
      placeholder: "Ask a question",
      fineprint:
        'This conversation may be recorded and used per our <a href="#">Privacy Policy</a>.',
    },
    de: {
      name: "Piper",
      role: "KI-SDR-Agentin",
      greeting:
        "Hallo! Ich bin Piper, deine freundliche KI-SDR-Agentin. Wobei kann ich dir heute helfen?",
      btn1: "Demo vereinbaren",
      btn2: "Mit unserem Team chatten",
      placeholder: "Stelle eine Frage",
      fineprint:
        'Dieses Gespräch kann aufgezeichnet und gemäß unserer <a href="#">Datenschutzerklärung</a> verwendet werden.',
    },
    fr: {
      name: "Piper",
      role: "Agent SDR IA",
      greeting:
        "Bonjour ! Je suis Piper, votre agent SDR IA. Comment puis-je vous aider aujourd’hui ?",
      btn1: "Planifier une démo",
      btn2: "Discuter avec notre équipe",
      placeholder: "Posez une question",
      fineprint:
        'Cette conversation peut être enregistrée et utilisée conformément à notre <a href="#">Politique de confidentialité</a>.',
    },
  };

  // Prefer your app.js context; fall back to path or <html lang="">
  function detectLang() {
    const ctxLang = window.TruffleContext?.language; // 'en'|'fr'|'de'
    if (["en", "fr", "de"].includes(ctxLang)) return ctxLang;

    const htmlLang = (document.documentElement.lang || "").toLowerCase();
    if (["en", "fr", "de"].includes(htmlLang)) return htmlLang;

    const parts = location.pathname.split("/").filter(Boolean);
    const fromPath = parts.find((p) => ["en", "fr", "de"].includes(p));
    return fromPath || "en";
  }

  const uiLang = detectLang();
  const t = L10N[uiLang] || L10N.en;

  // Mount container once
  let root = document.getElementById("piper-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "piper-root";
    document.body.appendChild(root);
  }

  // Piper card UI
  const html = `
    <div class="piper-container" id="piperContainer">
      <div class="piper-card" id="piperCard">
        <div class="piper-header">
          <img class="piper-avatar" src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=128&h=128&fit=facearea&facepad=2" alt="Agent avatar" />
          <div class="piper-hgroup">
            <div class="piper-name">${t.name}</div>
            <div class="piper-role">${t.role}</div>
          </div>
        </div>
        <div class="piper-greeting">${t.greeting}</div>
        <div class="piper-cta-row">
          <button class="piper-pill" data-msg="${t.btn1}">${t.btn1}</button>
          <button class="piper-pill" data-msg="${t.btn2}">${t.btn2}</button>
        </div>
        <div class="piper-input-wrap">
          <input id="piperInput" class="piper-input" placeholder="${t.placeholder}" />
          <button id="piperSendBtn" class="piper-send" aria-label="Send message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
          </button>
        </div>
        <div class="piper-fineprint">${t.fineprint}</div>
      </div>
    </div>`;
  root.insertAdjacentHTML("beforeend", html);

  // Behavior
  const SEND_POLICY = "immediate"; // or 'bot-first'
  let chatLaunched = false;
  let pendingMessage = null;

  const container = document.getElementById("piperContainer");
  const pills = container.querySelectorAll(".piper-pill");
  const input = document.getElementById("piperInput");
  const sendBtn = document.getElementById("piperSendBtn");

  function hideCard() {
    container && container.classList.add("piper-hidden");
  }
  function showCard() {
    container && container.classList.remove("piper-hidden");
  }

  // Wait for utilAPI made available by your existing assets/app.js init
  function waitForUtilAPI(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (window.embeddedservice_bootstrap?.utilAPI) return resolve();
        if (Date.now() - start > timeoutMs)
          return reject(new Error("utilAPI not available"));
        setTimeout(check, 50);
      })();
    });
  }

  async function launchChatIfNeeded() {
    await waitForUtilAPI();
    if (!chatLaunched) {
      await embeddedservice_bootstrap.utilAPI.launchChat();
      chatLaunched = true;
      hideCard(); // hide custom UI after launcher
    }
  }

  function sendTextNow(text) {
    if (!text || !text.trim()) return Promise.resolve();
    return embeddedservice_bootstrap.utilAPI.sendTextMessage(text.trim());
  }

  // Optional 'bot-first' queueing
  window.addEventListener("onEmbeddedMessagingFirstBotMessageSent", () => {
    if (SEND_POLICY === "bot-first" && pendingMessage) {
      sendTextNow(pendingMessage);
      pendingMessage = null;
    }
  });
  window.addEventListener("onEmbeddedMessagingConversationStarted", () => {
    if (SEND_POLICY === "bot-first" && pendingMessage) {
      sendTextNow(pendingMessage);
      pendingMessage = null;
    }
  });

  // CTAs
  pills.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const msg = btn.dataset.msg;
      pendingMessage = msg;
      try {
        await launchChatIfNeeded();
        if (SEND_POLICY === "immediate") {
          await sendTextNow(msg);
          pendingMessage = null;
        }
      } catch (e) {
        console.warn("Launch/send failed:", e);
        showCard();
      }
    });
  });

  // Input send
  sendBtn.addEventListener("click", async () => {
    const msg = input.value;
    if (!msg.trim()) return;
    pendingMessage = msg;
    try {
      await launchChatIfNeeded();
      if (SEND_POLICY === "immediate") {
        await sendTextNow(msg);
        pendingMessage = null;
      }
      input.value = "";
    } catch (e) {
      console.warn("Launch/send failed:", e);
      showCard();
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // If your org emits an end/minimize event, uncomment to re-show:
  // window.addEventListener("onEmbeddedMessagingConversationEnded", showCard);
})();