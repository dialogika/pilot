/**
 * Class Availability UI Presentation Layer
 * Pure DOM presentation logic (Zero direct Firebase queries).
 */

export function formatDate(dateStr) {
    if (!dateStr || dateStr === 'Flexible') return dateStr || 'Flexible';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;

        const day = date.getDate();
        const month = date.toLocaleString('id-ID', { month: 'short' });
        const hour = date.getHours().toString().padStart(2, '0');
        const minute = date.getMinutes().toString().padStart(2, '0');
        const ampm = date.getHours() >= 12 ? 'PM' : 'AM';

        return `${day} ${month}, ${hour}:${minute} ${ampm}`;
    } catch (e) {
        return dateStr;
    }
}

export function formatCurrency(val) {
    if (!val && val !== 0) return "";
    return new Intl.NumberFormat('id-ID').format(val);
}

export function parseCurrency(val) {
    if (!val) return 0;
    const digits = String(val).replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
}

export function isBatchClosed(item) {
    if (!item || !item.start_date || item.start_date === 'Flexible') return false;
    try {
        const date = new Date(item.start_date);
        if (isNaN(date.getTime())) return false;
        return date.getTime() < Date.now();
    } catch (e) {
        return false;
    }
}

export function getSeatsLeft(item) {
    const max = Number(item && item.max_seat ? item.max_seat : 0);
    const joined = Number(item && item.current_joined ? item.current_joined : 0);
    return Math.max(0, max - joined);
}

export function getBatchStatus(item) {
    if (!item) return "Open";
    if (isBatchClosed(item)) return "Closed";
    const seatsLeft = (Number(item.max_seat) || 0) - (Number(item.current_joined) || 0);
    if (seatsLeft <= 0) return "Full";
    if (seatsLeft <= 2) return "Almost Full";
    return "Open";
}

export function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Updates a single card's DOM in-place without triggering list re-rendering or scroll jumps.
 * @param {HTMLElement} cardEl
 * @param {Object} item
 */
export function updateCardStepperDOM(cardEl, item) {
    if (!cardEl || !item) return;

    const closed = isBatchClosed(item);
    const seatsLeft = (Number(item.max_seat) || 0) - (Number(item.current_joined) || 0);
    const isDimmed = closed || item.current_joined >= item.max_seat;

    // Toggle dimmed opacity class
    if (isDimmed) {
        cardEl.classList.add("opacity-50", "grayscale", "bg-slate-50");
    } else {
        cardEl.classList.remove("opacity-50", "grayscale", "bg-slate-50");
    }

    // Update Seats Left number box
    const seatBox = cardEl.querySelector(".seat-box");
    if (seatBox) {
        seatBox.className = "seat-box w-32 h-24 flex flex-col items-center justify-center rounded-[20px] transition group-hover:scale-105";
        if (seatsLeft > 2 && !closed) {
            seatBox.classList.add("bg-emerald-50", "text-emerald-600");
        } else if (seatsLeft > 0 && seatsLeft <= 2 && !closed) {
            seatBox.classList.add("bg-rose-50", "text-rose-600");
        } else {
            seatBox.classList.add("bg-slate-100", "text-slate-400");
        }

        const seatNumEl = seatBox.querySelector(".seat-number");
        if (seatNumEl) {
            seatNumEl.textContent = String(Math.max(0, seatsLeft));
        }
    }

    // Update Joined / Max text
    const joinedEl = cardEl.querySelector(".joined-counter");
    if (joinedEl) {
        joinedEl.textContent = String(item.current_joined);
    }
    const maxEl = cardEl.querySelector(".max-counter");
    if (maxEl) {
        maxEl.textContent = String(item.max_seat);
    }

    // Update Status column
    const statusCol = cardEl.querySelector(".status-col");
    if (statusCol) {
        if (closed) {
            statusCol.innerHTML = `
                <div class="flex flex-col items-end uppercase leading-tight">
                    <span class="text-[10px] font-black text-slate-400 tracking-[0.15em]">Closed</span>
                    <span class="text-[11px] font-black text-slate-500 tracking-widest">Kelas Ditutup</span>
                </div>
            `;
        } else if (seatsLeft <= 0) {
            statusCol.innerHTML = `
                <div class="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">Sold Out</div>
            `;
        } else if (seatsLeft <= 2) {
            statusCol.innerHTML = `
                <div class="flex flex-col items-end uppercase leading-tight">
                    <span class="text-[10px] font-black text-rose-500 tracking-[0.15em] animate-pulse italic">Hot Alert</span>
                    <span class="text-[11px] font-black text-slate-800 tracking-widest">Hampir Habis</span>
                </div>
            `;
        } else {
            statusCol.innerHTML = `
                <div class="flex flex-col items-end uppercase leading-tight">
                    <span class="text-[10px] font-black text-emerald-500 tracking-[0.15em]">Ready to Sell</span>
                    <span class="text-[11px] font-black text-slate-800 tracking-widest">Open Batch</span>
                </div>
            `;
        }
    }
}

