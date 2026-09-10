/**
 * Referral Dashboard UI Module
 * Pure presentation layer and DOM manipulation.
 * Zero direct Firebase SDK imports.
 */

// Format currency as IDR
export function formatCurrency(val) {
    const n = Number(val) || 0;
    return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

export function formatNumber(val) {
    const n = Number(val) || 0;
    return new Intl.NumberFormat("id-ID").format(n);
}

export function getReferralOwnerLabel(r) {
    const type = r.holderType || "system";
    const name = (r.holderName || "").trim();
    const ownerName = (r.ownerName || "").trim();
    const finalName = name || ownerName;
    if (type === "user" && finalName) {
        return "User: " + finalName;
    }
    return "System";
}

export function getReferralFunctionLabel(r) {
    const t = (r.functionType || "").toLowerCase();
    if (!t) return "";
    if (t === "discount") return "Discount";
    return r.functionType;
}

export function getReferralInitials(r) {
    const label = getReferralOwnerLabel(r);
    const parts = label.split(" ");
    if (!parts.length) return "RF";
    const cleanLabel = label.replace("User: ", "");
    const cleanParts = cleanLabel.split(" ");
    const first = cleanParts[0] || "";
    const second = cleanParts[1] || "";
    const a = first.charAt(0);
    const b = second.charAt(0);
    const letters = (a + b).toUpperCase().replace(/[^A-Z]/g, "");
    if (letters) return letters;
    return (r.code || "RF").slice(0, 2).toUpperCase();
}

export function getReferralExpiryMeta(r) {
    const months = parseInt(r.monthsValid || 2, 10);
    const created = typeof r.createdAtMs === "number" && r.createdAtMs > 0 ? r.createdAtMs :
        (typeof r.createdAt === "number" && r.createdAt > 0 ? r.createdAt : null);

    if (!created) {
        return {
            expiryLabel: "Masa berlaku " + months + " bulan",
            statusLabel: "",
            isActive: true
        };
    }
    const expiryDate = new Date(created);
    expiryDate.setMonth(expiryDate.getMonth() + months);
    const now = new Date();
    const isActive = expiryDate.getTime() >= now.getTime();
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 0);

    const expiryLabel = "Hingga " + expiryDate.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
    let statusLabel = "";
    if (isActive) {
        statusLabel = "Active - " + diffDays + " Days Left";
    } else {
        statusLabel = "Expired";
    }
    return {
        expiryLabel,
        statusLabel,
        isActive
    };
}

/**
 * Calculates and renders header usage performance card
 */
