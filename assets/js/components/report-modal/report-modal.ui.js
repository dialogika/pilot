// assets/js/components/report-modal/report-modal.ui.js
// =====================================================================
// REPORT MODAL UI — pure DOM rendering for the Quest Report Approval Modal.
//
// Rules:
//  - NO Firebase/Firestore access here (use report-modal.repository.js).
//  - Handles DOM templates, rendering statistics, table rows, and details sub-modal.
// =====================================================================

function escapeHtml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initialsOf(source) {
  const s = String(source || "").trim();
  if (!s) return "U";
  const parts = s.split(/\s+/);
  const letters = parts.map((p) => p[0] || "").join("");
  return (letters || s.substring(0, 2)).substring(0, 2).toUpperCase();
}

/**
 * Ensure mount point and CSS exist.
 */
export function ensureReportModalDOM() {
  if (document.getElementById("dgReportModalMount")) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/assets/js/components/report-modal/report-modal.css";
  document.head.appendChild(link);

  const mount = document.createElement("div");
  mount.id = "dgReportModalMount";
  mount.innerHTML = `
    <!-- Main Report Modal Overlay -->
    <div id="dgReportModalOverlay" class="dg-report-modal-overlay">
      <div class="dg-report-modal-dialog">
        <!-- Header -->
        <div class="dg-report-header">
          <div class="dg-report-header-title">
            <h4 id="dgReportTitle">Report Daily</h4>
            <span class="dg-report-count-badge" id="dgReportCountBadge">0</span>
          </div>
          <div class="dg-report-header-actions">
            <div class="dg-report-bulk-btn-group">
              <button type="button" class="dg-report-btn-tool" id="dgReportTopArchiveBtn" title="Bulk Archive">
                <i class="bi bi-archive text-secondary"></i>
              </button>
              <button type="button" class="dg-report-btn-tool" id="dgReportTopDeleteBtn" title="Bulk Delete">
                <i class="bi bi-trash text-danger"></i>
              </button>
            </div>
            <div class="dg-report-nav-pills">
              <button type="button" class="dg-report-tab-btn active" id="dgReportTabDaily" data-quest-tab="daily">Daily</button>
              <button type="button" class="dg-report-tab-btn" id="dgReportTabQuest" data-quest-tab="quest">Quest</button>
              <button type="button" class="dg-report-tab-btn" id="dgReportTabProject" data-quest-tab="project">Project</button>
            </div>
            <button type="button" class="dg-report-btn-close" id="dgReportCloseBtn">
              <i class="bi bi-x-lg"></i> Close
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="dg-report-body">
          <!-- Stats Grid -->
          <div class="dg-report-stats-grid">
            <!-- Approval Status -->
            <div class="dg-report-stat-card">
              <div class="dg-report-stat-header">
                <h6><i class="bi bi-check-circle"></i> Approval Status</h6>
              </div>
              <div class="dg-report-stat-values">
                <div class="dg-report-stat-item">
                  <div class="dg-report-stat-label">Requested</div>
                  <div class="dg-report-stat-value" id="dgStatRequested">0</div>
                  <div class="dg-report-stat-diff">Total</div>
                </div>
                <div class="dg-report-stat-item">
                  <div class="dg-report-stat-label">Approved</div>
                  <div class="dg-report-stat-value text-success" id="dgStatApproved">0</div>
                  <div class="dg-report-stat-diff">Total</div>
                </div>
                <div class="dg-report-stat-item">
                  <div class="dg-report-stat-label">Rejected</div>
                  <div class="dg-report-stat-value text-danger" id="dgStatRejected">0</div>
                  <div class="dg-report-stat-diff">Total</div>
                </div>
                <div class="dg-report-stat-item">
                  <div class="dg-report-stat-label">Pending</div>
                  <div class="dg-report-stat-value text-warning" id="dgStatPending">0</div>
                  <div class="dg-report-stat-diff">Total</div>
                </div>
              </div>
            </div>

            <!-- Quest Type Breakdown -->
            <div class="dg-report-stat-card">
              <div class="dg-report-stat-header">
                <h6><i class="bi bi-clock-history"></i> Quest Type Breakdown</h6>
              </div>
              <div>
                <div class="dg-report-breakdown-row">
                  <span class="dg-report-breakdown-label">Daily</span>
                  <div class="dg-report-progress-track">
                    <div class="dg-report-progress-fill bg-main" id="dgBreakdownDailyBar" style="width: 0%;"></div>
                  </div>
                  <span class="dg-report-breakdown-count" id="dgBreakdownDailyCount">0</span>
                </div>
                <div class="dg-report-breakdown-row">
                  <span class="dg-report-breakdown-label">Quest</span>
                  <div class="dg-report-progress-track">
                    <div class="dg-report-progress-fill bg-side" id="dgBreakdownQuestBar" style="width: 0%;"></div>
                  </div>
                  <span class="dg-report-breakdown-count" id="dgBreakdownQuestCount">0</span>
                </div>
                <div class="dg-report-breakdown-row">
                  <span class="dg-report-breakdown-label">Project</span>
                  <div class="dg-report-progress-track">
                    <div class="dg-report-progress-fill bg-project" id="dgBreakdownProjectBar" style="width: 0%;"></div>
                  </div>
                  <span class="dg-report-breakdown-count" id="dgBreakdownProjectCount">0</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls / Filter bar -->
          <div class="dg-report-controls">
            <div class="dg-report-filter-group">
              <div class="dg-report-search-wrap">
                <i class="bi bi-search"></i>
                <input type="text" class="dg-report-search-input" id="dgReportSearchInput" placeholder="Search Report Quest..." />
              </div>
              <select class="dg-report-select" id="dgReportPeriodSelect">
                <option value="all" selected>All Period</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="3month">3 Month</option>
                <option value="6month">6 Month</option>
                <option value="yearly">Yearly</option>
              </select>
              <select class="dg-report-select" id="dgReportStatusSelect">
                <option value="all">All Status</option>
                <option value="pending" selected>Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
              <select class="dg-report-select" id="dgReportPageSizeSelect">
                <option value="20" selected>20 / page</option>
                <option value="40">40 / page</option>
                <option value="60">60 / page</option>
              </select>
            </div>
            <div id="dgReportActionBtnWrap">
              <button type="button" class="dg-report-btn-approve-all" id="dgReportApproveAllBtn">
                <i class="bi bi-check-all"></i> Approve all
              </button>
            </div>
          </div>

          <!-- Table Area -->
          <div class="dg-report-table-wrapper">
            <table class="dg-report-table">
              <thead>
                <tr>
                  <th class="dg-report-col-select js-bulk-select-col" style="display:none;width:40px;text-align:center;">
                    <input type="checkbox" class="form-check-input" id="dgReportSelectAllCheckbox" title="Select All" style="width:16px;height:16px;cursor:pointer;vertical-align:middle;" />
                  </th>
                  <th class="dg-report-col-team" data-sort-key="user">Team</th>
                  <th class="dg-report-col-date" data-sort-key="date">Date</th>
                  <th class="dg-report-col-task" data-sort-key="task">Task</th>
                  <th class="dg-report-col-report" data-sort-key="reportPreview">Report</th>
                  <th class="dg-report-col-files" data-sort-key="fileName">Files</th>
                  <th class="dg-report-col-action" data-sort-key="status">Action</th>
                </tr>
              </thead>
              <tbody id="dgReportTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail & Feedback Sub-Modal -->
    <div id="dgReportDetailOverlay" class="dg-report-detail-overlay">
      <div class="dg-report-detail-card">
        <div class="dg-report-detail-header">
          <h5 id="dgReportDetailTaskTitle">Report Details</h5>
          <button type="button" class="btn-close" id="dgReportDetailCloseBtn" style="background:none;border:none;font-size:1.2rem;cursor:pointer;">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="dg-report-detail-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem;">
            <div>
              <div class="dg-report-stat-label">Assigned</div>
              <div id="dgDetailAssignAvatars" class="dg-report-avatar-pile"></div>
            </div>
            <div>
              <div class="dg-report-stat-label">Report To</div>
              <div id="dgDetailNotifyAvatars" class="dg-report-avatar-pile"></div>
            </div>
          </div>

          <div style="margin-bottom:1rem;">
            <div class="dg-report-stat-label">Quest Info</div>
            <div style="font-size:0.85rem;color:#334155;line-height:1.6;" id="dgDetailQuestInfo"></div>
          </div>

          <div style="margin-bottom:1rem;">
            <div class="dg-report-stat-label">Report Content</div>
            <div id="dgDetailReportContent" style="padding:0.75rem 1rem;background:#f8fafc;border-left:4px solid #16a34a;border-radius:0.5rem;font-size:0.875rem;line-height:1.6;"></div>
          </div>

          <div id="dgDetailFilesWrapper" style="display:none;margin-bottom:1rem;">
            <div class="dg-report-stat-label">Attached Files</div>
            <div id="dgDetailFilesList" style="display:flex;flex-wrap:wrap;gap:0.5rem;"></div>
          </div>

          <div id="dgDetailFeedbackSection" style="display:none;margin-top:1rem;">
            <div class="dg-report-stat-label text-danger">Feedback / Reason for Rejection</div>
            <textarea id="dgDetailFeedbackInput" rows="3" class="form-control" style="width:100%;border:1px solid #cbd5e1;border-radius:0.5rem;padding:0.5rem;font-size:0.85rem;" placeholder="Berikan catatan revisi untuk tim..."></textarea>
          </div>
        </div>
        <div class="dg-report-detail-footer">
          <span id="dgReportDetailStatusBadge" style="display:none;"></span>
          <button type="button" class="btn btn-warning btn-sm" id="dgReportDetailUnarchiveBtn" style="display:none;padding:0.4rem 1rem;border-radius:0.5rem;background:#f59e0b;color:#fff;border:none;font-weight:600;cursor:pointer;align-items:center;gap:0.35rem;"><i class="bi bi-arrow-counterclockwise"></i> Pulihkan dari Arsip</button>
          <button type="button" class="btn btn-success btn-sm" id="dgReportDetailApproveBtn" style="padding:0.4rem 1rem;border-radius:0.5rem;background:#16a34a;color:#fff;border:none;font-weight:600;cursor:pointer;">Approve Task</button>
          <button type="button" class="btn btn-danger btn-sm" id="dgReportDetailSubmitFeedbackBtn" style="display:none;padding:0.4rem 1rem;border-radius:0.5rem;background:#dc2626;color:#fff;border:none;font-weight:600;cursor:pointer;">Submit Feedback &amp; Reject</button>
        </div>
      </div>
    </div>

    <!-- Image / File Preview Lightbox Overlay is injected dynamically into document.body -->
  `;

  document.body.appendChild(mount);
}

