// pages/marketing/webinar/webinar.js
// =====================================================================
// ORCHESTRATOR LAYER: Webinar Management
// Handles Auth Guard, App Shell Mounts, Feature Lifecycle, State, and Events.
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopBar } from "../../../element/topbar.js";
import { renderSidebar } from "../../../element/sidebar.js";
import {
    listenToWebinars,
    saveWebinar,
    toggleWebinarActive,
    deleteWebinar,
    fetchMemberWebinarsPage
} from "./webinar.repository.js";
import {
    initQuillEditor,
    setQuillContent,
    getQuillHtml,
    getQuillText,
    updateStats,
    renderWebinarGrid,
    resetPosterPreview,
    setPosterPreview,
    updateActivateWarning,
    renderMemberModal,
    showToast
} from "./webinar.ui.js";

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Auth Guard
    const user = await requireAuth();
    if (!user) return;

    // 2. Mount App Shell
    const topbarMount = document.getElementById("dg-topbar-mount") || document.getElementById("topbarContainer");
    if (topbarMount) renderTopBar(topbarMount);

    const sidebarMount = document.getElementById("dg-sidebar-mount") || document.getElementById("sidebarContainer");
    if (sidebarMount) renderSidebar(sidebarMount);

    // 3. Initialize Quill WYSIWYG Editor
    initQuillEditor("#webinarMetaDescEditor");

    // 4. Local Feature State
    let webinarsCache = [];
    let posterFile = null;
    let unsubscribeWebinars = null;

    const MEMBER_PAGE_SIZE = 25;
    let memberModalInstance = null;
    let webinarModalInstance = null;
    let deleteModalInstance = null;
    let memberSearchTimer = null;

    const memberState = {
        buffer: [],
        pageIndex: 0,
        lastVisible: null,
        hasMore: true,
        loading: false,
        search: ""
    };

    // 5. Bootstrap Modal Instances
    const webinarModalEl = document.getElementById("webinarModal");
    if (webinarModalEl && typeof bootstrap !== "undefined") {
        webinarModalInstance = new bootstrap.Modal(webinarModalEl);
    }
    const deleteModalEl = document.getElementById("deleteModal");
    if (deleteModalEl && typeof bootstrap !== "undefined") {
        deleteModalInstance = new bootstrap.Modal(deleteModalEl);
    }
    const memberModalEl = document.getElementById("memberModal");
    if (memberModalEl && typeof bootstrap !== "undefined") {
        memberModalInstance = new bootstrap.Modal(memberModalEl);
    }

    /**
     * Matches member record against search query.
     */
    function memberMatchesQuery(doc, q) {
        const needle = q.toLowerCase();
        if (!needle) return true;
        const textFields = [doc.namaLengkap, doc.domisili, doc.profesi, doc.pernahIkutWebinar, doc.webinarName]
            .map((v) => String(v || "").toLowerCase());
        if (textFields.some((h) => h.includes(needle))) return true;
        const sumber = Array.isArray(doc.sumberTahu) ? doc.sumberTahu : [];
        if (sumber.some((s) => String(s || "").toLowerCase().includes(needle))) return true;
        const waDigits = String(doc.nomorWhatsapp || "").replace(/\D/g, "");
        const qDigits = needle.replace(/\D/g, "");
        if (qDigits && waDigits.includes(qDigits)) return true;
        return false;
    }

    /**
     * Loads next page of member webinars.
     */
    async function memberLoadNextPage() {
        if (memberState.loading || !memberState.hasMore) return;
        memberState.loading = true;
        renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });

        try {
            const result = await fetchMemberWebinarsPage({
                lastVisible: memberState.lastVisible,
                pageSize: MEMBER_PAGE_SIZE
            });

            memberState.buffer = memberState.buffer.concat(result.docs);
            memberState.lastVisible = result.lastVisible;
            memberState.hasMore = result.hasMore;
        } catch (err) {
            console.error("[WebinarOrchestrator] Gagal memuat member_webinar:", err);
            showToast("Gagal memuat data member.", "error");
        } finally {
            memberState.loading = false;
            renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });
        }
    }

    /**
     * Opens Add Webinar modal.
     */
    function openAddModal() {
        document.getElementById("webinarModalTitle").textContent = "Tambah Webinar Baru";
        document.getElementById("webinarId").value = "";
        document.getElementById("webinarName").value = "";
        document.getElementById("webinarMetaTitle").value = "";
        setQuillContent("");
        document.getElementById("webinarWhatsapp").value = "";
        document.getElementById("webinarIsActive").checked = false;
        document.getElementById("posterExistingUrl").value = "";
        document.getElementById("posterFileInput").value = "";
        document.getElementById("posterFileName").textContent = "";
        resetPosterPreview();
        posterFile = null;
        updateActivateWarning(webinarsCache, "");

        if (webinarModalInstance) webinarModalInstance.show();
    }

    /**
     * Opens Edit Webinar modal.
     */
    function openEditModal(id) {
        const w = webinarsCache.find((x) => x.id === id);
        if (!w) return;

        document.getElementById("webinarModalTitle").textContent = "Edit Webinar";
        document.getElementById("webinarId").value = id;
        document.getElementById("webinarName").value = w.name || "";
        document.getElementById("webinarMetaTitle").value = w.meta_title || "";
        setQuillContent(w.meta_description || "");
        document.getElementById("webinarWhatsapp").value = w.whatsapp_link || "";
        document.getElementById("webinarIsActive").checked = w.is_active === true;
        document.getElementById("posterExistingUrl").value = w.poster_url || "";
        document.getElementById("posterFileInput").value = "";
        document.getElementById("posterFileName").textContent = w.poster_url ? "Poster sudah diupload" : "";
        posterFile = null;

        if (w.poster_url) {
            setPosterPreview(w.poster_url, "Poster saat ini");
        } else {
            resetPosterPreview();
        }

        updateActivateWarning(webinarsCache, id);
        if (webinarModalInstance) webinarModalInstance.show();
    }

    /**
     * Opens Delete Confirmation modal.
     */
    function openDeleteModal(id) {
        const w = webinarsCache.find((x) => x.id === id);
        if (!w) return;
        document.getElementById("deleteWebinarName").textContent = w.name || "";
        document.getElementById("deleteWebinarId").value = id;
        if (deleteModalInstance) deleteModalInstance.show();
    }

    /**
     * Opens Daftar Member Webinar modal.
     */
    function openMemberModal() {
        memberState.buffer = [];
        memberState.pageIndex = 0;
        memberState.lastVisible = null;
        memberState.hasMore = true;
        memberState.loading = false;
        memberState.search = "";

        const searchInput = document.getElementById("memberSearchInput");
        if (searchInput) searchInput.value = "";

        if (memberModalInstance) memberModalInstance.show();
        renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });
        memberLoadNextPage();
    }

    /**
     * Handles file selection for poster.
     */
    function handlePosterFileSelect(file) {
        if (!file) return;
        posterFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            setPosterPreview(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    }

    /**
     * Refreshes view from cached webinars.
     */
    function refreshView() {
        updateStats(webinarsCache);
        renderWebinarGrid(webinarsCache, {
            onEdit: (id) => openEditModal(id),
            onToggleActive: async (id, nextActive) => {
                const w = webinarsCache.find((x) => x.id === id);
                if (nextActive) {
                    const othersActive = webinarsCache.filter((x) => x.is_active === true && x.id !== id);
                    if (othersActive.length > 0) {
                        const confirmed = confirm(
                            `Mengaktifkan webinar ini akan menonaktifkan ${othersActive.length} webinar lain yang sedang aktif. Lanjutkan?`
                        );
                        if (!confirmed) return;
                    }
                    try {
                        await toggleWebinarActive(id, true, othersActive.map((x) => x.id));
                        showToast(`Webinar "${w?.name || ""}" diaktifkan.`, "success");
                    } catch (err) {
                        console.error("Error activating webinar:", err);
                        showToast("Gagal mengaktifkan webinar.", "error");
                    }
                } else {
                    try {
                        await toggleWebinarActive(id, false);
                        showToast(`Webinar "${w?.name || ""}" dinonaktifkan.`, "warning");
                    } catch (err) {
                        console.error("Error deactivating webinar:", err);
                        showToast("Gagal menonaktifkan webinar.", "error");
                    }
                }
            },
            onDelete: (id) => openDeleteModal(id)
        });
    }

    /**
     * Attaches realtime listener to webinars collection.
     */
    function startRealtimeSubscription() {
        if (unsubscribeWebinars) {
            unsubscribeWebinars();
            unsubscribeWebinars = null;
        }

        unsubscribeWebinars = listenToWebinars(
            (webinars) => {
                webinarsCache = webinars;
                refreshView();
            },
            (err) => {
                console.error("[WebinarOrchestrator] Error listening to webinars:", err);
                showToast("Gagal memuat data webinar.", "error");
            }
        );
    }

    // 6. Attach Event Handlers

    // Header buttons
    const btnOpenAdd = document.getElementById("btnOpenAddWebinar");
    if (btnOpenAdd) btnOpenAdd.addEventListener("click", openAddModal);

    const btnOpenAddEmpty = document.getElementById("btnOpenAddWebinarEmpty");
    if (btnOpenAddEmpty) btnOpenAddEmpty.addEventListener("click", openAddModal);

    const btnOpenMember = document.getElementById("btnOpenMemberModal");
    if (btnOpenMember) btnOpenMember.addEventListener("click", openMemberModal);

    // Poster upload events
    const posterZone = document.getElementById("posterUploadZone");
    const posterFileInput = document.getElementById("posterFileInput");

    if (posterZone && posterFileInput) {
        posterZone.addEventListener("click", () => {
            posterFileInput.click();
        });

        posterFileInput.addEventListener("change", (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) handlePosterFileSelect(file);
        });

        posterZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            posterZone.style.borderColor = "#2563eb";
            posterZone.style.background = "#eff6ff";
        });

        posterZone.addEventListener("dragleave", () => {
            posterZone.style.borderColor = "";
            posterZone.style.background = "";
        });

        posterZone.addEventListener("drop", (e) => {
            e.preventDefault();
            posterZone.style.borderColor = "";
            posterZone.style.background = "";
            const file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) {
                handlePosterFileSelect(file);
            }
        });
    }

    // Modal Active Toggle Warning
    const toggleActiveInput = document.getElementById("webinarIsActive");
    if (toggleActiveInput) {
        toggleActiveInput.addEventListener("change", () => {
            const currentEditId = document.getElementById("webinarId").value;
            updateActivateWarning(webinarsCache, currentEditId);
        });
    }

    // Save Webinar Button
    const btnSaveWebinar = document.getElementById("btnSaveWebinar");
    if (btnSaveWebinar) {
        btnSaveWebinar.addEventListener("click", async () => {
            const id = document.getElementById("webinarId").value.trim();
            const name = document.getElementById("webinarName").value.trim();
            const metaTitle = document.getElementById("webinarMetaTitle").value.trim();
            const metaDescHtml = getQuillHtml();
            const metaDescText = getQuillText();
            const whatsappLink = document.getElementById("webinarWhatsapp").value.trim();
            const isActive = document.getElementById("webinarIsActive").checked;
            const existingPoster = document.getElementById("posterExistingUrl").value.trim();

            if (!name) return showToast("Nama webinar wajib diisi.", "error");
            if (!metaTitle) return showToast("Meta Title wajib diisi.", "error");
            if (!metaDescText) return showToast("Meta Description wajib diisi.", "error");

            const label = document.getElementById("btnSaveLabel");
            const spinner = document.getElementById("btnSaveSpinner");
            btnSaveWebinar.disabled = true;
            if (label) label.textContent = "Menyimpan...";
            if (spinner) spinner.style.display = "inline-block";

            try {
                await saveWebinar({
                    id,
                    name,
                    metaTitle,
                    metaDescription: metaDescHtml,
                    whatsappLink,
                    isActive,
                    posterFile,
                    existingPosterUrl: existingPoster,
                    currentWebinars: webinarsCache
                });

                showToast(`Webinar "${name}" berhasil ${id ? "diperbarui" : "ditambahkan"}.`, "success");
                if (webinarModalInstance) webinarModalInstance.hide();
            } catch (err) {
                console.error("[WebinarOrchestrator] Error saving webinar:", err);
                showToast("Gagal menyimpan webinar: " + (err.message || err.toString()), "error");
            } finally {
                btnSaveWebinar.disabled = false;
                if (label) label.textContent = "Simpan";
                if (spinner) spinner.style.display = "none";
            }
        });
    }

    // Confirm Delete Button
    const btnConfirmDelete = document.getElementById("btnConfirmDeleteWebinar");
    if (btnConfirmDelete) {
        btnConfirmDelete.addEventListener("click", async () => {
            const id = document.getElementById("deleteWebinarId").value;
            if (!id) return;
            const w = webinarsCache.find((x) => x.id === id);

            try {
                await deleteWebinar(id);
                if (deleteModalInstance) deleteModalInstance.hide();
                showToast(`Webinar "${w?.name || ""}" berhasil dihapus.`, "success");
            } catch (err) {
                console.error("[WebinarOrchestrator] Error deleting webinar:", err);
                showToast("Gagal menghapus webinar.", "error");
            }
        });
    }

    // Member Modal events
    const memberSearchInput = document.getElementById("memberSearchInput");
    if (memberSearchInput) {
        memberSearchInput.addEventListener("input", () => {
            clearTimeout(memberSearchTimer);
            memberSearchTimer = setTimeout(() => {
                memberState.search = memberSearchInput.value.trim();
                memberState.pageIndex = 0;
                renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });
            }, 250);
        });
    }

    const memberPrevBtn = document.getElementById("memberPrevBtn");
    if (memberPrevBtn) {
        memberPrevBtn.addEventListener("click", () => {
            if (memberState.pageIndex > 0) {
                memberState.pageIndex--;
                renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });
            }
        });
    }

    const memberNextBtn = document.getElementById("memberNextBtn");
    if (memberNextBtn) {
        memberNextBtn.addEventListener("click", async () => {
            const maxPage = Math.max(0, Math.ceil(memberState.buffer.length / MEMBER_PAGE_SIZE) - 1);
            if (memberState.pageIndex < maxPage) {
                memberState.pageIndex++;
                renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });
            } else if (memberState.hasMore) {
                await memberLoadNextPage();
                memberState.pageIndex = Math.max(0, Math.ceil(memberState.buffer.length / MEMBER_PAGE_SIZE) - 1);
                renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE });
            }
        });
    }

    const memberLoadMoreBtn = document.getElementById("memberLoadMoreBtn");
    if (memberLoadMoreBtn) {
        memberLoadMoreBtn.addEventListener("click", () => {
            memberLoadNextPage();
        });
    }

    // 7. Cleanup
    window.addEventListener("beforeunload", () => {
        if (unsubscribeWebinars) {
            unsubscribeWebinars();
            unsubscribeWebinars = null;
        }
    });

    // 8. Start Real-time Subscription
    startRealtimeSubscription();
});
