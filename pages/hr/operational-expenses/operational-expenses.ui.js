// pages/hr/operational-expenses/operational-expenses.ui.js
// =====================================================================
// PRESENTATION LAYER: OPERATIONAL EXPENSES
// Pure DOM rendering, templating, and view formatting.
// Zero Firebase or Firestore operations.
// =====================================================================

export const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

export const formatDateLabel = (dateValue) => {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(d);
};

export const formatDateTimeLabel = (timestamp) => {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
};

export const formatCategory = (category) => {
  const map = {
    mentor_salary: "Mentor Salary",
    operational: "Operational",
    reimburse: "Reimburse",
    tools: "Tools",
    transport: "Transport",
    other: "Other"
  };
  return map[category] || category || "Other";
};

export const displayStatus = (expense) => {
  const normalized = String(expense.status || "").toLowerCase();
  if (["paid", "complete", "rejected"].includes(normalized)) {
    return expense.status;
  }
  if (expense.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(expense.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) {
      return "overdue";
    }
  }
  return expense.status;
};

export const statusBadgeClass = (status) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "overdue") return "status-overdue";
  if (normalized === "paid") return "status-paid";
  if (normalized === "complete") return "status-complete";
  if (normalized === "reviewing") return "status-reviewing";
  if (normalized === "rejected") return "status-rejected";
  return "status-requested";
};

export const isImageUrl = (url) =>
  /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(String(url || ""));

/**
 * Updates the 5 stat cards with aggregate numbers.
 */
export function renderStats(stats) {
  const totalEl = document.getElementById("statTotal");
  const pendingEl = document.getElementById("statPending");
  const overdueEl = document.getElementById("statOverdue");
  const paidEl = document.getElementById("statPaid");
  const amountEl = document.getElementById("statAmount");

  if (totalEl) totalEl.textContent = stats.total ?? 0;
  if (pendingEl) pendingEl.textContent = stats.pending ?? 0;
  if (overdueEl) overdueEl.textContent = stats.overdue ?? 0;
  if (paidEl) paidEl.textContent = stats.paid ?? 0;
  if (amountEl) amountEl.textContent = `Rp ${formatCurrency(stats.amount ?? 0)}`;
}

/**
 * Renders the expense table rows and updates sort headers.
 */