export function renderHeaderStats(referrals = [], invoices = []) {
    const usedCountEl = document.getElementById("headerUsedCount");
    const maxUsageEl = document.getElementById("headerMaxCount");
    const percentBadgeEl = document.getElementById("headerPercentBadge");
    const progressBarEl = document.getElementById("headerProgressBar");

    let totalMax = 0;
    let totalUsed = 0;

    referrals.forEach((r) => {
        const max = parseInt(r.maxUsage || 0, 10);
        totalMax += max;

        const codeRef = (r.code || "").toUpperCase();
        if (codeRef) {
            const usedInvoices = invoices.filter((inv) => {
                const codeInv = (inv.referralCode || "").toUpperCase();
                const isPaid = (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
                    (typeof inv.paidAmount === "number" && inv.paidAmount > 0);
                return codeInv === codeRef && isPaid;
            });
            totalUsed += usedInvoices.length;
        }
    });

    if (totalMax === 0) totalMax = 100;
    const percent = Math.min(100, Math.round((totalUsed / totalMax) * 100));

    if (usedCountEl) usedCountEl.textContent = totalUsed;
    if (maxUsageEl) maxUsageEl.textContent = "/ " + totalMax;
    if (percentBadgeEl) percentBadgeEl.textContent = percent + "% Used";
    if (progressBarEl) progressBarEl.style.width = percent + "%";
}

/**
 * Renders product dropdown selector
 */
export function renderProductDropdown(products = [], selectedId, onSelect) {
    const panel = document.getElementById("productDropdownPanel");
    const btnLabel = document.getElementById("productBtnLabel");
    if (!panel) return;

    panel.innerHTML = "";
    const selected = products.find((p) => p.productId === selectedId) || products[0];

    if (btnLabel) {
        btnLabel.textContent = selected ? (selected.name || selected.productId) : "Pilih Produk";
    }

    if (!products.length) {
        panel.innerHTML = '<div class="px-4 py-6 text-center"><i class="bi bi-inbox text-3xl text-slate-300 mb-1 block"></i><p class="text-[11px] font-bold text-slate-400">Produk belum tersedia</p></div>';
        return;
    }

    const header = document.createElement("div");
    header.className = "px-3 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]";
    header.textContent = "Pilih Produk (" + products.length + ")";
    panel.appendChild(header);

    products.forEach((product) => {
        const isActive = selected && selected.productId === product.productId;
        const item = document.createElement("div");
        item.className = "product-dropdown-item" + (isActive ? " active" : "");

        item.innerHTML = `
            <div class="flex-1 min-w-0">
                <div class="text-[12px] font-bold text-slate-800 truncate">${product.name || product.productId}</div>
                <div class="text-[9px] text-slate-400">${product.type || "Online"} · ${product.totalSessions || 0} sessions</div>
            </div>
            ${isActive ? '<i class="bi bi-check-circle-fill text-indigo-500 text-sm flex-shrink-0"></i>' : ""}
        `;

        item.addEventListener("click", () => {
            if (typeof onSelect === "function") {
                onSelect(product.productId);
            }
        });
        panel.appendChild(item);
    });
}

/**
 * Toggles product dropdown display state
 */
export function toggleProductDropdown(forceClose = false) {
    const panel = document.getElementById("productDropdownPanel");
    const backdrop = document.getElementById("productDropdownBackdrop");
    const chevron = document.getElementById("productDropdownChevron");
    const btn = document.getElementById("productDropdownBtn");
    if (!panel || !backdrop) return;

    const isOpen = !forceClose && !panel.classList.contains("open");

    if (isOpen) {
        panel.classList.add("open");
        backdrop.classList.add("open");
        if (btn) {
            btn.classList.add("border-indigo-300", "shadow-sm");
            btn.classList.remove("border-slate-200");
        }
        if (chevron) chevron.style.transform = "rotate(180deg)";
    } else {
        panel.classList.remove("open");
        backdrop.classList.remove("open");
        if (btn) {
            btn.classList.remove("border-indigo-300", "shadow-sm");
            btn.classList.add("border-slate-200");
        }
        if (chevron) chevron.style.transform = "";
    }
}

/**
 * Renders Class Product Overview metadata and specifications
 */
export function renderProductOverview(product) {
    const metaContainer = document.getElementById("productMetaContainer");
    const specsList = document.getElementById("productSpecificationsList");
    const specsSection = document.getElementById("productSpecificationsSection");

    if (!metaContainer || !specsList) return;

    metaContainer.innerHTML = "";
    specsList.innerHTML = "";

    if (!product) {
        if (specsSection) specsSection.style.display = "none";
        return;
    }

    if (specsSection) specsSection.style.display = "";

    const metaItems = [
        { label: "Product", value: product.name || "-" },
        { label: "Type", value: product.type || "-" },
        { label: "Sessions", value: (product.totalSessions || 0) + " sessions" },
        { label: "Base Price", value: formatCurrency(product.basePrice || 0) }
    ];

    metaItems.forEach((item) => {
        const wrapper = document.createElement("div");
        const label = document.createElement("span");
        label.className = "block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1";
        label.textContent = item.label;
        const value = document.createElement("p");
        value.className = "text-sm font-bold text-slate-700";
        value.textContent = item.value;
        wrapper.appendChild(label);
        wrapper.appendChild(value);
        metaContainer.appendChild(wrapper);
    });

    if (Array.isArray(product.specifications) && product.specifications.length) {
        product.specifications.forEach((spec) => {
            const li = document.createElement("li");
            li.textContent = String(spec);
            specsList.appendChild(li);
        });
    } else {
        const emptyLi = document.createElement("li");
        emptyLi.className = "text-slate-300 italic";
        emptyLi.textContent = "Belum ada spesifikasi";
        specsList.appendChild(emptyLi);
    }
}

/**
 * Renders Curriculum list
 */
export function renderCurriculum(curriculumList = []) {
    const container = document.getElementById("productCurriculumContainer");
    if (!container) return;
    container.innerHTML = "";

    if (!curriculumList || !curriculumList.length) {
        container.innerHTML = '<p class="text-xs text-slate-400 italic">Belum ada kurikulum untuk produk ini.</p>';
        return;
    }

    curriculumList.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "flex gap-4";
        const bubble = document.createElement("div");
        bubble.className = "step-bubble";
        bubble.textContent = item.order || String(idx + 1).padStart(2, "0");
        const body = document.createElement("div");
        body.className = "pt-1";
        const title = document.createElement("h4");
        title.className = "text-sm font-bold text-slate-800";
        title.textContent = item.title || "-";
        const desc = document.createElement("p");
        desc.className = "text-xs text-slate-400";
        desc.textContent = item.description || "";
        body.appendChild(title);
        if (desc.textContent) {
            body.appendChild(desc);
        }
        row.appendChild(bubble);
        row.appendChild(body);
        container.appendChild(row);
    });
}

/**
 * Renders Highlights Sidebar Panel
 */
export function renderHighlights(product) {
    const hlName = document.getElementById("highlightProductName");
    const hlFeatures = document.getElementById("highlightFeatureCount");
    const hlPrice = document.getElementById("highlightBasePrice");
    const hlSessions = document.getElementById("highlightSessions");

    if (hlName) hlName.textContent = product ? (product.name || "-") : "-";
    if (hlFeatures) hlFeatures.textContent = product ? ((Array.isArray(product.features) ? product.features.length : 0) + " fitur") : "0";
    if (hlPrice) hlPrice.textContent = product ? formatCurrency(product.basePrice || 0) : "-";
    if (hlSessions) hlSessions.textContent = product ? ((product.totalSessions || 0) + " sessions") : "0";
}

/**
 * Renders draggable feature items into Key Features (active) and Excluded Modules zones with pagination
 */
