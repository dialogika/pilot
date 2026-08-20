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
            <h4 id="dgReportTitle">Report Side Quest</h4>
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
              <button type="button" class="dg-report-tab-btn active" id="dgReportTabSide" data-quest-tab="side">Side Quest</button>
              <button type="button" class="dg-report-tab-btn" id="dgReportTabMain" data-quest-tab="main">Main Quest</button>
              <button type="button" class="dg-report-tab-btn" id="dgReportTabProject" data-quest-tab="project">Project Quest</button>
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
                  <span class="dg-report-breakdown-label">Main Quest</span>
                  <div class="dg-report-progress-track">
                    <div class="dg-report-progress-fill bg-main" id="dgBreakdownMainBar" style="width: 0%;"></div>
                  </div>
                  <span class="dg-report-breakdown-count" id="dgBreakdownMainCount">0</span>
                </div>
                <div class="dg-report-breakdown-row">
                  <span class="dg-report-breakdown-label">Side Quest</span>
                  <div class="dg-report-progress-track">
                    <div class="dg-report-progress-fill bg-side" id="dgBreakdownSideBar" style="width: 0%;"></div>
                  </div>
                  <span class="dg-report-breakdown-count" id="dgBreakdownSideCount">0</span>
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
                  <th class="dg-report-col-select js-bulk-select-col" style="display:none;width:40px;text-align:center;"></th>
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
          <button type="button" class="btn btn-secondary btn-sm" id="dgReportDetailCancelBtn" style="padding:0.4rem 0.85rem;border-radius:0.5rem;border:1px solid #cbd5e1;background:#fff;cursor:pointer;">Close</button>
          <button type="button" class="btn btn-success btn-sm" id="dgReportDetailApproveBtn" style="padding:0.4rem 1rem;border-radius:0.5rem;background:#16a34a;color:#fff;border:none;font-weight:600;cursor:pointer;">Approve Task</button>
          <button type="button" class="btn btn-danger btn-sm" id="dgReportDetailSubmitFeedbackBtn" style="display:none;padding:0.4rem 1rem;border-radius:0.5rem;background:#dc2626;color:#fff;border:none;font-weight:600;cursor:pointer;">Submit Feedback &amp; Reject</button>
        </div>
      </div>
    </div>
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
  const titles = {
    side: "Report Side Quest",
    main: "Report Main Quest",
    project: "Report Project Quest",
  };
  const titleEl = document.getElementById("dgReportTitle");
  if (titleEl) titleEl.textContent = titles[tab] || "Report Quest";

  document.querySelectorAll(".dg-report-tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-quest-tab") === tab);
  });
}