export function showModalOverlay() {
  document.getElementById("dgReportModalOverlay")?.classList.add("show");
  document.body.style.overflow = "hidden";
}

export function hideModalOverlay() {
  document.getElementById("dgReportModalOverlay")?.classList.remove("show");
  document.body.style.overflow = "";
}

export function setActiveTab(tab) {
  const normTab = tab === "side" ? "quest" : tab === "main" ? "daily" : tab;
  const titles = {
    daily: "Report Daily",
    quest: "Report Quest",
    project: "Report Project",
    main: "Report Daily",
    side: "Report Quest",
  };
  const titleEl = document.getElementById("dgReportTitle");
  if (titleEl) titleEl.textContent = titles[normTab] || "Report";

  document.querySelectorAll(".dg-report-tab-btn").forEach((btn) => {
    const btnTab = btn.getAttribute("data-quest-tab");
    const normBtnTab = btnTab === "side" ? "quest" : btnTab === "main" ? "daily" : btnTab;
    btn.classList.toggle("active", normBtnTab === normTab);
  });
}

export function resolveUniqueUsers(uids, usersMap) {
  const ids = Array.isArray(uids) ? uids.filter(Boolean) : uids ? [uids] : [];
  if (!ids.length) return [];

  const seen = new Set();
  const uniqueUsers = [];

  ids.forEach((rawId) => {
    if (!rawId) return;
    if (typeof rawId === "object" && rawId !== null && (rawId.name || rawId.uid || rawId.docId)) {
      const canonicalKey = String(
        rawId.docId || rawId.uid || rawId.id || rawId.email || rawId.name
      ).toLowerCase();
      if (!seen.has(canonicalKey)) {
        seen.add(canonicalKey);
        uniqueUsers.push(rawId);
      }
      return;
    }

    const strId = String(rawId).trim();
    if (!strId) return;
    const strLower = strId.toLowerCase();

    // 1. Direct lookup in usersMap
    let user = usersMap ? (usersMap[strId] || usersMap[strLower]) : null;

    // 2. Deep search through values of usersMap
    if (!user && usersMap) {
      const allUsers = Object.values(usersMap);
      for (const u of allUsers) {
        if (!u) continue;
        const uDocId = String(u.docId || u.id || "").toLowerCase();
        const uUid = String(u.uid || "").toLowerCase();
        const uEmail = String(u.email || "").toLowerCase();
        const uName = String(u.name || u.displayName || u.full_name || "").toLowerCase();
        const uAliases = Array.isArray(u.allAliases) ? u.allAliases.map((a) => String(a).toLowerCase()) : [];

        if (
          (uDocId && uDocId === strLower) ||
          (uUid && uUid === strLower) ||
          (uEmail && uEmail === strLower) ||
          (uAliases.length && uAliases.includes(strLower)) ||
          (uName && uName === strLower)
        ) {
          user = u;
          break;
        }
      }
    }

    const finalUser = user || { uid: strId, name: strId, photo: "" };
    const canonicalKey = String(
      finalUser.docId || finalUser.uid || finalUser.id || finalUser.email || finalUser.name || strId
    ).toLowerCase();

    if (!seen.has(canonicalKey)) {
      seen.add(canonicalKey);
      uniqueUsers.push(finalUser);
    }
  });

  return uniqueUsers;
}