export function renderDraggableFeatures({
    features = [],
    savedExcludedKeys = [],
    activePage = 1,
    activePageSize = 5,
    onActivePageChange
}) {
    const activeZone = document.getElementById("active-zone");
    const excludedZone = document.getElementById("excluded-zone");
    const activePagination = document.getElementById("activeFeaturesPagination");
    const excludedPagination = document.getElementById("excludedFeaturesPagination");

    if (!activeZone || !excludedZone) return;

    activeZone.innerHTML = "";
    excludedZone.innerHTML = "";

    const placeholder = document.createElement("div");
    placeholder.id = "placeholder-text";
    placeholder.className = "text-center py-8";
    placeholder.innerHTML = '<i class="bi bi-box-arrow-in-right text-3xl mb-2 block"></i><p class="text-xs font-bold uppercase tracking-widest">Drop here to exclude</p>';
    excludedZone.appendChild(placeholder);

    const featIconColors = [
        { bg: "bg-amber-50", text: "text-amber-500", icon: "bi-star" },
        { bg: "bg-purple-50", text: "text-purple-600", icon: "bi-award" },
        { bg: "bg-indigo-50", text: "text-indigo-600", icon: "bi-lightning" },
        { bg: "bg-blue-50", text: "text-blue-500", icon: "bi-gem" },
        { bg: "bg-emerald-50", text: "text-emerald-600", icon: "bi-check-circle" },
        { bg: "bg-rose-50", text: "text-rose-500", icon: "bi-heart" },
        { bg: "bg-cyan-50", text: "text-cyan-600", icon: "bi-diagram-3" },
        { bg: "bg-orange-50", text: "text-orange-500", icon: "bi-rocket-takeoff" }
    ];

    if (!features.length) {
        activeZone.innerHTML = '<div class="p-4 text-xs text-slate-300 italic text-center">Belum ada fitur untuk produk ini</div>';
        if (activePagination) activePagination.innerHTML = "";
        updateCounters();
        return;
    }

    // Separate features into active and excluded
    const activeList = [];
    const excludedList = [];

    features.forEach((feat, idx) => {
        const featKey = typeof feat === "string" ? "fc-feat-" + (idx + 1) : (feat.key || "fc-feat-" + (idx + 1));
        const itemObj = {
            feat,
            idx,
            featKey,
            title: typeof feat === "string" ? feat : (feat.label || ""),
            colorSet: featIconColors[idx % featIconColors.length]
        };
        if (savedExcludedKeys.includes(featKey)) {
            excludedList.push(itemObj);
        } else {
            activeList.push(itemObj);
        }
    });

    // Pagination calculations for Active Features
    const totalActive = activeList.length;
    const totalPages = Math.ceil(totalActive / activePageSize) || 1;
    const currentPage = Math.min(Math.max(1, activePage), totalPages);
    const startIndex = (currentPage - 1) * activePageSize;
    const visibleActive = activeList.slice(startIndex, startIndex + activePageSize);

    // Helper to create draggable DOM item
    function createFeatureElement(item, isExcluded) {
        const featEl = document.createElement("div");
        featEl.id = "feat-item-" + (item.idx + 1);
        featEl.setAttribute("data-feat-key", item.featKey);
        featEl.className = "draggable-item p-4 bg-white border rounded-2xl shadow-sm flex items-center gap-4 " +
            (isExcluded ? "border-rose-100 bg-rose-50/30" : "border-emerald-100");
        featEl.setAttribute("draggable", "true");

        featEl.addEventListener("dragstart", (ev) => {
            ev.dataTransfer.setData("text/plain", ev.currentTarget.getAttribute("data-feat-key"));
            ev.currentTarget.classList.add("dragging");
        });
        featEl.addEventListener("dragend", (ev) => {
            ev.currentTarget.classList.remove("dragging");
        });

        // Left color icon
        const iconWrap = document.createElement("div");
        iconWrap.className = "w-10 h-10 rounded-xl " + item.colorSet.bg + " " + item.colorSet.text + " flex items-center justify-center flex-shrink-0";
        const decorIcon = document.createElement("i");
        decorIcon.className = "bi " + item.colorSet.icon;
        iconWrap.appendChild(decorIcon);

        // Body
        const body = document.createElement("div");
        body.className = "flex-grow";
        const h4 = document.createElement("h4");
        h4.className = "text-sm font-bold text-slate-800";
        h4.textContent = item.title;
        body.appendChild(h4);

        // Status icon
        const statusIcon = document.createElement("i");
        statusIcon.className = "bx feat-status-icon text-xl flex-shrink-0 " +
            (isExcluded ? "bxs-x-circle text-rose-500" : "bxs-check-circle text-emerald-500");

        featEl.appendChild(iconWrap);
        featEl.appendChild(body);
        featEl.appendChild(statusIcon);
        return featEl;
    }

    // Render active visible items
    if (visibleActive.length === 0) {
        activeZone.innerHTML = '<div class="p-4 text-xs text-slate-400 italic text-center">Semua fitur di-exclude</div>';
    } else {
        visibleActive.forEach((item) => {
            activeZone.appendChild(createFeatureElement(item, false));
        });
    }

    // Render excluded items
    if (excludedList.length > 0) {
        excludedList.forEach((item) => {
            excludedZone.appendChild(createFeatureElement(item, true));
        });
    }

    // Render Active Features Pagination Controls
    if (activePagination) {
        if (totalActive <= activePageSize && totalPages <= 1) {
            activePagination.innerHTML = `
                <div class="ref-pagination-info">
                    <span>${totalActive} fitur aktif</span>
                </div>
            `;
        } else {
            const end = Math.min(startIndex + activePageSize, totalActive);
            let btnsHtml = "";

            // Prev Button
            const prevDisabled = currentPage === 1;
            btnsHtml += `
                <button type="button" class="ref-pagination-btn btn-prev-active ${prevDisabled ? "disabled" : ""}" ${prevDisabled ? "disabled" : ""} title="Sebelumnya">
                    <i class="bi bi-chevron-left text-[11px]"></i>
                </button>
            `;

            for (let p = 1; p <= totalPages; p++) {
                const isActive = p === currentPage;
                btnsHtml += `
                    <button type="button" class="ref-pagination-btn btn-page-active ${isActive ? "active" : ""}" data-page="${p}">
                        ${p}
                    </button>
                `;
            }

            // Next Button
            const nextDisabled = currentPage === totalPages;
            btnsHtml += `
                <button type="button" class="ref-pagination-btn btn-next-active ${nextDisabled ? "disabled" : ""}" ${nextDisabled ? "disabled" : ""} title="Berikutnya">
                    <i class="bi bi-chevron-right text-[11px]"></i>
                </button>
            `;

            activePagination.innerHTML = `
                <div class="ref-pagination-info">
                    <span>Menampilkan ${startIndex + 1}-${end} dari ${totalActive} fitur</span>
                </div>
                <div class="ref-pagination-controls">
                    ${btnsHtml}
                </div>
            `;

            // Wire up page buttons
            activePagination.querySelectorAll(".btn-page-active").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const targetPage = parseInt(btn.getAttribute("data-page"), 10);
                    if (typeof onActivePageChange === "function") {
                        onActivePageChange(targetPage);
                    }
                });
            });

            const prevBtn = activePagination.querySelector(".btn-prev-active");
            if (prevBtn) {
                prevBtn.addEventListener("click", () => {
                    if (currentPage > 1 && typeof onActivePageChange === "function") {
                        onActivePageChange(currentPage - 1);
                    }
                });
            }

            const nextBtn = activePagination.querySelector(".btn-next-active");
            if (nextBtn) {
                nextBtn.addEventListener("click", () => {
                    if (currentPage < totalPages && typeof onActivePageChange === "function") {
                        onActivePageChange(currentPage + 1);
                    }
                });
            }
        }
    }

    updateCounters(totalActive, excludedList.length);
}