export function renderAvatarPile(uids, usersMap, max = 3) {
  const ids = Array.isArray(uids) ? uids.filter(Boolean) : [];
  if (!ids.length) return '<span class="text-muted" style="font-size:0.75rem;">-</span>';

  let html = '<div class="dg-report-avatar-pile">';
  const showCount = Math.min(ids.length, max);
  for (let i = 0; i < showCount; i++) {
    const uid = ids[i];
    const user = usersMap && usersMap[uid] ? usersMap[uid] : { uid, name: uid, photo: "" };
    const name = user.name || uid;
    if (user.photo) {
      html += `<img src="${escapeAttr(user.photo)}" class="dg-report-avatar-item" title="${escapeAttr(name)}" alt="" />`;
    } else {
      const ini = initialsOf(name);
      html += `<span class="dg-report-avatar-item" title="${escapeAttr(name)}">${escapeHtml(ini)}</span>`;
    }
  }
  if (ids.length > max) {
    html += `<span class="dg-report-avatar-more">+${ids.length - max}</span>`;
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
  const mainCount = stats.breakdown?.main || 0;
  const sideCount = stats.breakdown?.side || 0;
  const projectCount = stats.breakdown?.project || 0;
  const totalBreakdown = Math.max(mainCount + sideCount + projectCount, 1);

  const mainPct = Math.round((mainCount / totalBreakdown) * 100);
  const sidePct = Math.round((sideCount / totalBreakdown) * 100);
  const projectPct = Math.round((projectCount / totalBreakdown) * 100);

  const mainBar = document.getElementById("dgBreakdownMainBar");
  const sideBar = document.getElementById("dgBreakdownSideBar");
  const projectBar = document.getElementById("dgBreakdownProjectBar");
  const mainCountEl = document.getElementById("dgBreakdownMainCount");
  const sideCountEl = document.getElementById("dgBreakdownSideCount");
  const projectCountEl = document.getElementById("dgBreakdownProjectCount");

  if (mainBar) mainBar.style.width = `${mainPct}%`;
  if (sideBar) sideBar.style.width = `${sidePct}%`;
  if (projectBar) projectBar.style.width = `${projectPct}%`;

  if (mainCountEl) mainCountEl.textContent = String(mainCount);
  if (sideCountEl) sideCountEl.textContent = String(sideCount);
  if (projectCountEl) projectCountEl.textContent = String(projectCount);
}

export function renderTable(reports, usersMap, callbacks = {}, bulkMode = false, selectedIds = {}) {
  const tbody = document.getElementById("dgReportTableBody");
  if (!tbody) return;

  // Toggle bulk select header col
  document.querySelectorAll(".js-bulk-select-col").forEach((el) => {
    el.style.display = bulkMode ? "" : "none";
  });

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
    const isApproved = r.status === "approved";
    const statusLabel = isApproved ? "Approved" : r.status === "rejected" ? "Rejected" : "Pending";
    const statusColor = isApproved ? "text-success" : r.status === "rejected" ? "text-danger" : "text-muted";

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
        .map((f) => {
          let icon = "bi-file-earmark";
          const type = String(f.type || "").toLowerCase();
          if (type.includes("pdf")) icon = "bi-file-earmark-pdf text-danger";
          else if (type.includes("zip") || type.includes("rar")) icon = "bi-file-earmark-zip text-warning";
          else if (type.startsWith("image/")) icon = "bi-file-earmark-image text-primary";
          return `<a href="${escapeAttr(f.url || "#")}" target="_blank" class="text-decoration-none me-1" title="${escapeAttr(f.name || "")}"><i class="bi ${icon}"></i></a>`;
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
          <button type="button" class="dg-report-btn-reject js-btn-reject" title="Reject"><i class="bi bi-x-lg"></i></button>
          <button type="button" class="dg-report-btn-approve js-btn-approve ${isApproved ? "is-approved" : ""}">
            ${isApproved ? "Approved" : "Approve"}
          </button>
        </div>
      </td>
    `;

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

export function openDetailModal(report, mode, usersMap) {
  const overlay = document.getElementById("dgReportDetailOverlay");
  if (!overlay || !report) return;

  document.getElementById("dgReportDetailTaskTitle").textContent = report.task || "Report Details";
  document.getElementById("dgDetailAssignAvatars").innerHTML = renderAvatarPile(report.assignees, usersMap, 5);
  document.getElementById("dgDetailNotifyAvatars").innerHTML = renderAvatarPile(report.notifyTo, usersMap, 5);

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
        .map((f) => `<a href="${escapeAttr(f.url || "#")}" target="_blank" class="btn btn-sm btn-outline-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;border:1px solid #cbd5e1;border-radius:0.375rem;text-decoration:none;color:#334155;"><i class="bi bi-paperclip"></i> ${escapeHtml(f.name || "File")}</a>`)
        .join("");
      filesWrap.style.display = "";
    } else {
      filesWrap.style.display = "none";
    }
  }

  // Mode feedback vs view
  const feedbackSec = document.getElementById("dgDetailFeedbackSection");
  const approveBtn = document.getElementById("dgReportDetailApproveBtn");
  const submitFeedbackBtn = document.getElementById("dgReportDetailSubmitFeedbackBtn");

  if (mode === "feedback") {
    if (feedbackSec) feedbackSec.style.display = "";
    if (approveBtn) approveBtn.style.display = "none";
    if (submitFeedbackBtn) submitFeedbackBtn.style.display = "";
  } else {
    if (feedbackSec) feedbackSec.style.display = "none";
    if (approveBtn) approveBtn.style.display = "";
    if (submitFeedbackBtn) submitFeedbackBtn.style.display = "none";
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