export function renderAvatarPile(uids, usersMap, max = 3) {
  const users = resolveUniqueUsers(uids, usersMap);
  if (!users.length) return '<span class="text-muted" style="font-size:0.75rem;">-</span>';

  let html = '<div class="dg-report-avatar-pile">';
  const showCount = Math.min(users.length, max);
  for (let i = 0; i < showCount; i++) {
    const user = users[i];
    const name = user.name || user.displayName || user.uid || "User";
    if (user.photo) {
      html += `<img src="${escapeAttr(user.photo)}" class="dg-report-avatar-item" title="${escapeAttr(name)}" alt="" />`;
    } else {
      const ini = initialsOf(name);
      html += `<span class="dg-report-avatar-item" title="${escapeAttr(name)}">${escapeHtml(ini)}</span>`;
    }
  }
  if (users.length > max) {
    html += `<span class="dg-report-avatar-more">+${users.length - max}</span>`;
  }
  html += "</div>";
  return html;
}

export function renderStats(stats, badgeTotal) {
  const elReq = document.getElementById("dgStatRequested");
  const elApp = document.getElementById("dgStatApproved");
  const elRej = document.getElementById("dgStatRejected");
  const elPen = document.getElementById("dgStatPending");
  const elBadge = document.getElementById("dgReportCountBadge");

  if (elReq) elReq.textContent = String(stats.requested || 0);
  if (elApp) elApp.textContent = String(stats.approved || 0);
  if (elRej) elRej.textContent = String(stats.rejected || 0);
  if (elPen) elPen.textContent = String(stats.pending || 0);
  if (elBadge) elBadge.textContent = String(badgeTotal || 0);

  // Breakdown progress
  const dailyCount = stats.breakdown?.daily || stats.breakdown?.main || 0;
  const questCount = stats.breakdown?.quest || stats.breakdown?.side || 0;
  const projectCount = stats.breakdown?.project || 0;
  const totalBreakdown = Math.max(dailyCount + questCount + projectCount, 1);

  const dailyPct = Math.round((dailyCount / totalBreakdown) * 100);
  const questPct = Math.round((questCount / totalBreakdown) * 100);
  const projectPct = Math.round((projectCount / totalBreakdown) * 100);

  const dailyBar = document.getElementById("dgBreakdownDailyBar") || document.getElementById("dgBreakdownMainBar");
  const questBar = document.getElementById("dgBreakdownQuestBar") || document.getElementById("dgBreakdownSideBar");
  const projectBar = document.getElementById("dgBreakdownProjectBar");
  const dailyCountEl = document.getElementById("dgBreakdownDailyCount") || document.getElementById("dgBreakdownMainCount");
  const questCountEl = document.getElementById("dgBreakdownQuestCount") || document.getElementById("dgBreakdownSideCount");
  const projectCountEl = document.getElementById("dgBreakdownProjectCount");

  if (dailyBar) dailyBar.style.width = `${dailyPct}%`;
  if (questBar) questBar.style.width = `${questPct}%`;
  if (projectBar) projectBar.style.width = `${projectPct}%`;

  if (dailyCountEl) dailyCountEl.textContent = String(dailyCount);
  if (questCountEl) questCountEl.textContent = String(questCount);
  if (projectCountEl) projectCountEl.textContent = String(projectCount);
}