/**
 * Updates Drag & Drop zone counters and placeholder states
 */
export function updateCounters(activeCountOverride, excludedCountOverride) {
    const activeZone = document.getElementById("active-zone");
    const excludedZone = document.getElementById("excluded-zone");
    const placeholder = document.getElementById("placeholder-text");

    const activeCount = typeof activeCountOverride === "number" ? activeCountOverride :
        (activeZone ? activeZone.querySelectorAll(".draggable-item").length : 0);
    const excludedCount = typeof excludedCountOverride === "number" ? excludedCountOverride :
        (excludedZone ? excludedZone.querySelectorAll(".draggable-item").length : 0);

    const activeCountEl = document.getElementById("active-count");
    const excludedCountEl = document.getElementById("excluded-count");

    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (excludedCountEl) excludedCountEl.textContent = excludedCount;

    if (excludedZone) {
        if (excludedCount > 0) {
            if (placeholder) placeholder.style.display = "none";
            excludedZone.classList.remove("justify-center", "items-center");
        } else {
            if (placeholder) placeholder.style.display = "block";
            excludedZone.classList.add("justify-center", "items-center");
        }
    }
}

/**
 * Returns currently excluded feature keys from excluded zone
 */
export function getExcludedKeysFromDOM() {
    const excludedZone = document.getElementById("excluded-zone");
    if (!excludedZone) return [];
    const keys = [];
    excludedZone.querySelectorAll(".draggable-item[data-feat-key]").forEach((el) => {
        const k = el.getAttribute("data-feat-key");
        if (k) keys.push(k);
    });
    return keys;
}

/**
 * Sets up drag and drop event handlers on drop zones
 */
export function setupDragAndDrop(onDropAction) {
    const zones = document.querySelectorAll(".drop-zone");

    zones.forEach((zone) => {
        zone.addEventListener("dragover", (ev) => {
            ev.preventDefault();
            zone.classList.add("over");
        });

        zone.addEventListener("dragleave", (ev) => {
            if (ev.target === zone || !zone.contains(ev.relatedTarget)) {
                zone.classList.remove("over");
            }
        });

        zone.addEventListener("drop", (ev) => {
            ev.preventDefault();
            zone.classList.remove("over");

            const featKey = ev.dataTransfer.getData("text/plain");
            if (!featKey) return;

            const isExcluding = zone.id === "excluded-zone";
            if (typeof onDropAction === "function") {
                onDropAction(featKey, isExcluding);
            }
        });
    });
}

/* ==========================================================================
   Drawer: Set Fitur per Referral
   ========================================================================== */

