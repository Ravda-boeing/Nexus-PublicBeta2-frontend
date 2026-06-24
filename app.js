"use strict";

// ─── Config ───────────────────────────────────────────────────────────────────
let API_URL = "http://localhost:8000";

async function loadConfig() {
  try {
    const res = await fetch("config.json");
    const cfg = await res.json();
    API_URL = (cfg.apiUrl || API_URL).replace(/\/chat$/, "").replace(/\/$/, "");
  } catch (e) {
    console.warn("Could not load config.json, using default:", API_URL);
  }
}

// ─── State ────────────────────────────────────────────────────────────────────
let currentSessionId = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const chatLogs        = document.getElementById("chat-logs");
const typingIndicator = document.getElementById("typing-indicator");
const chatArea        = document.getElementById("chat-area");
const userInput       = document.getElementById("user-input");
const sendBtn         = document.getElementById("send-btn");
const newChatBtn      = document.getElementById("new-chat-btn");
const convList        = document.getElementById("conversation-list");

// ─── Rendering ────────────────────────────────────────────────────────────────
function addMessage(text, sender) {
  const row = document.createElement("div");
  row.className = `message-row ${sender}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${sender}`;
  avatar.textContent = sender === "bot" ? "NX" : "YOU";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatLogs.appendChild(row);
  scrollToBottom();
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function showTyping() {
  typingIndicator.style.display = "flex";
  scrollToBottom();
}

function hideTyping() {
  typingIndicator.style.display = "none";
}

function clearChat() {
  chatLogs.innerHTML = "";
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const res = await fetch(`${API_URL}/conversations`);
    const convs = await res.json();
    renderSidebar(convs);
  } catch (e) {
    console.error("Failed to load conversations:", e);
  }
}

function renderSidebar(convs) {
  convList.innerHTML = "";
  convs.forEach(conv => {
    const item = document.createElement("div");
    item.className = "conv-item" + (conv.id === currentSessionId ? " active" : "");
    item.dataset.id = conv.id;

    const label = document.createElement("span");
    label.className = "conv-label";
    label.textContent = conv.title || "Untitled";

    const delBtn = document.createElement("button");
    delBtn.className = "conv-delete";
    delBtn.textContent = "✕";
    delBtn.title = "Delete";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteConversation(conv.id);
    });

    item.appendChild(label);
    item.appendChild(delBtn);
    item.addEventListener("click", () => loadConversation(conv.id));
    convList.appendChild(item);
  });
}

function setActiveInSidebar(sessionId) {
  convList.querySelectorAll(".conv-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === sessionId);
  });
}

// ─── Load conversation ────────────────────────────────────────────────────────
async function loadConversation(sessionId) {
  try {
    const res = await fetch(`${API_URL}/conversations/${sessionId}`);
    const data = await res.json();
    currentSessionId = sessionId;
    clearChat();
    setActiveInSidebar(sessionId);
    (data.messages || []).forEach(msg => {
      addMessage(msg.content, msg.role === "user" ? "user" : "bot");
    });
  } catch (e) {
    console.error("Failed to load conversation:", e);
  }
}

// ─── Delete conversation ──────────────────────────────────────────────────────
async function deleteConversation(sessionId) {
  try {
    await fetch(`${API_URL}/conversations/${sessionId}`, { method: "DELETE" });
    if (currentSessionId === sessionId) startNewChat();
    await loadConversations();
  } catch (e) {
    console.error("Failed to delete:", e);
  }
}

// ─── New chat ─────────────────────────────────────────────────────────────────
function startNewChat() {
  currentSessionId = null;
  clearChat();
  setActiveInSidebar(null);
  userInput.focus();
}

// ─── Send message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  userInput.value = "";
  sendBtn.disabled = true;
  userInput.disabled = true;

  addMessage(message, "user");
  showTyping();

  try {
    const body = { message };
    if (currentSessionId) body.session_id = currentSessionId;

    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server error ${res.status}`);
    }

    const data = await res.json();
    hideTyping();
    addMessage(data.reply, "bot");

    if (data.session_id) {
      const isNew = !currentSessionId;
      currentSessionId = data.session_id;
      await loadConversations();
      if (isNew) setActiveInSidebar(currentSessionId);
    }
  } catch (e) {
    hideTyping();
    addMessage(`Error: ${e.message}`, "bot");
    console.error("Send error:", e);
  } finally {
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

// ─── Events ───────────────────────────────────────────────────────────────────
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) sendMessage();
});
newChatBtn.addEventListener("click", startNewChat);

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await loadConfig();
  await loadConversations();
  userInput.focus();
})();