export function syncSelectAllCheckbox(reports, selectedIds = {}) {
  const selectAllCb = document.getElementById("dgReportSelectAllCheckbox");
  if (!selectAllCb) return;
  if (!reports || reports.length === 0) {
    selectAllCb.checked = false;
    selectAllCb.indeterminate = false;
    return;
  }
  const allSelected = reports.every((r) => !!selectedIds[r.id]);
  const someSelected = reports.some((r) => !!selectedIds[r.id]);
  selectAllCb.checked = allSelected;
  selectAllCb.indeterminate = !allSelected && someSelected;
}

export function renderTable(reports, usersMap, callbacks = {}, bulkMode = false, selectedIds = {}) {
  const tbody = document.getElementById("dgReportTableBody");
  if (!tbody) return;

  // Toggle bulk select header col
  document.querySelectorAll(".js-bulk-select-col").forEach((el) => {
    el.style.display = bulkMode ? "" : "none";
  });

  // Handle Select All Checkbox state
  const selectAllCb = document.getElementById("dgReportSelectAllCheckbox");
  if (selectAllCb) {
    if (bulkMode && reports.length > 0) {
      syncSelectAllCheckbox(reports, selectedIds);
    } else {
      selectAllCb.checked = false;
      selectAllCb.indeterminate = false;
    }

    selectAllCb.onchange = (e) => {
      const isChecked = e.target.checked;
      if (callbacks.onToggleSelectAll) {
        callbacks.onToggleSelectAll(isChecked);
      }
    };
  }

  if (!reports.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${bulkMode ? "7" : "6"}" class="dg-report-empty-state">
          <i class="bi bi-inbox" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          Tidak ada laporan ditemukan untuk kriteria ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";
  reports.forEach((r) => {
    const row = document.createElement("tr");
    row.setAttribute("data-report-id", r.id);

    const teamHtml = renderAvatarPile(r.assignees, usersMap, 3);
    const isArchived = !!(r.archived || r.status === "archived");
    const isApproved = !isArchived && r.status === "approved";
    const isRejected = !isArchived && r.status === "rejected";
    const isPending = !isArchived && !isApproved && !isRejected;

    let selectCellHtml = "";
    if (bulkMode) {
      const isChecked = selectedIds[r.id] ? "checked" : "";
      selectCellHtml = `
        <td class="text-center js-bulk-select-col">
          <input type="checkbox" class="form-check-input js-bulk-checkbox" ${isChecked} style="width:16px;height:16px;cursor:pointer;" />
        </td>
      `;
    }

    let filesHtml = '<span class="text-muted">-</span>';
    if (r.files && r.files.length > 0) {
      filesHtml = r.files
        .map((f, idx) => {
          let icon = "bi-file-earmark";
          const type = String(f.type || "").toLowerCase();
          const fname = String(f.name || "").toLowerCase();
          const furl = String(f.url || "").toLowerCase();
          if (type.includes("pdf") || fname.endsWith(".pdf") || furl.includes(".pdf")) {
            icon = "bi-file-earmark-pdf text-danger";
          } else if (type.includes("zip") || type.includes("rar") || fname.endsWith(".zip") || fname.endsWith(".rar")) {
            icon = "bi-file-earmark-zip text-warning";
          } else if (type.startsWith("image/") || furl.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)/.test(furl) || /\.(png|jpe?g|gif|webp|svg)$/.test(fname)) {
            icon = "bi-file-earmark-image text-primary";
          }
          return `<button type="button" class="btn btn-link p-0 text-decoration-none me-1 js-table-file-btn" data-file-idx="${idx}" title="${escapeAttr(f.name || "Attachment")}" style="cursor:pointer;font-size:0.95rem;border:none;background:none;"><i class="bi ${icon}"></i></button>`;
        })
        .join("");
    }

    row.innerHTML = `
      ${selectCellHtml}
      <td class="dg-report-col-team">${teamHtml}</td>
      <td class="dg-report-col-date">${escapeHtml(r.date)}</td>
      <td class="dg-report-col-task"><span class="dg-report-text-truncate" title="${escapeAttr(r.task)}">${escapeHtml(r.taskShort)}</span></td>
      <td class="dg-report-col-report">
        <div class="dg-report-rich-preview" title="${escapeAttr(r.reportPreviewFull)}">${escapeHtml(r.reportPreview)}</div>
      </td>
      <td class="dg-report-col-files">${filesHtml}</td>
      <td class="dg-report-col-action">
        <div class="dg-report-btn-action-group">
          ${isPending ? `
            <button type="button" class="dg-report-btn-reject js-btn-reject" title="Reject"><i class="bi bi-x-lg"></i></button>
            <button type="button" class="dg-report-btn-approve js-btn-approve">
              Approve
            </button>
          ` : isArchived ? `
            <button type="button" class="btn btn-sm btn-outline-warning js-btn-unarchive" title="Pulihkan dari Arsip" style="padding:0.25rem 0.65rem;font-size:0.78rem;font-weight:600;border-radius:0.4rem;display:inline-flex;align-items:center;gap:0.3rem;">
              <i class="bi bi-arrow-counterclockwise"></i> Pulihkan
            </button>
          ` : isApproved ? `
            <span class="dg-report-status-badge badge-approved" style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.35rem 0.75rem;border-radius:0.5rem;background:#dcfce7;color:#16a34a;font-size:0.78rem;font-weight:600;">
              <i class="bi bi-check-circle-fill"></i> Approved
            </span>
          ` : `
            <span class="dg-report-status-badge badge-rejected" style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.35rem 0.75rem;border-radius:0.5rem;background:#fee2e2;color:#dc2626;font-size:0.78rem;font-weight:600;">
              <i class="bi bi-x-circle-fill"></i> Rejected
            </span>
          `}
        </div>
      </td>
    `;

    // File icon clicks in table
    row.querySelectorAll(".js-table-file-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.fileIdx, 10);
        if (!isNaN(idx) && r.files && r.files[idx]) {
          openAttachment(r.files[idx]);
        }
      });
    });

    // Row click -> open details
    row.addEventListener("click", (e) => {
      if (e.target.closest("button") || e.target.closest("a") || e.target.closest("input")) return;
      if (callbacks.onOpenDetail) callbacks.onOpenDetail(r, "view");
    });

    // Checkbox toggle
    row.querySelector(".js-bulk-checkbox")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (callbacks.onToggleSelect) callbacks.onToggleSelect(r.id, e.target.checked);
    });

    // Unarchive action
    row.querySelector(".js-btn-unarchive")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (callbacks.onUnarchive) callbacks.onUnarchive(r);
    });

    // Reject action
    row.querySelector(".js-btn-reject")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (callbacks.onReject) callbacks.onReject(r);
    });

    // Approve action
    row.querySelector(".js-btn-approve")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (callbacks.onApprove) callbacks.onApprove(r);
    });

    tbody.appendChild(row);
  });
}