export function openRefFeatDrawer() {
    const overlay = document.getElementById("refFeatOverlay");
    const drawer = document.getElementById("refFeatDrawer");
    if (overlay) overlay.classList.remove("hidden");
    if (drawer) drawer.classList.remove("translate-x-full");
}

export function closeRefFeatDrawer() {
    const overlay = document.getElementById("refFeatOverlay");
    const drawer = document.getElementById("refFeatDrawer");
    if (overlay) overlay.classList.add("hidden");
    if (drawer) drawer.classList.add("translate-x-full");
}

export function populateRefFeatDropdown(referrals = [], selectedCode = "") {
    const sel = document.getElementById("refFeatCodeSelect");
    if (!sel) return;

    sel.innerHTML = '<option value="">— Pilih kode referral —</option>';
    if (!referrals.length) {
        sel.innerHTML += "<option disabled>Belum ada data referral</option>";
        return;
    }

    referrals.forEach((r) => {
        const code = r.code || r.id || "";
        const label = r.ownerName ? `${code} — ${r.ownerName}` : code;
        if (!code) return;
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = label;
        if (selectedCode && selectedCode === code) opt.selected = true;
        sel.appendChild(opt);
    });
}

export function renderRefFeatChecklist(features = [], excludedKeys = []) {
    const wrap = document.getElementById("refFeatChecklistWrap");
    const empty = document.getElementById("refFeatEmpty");
    const hint = document.getElementById("refFeatCodeHint");
    const saveBtn = document.getElementById("refFeatSaveBtn");
    const container = document.getElementById("refFeatChecklist");

    if (!wrap || !empty || !container) return;

    wrap.classList.remove("hidden");
    empty.classList.add("hidden");
    if (hint) hint.classList.remove("hidden");
    if (saveBtn) saveBtn.disabled = false;

    container.innerHTML = "";

    features.forEach((feat) => {
        const isActive = !excludedKeys.includes(feat.key);
        const item = document.createElement("label");
        item.className = "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all " +
            (isActive
                ? "bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50"
                : "bg-rose-50/40 border-rose-100 hover:bg-rose-50/70");
        item.setAttribute("data-feat-key", feat.key);

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isActive;
        cb.value = feat.key;
        cb.className = "w-4 h-4 accent-indigo-600 flex-shrink-0";

        const icon = document.createElement("i");
        icon.className = "bx " + (isActive ? "bxs-check-circle text-emerald-500" : "bxs-x-circle text-rose-400") + " text-lg flex-shrink-0";

        cb.addEventListener("change", function () {
            if (cb.checked) {
                item.className = "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50";
                icon.className = "bx bxs-check-circle text-emerald-500 text-lg flex-shrink-0";
            } else {
                item.className = "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all bg-rose-50/40 border-rose-100 hover:bg-rose-50/70";
                icon.className = "bx bxs-x-circle text-rose-400 text-lg flex-shrink-0";
            }
        });

        const txt = document.createElement("span");
        txt.className = "text-sm font-semibold text-slate-700 flex-1";
        txt.textContent = feat.label;

        item.appendChild(cb);
        item.appendChild(icon);
        item.appendChild(txt);
        container.appendChild(item);
    });
}

export function renderRefFeatSavedList(referrals = [], features = [], onPreview) {
    const container = document.getElementById("refFeatSavedList");
    if (!container) return;

    const savedRefs = referrals.filter((r) => Array.isArray(r.excludedFeatures) && r.excludedFeatures.length > 0);
    if (!savedRefs.length) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = '<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Konfigurasi Tersimpan</p>';

    savedRefs.forEach((r) => {
        const code = r.code || "-";
        const excluded = r.excludedFeatures || [];
        const activeCount = features.length - excluded.length;
        const div = document.createElement("div");
        div.className = "flex items-center justify-between px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 mb-1.5";
        div.innerHTML = `
            <div>
                <span class="text-xs font-bold text-slate-700 font-mono">${code}</span>
                <span class="ml-2 text-[10px] text-slate-400">${activeCount} aktif, ${excluded.length} di-exclude</span>
            </div>
            <button type="button" class="btn-preview-config text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors">
                Preview
            </button>
        `;

        const prevBtn = div.querySelector(".btn-preview-config");
        if (prevBtn && typeof onPreview === "function") {
            prevBtn.addEventListener("click", () => onPreview(r));
        }

        container.appendChild(div);
    });
}

/* ==========================================================================
   Modal: Create & Edit Referral
   ========================================================================== */

export function openReferralModal() {
    const modal = document.getElementById("referralModal");
    if (modal) modal.classList.remove("hidden");
}

export function closeReferralModal() {
    const modal = document.getElementById("referralModal");
    if (modal) modal.classList.add("hidden");
}