/**
 * Renders the class availability list into container.
 */
export function renderClassList({
    container,
    items,
    selectedIds = [],
    onToggleSelect,
    onToggleSelectAll,
    onStepJoined,
    onEdit,
    onDelete
}) {
    if (!container) return;
    container.innerHTML = "";

    if (!items || items.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12 bg-white rounded-[24px] border-2 border-dashed border-slate-200 shadow-sm">
                <div class="mb-3">
                    <svg class="w-12 h-12 text-slate-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                </div>
                <p class="text-slate-500 font-medium">Belum ada data kelas yang tersedia.</p>
                <p class="text-slate-400 text-sm">Silakan sesuaikan filter atau tambahkan batch baru untuk memulai.</p>
            </div>
        `;
        return;
    }

    // Header bar
    const availableToSelect = items.filter(c => !c.is_planned);
    const isAllSelected = availableToSelect.length > 0 && selectedIds.length >= availableToSelect.length;

    const headerDiv = document.createElement("div");
    headerDiv.className = "px-4 py-2 flex items-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-400";
    headerDiv.innerHTML = `
        <div class="w-8 flex justify-center">
            <input type="checkbox" id="selectAllCheckbox" ${isAllSelected ? "checked" : ""} class="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
        </div>
        <div class="w-32 text-center">Available</div>
        <div class="flex-grow ml-4">Class Details</div>
        <div class="w-32 text-center">Type</div>
        <div class="w-48 text-center">Registration</div>
        <div class="w-32 text-right">Status</div>
        <div class="w-24 text-center">Action</div>
    `;

    const selectAllBox = headerDiv.querySelector("#selectAllCheckbox");
    if (selectAllBox) {
        selectAllBox.addEventListener("change", (e) => {
            onToggleSelectAll(e.target.checked);
        });
    }

    container.appendChild(headerDiv);

    // Render items
    items.forEach((item) => {
        const closed = isBatchClosed(item);
        const seatsLeft = (Number(item.max_seat) || 0) - (Number(item.current_joined) || 0);
        const isDimmed = closed || item.current_joined >= item.max_seat;
        const isChecked = selectedIds.includes(item.id);

        let seatColorClass = "bg-slate-100 text-slate-400";
        if (seatsLeft > 2 && !closed) {
            seatColorClass = "bg-emerald-50 text-emerald-600";
        } else if (seatsLeft > 0 && seatsLeft <= 2 && !closed) {
            seatColorClass = "bg-rose-50 text-rose-600";
        }

        let typeBadgeClass = "bg-orange-50 text-orange-600 border-orange-100";
        if (item.type === "Online") {
            typeBadgeClass = "bg-blue-50 text-blue-600 border-blue-100";
        } else if (item.type === "Private") {
            typeBadgeClass = "bg-purple-50 text-purple-600 border-purple-100";
        }

        let statusHtml = "";
        if (closed) {
            statusHtml = `
                <div class="flex flex-col items-end uppercase leading-tight">
                    <span class="text-[10px] font-black text-slate-400 tracking-[0.15em]">Closed</span>
                    <span class="text-[11px] font-black text-slate-500 tracking-widest">Kelas Ditutup</span>
                </div>
            `;
        } else if (seatsLeft <= 0) {
            statusHtml = `
                <div class="text-xs font-black text-slate-400 uppercase tracking-widest leading-tight">Sold Out</div>
            `;
        } else if (seatsLeft <= 2) {
            statusHtml = `
                <div class="flex flex-col items-end uppercase leading-tight">
                    <span class="text-[10px] font-black text-rose-500 tracking-[0.15em] animate-pulse italic">Hot Alert</span>
                    <span class="text-[11px] font-black text-slate-800 tracking-widest">Hampir Habis</span>
                </div>
            `;
        } else {
            statusHtml = `
                <div class="flex flex-col items-end uppercase leading-tight">
                    <span class="text-[10px] font-black text-emerald-500 tracking-[0.15em]">Ready to Sell</span>
                    <span class="text-[11px] font-black text-slate-800 tracking-widest">Open Batch</span>
                </div>
            `;
        }

        const card = document.createElement("div");
        card.setAttribute("data-class-id", item.id);
        card.className = `row-transition bg-white border border-slate-200 rounded-[24px] p-2 flex items-center shadow-sm hover:shadow-xl hover:border-indigo-200 group mb-3 ${isDimmed ? "opacity-50 grayscale bg-slate-50" : ""}`;

        card.innerHTML = `
            <div class="w-10 flex justify-center pl-2">
                <input type="checkbox" value="${item.id}" ${isChecked ? "checked" : ""} ${item.is_planned ? "disabled" : ""} class="row-select-checkbox w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
            </div>
            
            <div class="seat-box w-32 h-24 flex flex-col items-center justify-center rounded-[20px] transition group-hover:scale-105 ${seatColorClass}">
                <span class="seat-number mono text-5xl leading-none font-bold">${Math.max(0, seatsLeft)}</span>
                <span class="text-[10px] font-black uppercase mt-1 tracking-widest">Seats</span>
            </div>

            <div class="flex-grow px-6">
                <div class="text-xl font-extrabold text-slate-800 mb-1 group-hover:text-indigo-600 transition">${escapeHtml(item.name)}</div>
                <div class="flex items-center gap-4 text-sm font-semibold">
                    <div class="flex items-center gap-1.5 text-slate-500">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                        <span>${formatDate(item.start_date)}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-indigo-500/80">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span>${escapeHtml(item.mentor_name)}</span>
                    </div>
                </div>
                ${item.product_name || item.product_id ? `
                    <div class="mt-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                        <span class="uppercase tracking-[0.16em]">Product</span>
                        <span class="mono text-[10px] text-slate-500">${escapeHtml(item.product_name || item.product_id)}</span>
                    </div>
                ` : ""}
                ${item.is_planned ? `
                    <div class="mt-2">
                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-widest border border-indigo-100">Sudah Masuk Perencanaan</span>
                    </div>
                ` : ""}
            </div>

            <div class="w-32 text-center">
                <span class="px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm border ${typeBadgeClass}">
                    ${escapeHtml(item.type)}
                </span>
            </div>

            <div class="w-48 px-4 flex flex-col items-center gap-2">
                <div class="flex items-center bg-slate-100 p-1 rounded-xl">
                    <button type="button" class="btn-step-minus w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-rose-500 hover:text-white transition group/btn cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4"/></svg>
                    </button>
                    <div class="px-4 text-center select-none">
                        <span class="joined-counter mono font-bold text-slate-800">${item.current_joined}</span>
                        <span class="text-slate-400 font-bold">/</span>
                        <span class="max-counter text-slate-400 font-bold text-xs">${item.max_seat}</span>
                    </div>
                    <button type="button" class="btn-step-plus w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-emerald-500 hover:text-white transition cursor-pointer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/></svg>
                    </button>
                </div>
            </div>

            <div class="status-col w-32 pr-8 text-right">
                ${statusHtml}
            </div>

            <div class="w-24 flex items-center justify-center gap-2 border-l border-slate-100 pl-2">
                <button type="button" class="btn-edit-batch p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer" title="Edit Batch">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                </button>
                <button type="button" class="btn-delete-batch p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer" title="Delete Batch">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        `;

        // Event bindings
        const chk = card.querySelector(".row-select-checkbox");
        if (chk) {
            chk.addEventListener("change", () => {
                onToggleSelect(item.id, chk.checked);
            });
        }

        const btnMinus = card.querySelector(".btn-step-minus");
        if (btnMinus) {
            btnMinus.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                onStepJoined(item, -1, card);
            });
        }

        const btnPlus = card.querySelector(".btn-step-plus");
        if (btnPlus) {
            btnPlus.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                onStepJoined(item, 1, card);
            });
        }

        const btnEdit = card.querySelector(".btn-edit-batch");
        if (btnEdit) {
            btnEdit.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(item);
            });
        }

        const btnDelete = card.querySelector(".btn-delete-batch");
        if (btnDelete) {
            btnDelete.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(item);
            });
        }

        container.appendChild(card);
    });
}

/**
 * Renders the pagination controls.
 */
export function renderPagination({ currentPage, pageSize, totalItems }, onPageChange, onPageSizeChange) {
    const container = document.getElementById("classAvailabilityPagination");
    if (!container) return;

    if (totalItems === 0) {
        container.innerHTML = "";
        container.classList.add("hidden");
        return;
    }
    container.classList.remove("hidden");

    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    let pagesHtml = "";
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    // Prev button
    const prevDisabled = currentPage === 1;
    pagesHtml += `
        <button type="button" class="pagination-btn ${prevDisabled ? "disabled" : ""}" data-page="${currentPage - 1}" ${prevDisabled ? "disabled" : ""} title="Halaman Sebelumnya">
            <i class="bi bi-chevron-left text-[11px]"></i>
        </button>
    `;

    if (startPage > 1) {
        pagesHtml += `<button type="button" class="pagination-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            pagesHtml += `<span class="px-1 text-slate-400 font-bold">...</span>`;
        }
    }

    for (let p = startPage; p <= endPage; p++) {
        const isActive = p === currentPage;
        pagesHtml += `
            <button type="button" class="pagination-btn ${isActive ? "active" : ""}" data-page="${p}">
                ${p}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pagesHtml += `<span class="px-1 text-slate-400 font-bold">...</span>`;
        }
        pagesHtml += `<button type="button" class="pagination-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    // Next button
    const nextDisabled = currentPage === totalPages;
    pagesHtml += `
        <button type="button" class="pagination-btn ${nextDisabled ? "disabled" : ""}" data-page="${currentPage + 1}" ${nextDisabled ? "disabled" : ""} title="Halaman Berikutnya">
            <i class="bi bi-chevron-right text-[11px]"></i>
        </button>
    `;

    container.innerHTML = `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full pt-4 pb-2 border-t border-slate-200">
            <div class="flex items-center gap-3">
                <div class="text-xs text-slate-500 font-medium">
                    Menampilkan <span class="font-bold text-slate-800">${start}</span> - <span class="font-bold text-slate-800">${end}</span> dari <span class="font-bold text-slate-800">${totalItems}</span> kelas
                </div>
                <div class="flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Baris per halaman:</span>
                    <select id="selectPageSize" class="py-1 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-sm">
                        <option value="10" ${pageSize === 10 ? "selected" : ""}>10</option>
                        <option value="25" ${pageSize === 25 ? "selected" : ""}>25</option>
                        <option value="50" ${pageSize === 50 ? "selected" : ""}>50</option>
                        <option value="100" ${pageSize === 100 ? "selected" : ""}>100</option>
                    </select>
                </div>
            </div>
            <div class="flex items-center gap-1" id="paginationButtonList">
                ${pagesHtml}
            </div>
        </div>
    `;

    const sizeSelect = container.querySelector("#selectPageSize");
    if (sizeSelect) {
        sizeSelect.addEventListener("change", (e) => {
            onPageSizeChange(parseInt(e.target.value, 10));
        });
    }

    const btnList = container.querySelector("#paginationButtonList");
    if (btnList) {
        btnList.querySelectorAll(".pagination-btn[data-page]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const p = parseInt(btn.getAttribute("data-page"), 10);
                if (p >= 1 && p <= totalPages && p !== currentPage) {
                    onPageChange(p);
                }
            });
        });
    }
}

