// pages/marketing/mailing-list/mailing-list.js
// =====================================================================
// ORCHESTRATOR LAYER: Mailing List
// Handles Auth Guard, App Shell Mounts, Feature Lifecycle, State, and Events.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";
import {
    subscribeToMailingList,
    resolveMailingErrorMessage
} from "./mailing-list.repository.js";
import {
    setVisibleState,
    setErrorMessage,
    updateSummaryMetrics,
    renderTableRows,
    copyText,
    showToast
} from "./mailing-list.ui.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Auth Guard
    const user = await requireAuth();
    if (!user) return;

    // 2. Mount App Shell (Topbar & Sidebar)
    const topbarMount = document.getElementById("dg-topbar-mount") || document.getElementById("topbarContainer");
    if (topbarMount) renderTopBar(topbarMount);

    const sidebarMount = document.getElementById("dg-sidebar-mount") || document.getElementById("sidebarContainer");
    if (sidebarMount) renderSidebar(sidebarMount);

    // 3. Cache DOM Elements
    const elements = {
        searchInput: document.getElementById("mailingSearchInput"),
        tableBody: document.getElementById("mailingTableBody"),
        tableContainer: document.getElementById("mailingTableContainer"),
        loadingState: document.getElementById("mailingLoadingState"),
        errorState: document.getElementById("mailingErrorState"),
        errorText: document.getElementById("mailingErrorText"),
        emptyState: document.getElementById("mailingEmptyState"),
        noResultsState: document.getElementById("mailingNoResultsState"),
        selectAllCheckbox: document.getElementById("mailingSelectAll"),
        totalValue: document.getElementById("totalSubscribersValue"),
        filteredValue: document.getElementById("filteredSubscribersValue"),
        selectedValue: document.getElementById("selectedSubscribersValue"),
        statusText: document.getElementById("mailingStatusText"),
        toastEl: document.getElementById("mailingToast"),
        btnCopySelected: document.getElementById("btnCopySelected"),
        btnCopyAll: document.getElementById("btnCopyAll"),
        btnRetry: document.getElementById("btnRetryMailingLoad")
    };

    // 4. Local Feature State
    let subscribersState = [];
    let selectedEmails = new Set();
    let unsubscribeListener = null;

    /**
     * Gets filtered items based on current search term.
     * @returns {Array<{ id: string, email: string, createdAt: Date|null }>}
     */
    function getFilteredSubscribers() {
        const term = elements.searchInput ? elements.searchInput.value.trim().toLowerCase() : "";
        if (!term) return subscribersState.slice();
        return subscribersState.filter((item) => String(item.email || "").toLowerCase().includes(term));
    }

    /**
     * Renders view based on state and filter results.
     */
    function renderView() {
        const filtered = getFilteredSubscribers();

        updateSummaryMetrics(elements, {
            totalCount: subscribersState.length,
            filteredItems: filtered,
            selectedEmails
        });

        if (!subscribersState.length) {
            setVisibleState(elements, "empty");
            return;
        }

        if (!filtered.length) {
            setVisibleState(elements, "no-results");
            return;
        }

        setVisibleState(elements, "table");

        renderTableRows(elements, {
            items: filtered,
            selectedEmails,
            onToggleSelect: (email, isChecked) => {
                if (!email) return;
                if (isChecked) {
                    selectedEmails.add(email);
                } else {
                    selectedEmails.delete(email);
                }
                updateSummaryMetrics(elements, {
                    totalCount: subscribersState.length,
                    filteredItems: filtered,
                    selectedEmails
                });
            },
            onRowClick: async (email) => {
                await copyText(elements.toastEl, email, "Email berhasil disalin.");
            }
        });
    }

    /**
     * Starts Firestore real-time subscription.
     */
    function startRealtimeSubscription() {
        if (unsubscribeListener) {
            unsubscribeListener();
            unsubscribeListener = null;
        }

        setVisibleState(elements, "loading");

        unsubscribeListener = subscribeToMailingList(
            (items) => {
                subscribersState = items;
                // Retain only valid existing selections
                selectedEmails = new Set(
                    Array.from(selectedEmails).filter((email) => subscribersState.some((item) => item.email === email))
                );
                renderView();
            },
            (error) => {
                console.error("[MailingList] Real-time subscription error:", error);
                setErrorMessage(elements, resolveMailingErrorMessage(error));
            }
        );
    }

    // 5. Attach Event Listeners
    if (elements.searchInput) {
        elements.searchInput.addEventListener("input", () => {
            renderView();
        });
    }

    if (elements.selectAllCheckbox) {
        elements.selectAllCheckbox.addEventListener("change", () => {
            const filtered = getFilteredSubscribers();
            filtered.forEach((item) => {
                if (!item.email) return;
                if (elements.selectAllCheckbox.checked) {
                    selectedEmails.add(item.email);
                } else {
                    selectedEmails.delete(item.email);
                }
            });
            renderView();
        });
    }

    if (elements.btnCopySelected) {
        elements.btnCopySelected.addEventListener("click", async () => {
            const selected = Array.from(selectedEmails).filter(Boolean);
            await copyText(elements.toastEl, selected.join(", "), "Email terpilih berhasil disalin.");
        });
    }

    if (elements.btnCopyAll) {
        elements.btnCopyAll.addEventListener("click", async () => {
            const allEmails = subscribersState.map((item) => item.email).filter(Boolean);
            await copyText(elements.toastEl, allEmails.join(", "), "Semua email berhasil disalin.");
        });
    }

    if (elements.btnRetry) {
        elements.btnRetry.addEventListener("click", () => {
            startRealtimeSubscription();
        });
    }

    // 6. Cleanup on page unload
    window.addEventListener("beforeunload", () => {
        if (unsubscribeListener) {
            unsubscribeListener();
            unsubscribeListener = null;
        }
    });

    // 7. Initialize
    startRealtimeSubscription();
});