export function populateProductCheckboxes(products = [], selectedIds = [], onChange) {
    const container = document.getElementById("rdRefProductOptions");
    const summary = document.getElementById("rdRefProductSummary");
    if (!container) return;

    container.innerHTML = "";
    if (!products.length) {
        container.innerHTML = '<p class="text-[11px] text-slate-400 p-2 text-center">Belum ada produk tersedia</p>';
        return;
    }

    products.forEach((p) => {
        const label = document.createElement("label");
        label.className = "flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = p.productId;
        cb.className = "w-4 h-4 accent-emerald-600 rounded";
        if (selectedIds.includes(p.productId)) cb.checked = true;

        cb.addEventListener("change", () => {
            if (typeof onChange === "function") {
                onChange(p.productId, cb.checked);
            }
        });

        const span = document.createElement("span");
        span.className = "text-sm font-semibold text-slate-700";
        span.textContent = p.name || p.productId;
        label.appendChild(cb);
        label.appendChild(span);
        container.appendChild(label);
    });

    if (summary) {
        if (!selectedIds.length) {
            summary.textContent = "Pilih minimal 1 product";
            summary.className = "text-sm text-slate-500";
        } else {
            summary.textContent = selectedIds.length + " product dipilih";
            summary.className = "text-sm text-emerald-600 font-bold";
        }
    }
}

export function populateCreationFeatureChecklist(features = [], excludedKeys = []) {
    const container = document.getElementById("creationRefFeatChecklist");
    if (!container) return;
    container.innerHTML = "";

    features.forEach((feat) => {
        const isExcluded = excludedKeys.includes(feat.key);
        const isActive = !isExcluded;

        const item = document.createElement("label");
        item.className = "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all " +
            (isActive ? "bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50" : "bg-rose-50/40 border-rose-100 hover:bg-rose-50/70");
        item.setAttribute("data-feat-key", feat.key);

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = isActive;
        cb.value = feat.key;
        cb.className = "w-4 h-4 accent-indigo-600 flex-shrink-0";

        const icon = document.createElement("i");
        icon.className = "bx " + (isActive ? "bxs-check-circle text-emerald-500" : "bxs-x-circle text-rose-400") + " text-lg flex-shrink-0";

        const txt = document.createElement("span");
        txt.className = "text-xs font-extrabold text-slate-700 flex-1 truncate";
        txt.textContent = feat.label;

        cb.addEventListener("change", () => {
            if (cb.checked) {
                item.className = "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all bg-emerald-50/60 border-emerald-100 hover:bg-emerald-50";
                icon.className = "bx bxs-check-circle text-emerald-500 text-lg flex-shrink-0";
            } else {
                item.className = "flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all bg-rose-50/40 border-rose-100 hover:bg-rose-50/70";
                icon.className = "bx bxs-x-circle text-rose-400 text-lg flex-shrink-0";
            }
        });

        item.appendChild(cb);
        item.appendChild(icon);
        item.appendChild(txt);
        container.appendChild(item);
    });
}

export function populateEditReferralForm(item, products = []) {
    const fields = {
        rdRefCode: item.code || "",
        rdRefMaxUsage: item.maxUsage || "",
        rdRefMonthsValid: item.monthsValid || "",
        rdRefUsedCount: item.usedCount || "",
        rdRefHolderType: item.holderType || "system",
        rdRefOwnerName: item.holderName || item.ownerName || "",
        rdRefFunctionType: item.functionType || ""
    };

    Object.keys(fields).forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = fields[id];
    });

    const holderType = document.getElementById("rdRefHolderType");
    const ownerWrapper = document.getElementById("rdRefOwnerNameWrapper");
    if (holderType && ownerWrapper) {
        ownerWrapper.classList.toggle("hidden", holderType.value !== "user");
    }

    const functionType = document.getElementById("rdRefFunctionType");
    const discountWrapper = document.getElementById("rdRefDiscountWrapper");
    const btnCalc = document.getElementById("btnOpenDiscountCalculator");
    if (functionType) {
        const isDiscount = functionType.value === "discount";
        if (discountWrapper) discountWrapper.classList.toggle("hidden", !isDiscount);
        if (btnCalc) btnCalc.classList.toggle("hidden", !isDiscount);
    }

    const rawPercent = item.discountPercent ?? item.discountPercentage;
    const rawAmount = item.discountAmount;
    const percentField = document.getElementById("rdRefDiscountPercent");
    const amountField = document.getElementById("rdRefDiscountAmount");

    if (percentField) percentField.value = rawPercent !== undefined && rawPercent !== null ? rawPercent : "";
    if (amountField) {
        if (rawAmount !== undefined && rawAmount !== null && rawAmount !== "") {
            const numericAmount = typeof rawAmount === "number" ? rawAmount : parseInt(String(rawAmount).replace(/\D/g, ""), 10);
            amountField.value = Number.isFinite(numericAmount) ? formatNumber(numericAmount) : "";
        } else {
            amountField.value = "";
        }
    }
}

export function resetReferralForm() {
    const fields = [
        "rdRefCode",
        "rdRefOwnerName",
        "rdRefDiscountPercent",
        "rdRefDiscountAmount",
        "rdRefMaxUsage",
        "rdRefMonthsValid",
        "rdRefUsedCount"
    ];
    fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    const holderType = document.getElementById("rdRefHolderType");
    const functionType = document.getElementById("rdRefFunctionType");
    const ownerWrapper = document.getElementById("rdRefOwnerNameWrapper");
    const discountWrapper = document.getElementById("rdRefDiscountWrapper");
    const btnCalc = document.getElementById("btnOpenDiscountCalculator");

    if (holderType) holderType.value = "system";
    if (functionType) functionType.value = "";
    if (ownerWrapper) ownerWrapper.classList.add("hidden");
    if (discountWrapper) discountWrapper.classList.add("hidden");
    if (btnCalc) btnCalc.classList.add("hidden");
}