export function openInNewTab(url, name) {
  if (!url || url === "#") {
    alert("Tautan file tidak tersedia.");
    return;
  }

  // If data: image -> create a new window with a full-size HTML viewer
  if (url.startsWith("data:image/")) {
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(name || "Attachment Preview")}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0f172a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1rem;
    }
    .img-wrap {
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      max-width: 100%;
      max-height: 90vh;
      object-fit: contain;
      border-radius: 8px;
      box-shadow: 0 20px 30px rgba(0,0,0,0.6);
    }
  </style>
</head>
<body>
  <div class="img-wrap">
    <img src="${url}" alt="${escapeHtml(name || "Preview")}" />
  </div>
</body>
</html>`);
      win.document.close();
      return;
    }
  }

  // If data: PDF -> convert to blob URL
  if (url.startsWith("data:application/pdf")) {
    try {
      const arr = url.split(",");
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
      return;
    } catch (_) {}
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  if (url.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "attachment";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  window.open(url, "_blank");
}

function _buildPreviewOverlayHTML(container) {
  container.style.cssText = "position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100vw !important;height:100vh !important;z-index:99999999 !important;display:none;align-items:center;justify-content:center;padding:1.5rem;background:rgba(15,23,42,0.85);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);";
  container.innerHTML = `
    <div id="dgReportFilePreviewBackdrop" style="position:absolute;top:0;left:0;right:0;bottom:0;cursor:pointer;"></div>
    <div class="dg-report-preview-card" style="position:relative;z-index:2;background:#1e293b;border:1px solid rgba(255,255,255,0.2);border-radius:0.75rem;max-width:92vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);overflow:hidden;">
      <div class="dg-report-preview-header" style="padding:0.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;background:rgba(0,0,0,0.4);border-bottom:1px solid rgba(255,255,255,0.1);color:#fff;">
        <span class="dg-report-preview-title" id="dgReportFilePreviewTitle" style="font-size:0.9rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:50vw;color:#f1f5f9;">Preview Attachment</span>
        <div class="dg-report-preview-actions" style="display:flex;align-items:center;gap:0.5rem;">
          <button type="button" id="dgReportFilePreviewNewTabBtn" class="btn btn-sm" style="font-size:0.75rem;padding:0.3rem 0.6rem;border-radius:0.375rem;color:#f8fafc;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;">
            <i class="bi bi-box-arrow-up-right"></i> Tab Baru
          </button>
          <a id="dgReportFilePreviewDownloadBtn" href="#" download="attachment" class="btn btn-sm" style="font-size:0.75rem;padding:0.3rem 0.6rem;border-radius:0.375rem;color:#f8fafc;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;text-decoration:none;">
            <i class="bi bi-download"></i> Unduh
          </a>
          <button type="button" id="dgReportFilePreviewCloseBtn" class="btn btn-sm" style="font-size:0.85rem;padding:0.3rem 0.6rem;border-radius:0.375rem;color:#f8fafc;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);cursor:pointer;">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
      <div class="dg-report-preview-body" id="dgReportFilePreviewBody" style="padding:1rem;display:flex;align-items:center;justify-content:center;overflow:auto;background:#0f172a;min-height:200px;max-height:calc(90vh - 60px);">
        <img id="dgReportFilePreviewImg" src="" alt="Preview" style="display:none;max-width:100%;max-height:75vh;object-fit:contain;border-radius:0.375rem;box-shadow:0 10px 25px rgba(0,0,0,0.5);cursor:pointer;" title="Klik untuk membuka di tab baru" />
        <iframe id="dgReportFilePreviewFrame" src="" style="display:none;width:80vw;height:75vh;border:none;border-radius:0.375rem;background:#fff;"></iframe>
      </div>
    </div>
  `;
  container.querySelector("#dgReportFilePreviewCloseBtn")?.addEventListener("click", closeFilePreview);
  container.querySelector("#dgReportFilePreviewBackdrop")?.addEventListener("click", closeFilePreview);
}

export function getOrCreatePreviewOverlay() {
  let overlay = document.getElementById("dgReportFilePreviewOverlay");

  if (overlay && overlay.parentElement !== document.body) {
    // Overlay exists but is trapped inside another element (stacking context issue)
    // Remove it and recreate fresh on document.body
    overlay.parentElement.removeChild(overlay);
    overlay = null;
  }

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "dgReportFilePreviewOverlay";
    overlay.className = "dg-report-preview-overlay";
    _buildPreviewOverlayHTML(overlay);
    document.body.appendChild(overlay);
  } else {
    // Already on body — just ensure z-index is at the top
    overlay.style.zIndex = "99999999";
  }

  return overlay;
}

export function openAttachment(file) {
  if (!file) return;
  let rawUrl = "";
  let name = "Attachment";
  let type = "";

  if (typeof file === "string") {
    rawUrl = file;
  } else if (file && typeof file === "object") {
    rawUrl = file.url || file.fileUrl || file.file_url || file.src || file.link || file.href || "";
    name = file.name || file.fileName || file.file_name || file.title || "Attachment";
    type = String(file.type || file.fileType || file.file_type || "").toLowerCase();
  }

  if (!rawUrl || rawUrl === "#") {
    alert("Tautan file tidak tersedia atau rusak.");
    return;
  }

  const isDataUrl = rawUrl.startsWith("data:");
  const isImage =
    type.startsWith("image/") ||
    rawUrl.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(rawUrl) ||
    /\.(png|jpe?g|gif|webp|svg)$/i.test(name);

  const isPdf =
    type.includes("pdf") ||
    rawUrl.startsWith("data:application/pdf") ||
    /\.pdf(\?.*)?$/i.test(rawUrl) ||
    name.toLowerCase().endsWith(".pdf");

  try {
    const overlay = getOrCreatePreviewOverlay();
    const titleEl = overlay.querySelector("#dgReportFilePreviewTitle");
    const imgEl = overlay.querySelector("#dgReportFilePreviewImg");
    const frameEl = overlay.querySelector("#dgReportFilePreviewFrame");
    const downloadBtn = overlay.querySelector("#dgReportFilePreviewDownloadBtn");
    const newTabBtn = overlay.querySelector("#dgReportFilePreviewNewTabBtn");

    if (titleEl) titleEl.textContent = name;

    if (downloadBtn) {
      downloadBtn.href = rawUrl;
      downloadBtn.download = name || (isPdf ? "document.pdf" : "image.png");
    }

    if (newTabBtn) {
      newTabBtn.onclick = (e) => {
        e.preventDefault();
        openInNewTab(rawUrl, name);
      };
    }

    if (isImage) {
      if (imgEl) {
        imgEl.src = rawUrl;
        imgEl.style.display = "block";
        imgEl.onclick = () => openInNewTab(rawUrl, name);
      }
      if (frameEl) {
        frameEl.style.display = "none";
        frameEl.src = "";
      }
      overlay.style.display = "flex";
      overlay.style.zIndex = "99999999";
      return;
    }

    if (isPdf && isDataUrl) {
      if (frameEl) {
        frameEl.src = rawUrl;
        frameEl.style.display = "block";
      }
      if (imgEl) {
        imgEl.style.display = "none";
        imgEl.src = "";
      }
      overlay.style.display = "flex";
      overlay.style.zIndex = "99999999";
      return;
    }
  } catch (err) {
    console.error("Error opening preview modal:", err);
  }

  // Direct open fallback
  openInNewTab(rawUrl, name);
}

export function closeFilePreview() {
  const previewOverlay = document.getElementById("dgReportFilePreviewOverlay");
  if (previewOverlay) {
    previewOverlay.style.display = "none";
    const previewImg = previewOverlay.querySelector("#dgReportFilePreviewImg");
    if (previewImg) {
      previewImg.src = "";
      previewImg.style.display = "none";
    }
    const previewFrame = previewOverlay.querySelector("#dgReportFilePreviewFrame");
    if (previewFrame) {
      previewFrame.src = "";
      previewFrame.style.display = "none";
    }
  }
}

export function openDetailModal(report, mode, usersMap) {
  const overlay = document.getElementById("dgReportDetailOverlay");
  if (!overlay || !report) return;

  window._activeReportFiles = report.files || [];
  window._currentDetailReport = report;

  document.getElementById("dgReportDetailTaskTitle").textContent = report.task || "Report Details";
  document.getElementById("dgDetailAssignAvatars").innerHTML = renderAvatarPile(report.assignees, usersMap, 5);
  document.getElementById("dgDetailNotifyAvatars").innerHTML = renderAvatarPile(
    report.reportTo && report.reportTo.length ? report.reportTo : report.notifyTo,
    usersMap,
    5,
  );

  const depts = (report.departments || []).map((d) => d && d.name ? d.name : d).filter(Boolean).join(", ") || "-";
  const points = report.points ? `${report.points} Points` : "-";
  document.getElementById("dgDetailQuestInfo").innerHTML = `
    <strong>Type:</strong> ${escapeHtml(report.questType)} &bull; 
    <strong>Department:</strong> ${escapeHtml(depts)} &bull; 
    <strong>Points:</strong> ${escapeHtml(points)} &bull; 
    <strong>Due Date:</strong> ${escapeHtml(report.dueDate || "-")}
  `;

  document.getElementById("dgDetailReportContent").innerHTML = report.reportFull || "<em>Tidak ada rincian report.</em>";

  // Files
  const filesWrap = document.getElementById("dgDetailFilesWrapper");
  const filesList = document.getElementById("dgDetailFilesList");
  if (filesWrap && filesList) {
    if (report.files && report.files.length) {
      filesList.innerHTML = report.files
        .map((f, idx) => {
          let rawUrl = "";
          let name = "Attachment";
          let type = "";

          if (typeof f === "string") {
            rawUrl = f;
          } else if (f && typeof f === "object") {
            rawUrl = f.url || f.fileUrl || f.file_url || f.src || f.link || f.href || "";
            name = f.name || f.fileName || f.file_name || f.title || "Attachment";
            type = String(f.type || f.fileType || f.file_type || "").toLowerCase();
          }

          const isImage =
            type.startsWith("image/") ||
            rawUrl.startsWith("data:image/") ||
            /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(rawUrl) ||
            /\.(png|jpe?g|gif|webp|svg)$/i.test(name);

          let icon = "bi-paperclip";
          if (type.includes("pdf") || name.endsWith(".pdf") || rawUrl.includes(".pdf")) {
            icon = "bi-file-earmark-pdf text-danger";
          } else if (type.includes("zip") || type.includes("rar") || name.endsWith(".zip") || name.endsWith(".rar")) {
            icon = "bi-file-earmark-zip text-warning";
          } else if (isImage) {
            icon = "bi-file-earmark-image text-primary";
          }

          if (isImage && rawUrl) {
            return `
              <div class="dg-detail-file-card js-btn-open-file" data-file-idx="${idx}" onclick="window.dgOpenAttachmentByIndex && window.dgOpenAttachmentByIndex(${idx})" style="display:inline-flex;align-items:center;gap:0.6rem;padding:0.4rem 0.75rem;border:1px solid #cbd5e1;border-radius:0.5rem;background:#ffffff;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.06);transition:all 0.15s ease;">
                <img src="${escapeAttr(rawUrl)}" alt="${escapeAttr(name)}" style="width:34px;height:34px;object-fit:cover;border-radius:0.375rem;border:1px solid #e2e8f0;background:#f8fafc;" />
                <div style="display:flex;flex-direction:column;text-align:left;">
                  <span style="font-size:0.8rem;font-weight:600;color:#1e293b;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(name)}</span>
                  <span style="font-size:0.7rem;color:#0284c7;font-weight:500;"><i class="bi bi-eye"></i> Klik untuk preview</span>
                </div>
              </div>
            `;
          }

          return `<button type="button" class="btn btn-sm btn-outline-secondary js-btn-open-file" data-file-idx="${idx}" onclick="window.dgOpenAttachmentByIndex && window.dgOpenAttachmentByIndex(${idx})" style="padding:0.4rem 0.85rem;font-size:0.8rem;border:1px solid #cbd5e1;border-radius:0.5rem;background:#ffffff;color:#1e293b;display:inline-flex;align-items:center;gap:0.45rem;cursor:pointer;transition:all 0.15s ease;font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
            <i class="bi ${icon}"></i>
            <span>${escapeHtml(name)}</span>
          </button>`;
        })
        .join("");

      filesList.querySelectorAll(".js-btn-open-file").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const idx = parseInt(btn.dataset.fileIdx, 10);
          if (!isNaN(idx) && report.files && report.files[idx]) {
            openAttachment(report.files[idx]);
          }
        });
      });

      filesWrap.style.display = "";
    } else {
      filesWrap.style.display = "none";
    }
  }

  // Footer buttons — conditional by status
  const feedbackSec = document.getElementById("dgDetailFeedbackSection");
  const approveBtn = document.getElementById("dgReportDetailApproveBtn");
  const submitFeedbackBtn = document.getElementById("dgReportDetailSubmitFeedbackBtn");
  const unarchiveBtn = document.getElementById("dgReportDetailUnarchiveBtn");
  const statusBadge = document.getElementById("dgReportDetailStatusBadge");

  const isArchived = !!(report.archived || report.status === "archived");
  const isAlreadyApproved = !isArchived && report.status === "approved";
  const isAlreadyRejected = !isArchived && report.status === "rejected";
  const isSettled = isArchived || isAlreadyApproved || isAlreadyRejected;

  // Reset all first
  if (feedbackSec) feedbackSec.style.display = "none";
  if (approveBtn) approveBtn.style.display = "none";
  if (submitFeedbackBtn) submitFeedbackBtn.style.display = "none";
  if (unarchiveBtn) unarchiveBtn.style.display = "none";
  if (statusBadge) statusBadge.style.display = "none";

  if (isSettled) {
    if (isArchived) {
      if (unarchiveBtn) unarchiveBtn.style.display = "inline-flex";
      if (statusBadge) {
        statusBadge.style.display = "inline-flex";
        statusBadge.style.alignItems = "center";
        statusBadge.style.gap = "0.4rem";
        statusBadge.style.padding = "0.4rem 1rem";
        statusBadge.style.borderRadius = "0.5rem";
        statusBadge.style.fontWeight = "600";
        statusBadge.style.fontSize = "0.875rem";
        statusBadge.innerHTML = `<i class="bi bi-archive-fill"></i> Archived`;
        statusBadge.style.background = "#f1f5f9";
        statusBadge.style.color = "#64748b";
        statusBadge.style.border = "1px solid #cbd5e1";
      }
    } else {
      // Already approved/rejected — show only status badge, no buttons
      if (statusBadge) {
        statusBadge.style.display = "inline-flex";
        statusBadge.style.alignItems = "center";
        statusBadge.style.gap = "0.4rem";
        statusBadge.style.padding = "0.4rem 1rem";
        statusBadge.style.borderRadius = "0.5rem";
        statusBadge.style.fontWeight = "600";
        statusBadge.style.fontSize = "0.875rem";
        if (isAlreadyApproved) {
          statusBadge.innerHTML = `<i class="bi bi-check-circle-fill"></i> Approved`;
          statusBadge.style.background = "#dcfce7";
          statusBadge.style.color = "#16a34a";
          statusBadge.style.border = "1px solid #bbf7d0";
        } else {
          statusBadge.innerHTML = `<i class="bi bi-x-circle-fill"></i> Rejected`;
          statusBadge.style.background = "#fee2e2";
          statusBadge.style.color = "#dc2626";
          statusBadge.style.border = "1px solid #fecaca";
        }
      }
    }
  } else if (mode === "feedback") {
    if (feedbackSec) feedbackSec.style.display = "";
    if (submitFeedbackBtn) submitFeedbackBtn.style.display = "";
  } else {
    if (approveBtn) approveBtn.style.display = "";
  }

  overlay.classList.add("show");
}

export function closeDetailModal() {
  document.getElementById("dgReportDetailOverlay")?.classList.remove("show");
}

export function getDetailFeedbackText() {
  const input = document.getElementById("dgDetailFeedbackInput");
  return input ? input.value.trim() : "";
}

if (typeof window !== "undefined") {
  window.dgOpenAttachment = openAttachment;
  window.dgOpenInNewTab = openInNewTab;
  window.dgOpenAttachmentByIndex = function (idx) {
    try {
      const files =
        window._activeReportFiles && window._activeReportFiles.length
          ? window._activeReportFiles
          : window._currentDetailReport && window._currentDetailReport.files
          ? window._currentDetailReport.files
          : [];
      if (files && files[idx]) {
        openAttachment(files[idx]);
      }
    } catch (err) {
      console.error("Error in dgOpenAttachmentByIndex:", err);
    }
  };
}
