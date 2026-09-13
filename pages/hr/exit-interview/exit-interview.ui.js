// pages/hr/exit-interview/exit-interview.ui.js
// =====================================================================
// EXIT INTERVIEW UI MODULE
// Handles all DOM rendering, card layout, empty states, modals,
// and conditional pagination.
// NO direct Firestore access here.
// =====================================================================

/**
 * Safely escapes HTML special characters to prevent XSS.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>'"]/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[ch],
  );
}

/**
 * Renders the modern conditional pagination component.
 * ONLY shown if totalRows > rowsPerPage.
 */
export function renderPaginationComponent(containerEl, info) {
  if (!containerEl) return;
  const { currentPage, totalRows, rowsPerPage, onPageChange } = info;

  if (totalRows <= rowsPerPage) {
    containerEl.innerHTML = "";
    containerEl.classList.add("hidden");
    return;
  }

  containerEl.classList.remove("hidden");
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const start = (currentPage - 1) * rowsPerPage + 1;
  const end = Math.min(currentPage * rowsPerPage, totalRows);

  const infoHtml = `<div class="pagination-info">Menampilkan <span class="font-bold text-slate-800">${start}</span> - <span class="font-bold text-slate-800">${end}</span> dari <span class="font-bold text-slate-800">${totalRows}</span> submission</div>`;

  let buttonsHtml = "";
  const prevDisabled = currentPage <= 1;
  buttonsHtml += `
    <button class="pagination-btn" data-action="prev" ${prevDisabled ? "disabled" : ""} title="Sebelumnya">
      <i class="bi bi-chevron-left"></i>
    </button>
  `;

  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    const isActive = p === currentPage;
    buttonsHtml += `
      <button class="pagination-btn ${isActive ? "active" : ""}" data-page="${p}">
        ${p}
      </button>
    `;
  }

  const nextDisabled = currentPage >= totalPages;
  buttonsHtml += `
    <button class="pagination-btn" data-action="next" ${nextDisabled ? "disabled" : ""} title="Berikutnya">
      <i class="bi bi-chevron-right"></i>
    </button>
  `;

  containerEl.innerHTML = `
    ${infoHtml}
    <div class="pagination-controls">
      ${buttonsHtml}
    </div>
  `;

  containerEl.querySelectorAll(".pagination-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const action = btn.dataset.action;
      const pageNum = btn.dataset.page;
      if (action === "prev" && currentPage > 1) {
        onPageChange(currentPage - 1);
      } else if (action === "next" && currentPage < totalPages) {
        onPageChange(currentPage + 1);
      } else if (pageNum) {
        onPageChange(Number(pageNum));
      }
    });
  });
}

/**
 * Renders the grid of exit interview cards with conditional pagination.
 * @param {Array} items - All submission documents
 * @param {Object} paginationState - { page, rowsPerPage, onPageChange }
 */
export function renderExitInterviewList(items, paginationState) {
  const container = document.getElementById("exitInterviewList");
  const paginationContainer = document.getElementById(
    "exitInterviewPagination",
  );
  if (!container) return;

  container.innerHTML = "";

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="col-12">
        <div class="exit-empty-state">
          <i class="bi bi-inbox"></i>
          <div class="fw-bold">Belum ada submission</div>
          <p class="text-slate-400 text-xs mt-1 mb-0">Klik tombol "+ Buat Exit Interview" untuk menambahkan data.</p>
        </div>
      </div>
    `;
    if (paginationContainer) {
      paginationContainer.innerHTML = "";
      paginationContainer.classList.add("hidden");
    }
    return;
  }

  const { page, rowsPerPage, onPageChange } = paginationState;
  const startIdx = (page - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const displayedItems =
    items.length > rowsPerPage ? items.slice(startIdx, endIdx) : items;

  const frag = document.createDocumentFragment();
  displayedItems.forEach((item) => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4";
    col.innerHTML = `
      <div class="exit-card">
        <div class="type-strip"></div>
        <div class="exit-card-body">
          <div class="d-flex justify-content-between align-items-start">
            <span class="exit-anon-badge"><i class="bi bi-incognito"></i> Anonim</span>
            <i class="bi bi-trash3 exit-delete-icon" data-id="${item.id}" title="Hapus submission"></i>
          </div>
          <p class="exit-content-preview mb-0">${escapeHtml(item.content || "")}</p>
        </div>
      </div>
    `;
    frag.appendChild(col);
  });

  container.appendChild(frag);

  renderPaginationComponent(paginationContainer, {
    currentPage: page,
    totalRows: items.length,
    rowsPerPage,
    onPageChange,
  });
}

/**
 * Shows loading spinner in the submission container.
 */
export function showLoadingState() {
  const container = document.getElementById("exitInterviewList");
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <div class="spinner-border text-primary spinner-border-sm mb-2" role="status"></div>
        <div>Loading submissions...</div>
      </div>
    `;
  }
}

/**
 * Shows error message in the submission container.
 */
export function showErrorState(msg = "Failed to load submissions.") {
  const container = document.getElementById("exitInterviewList");
  if (container) {
    container.innerHTML = `
      <div class="col-12 text-center text-danger py-4">
        <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
        ${escapeHtml(msg)}
      </div>
    `;
  }
}

/**
 * Modal helpers
 */
export function openCreateModal() {
  const input = document.getElementById("exitContentInput");
  const charCount = document.getElementById("exitCharCount");
  if (input) input.value = "";
  if (charCount) charCount.textContent = "0";

  const modalEl = document.getElementById("exitInterviewModal");
  if (modalEl && window.bootstrap?.Modal) {
    const modal = window.bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  }
}

export function closeCreateModal() {
  const modalEl = document.getElementById("exitInterviewModal");
  if (modalEl && window.bootstrap?.Modal) {
    const modal = window.bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

export function setSubmitButtonLoading(isLoading) {
  const saveBtn = document.getElementById("exitSaveButton");
  if (!saveBtn) return;
  if (isLoading) {
    saveBtn.disabled = true;
    saveBtn.innerText = "Sending...";
  } else {
    saveBtn.disabled = false;
    saveBtn.innerText = "Submit";
  }
}