export function showReferralStatus(msg, isError) {
    const statusText = document.getElementById("referralStatusText");
    if (!statusText) return;
    statusText.textContent = msg;
    statusText.className = "text-[10px] text-center mt-2 font-bold " + (isError ? "text-red-500" : "text-emerald-600");
    statusText.classList.remove("hidden");
    setTimeout(() => statusText.classList.add("hidden"), 4000);
}

/* ==========================================================================
   Modal: Daftar Referral (List & History)
   ========================================================================== */

export function openReferralListModal() {
    const modal = document.getElementById("referralListModal");
    if (modal) modal.classList.remove("hidden");
}

export function closeReferralListModal() {
    const modal = document.getElementById("referralListModal");
    if (modal) modal.classList.add("hidden");
}

export function renderReferralTable(referrals = [], invoices = [], filterStatus = "all", keyword = "", onToggleHistory, onEdit, onDelete) {
    const tbody = document.getElementById("refTableBody");
    const footer = document.getElementById("refFooterSummary");
    if (!tbody) return;

    tbody.innerHTML = "";
    const cleanKeyword = (keyword || "").toLowerCase();
    let visibleCount = 0;

    const sorted = [...referrals].sort((a, b) => {
        const ta = a.createdAtMs || a.createdAt || 0;
        const tb = b.createdAtMs || b.createdAt || 0;
        return tb - ta;
    });

    sorted.forEach((r, idx) => {
        const originalIdx = referrals.indexOf(r);
        const ownerLabel = getReferralOwnerLabel(r);
        const initials = getReferralInitials(r);
        const functionLabel = getReferralFunctionLabel(r);
        const max = parseInt(r.maxUsage || 0, 10);

        const usedInvoices = invoices.filter((inv) => {
            const codeInv = (inv.referralCode || "").toUpperCase();
            const codeRef = (r.code || "").toUpperCase();
            if (!(codeInv && codeRef && codeInv === codeRef)) return false;
            return (typeof inv.paidAtMs === "number" && inv.paidAtMs > 0) ||
                (typeof inv.paidAmount === "number" && inv.paidAmount > 0);
        });

        const used = usedInvoices.length;
        const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
        const expiryMeta = getReferralExpiryMeta(r);

        if (filterStatus === "active" && !expiryMeta.isActive) return;
        if (filterStatus === "expired" && expiryMeta.isActive) return;
        if (cleanKeyword) {
            const haystack = [r.code || "", ownerLabel].join(" ").toLowerCase();
            if (haystack.indexOf(cleanKeyword) === -1) return;
        }

        visibleCount++;
        const historyId = "refHistory-" + originalIdx;

        const baseRow = document.createElement("tr");
        baseRow.className = expiryMeta.isActive
            ? "group hover:bg-slate-50/50 transition-all border-b border-slate-50"
            : "group hover:bg-slate-50/50 transition-all opacity-60 border-b border-slate-50";

        baseRow.innerHTML = `
            <td class="p-4">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full ${expiryMeta.isActive ? "bg-blue-100 text-blue-600" : "bg-slate-200 text-slate-600"} flex items-center justify-center font-bold text-xs">
                        ${initials}
                    </div>
                    <div>
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-tight">${ownerLabel}</p>
                        <p class="text-base font-extrabold text-slate-800 font-mono tracking-wider">${r.code || "-"}</p>
                        ${functionLabel ? `<p class="text-[10px] font-semibold text-emerald-600 mt-1 uppercase tracking-widest">${functionLabel}</p>` : ""}
                    </div>
                </div>
            </td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="text-sm font-bold text-slate-700 italic">${expiryMeta.expiryLabel}</span>
                    ${expiryMeta.statusLabel ? `<span class="text-[10px] font-bold ${expiryMeta.isActive ? "text-emerald-500 bg-emerald-50" : "text-red-500 bg-red-50"} px-2 py-0.5 rounded-full w-fit mt-1 uppercase tracking-tighter">${expiryMeta.statusLabel}</span>` : ""}
                </div>
            </td>
            <td class="p-4">
                <div class="w-full max-w-[140px]">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs font-extrabold text-slate-700">${used} / ${max}</span>
                        <span class="text-[10px] text-slate-400 font-bold">${percent}%</span>
                    </div>
                    <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div class="progress-bar h-full ${expiryMeta.isActive ? "bg-emerald-500" : "bg-slate-400"}" style="width: ${percent}%;"></div>
                    </div>
                </div>
            </td>
            <td class="p-4">
                <div class="flex items-center justify-center gap-2">
                    <button type="button" data-history-id="${historyId}" class="btn-toggle-history w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white transition-all" title="Lihat Riwayat Invoice">
                        <i class="bi bi-clock-history"></i>
                    </button>
                    <button type="button" data-idx="${originalIdx}" class="btn-edit-ref w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-amber-500 hover:text-white transition-all" title="Edit Referral">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button type="button" data-idx="${originalIdx}" class="btn-delete-ref w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-rose-500 hover:text-white transition-all" title="Hapus Referral">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;

        // Event listeners for action buttons
        const histBtn = baseRow.querySelector(".btn-toggle-history");
        const editBtn = baseRow.querySelector(".btn-edit-ref");
        const delBtn = baseRow.querySelector(".btn-delete-ref");

        if (histBtn) {
            histBtn.addEventListener("click", () => {
                if (typeof onToggleHistory === "function") onToggleHistory(historyId);
            });
        }
        if (editBtn) {
            editBtn.addEventListener("click", () => {
                if (typeof onEdit === "function") onEdit(r, originalIdx);
            });
        }
        if (delBtn) {
            delBtn.addEventListener("click", () => {
                if (typeof onDelete === "function") onDelete(r, originalIdx);
            });
        }

        tbody.appendChild(baseRow);

        // History row
        const historyRow = document.createElement("tr");
        historyRow.id = historyId;
        historyRow.className = "hidden bg-slate-50/80";

        let historyItemsHtml = "";
        if (usedInvoices.length) {
            usedInvoices.sort((a, b) => (b.paidAtMs || 0) - (a.paidAtMs || 0));
            const slice = usedInvoices.slice(0, 4);
            slice.forEach((inv) => {
                const invNumber = inv.invoiceNumber || ("#" + (inv.id || ""));
                const customer = inv.leadName || "-";
                historyItemsHtml += `
                    <div class="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                        <div>
                            <p class="text-xs font-bold text-slate-800">${invNumber}</p>
                            <p class="text-[10px] text-slate-500 font-medium">Customer: ${customer}</p>
                        </div>
                    </div>
                `;
            });
            if (usedInvoices.length > 4) {
                historyItemsHtml += `<p class="text-[10px] text-slate-400 text-center mt-2 italic">+ ${usedInvoices.length - 4} lainnya</p>`;
            }
        } else {
            historyItemsHtml = '<p class="text-[11px] text-slate-500 col-span-2">Belum ada invoice yang tercatat menggunakan kode ini.</p>';
        }

        historyRow.innerHTML = `
            <td colspan="4" class="p-6">
                <div class="bg-white rounded-2xl border border-slate-200 p-5 shadow-inner">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-widest"><i class="bi bi-clock-history mr-2 text-blue-500"></i> Riwayat Penggunaan Invoice</h4>
                        <span class="text-[10px] font-bold text-slate-400 italic">Digunakan di ${usedInvoices.length} Invoice</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        ${historyItemsHtml}
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(historyRow);
    });

    if (footer) {
        footer.textContent = `Referral Terdaftar: ${referrals.length} • Ditampilkan: ${visibleCount}`;
    }
}