export function renderTable(
  items,
  { sortKey = "", sortDirection = "asc", onOpenDetail, onMarkReviewing, onSendWhatsapp }
) {
  const tbody = document.getElementById("expenseTableBody");
  const counterEl = document.getElementById("visibleItemsCount");
  if (counterEl) {
    counterEl.textContent = `${items.length} item terlihat`;
  }
  if (!tbody) return;

  // Update sort icons on table headers
  const headers = ["request", "destination", "amount", "notes", "status"];
  headers.forEach((key) => {
    const icon = document.getElementById(`sortIcon-${key}`);
    if (icon) {
      if (sortKey === key) {
        icon.className = sortDirection === "asc"
          ? "bi bi-chevron-up sort-icon is-active"
          : "bi bi-chevron-down sort-icon is-active";
      } else {
        icon.className = "bi bi-arrow-down-up sort-icon";
      }
    }
  });

  if (!items.length) {
    const hasDateFilter = !!options.activeDate;
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state py-5">
            <i class="bi ${hasDateFilter ? "bi-calendar-x" : "bi-wallet2"} text-3xl block mb-2 text-slate-300"></i>
            <div class="font-bold text-slate-700 mb-1">
              ${hasDateFilter ? "Belum ada expense request pada tanggal ini" : "Belum ada expense request yang sesuai filter"}
            </div>
            <div class="text-xs text-slate-400 mb-3">
              ${hasDateFilter ? "Klik tombol di bawah atau klik ulang pill tanggal untuk menampilkan semua data." : "Buat request baru atau sesuaikan kata kunci pencarian."}
            </div>
            ${
              hasDateFilter
                ? `<button type="button" id="btnEmptyResetDate" class="btn btn-sm btn-outline-primary rounded-pill px-3 py-1 text-xs font-bold">
                     Tampilkan Semua Data
                   </button>`
                : ""
            }
          </div>
        </td>
      </tr>
    `;
    const resetBtn = document.getElementById("btnEmptyResetDate");
    if (resetBtn && typeof options.onClearDate === "function") {
      resetBtn.addEventListener("click", options.onClearDate);
    }
    return;
  }

  tbody.innerHTML = items
    .map((expense) => {
      const statusText = displayStatus(expense);
      const badgeCls = statusBadgeClass(statusText);
      const isPaidOrComplete = expense.status === "paid" || expense.status === "complete";
      const canReview = !isPaidOrComplete;
      const canSendWa =
        expense.category === "mentor_salary" &&
        expense.status === "paid" &&
        !!expense.transferProofUrl;

      const proofLink = expense.transferProofUrl
        ? `<a href="${expense.transferProofUrl}" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 text-decoration-none">
             <i class="bi bi-paperclip"></i> Lihat Bukti TF
           </a>`
        : `<span class="text-xs font-bold text-slate-300">Belum ada bukti transfer</span>`;

      const reimburseDocLink = expense.reimburseProofUrl
        ? `<div class="note-box mt-2">
             <div class="text-[10px] uppercase tracking-[0.16em] font-black text-slate-400 mb-1">Dokumen Pendukung</div>
             <div class="text-xs">
               <a href="${expense.reimburseProofUrl}" target="_blank" class="font-bold text-blue-600 hover:text-blue-800 text-decoration-none">
                 <i class="bi bi-file-earmark-text"></i> Lihat Dokumen
               </a>
             </div>
           </div>`
        : "";

      const waLink =
        expense.status === "complete" && expense.whatsappLink
          ? `<div class="text-xs mt-1">
               <a href="${expense.whatsappLink}" target="_blank" class="font-bold text-emerald-600 hover:text-emerald-700 text-decoration-none">
                 <i class="bi bi-whatsapp"></i> Buka WA Mentor
               </a>
             </div>`
          : "";

      return `
        <tr data-expense-id="${expense.id}">
          <td>
            <div class="d-flex flex-column gap-1.5" style="max-width: 320px;">
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="text-sm font-black text-slate-900">${expense.title || "-"}</span>
                <span class="badge-pill ${badgeCls}">${statusText}</span>
              </div>
              <div class="text-[11px] text-slate-500 uppercase tracking-wider font-bold">
                ${formatCategory(expense.category)} • ${expense.department || "General"}
              </div>
              <div class="text-xs text-slate-600">
                PIC: <span class="font-bold text-slate-800">${expense.requesterName || "-"}</span>
              </div>
              ${
                expense.relatedClass || expense.mentorName
                  ? `<div class="text-xs text-slate-500">
                       ${expense.relatedClass || "-"}${expense.mentorName ? ` • Mentor: ${expense.mentorName}` : ""}
                     </div>`
                  : ""
              }
              <div class="mono text-[11px] text-slate-400">#${expense.id}</div>
            </div>
          </td>
          <td>
            <div class="d-flex flex-column gap-1" style="max-width: 240px;">
              <div class="text-sm font-bold text-slate-800">${expense.beneficiaryName || "-"}</div>
              <div class="text-xs text-slate-500 font-medium">${expense.bankName || "-"}</div>
              <div class="mono text-xs text-slate-700">${expense.accountNumber || "-"}</div>
              <div class="mt-1">${proofLink}</div>
            </div>
          </td>
          <td>
            <div class="d-flex flex-column gap-1">
              <div class="text-base font-black text-slate-900">Rp ${formatCurrency(expense.amount)}</div>
              <div class="text-xs text-slate-500">Due: ${formatDateLabel(expense.dueDate)}</div>
              ${
                expense.paidAtMs
                  ? `<div class="text-xs text-emerald-600 font-bold">Paid: ${formatDateTimeLabel(expense.paidAtMs)}</div>`
                  : ""
              }
            </div>
          </td>
          <td>
            <div class="d-flex flex-column gap-2" style="max-width: 300px;">
              <div class="note-box">
                <div class="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">Notes / Penjelasan</div>
                <div class="text-xs text-slate-600 leading-normal">${expense.notes || "Belum ada penjelasan tambahan."}</div>
              </div>
              ${
                expense.paymentNotes
                  ? `<div class="note-box">
                       <div class="text-[10px] uppercase tracking-wider font-black text-slate-400 mb-1">Treasurer Note</div>
                       <div class="text-xs text-slate-600 leading-normal">${expense.paymentNotes}</div>
                     </div>`
                  : ""
              }
              ${reimburseDocLink}
            </div>
          </td>
          <td>
            <div class="d-flex flex-column gap-1.5">
              <span class="badge-pill ${badgeCls}">${statusText}</span>
              <div class="text-xs text-slate-500 font-medium">${expense.paymentMethod || "Transfer Bank"}</div>
              ${waLink}
              <div class="text-xs text-slate-400">Updated: ${formatDateTimeLabel(expense.updatedAtMs)}</div>
            </div>
          </td>
          <td class="text-end">
            <div class="d-flex flex-column gap-2 align-items-end">
              <button
                type="button"
                class="btn btn-sm btn-dark text-xs font-bold rounded-3 px-3 py-1.5 action-open-detail"
                data-id="${expense.id}"
              >
                Open Detail
              </button>
              ${
                canReview
                  ? `<button
                       type="button"
                       class="btn btn-sm btn-outline-warning text-xs font-bold rounded-3 px-3 py-1.5 action-mark-reviewing"
                       data-id="${expense.id}"
                     >
                       Mark Reviewing
                     </button>`
                  : ""
              }
              ${
                canSendWa
                  ? `<button
                       type="button"
                       class="btn btn-sm btn-outline-success text-xs font-bold rounded-3 px-3 py-1.5 action-send-wa"
                       data-id="${expense.id}"
                     >
                       Kirim Bukti ke Mentor
                     </button>`
                  : ""
              }
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  // Attach button events
  tbody.querySelectorAll(".action-open-detail").forEach((btn) => {
    btn.addEventListener("click", () => onOpenDetail(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".action-mark-reviewing").forEach((btn) => {
    btn.addEventListener("click", () => onMarkReviewing(btn.getAttribute("data-id")));
  });
  tbody.querySelectorAll(".action-send-wa").forEach((btn) => {
    btn.addEventListener("click", () => onSendWhatsapp(btn.getAttribute("data-id")));
  });
}

/**
 * Renders pagination controls.
 */
export function renderPagination(
  { currentPage, pageSize, totalItems },
  onPageChange
) {
  const container = document.getElementById("paginationWrap");
  if (!container) return;

  if (totalItems <= pageSize && pageSize !== 0) {
    container.style.display = "none";
    return;
  }
  container.style.display = "flex";

  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const infoEl = document.getElementById("paginationInfo");
  if (infoEl) {
    infoEl.textContent = `Menampilkan ${startItem}-${endItem} dari ${totalItems} data`;
  }

  const controlsEl = document.getElementById("paginationControls");
  if (!controlsEl) return;

  let pagesHtml = "";

  // Prev Button
  pagesHtml += `
    <button type="button" class="page-btn" ${currentPage <= 1 ? "disabled" : ""} data-page="${currentPage - 1}">
      <i class="bi bi-chevron-left"></i>
    </button>
  `;

  // Page Numbers
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  if (startPage > 1) {
    pagesHtml += `<button type="button" class="page-btn" data-page="1">1</button>`;
    if (startPage > 2) {
      pagesHtml += `<span class="px-1 text-slate-400 text-xs">...</span>`;
    }
  }

  for (let p = startPage; p <= endPage; p++) {
    pagesHtml += `
      <button type="button" class="page-btn ${p === currentPage ? "active" : ""}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pagesHtml += `<span class="px-1 text-slate-400 text-xs">...</span>`;
    }
    pagesHtml += `<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
  }

  // Next Button
  pagesHtml += `
    <button type="button" class="page-btn" ${currentPage >= totalPages ? "disabled" : ""} data-page="${currentPage + 1}">
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  controlsEl.innerHTML = pagesHtml;

  controlsEl.querySelectorAll("button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.getAttribute("data-page"), 10);
      if (page && page !== currentPage && page >= 1 && page <= totalPages) {
        onPageChange(page);
      }
    });
  });
}

/**
 * Renders date pills for quick filtering.
 */
export function renderDatePills(dateWindow, activeDate, onSelectDate) {
  const pillGroup = document.getElementById("datePillGroup");
  if (!pillGroup) return;

  pillGroup.innerHTML = dateWindow
    .map(
      (opt) => `
      <button
        type="button"
        class="date-pill ${opt.iso === activeDate ? "is-active" : ""}"
        data-iso="${opt.iso}"
        title="${opt.iso}"
      >
        ${opt.label}
      </button>
    `
    )
    .join("");

  pillGroup.querySelectorAll(".date-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      onSelectDate(btn.getAttribute("data-iso"));
    });
  });
}

/**
 * Renders autocomplete dropdown options.
 */
export function renderSearchResults(containerId, options, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!options.length) {
    container.innerHTML = `<div class="search-select-empty">Tidak ada data yang cocok.</div>`;
    container.style.display = "block";
    return;
  }

  container.innerHTML = options
    .map(
      (opt) => `
      <button type="button" class="search-select-item" data-id="${opt.id}">
        <div class="text-sm font-bold text-slate-800">${opt.name}</div>
        ${opt.meta ? `<div class="text-[11px] text-slate-500">${opt.meta}</div>` : ""}
      </button>
    `
    )
    .join("");

  container.style.display = "block";

  container.querySelectorAll(".search-select-item").forEach((btn) => {
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const id = btn.getAttribute("data-id");
      const chosen = options.find((item) => item.id === id);
      if (chosen) onSelect(chosen);
    });
  });
}

/**
 * Hides search results dropdown.
 */
export function hideSearchResults(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = "none";
  }
}

/**
 * Populates drawer form fields and adjusts category panels.
 */
export function populateDrawerForm(form, isEditMode) {
  const titleEl = document.getElementById("drawerHeaderTitle");
  const subEl = document.getElementById("drawerHeaderSub");
  const idEl = document.getElementById("drawerExpenseId");
  const idDisplay = document.getElementById("drawerExpenseIdDisplay");
  const deleteBtn = document.getElementById("btnDeleteExpense");

  if (titleEl) {
    titleEl.textContent = isEditMode ? "Update Expense" : "New Expense Request";
  }
  if (subEl) {
    subEl.textContent = form.title || (isEditMode ? "Expense Detail" : "Create Request");
  }
  if (idEl) {
    idEl.value = form.id || "";
  }
  if (idDisplay) {
    idDisplay.textContent = isEditMode && form.id ? `Expense ID: #${form.id}` : "";
  }
  if (deleteBtn) {
    deleteBtn.style.display = isEditMode ? "inline-block" : "none";
  }

  // Inputs
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? "";
  };

  setVal("formTitle", form.title);
  setVal("formCategory", form.category || "mentor_salary");
  setVal("formDepartment", form.department || "HR Division");
  setVal("formDueDate", form.dueDate);
  setVal("formAmount", form.amount ? formatCurrency(form.amount) : "");
  setVal("formStatus", form.status || "requested");

  setVal("formBeneficiaryName", form.beneficiaryName);
  setVal("formBankName", form.bankName);
  setVal("formAccountNumber", form.accountNumber);
  setVal("formPaymentMethod", form.paymentMethod || "Transfer Bank");

  setVal("formNotes", form.notes);
  setVal("formPaymentNotes", form.paymentNotes);

  // Search & Specific
  setVal("requesterSearchInput", form.requesterName);
  setVal("formRequesterId", form.requesterId);
  setVal("formRequesterName", form.requesterName);

  setVal("classSearchInput", form.relatedClass);
  setVal("formClassId", form.classId);
  setVal("formRelatedClass", form.relatedClass);

  setVal("mentorSearchInput", form.mentorName);
  setVal("formMentorId", form.mentorId);
  setVal("formMentorName", form.mentorName);
  setVal("formMentorWhatsapp", form.mentorWhatsapp);

  // Category specific fields
  setVal("formVendorName", form.vendorName);
  setVal("formExpensePeriod", form.expensePeriod);
  setVal("formReimburseType", form.reimburseType);
  setVal("formReimburseReason", form.reimburseReason);
  setVal("formToolName", form.toolName);
  setVal("formBillingPeriod", form.billingPeriod);
  setVal("formTravelerName", form.travelerName);
  setVal("formTravelDate", form.travelDate);
  setVal("formTravelRoute", form.travelRoute);
  setVal("formReferenceLabel", form.referenceLabel);
  setVal("formReferenceDetail", form.referenceDetail);

  // Previews
  renderProofPreview("transferProofPreview", form.transferProofUrl, "Bukti Transfer");
  renderProofPreview("reimburseProofPreview", form.reimburseProofUrl, "Dokumen Pendukung");

  // Toggle category panels
  toggleCategoryPanels(form.category || "mentor_salary");
}

function renderProofPreview(containerId, url, altLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!url) {
    container.innerHTML = `<span class="text-xs font-bold text-slate-300">Belum ada ${altLabel.toLowerCase()}</span>`;
    return;
  }
  if (isImageUrl(url)) {
    container.innerHTML = `<img src="${url}" alt="${altLabel}" class="img-fluid">`;
  } else {
    container.innerHTML = `
      <a href="${url}" target="_blank" class="text-xs font-bold text-blue-600 hover:text-blue-800 text-decoration-none">
        <i class="bi bi-file-earmark-arrow-down"></i> Buka ${altLabel}
      </a>
    `;
  }
}

/**
 * Toggles visibility of category-specific form panels.
 */
export function toggleCategoryPanels(category) {
  const panels = [
    "catMentorSalary",
    "catOperational",
    "catReimburse",
    "catTools",
    "catTransport",
    "catOther"
  ];
  panels.forEach((p) => {
    const el = document.getElementById(p);
    if (el) el.style.display = "none";
  });

  const catMap = {
    mentor_salary: "catMentorSalary",
    operational: "catOperational",
    reimburse: "catReimburse",
    tools: "catTools",
    transport: "catTransport",
    other: "catOther"
  };

  const targetId = catMap[category] || "catOther";
  const targetEl = document.getElementById(targetId);
  if (targetEl) targetEl.style.display = "grid";

  // If mentor salary, bank info can be readonly if mentor selected
  const mentorId = document.getElementById("formMentorId")?.value;
  const isMentor = category === "mentor_salary" && !!mentorId;
  const bankInputs = ["formBeneficiaryName", "formBankName", "formAccountNumber"];
  bankInputs.forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.readOnly = isMentor;
      input.classList.toggle("field-readonly", isMentor);
    }
  });
}

/**
 * Opens the drawer modal.
 */
export function openDrawer() {
  const drawer = document.getElementById("expenseDrawer");
  if (drawer) {
    drawer.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

/**
 * Closes the drawer modal.
 */
export function closeDrawer() {
  const drawer = document.getElementById("expenseDrawer");
  if (drawer) {
    drawer.classList.remove("active");
    document.body.style.overflow = "";
  }
}

/**
 * Displays a toast notification.
 */
export function showToast(message) {
  const toast = document.getElementById("toastNotice");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}
