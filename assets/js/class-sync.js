/**
 * class-sync.js
 * ─────────────────────────────────────────────────────────────
 * Shared module for real-time cross-tab class synchronization.
 *
 * Features:
 *  • BroadcastChannel fast-path between same-origin tabs
 *  • Throttled / debounced render scheduling
 *  • Sync-status badge helper  (Live / Syncing / Offline)
 *  • Highlight-animation helper for newly-added cards
 *
 * Browser support: Chrome 54+, Firefox 38+, Edge 79+, Safari 15.4+
 * Progressive enhancement: everything degrades gracefully if
 * BroadcastChannel is unavailable.
 * ─────────────────────────────────────────────────────────────
 */

// ──────────────────────────────────────────────
//  Constants
// ──────────────────────────────────────────────
const CHANNEL_NAME = "dialogika_class_sync";
const DEBOUNCE_MS = 500;          // batch snapshot updates
const HIGHLIGHT_DURATION_MS = 3000;

// ──────────────────────────────────────────────
//  BroadcastChannel wrapper
// ──────────────────────────────────────────────
let _channel = null;

/**
 * Get or create the shared BroadcastChannel.
 * Returns null when the API is not supported.
 */
function getChannel() {
    if (_channel) return _channel;
    if (typeof BroadcastChannel === "undefined") return null;
    try {
        _channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (_e) {
        // SecurityError in some contexts (e.g. file://)
        _channel = null;
    }
    return _channel;
}

/**
 * Broadcast a message to other tabs.
 * @param {{ type: string, [key: string]: any }} message
 */
export function broadcastMessage(message) {
    const ch = getChannel();
    if (ch) {
        try { ch.postMessage(message); } catch (_e) { /* ignore */ }
    }
}

/**
 * Register a handler for incoming BroadcastChannel messages.
 * @param {(msg: { type: string, [key: string]: any }) => void} handler
 * @returns {() => void} unsubscribe function
 */
export function onBroadcastMessage(handler) {
    const ch = getChannel();
    if (!ch) return () => {};
    const listener = (event) => {
        if (event.data) handler(event.data);
    };
    ch.addEventListener("message", listener);
    return () => ch.removeEventListener("message", listener);
}

// ──────────────────────────────────────────────
//  Throttled / Debounced Render
// ──────────────────────────────────────────────
let _renderTimer = null;
let _pendingRenderFn = null;

/**
 * Schedule a render callback, debounced by DEBOUNCE_MS.
 * If multiple calls arrive within the window only the last
 * callback executes — ideal for batching Firestore snapshot
 * events that fire in rapid succession.
 *
 * @param {() => void} fn
 * @param {number}     [delay=DEBOUNCE_MS]
 */
export function scheduleRender(fn, delay) {
    _pendingRenderFn = fn;
    if (_renderTimer) clearTimeout(_renderTimer);
    _renderTimer = setTimeout(() => {
        _renderTimer = null;
        if (_pendingRenderFn) {
            _pendingRenderFn();
            _pendingRenderFn = null;
        }
    }, delay !== undefined ? delay : DEBOUNCE_MS);
}

// ──────────────────────────────────────────────
//  Sync Status Badge
// ──────────────────────────────────────────────

/**
 * Inject a small sync-status badge into a container element.
 * Call updateSyncBadge() afterwards to change its state.
 *
 * @param {HTMLElement} container  – element to append badge into
 * @returns {HTMLElement}           the created badge element
 */
export function createSyncBadge(container) {
    const badge = document.createElement("span");
    badge.id = "syncStatusBadge";
    badge.className = "sync-badge sync-badge-live";
    badge.innerHTML = '<span class="sync-dot"></span><span class="sync-label">Live</span>';
    if (container) container.appendChild(badge);
    return badge;
}

/**
 * Update the visual state of the sync badge.
 * @param {"live"|"syncing"|"offline"} state
 */
export function updateSyncBadge(state) {
    const badge = document.getElementById("syncStatusBadge");
    if (!badge) return;
    badge.classList.remove("sync-badge-live", "sync-badge-syncing", "sync-badge-offline");

    const dot   = badge.querySelector(".sync-dot");
    const label = badge.querySelector(".sync-label");

    switch (state) {
        case "syncing":
            badge.classList.add("sync-badge-syncing");
            if (label) label.textContent = "Syncing…";
            break;
        case "offline":
            badge.classList.add("sync-badge-offline");
            if (label) label.textContent = "Offline";
            break;
        default:
            badge.classList.add("sync-badge-live");
            if (label) label.textContent = "Live";
    }
}

// ──────────────────────────────────────────────
//  Highlight Animation
// ──────────────────────────────────────────────

/**
 * Add a temporary highlight class to calendar cards that
 * match certain doc IDs (the newly added ones).
 *
 * Call this *after* the calendar has been re-rendered so
 * the DOM nodes already exist.
 *
 * @param {string[]} docIds  – Firestore document IDs to highlight
 */
export function highlightNewCards(docIds) {
    if (!docIds || !docIds.length) return;
    const idSet = new Set(docIds);
    const cards = document.querySelectorAll("[data-doc-id]");
    cards.forEach((card) => {
        if (idSet.has(card.dataset.docId)) {
            card.classList.add("cal-card-new");
            setTimeout(() => card.classList.remove("cal-card-new"), HIGHLIGHT_DURATION_MS);
        }
    });
}

/**
 * CSS text for sync badge + highlight animation.
 * Inject once via <style> tag so consumers don't need a
 * separate stylesheet.
 */
export function injectSyncStyles() {
    if (document.getElementById("classSyncStyles")) return;
    const style = document.createElement("style");
    style.id = "classSyncStyles";
    style.textContent = `
        /* ── Sync status badge ────────────────────── */
        .sync-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.02em;
            transition: all 0.3s ease;
            user-select: none;
        }
        .sync-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .sync-badge-live {
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #a7f3d0;
        }
        .sync-badge-live .sync-dot {
            background: #10b981;
            box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
            animation: syncPulse 2s ease-in-out infinite;
        }
        .sync-badge-syncing {
            background: #fefce8;
            color: #854d0e;
            border: 1px solid #fde68a;
        }
        .sync-badge-syncing .sync-dot {
            background: #f59e0b;
            animation: syncSpin 1s linear infinite;
        }
        .sync-badge-offline {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }
        .sync-badge-offline .sync-dot {
            background: #ef4444;
        }
        @keyframes syncPulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%      { opacity: 0.5; transform: scale(0.75); }
        }
        @keyframes syncSpin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* ── New-class highlight glow ─────────────── */
        @keyframes newClassGlow {
            0%   { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.55); }
            30%  { box-shadow: 0 0 18px 4px rgba(99, 102, 241, 0.35); }
            100% { box-shadow: none; }
        }
        .cal-card-new {
            animation: newClassGlow 3s ease-out forwards;
            border-left-color: #6366f1 !important;
        }
    `;
    document.head.appendChild(style);
}

// ──────────────────────────────────────────────
//  Cleanup
// ──────────────────────────────────────────────

/**
 * Destroy the BroadcastChannel and clear pending timers.
 * Call on page unload.
 */
export function destroySyncResources() {
    if (_renderTimer) {
        clearTimeout(_renderTimer);
        _renderTimer = null;
    }
    if (_channel) {
        try { _channel.close(); } catch (_e) { /* ignore */ }
        _channel = null;
    }
}