/* ==========================================================================
   Popup: Duplikat System Default Warning
   ========================================================================== */

export function checkAndShowSystemDefaultPopup(referrals = [], onOpenList) {
    const systemRefs = referrals.filter((r) => {
        const type = (r.holderType || "system").toLowerCase();
        return type === "system";
    });

    const productConflict = {};
    systemRefs.forEach((r) => {
        const products = Array.isArray(r.products) ? r.products : [];
        products.forEach((pid) => {
            if (!productConflict[pid]) productConflict[pid] = [];
            productConflict[pid].push(r);
        });
    });

    const conflictingRefsSet = new Set();
    Object.keys(productConflict).forEach((pid) => {
        if (productConflict[pid].length > 1) {
            productConflict[pid].forEach((r) => conflictingRefsSet.add(r));
        }
    });

    if (conflictingRefsSet.size === 0) return;

    const systemDefaults = Array.from(conflictingRefsSet);
    const listContainer = document.getElementById("sysDefaultCodeList");
    const countBadge = document.getElementById("sysDefaultCount");
    const popup = document.getElementById("sysDefaultPopup");

    if (!listContainer || !popup) return;

    if (countBadge) countBadge.textContent = systemDefaults.length;
    listContainer.innerHTML = "";

    systemDefaults.forEach((r) => {
        const code = r.code || "-";
        const funcLabel = r.functionType === "discount"
            ? `Discount ${r.discountPercent || 0}%`
            : (r.functionType || "-");
        const el = document.createElement("div");
        el.className = "flex items-center justify-between p-3 bg-white rounded-xl border border-amber-100";
        el.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                    <i class="bi bi-ticket-perforated text-sm"></i>
                </div>
                <div>
                    <p class="text-sm font-extrabold text-slate-800 font-mono tracking-wider">${code}</p>
                    <p class="text-[10px] text-slate-400 font-medium">${funcLabel}</p>
                </div>
            </div>
            <span class="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 rounded-full border border-amber-200">System</span>
        `;
        listContainer.appendChild(el);
    });

    const btnOpen = popup.querySelector(".btn-open-list-from-popup");
    if (btnOpen && typeof onOpenList === "function") {
        btnOpen.onclick = () => {
            closeSysDefaultPopup();
            onOpenList();
        };
    }

    popup.classList.remove("hidden");
}

export function closeSysDefaultPopup() {
    const popup = document.getElementById("sysDefaultPopup");
    if (popup) popup.classList.add("hidden");
}
