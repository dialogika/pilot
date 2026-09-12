// pages/marketing/webinar/webinar.ui.js
// =====================================================================
// UI LAYER: Webinar Management Presentation
// Handles DOM rendering, Quill WYSIWYG editor, modal views, and toast feedback.
// =====================================================================

let quillInstance = null;

/**
 * Strips HTML tags from string for clean preview text.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html) {
    if (!html) return "";
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
}

/**
 * Escapes unsafe characters for HTML injection.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Formats a Firestore Timestamp or Date object for Member Table.
 * @param {any} ts
 * @returns {string}
 */
export function formatMemberDate(ts) {
    if (!ts) return "-";
    let d = ts;
    if (d && typeof d.toDate === "function") d = d.toDate();
    if (d instanceof Date && !isNaN(d.getTime())) {
        return d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }
    return "-";
}

/**
 * Shows custom floating toast notification.
 * @param {string} message
 * @param {"success"|"error"|"warning"} type
 */
export function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `custom-toast custom-toast-${type} mb-2`;
    toast.innerHTML = `<i class="bi bi-${type === "success" ? "check-circle-fill" : type === "error" ? "x-circle-fill" : "exclamation-triangle-fill"} me-2"></i>${escapeHtml(message)}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transition = "opacity 0.3s";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

/**
 * Initializes Quill WYSIWYG Editor on the description container.
 * @param {string} selector
 * @returns {Object|null} Quill instance
 */
export function initQuillEditor(selector = "#webinarMetaDescEditor") {
    if (quillInstance) return quillInstance;
    const editorEl = document.querySelector(selector);
    if (editorEl && typeof Quill !== "undefined") {
        quillInstance = new Quill(selector, {
            theme: "snow",
            placeholder: "Tulis deskripsi webinar di sini...",
            modules: {
                toolbar: [
                    [{ header: [1, 2, 3, false] }],
                    [{ size: ["small", false, "large", "huge"] }],
                    ["bold", "italic", "underline"],
                    [{ color: [] }, { background: [] }],
                    [{ align: [] }],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link"],
                    ["clean"],
                    ["undo", "redo"]
                ],
                history: {
                    delay: 1000,
                    maxStack: 100,
                    userOnly: true
                }
            }
        });
    }
    return quillInstance;
}

/**
 * Sets content of Quill editor safely.
 * @param {string} html
 */
export function setQuillContent(html) {
    if (!quillInstance) return;
    if (html) {
        quillInstance.clipboard.dangerouslyPasteHTML(html);
    } else {
        quillInstance.setContents([]);
    }
}

/**
 * Gets HTML content from Quill editor.
 * @returns {string}
 */
export function getQuillHtml() {
    return quillInstance ? quillInstance.root.innerHTML : "";
}

/**
 * Gets plain text content from Quill editor.
 * @returns {string}
 */
export function getQuillText() {
    return quillInstance ? quillInstance.getText().trim() : "";
}

/**
 * Updates stats cards for Total Webinar, Webinar Aktif, and Status Publik.
 * @param {Array<Object>} webinars
 */
export function updateStats(webinars = []) {
    const total = webinars.length;
    const activeCount = webinars.filter((w) => w.is_active === true).length;
    const activeWebinar = webinars.find((w) => w.is_active === true);

    const statTotal = document.getElementById("statTotalWebinar");
    const statActive = document.getElementById("statActiveWebinar");
    const statPublic = document.getElementById("statPublicStatus");

    if (statTotal) statTotal.textContent = String(total);
    if (statActive) statActive.textContent = String(activeCount);
    if (statPublic) {
        if (activeWebinar) {
            statPublic.innerHTML = `<span class="text-success font-bold">${escapeHtml(activeWebinar.name)}</span>`;
        } else {
            statPublic.innerHTML = '<span class="text-muted">Tidak ada webinar aktif</span>';
        }
    }
}

/**
 * Renders webinar card grid.
 * @param {Array<Object>} webinars
 * @param {Object} handlers
 * @param {(id: string) => void} handlers.onEdit
 * @param {(id: string, activate: boolean) => void} handlers.onToggleActive
 * @param {(id: string) => void} handlers.onDelete
 */
export function renderWebinarGrid(webinars = [], { onEdit, onToggleActive, onDelete } = {}) {
    const grid = document.getElementById("webinarGrid");
    const empty = document.getElementById("emptyState");
    if (!grid) return;

    if (!webinars.length) {
        grid.innerHTML = "";
        if (empty) empty.style.display = "block";
        return;
    }

    if (empty) empty.style.display = "none";
    grid.innerHTML = "";

    webinars.forEach((w) => {
        const isActive = w.is_active === true;
        const cardClass = isActive ? "webinar-card webinar-card-active" : "webinar-card";

        const posterHtml = w.poster_url
            ? `<img src="${escapeHtml(w.poster_url)}" alt="${escapeHtml(w.name)}">`
            : `<div class="webinar-poster-placeholder"><i class="bi bi-image" style="font-size:2.5rem;"></i></div>`;

        const statusBadge = isActive
            ? '<span class="webinar-status-badge active"><i class="bi bi-broadcast"></i>Aktif</span>'
            : '<span class="webinar-status-badge inactive">Nonaktif</span>';

        const cleanDesc = stripHtml(w.meta_description || "");
        const descPreview = cleanDesc.length > 120
            ? cleanDesc.substring(0, 120).trim() + "..."
            : cleanDesc;

        const metaTitlePreview = (w.meta_title || "").length > 50
            ? (w.meta_title || "").substring(0, 50) + "..."
            : (w.meta_title || "-");

        const activateBtnClass = isActive ? "action-deactivate" : "action-activate";
        const activateBtnIcon = isActive ? "bi-pause-circle" : "bi-play-circle";
        const activateBtnLabel = isActive ? "Nonaktifkan" : "Aktifkan";

        const col = document.createElement("div");
        col.className = "col-md-6 col-xl-4";
        col.innerHTML = `
            <div class="${cardClass}">
                <div class="webinar-card-poster">
                    ${posterHtml}
                    ${statusBadge}
                </div>
                <div class="webinar-card-body">
                    <h6 class="webinar-card-title">${escapeHtml(w.name)}</h6>
                    ${descPreview ? `<p class="webinar-card-desc">${escapeHtml(descPreview)}</p>` : ""}
                    <div class="webinar-card-meta">
                        <div class="webinar-card-meta-item">
                            <i class="bi bi-tag"></i>
                            <span>${escapeHtml(metaTitlePreview)}</span>
                        </div>
                        <div class="webinar-card-meta-item">
                            <i class="bi bi-whatsapp"></i>
                            ${w.whatsapp_link
                                ? '<span class="text-success font-semibold">WhatsApp Linked</span>'
                                : '<span class="text-warning font-semibold">No Link</span>'}
                        </div>
                    </div>
                </div>
                <div class="webinar-card-footer">
                    <button type="button" class="btn-card-action action-edit btn-action-edit" title="Edit">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button type="button" class="btn-card-action ${activateBtnClass} btn-action-toggle" title="${activateBtnLabel}">
                        <i class="bi ${activateBtnIcon}"></i> ${activateBtnLabel}
                    </button>
                    <button type="button" class="btn-card-action action-delete btn-action-delete" title="Hapus">
                        <i class="bi bi-trash3"></i>
                    </button>
                    <span class="webinar-order-badge">#${w.order ?? 0}</span>
                </div>
            </div>
        `;

        const editBtn = col.querySelector(".btn-action-edit");
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                if (typeof onEdit === "function") onEdit(w.id);
            });
        }

        const toggleBtn = col.querySelector(".btn-action-toggle");
        if (toggleBtn) {
            toggleBtn.addEventListener("click", () => {
                if (typeof onToggleActive === "function") onToggleActive(w.id, !isActive);
            });
        }

        const deleteBtn = col.querySelector(".btn-action-delete");
        if (deleteBtn) {
            deleteBtn.addEventListener("click", () => {
                if (typeof onDelete === "function") onDelete(w.id);
            });
        }

        grid.appendChild(col);
    });
}

/**
 * Resets poster preview in the modal form.
 */
export function resetPosterPreview() {
    const preview = document.getElementById("posterPreview");
    const placeholder = document.getElementById("posterPlaceholder");
    const zone = document.getElementById("posterUploadZone");
    const fileNameEl = document.getElementById("posterFileName");

    if (preview) {
        preview.style.display = "none";
        preview.src = "";
    }
    if (placeholder) placeholder.style.display = "block";
    if (zone) zone.classList.remove("has-image");
    if (fileNameEl) fileNameEl.textContent = "";
}

/**
 * Sets poster preview image and file label.
 * @param {string} src
 * @param {string} fileName
 */
export function setPosterPreview(src, fileName = "") {
    const preview = document.getElementById("posterPreview");
    const placeholder = document.getElementById("posterPlaceholder");
    const zone = document.getElementById("posterUploadZone");
    const fileNameEl = document.getElementById("posterFileName");

    if (preview && src) {
        preview.src = src;
        preview.style.display = "block";
    }
    if (placeholder) placeholder.style.display = "none";
    if (zone) zone.classList.add("has-image");
    if (fileNameEl && fileName) fileNameEl.textContent = fileName;
}

/**
 * Updates the activation warning in the modal.
 * @param {Array<Object>} webinars
 * @param {string} currentEditId
 */
export function updateActivateWarning(webinars = [], currentEditId = "") {
    const toggle = document.getElementById("webinarIsActive");
    const warning = document.getElementById("activateWarning");
    if (!toggle || !warning) return;

    if (toggle.checked) {
        const hasOtherActive = webinars.some((w) => w.is_active === true && w.id !== currentEditId);
        warning.style.display = hasOtherActive ? "block" : "none";
    } else {
        warning.style.display = "none";
    }
}

/**
 * Renders Member Webinar modal content.
 * @param {Object} memberState
 * @param {Object} handlers
 */
export function renderMemberModal(memberState, { memberMatchesQuery, MEMBER_PAGE_SIZE }) {
    const body = document.getElementById("memberTableBody");
    const wrap = document.getElementById("memberTableWrap");
    const empty = document.getElementById("memberEmpty");
    const emptyText = document.getElementById("memberEmptyText");
    const info = document.getElementById("memberInfoText");
    const pageLabel = document.getElementById("memberPageLabel");
    const prevBtn = document.getElementById("memberPrevBtn");
    const nextBtn = document.getElementById("memberNextBtn");
    const loadMoreBtn = document.getElementById("memberLoadMoreBtn");
    const loadHint = document.getElementById("memberLoadHint");

    const searching = Boolean(memberState.search);
    let visible = [];

    if (searching) {
        visible = memberState.buffer.filter((d) => memberMatchesQuery(d, memberState.search));
    } else {
        const start = memberState.pageIndex * MEMBER_PAGE_SIZE;
        visible = memberState.buffer.slice(start, start + MEMBER_PAGE_SIZE);
    }

    if (visible.length) {
        if (body) {
            body.innerHTML = visible.map((m) => {
                const sumber = Array.isArray(m.sumberTahu) && m.sumberTahu.length
                    ? m.sumberTahu.map((s) => `<span class="badge rounded-pill text-bg-light border me-1" style="font-weight:500;color:#334155;">${escapeHtml(s)}</span>`).join("")
                    : '<span class="text-muted">-</span>';
                const profesiBadge = m.profesi
                    ? `<span class="badge rounded-pill text-bg-${m.profesi === "Pelajar" ? "info" : m.profesi === "Mahasiswa" ? "primary" : "success"}" style="font-weight:600;">${escapeHtml(m.profesi)}</span>`
                    : '<span class="text-muted">-</span>';
                const pernahBadge = m.pernahIkutWebinar
                    ? (String(m.pernahIkutWebinar).toLowerCase().includes("sudah")
                        ? '<span class="badge rounded-pill text-bg-warning" style="font-weight:600;">Sudah pernah</span>'
                        : '<span class="badge rounded-pill text-bg-secondary" style="font-weight:600;">Pertama kali</span>')
                    : '<span class="text-muted">-</span>';
                const waDigits = String(m.nomorWhatsapp || "").replace(/\D/g, "");
                return `<tr>
                    <td class="fw-semibold" style="padding:10px 12px;">${escapeHtml(m.namaLengkap) || "-"}</td>
                    <td>${waDigits ? `<a href="https://wa.me/${waDigits}" target="_blank" rel="noopener noreferrer" class="text-decoration-none text-primary fw-semibold">${escapeHtml(m.nomorWhatsapp)}</a>` : '<span class="text-muted">-</span>'}</td>
                    <td>${escapeHtml(m.domisili) || '<span class="text-muted">-</span>'}</td>
                    <td>${profesiBadge}</td>
                    <td style="max-width:230px;">${sumber}</td>
                    <td>${pernahBadge}</td>
                    <td style="max-width:160px;">${escapeHtml(m.webinarName) || '<span class="text-muted">-</span>'}</td>
                    <td class="text-muted" style="white-space:nowrap;">${formatMemberDate(m.createdAt)}</td>
                </tr>`;
            }).join("");
        }
        if (wrap) wrap.style.display = "";
        if (empty) empty.style.display = "none";
    } else {
        if (body) body.innerHTML = "";
        if (wrap) wrap.style.display = "none";
        if (empty) {
            empty.style.display = "block";
            if (emptyText) {
                emptyText.textContent = memberState.search
                    ? 'Tidak ada hasil yang cocok pada data yang sudah dimuat. Klik "Muat Lebih Banyak" untuk mencari pada data berikutnya.'
                    : "Belum ada data member webinar.";
            }
        }
    }

    const totalLoaded = memberState.buffer.length;
    const maxPage = Math.max(0, Math.ceil(totalLoaded / MEMBER_PAGE_SIZE) - 1);

    if (memberState.loading) {
        if (info) info.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Memuat data...';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (loadMoreBtn) loadMoreBtn.disabled = true;
        if (pageLabel) pageLabel.textContent = "Halaman " + (memberState.pageIndex + 1);
        if (loadHint) loadHint.textContent = "";
        return;
    }

    if (searching) {
        if (info) info.textContent = `${visible.length} hasil dari ${totalLoaded} data yang dimuat`;
        if (prevBtn) prevBtn.style.display = "none";
        if (nextBtn) nextBtn.style.display = "none";
        if (pageLabel) pageLabel.style.display = "none";
    } else {
        if (info) info.textContent = `Menampilkan ${visible.length} data — halaman ${memberState.pageIndex + 1}`;
        if (prevBtn) {
            prevBtn.style.display = "";
            prevBtn.disabled = memberState.pageIndex === 0;
        }
        if (nextBtn) {
            nextBtn.style.display = "";
            nextBtn.disabled = !memberState.hasMore && memberState.pageIndex >= maxPage;
        }
        if (pageLabel) {
            pageLabel.style.display = "";
            pageLabel.textContent = `Halaman ${memberState.pageIndex + 1}`;
        }
    }

    if (loadMoreBtn) {
        loadMoreBtn.style.display = memberState.hasMore ? "" : "none";
        loadMoreBtn.disabled = false;
    }
    if (loadHint) {
        loadHint.textContent = memberState.hasMore
            ? "Klik untuk memuat 25 data berikutnya"
            : (totalLoaded ? `Semua data telah dimuat (${totalLoaded})` : "");
    }
}