/**
 * Populates Product dropdown elements.
 */
export function populateProductDropdown(selectEl, products, selectedVal = "", includeCustom = false) {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="">Pilih product</option>`;
    if (includeCustom) {
        selectEl.innerHTML += `<option value="__custom__" ${selectedVal === "__custom__" ? "selected" : ""}>Custom (Input Manual)</option>`;
    }
    products.forEach((p) => {
        const isSel = p.productId === selectedVal;
        selectEl.innerHTML += `<option value="${escapeHtml(p.productId)}" ${isSel ? "selected" : ""}>${escapeHtml(p.name || p.productId)}</option>`;
    });
}

/**
 * Populates Mentor dropdown elements.
 */
export function populateMentorDropdown(selectEl, mentors, selectedVal = "") {
    if (!selectEl) return;
    selectEl.innerHTML = `<option value="Unknown">Unknown (Pilih Nanti)</option>`;
    mentors.forEach((m) => {
        const isSel = m.name === selectedVal;
        selectEl.innerHTML += `<option value="${escapeHtml(m.name)}" ${isSel ? "selected" : ""}>${escapeHtml(m.name)}</option>`;
    });
}

export function openModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
}

export function closeModal(modalId) {
    const modalEl = document.getElementById(modalId);
    if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }
}

export function renderPlanSummaryModal({ valid = [], invalid = [] }) {
    const alertInfo = document.getElementById("planAlertInfo");
    const alertDanger = document.getElementById("planAlertDanger");
    const validCountSpan = document.getElementById("planValidCount");
    const invalidCountSpan = document.getElementById("planInvalidCount");
    const validListUl = document.getElementById("planValidList");
    const invalidListUl = document.getElementById("planInvalidList");
    const validSection = document.getElementById("planValidSection");
    const invalidSection = document.getElementById("planInvalidSection");
    const confirmBtn = document.getElementById("confirmPlanMoveBtn");

    if (alertInfo) {
        alertInfo.style.display = valid.length > 0 ? "block" : "none";
    }
    if (validCountSpan) validCountSpan.textContent = String(valid.length);

    if (alertDanger) {
        alertDanger.style.display = invalid.length > 0 ? "block" : "none";
    }
    if (invalidCountSpan) invalidCountSpan.textContent = String(invalid.length);

    if (validSection) validSection.style.display = valid.length > 0 ? "block" : "none";
    if (validListUl) {
        validListUl.innerHTML = valid.map(c => `<li>${escapeHtml(c.name)} (${escapeHtml(c.mentor_name)})</li>`).join("");
    }

    if (invalidSection) invalidSection.style.display = invalid.length > 0 ? "block" : "none";
    if (invalidListUl) {
        invalidListUl.innerHTML = invalid.map(c => `<li class="text-rose-600">${escapeHtml(c.name)} - Alasan: ${escapeHtml(c.reason)}</li>`).join("");
    }

    if (confirmBtn) {
        confirmBtn.disabled = valid.length === 0;
        confirmBtn.innerHTML = `Pindahkan ${valid.length} Kelas`;
    }
}

export function showToast(message, type = "info") {
    let container = document.getElementById("dg-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "dg-toast-container";
        container.className = "fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white transition-all transform duration-300 translate-y-4 opacity-0 ${
        type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-slate-800"
    }`;
    toast.innerHTML = `
        <i class="bi ${type === "success" ? "bi-check-circle" : type === "error" ? "bi-exclamation-triangle" : "bi-info-circle"} text-sm"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-4", "opacity-0");
    });

    setTimeout(() => {
        toast.classList.add("translate-y-4", "opacity-0");
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
