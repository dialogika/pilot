// pilot/pages/hr/team-management/team-management.ui.js
// =====================================================================
// UI MODULE: Team Management
//
// Responsibilities:
// - DOM rendering of division cards and responsive data tables
// - Status pills, contract badges, PKWT file buttons, Document badges
// - Modal form population and input validation
// - Document uploads list rendering (pending & existing)
// - View Documents popup modal rendering
//
// Rules:
// - NO direct Firestore queries or mutations
// =====================================================================

import {
  DIVISIONS,
  ACTIVE_DIVISIONS,
  CONTRACT_TYPES,
  getDocumentKey,
} from "./team-management.repository.js";

const CONTRACT_COLORS = {
  PKWT: "badge bg-primary text-white",
  PKWTT: "badge bg-success text-white",
  Freelance: "badge bg-warning text-dark",
};

/**
 * Escapes HTML characters to prevent XSS injection.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convert division name to URL-friendly slug for element IDs.
 * @param {string} division
 * @returns {string}
 */
export function slugDivision(division) {
  return (division || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Validate and normalize division name against recognized list.
 * @param {string} value
 * @returns {string}
 */
export function normalizeDivision(value) {
  const raw = (value || "").toString().trim();
  return DIVISIONS.includes(raw) ? raw : "";
}

/**
 * Format currency in Indonesian Rupiah (IDR).
 * @param {number|string} value
 * @returns {string}
 */
export function formatFee(value) {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return escapeHtml(value);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

/**
 * Convert status string to CSS class.
 * @param {string} status
 * @returns {string}
 */
export function getStatusClass(status) {
  return (
    "status-" +
    (status || "active").toString().trim().toLowerCase().replace(/\s+/g, "-")
  );
}

/**
 * Build PKWT button or badge HTML.
 * @param {Object} member
 * @returns {string}
 */
export function getPkwtBadgeHtml(member) {
  if (member.pkwtFileUrl) {
    return (
      '<a href="' +
      escapeHtml(member.pkwtFileUrl) +
      '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1" style="padding: 3px 8px; font-size: 0.75rem; border-radius: 6px;">' +
      '<i class="fas fa-file-pdf"></i> Lihat PKWT</a>'
    );
  }
  return '<span class="badge bg-light text-secondary border" style="font-size: 0.7rem; font-weight: 500;">No File</span>';
}

/**
 * Build contract type badge HTML.
 * @param {Object} member
 * @returns {string}
 */
export function getContractBadgeHtml(member) {
  const contractType = member.contractType || "PKWT";
  const badgeClass =
    CONTRACT_COLORS[contractType] || "badge bg-secondary text-white";
  return (
    '<span class="' +
    badgeClass +
    '" style="font-size: 0.75rem; font-weight: 600; padding: 4px 8px; border-radius: 6px;">' +
    escapeHtml(contractType) +
    "</span>"
  );
}

/**
 * Build Document team folder button or badge HTML.
 * @param {Object} member
 * @returns {string}
 */
export function getDocumentBadgeHtml(member) {
  const docs =
    member.documents && Array.isArray(member.documents) ? member.documents : [];
  if (docs.length > 0) {
    const label = docs.length === 1 ? "1 File" : `${docs.length} Files`;
    return (
      '<button type="button" class="btn btn-sm btn-outline-primary team-documents-btn d-inline-flex align-items-center gap-1" data-id="' +
      escapeHtml(member.id) +
      '" style="padding: 3px 8px; font-size: 0.75rem; border-radius: 6px;">' +
      '<i class="fas fa-folder"></i> ' +
      label +
      "</button>"
    );
  }
  return '<span class="badge bg-light text-secondary border" style="font-size: 0.7rem; font-weight: 500;">No Document</span>';
}

/**
 * Format bytes to readable string (B, KB, MB).
 * @param {number} size
 * @returns {string}
 */
export function formatFileSize(size) {
  const bytes = Number(size || 0);
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

/**
 * Render all division sections into the container.
 * @param {HTMLElement} container
 */
export function renderDivisionSections(container) {
  if (!container) return;

  const sectionsToRender = ACTIVE_DIVISIONS.concat(["Ghosted", "Resigned"]);

  container.innerHTML = sectionsToRender
    .map((division) => {
      const slug = slugDivision(division);
      const isSpecial = division === "Ghosted" || division === "Resigned";

      // Only show "Tambah Anggota" button for active divisions
      const addButtonHtml = isSpecial
        ? ""
        : '<button type="button" class="btn btn-team-add team-add-btn" data-division="' +
          escapeHtml(division) +
          '">' +
          '<i class="fas fa-plus"></i> Tambah Anggota' +
          "</button>";

      let headers =
        "<th>Nama</th>" +
        (isSpecial ? "<th>Divisi Asal</th>" : "") +
        "<th>Status</th>" +
        "<th>Kontrak</th>" +
        "<th>PKWT</th>" +
        "<th>Dokumen Tim</th>" +
        "<th>WhatsApp</th>" +
        "<th>Email</th>" +
        "<th>Instagram</th>" +
        "<th>LinkedIn</th>" +
        "<th>Bank / Wallet</th>" +
        "<th>Nomor Rekening</th>" +
        "<th>Price / Fee</th>" +
        '<th class="text-end">Action</th>';

      return (
        '<section class="team-section" data-division="' +
        escapeHtml(division) +
        '">' +
        '<div class="team-section-header">' +
        '<h2 class="team-section-title">' +
        '<span class="team-section-icon"><i class="bi bi-people-fill"></i></span>' +
        "<span>" +
        escapeHtml(division) +
        "</span>" +
        "</h2>" +
        addButtonHtml +
        "</div>" +
        '<div class="table-responsive">' +
        '<table class="table team-table">' +
        "<thead>" +
        "<tr>" +
        headers +
        "</tr>" +
        "</thead>" +
        '<tbody id="teamBody-' +
        slug +
        '"></tbody>' +
        "</table>" +
        "</div>" +
        "</section>"
      );
    })
    .join("");
}

/**
 * Render members into their respective division table tbody.
 * @param {Array<Object>} members
 */
export function renderMembers(members) {
  const sectionsToRender = ACTIVE_DIVISIONS.concat(["Ghosted", "Resigned"]);
  sectionsToRender.forEach((division) => {
    const body = document.getElementById("teamBody-" + slugDivision(division));
    if (body) body.innerHTML = "";
  });

  const sorted = (members || [])
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));

  sorted.forEach((member) => {
    let targetDivision = null;

    if (member.status === "Ghosted") {
      targetDivision = "Ghosted";
    } else if (member.status === "Resigned") {
      targetDivision = "Resigned";
    } else {
      const division = normalizeDivision(member.department || member.division);
      if (division && ACTIVE_DIVISIONS.includes(division)) {
        targetDivision = division;
      }
    }

    if (!targetDivision) return;

    const body = document.getElementById(
      "teamBody-" + slugDivision(targetDivision)
    );
    if (!body) return;

    const isSpecial =
      targetDivision === "Ghosted" || targetDivision === "Resigned";
    const tr = document.createElement("tr");

    const originalDiv =
      member.originalDivision || member.department || member.division || "-";

    tr.innerHTML =
      '<td><span class="member-name">' +
      escapeHtml(member.name || "-") +
      "</span></td>" +
      (isSpecial ? "<td>" + escapeHtml(originalDiv) + "</td>" : "") +
      '<td><span class="status-pill ' +
      getStatusClass(member.status) +
      '">' +
      escapeHtml(member.status || "-") +
      "</span></td>" +
      "<td>" +
      getContractBadgeHtml(member) +
      "</td>" +
      "<td>" +
      getPkwtBadgeHtml(member) +
      "</td>" +
      "<td>" +
      getDocumentBadgeHtml(member) +
      "</td>" +
      "<td>" +
      escapeHtml(member.whatsapp || "-") +
      "</td>" +
      "<td>" +
      escapeHtml(member.email || "-") +
      "</td>" +
      "<td>" +
      escapeHtml(member.instagram || "-") +
      "</td>" +
      "<td>" +
      escapeHtml(member.linkedin || "-") +
      "</td>" +
      "<td>" +
      escapeHtml(member.bank || "-") +
      "</td>" +
      "<td>" +
      escapeHtml(member.accountNumber || "-") +
      "</td>" +
      "<td>" +
      formatFee(member.fee) +
      "</td>" +
      '<td class="text-end">' +
      '<button type="button" class="action-btn me-2 team-edit-btn" data-id="' +
      escapeHtml(member.id) +
      '" title="Edit anggota">' +
      '<i class="fas fa-pen"></i>' +
      "</button>" +
      '<button type="button" class="action-btn danger team-delete-btn" data-id="' +
      escapeHtml(member.id) +
      '" title="Hapus anggota">' +
      '<i class="fas fa-trash"></i>' +
      "</button>" +
      "</td>";

    body.appendChild(tr);
  });
}

/**
 * Render existing & pending document files in the Add/Edit Modal.
 * @param {Array<File>} pendingDocuments
 * @param {Array<Object>} existingDocuments
 * @param {Set<string>} removedDocumentKeys
 */
export function renderSelectedDocuments(
  pendingDocuments = [],
  existingDocuments = [],
  removedDocumentKeys = new Set()
) {
  const listContainer = document.getElementById("teamMemberDocumentsList");
  const existingContainer = document.getElementById(
    "teamExistingDocumentsList"
  );

  const existing = (
    Array.isArray(existingDocuments) ? existingDocuments : []
  ).filter((d) => !removedDocumentKeys.has(getDocumentKey(d)));

  if (existingContainer) {
    existingContainer.innerHTML = existing.length
      ? '<div class="small fw-bold text-muted mb-2">Dokumen tersimpan</div>' +
        existing
          .map((d) => {
            return (
              '<div class="d-flex justify-content-between align-items-center border rounded-3 bg-white px-3 py-2 mb-2">' +
              '<div class="text-truncate pe-3"><i class="fas fa-file me-2 text-muted"></i>' +
              escapeHtml(d.fileName || "File") +
              "</div>" +
              '<button type="button" class="btn btn-sm btn-outline-danger team-remove-existing-document" data-key="' +
              escapeHtml(getDocumentKey(d)) +
              '">' +
              '<i class="fas fa-times"></i>' +
              "</button>" +
              "</div>"
            );
          })
          .join("")
      : "";
  }

  if (!listContainer) return;
  listContainer.innerHTML = pendingDocuments.length
    ? pendingDocuments
        .map((file, index) => {
          return (
            '<li class="d-flex justify-content-between align-items-center border rounded-3 bg-white px-3 py-2 mb-2">' +
            '<span class="text-truncate pe-3"><i class="fas fa-file me-2 text-muted"></i>' +
            escapeHtml(file.name) +
            '<span class="text-muted ms-2">' +
            escapeHtml(formatFileSize(file.size)) +
            "</span></span>" +
            '<button type="button" class="btn btn-sm btn-outline-danger team-remove-pending-document" data-index="' +
            index +
            '">' +
            '<i class="fas fa-times"></i>' +
            "</button>" +
            "</li>"
          );
        })
        .join("")
    : '<li class="text-muted small">Belum ada file baru dipilih.</li>';
}

/**
 * Reset and clear the member modal form.
 * @param {string} division
 */
export function resetMemberForm(division) {
  const form = document.getElementById("teamMemberForm");
  if (form) form.reset();

  document.getElementById("teamMemberId").value = "";
  document.getElementById("teamMemberStatus").value = "Active";
  document.getElementById("teamMemberContractType").value = "PKWT";
  document.getElementById("teamMemberPkwtFile").value = "";
  document.getElementById("pkwtFileStatus").innerHTML = "";
  document.getElementById("teamMemberDocuments").value = "";

  document.getElementById("teamMemberModalTitle").textContent =
    "Tambah Anggota";
  document.getElementById("teamMemberSubmitBtn").textContent =
    "Simpan Anggota";
}

/**
 * Populate the modal form with an existing member's data.
 * @param {Object} member
 */
export function populateMemberForm(member) {
  document.getElementById("teamMemberId").value = member.id || "";
  document.getElementById("teamMemberName").value = member.name || "";
  document.getElementById("teamMemberStatus").value = member.status || "Active";
  document.getElementById("teamMemberContractType").value =
    member.contractType || "PKWT";
  document.getElementById("teamMemberWhatsapp").value = member.whatsapp || "";
  document.getElementById("teamMemberEmail").value = member.email || "";
  document.getElementById("teamMemberInstagram").value =
    member.instagram || "";
  document.getElementById("teamMemberLinkedin").value = member.linkedin || "";
  document.getElementById("teamMemberAddress").value = member.address || "";
  document.getElementById("teamMemberBirthDate").value = member.birthDate || "";
  document.getElementById("teamMemberStartDate").value = member.startDate || "";
  document.getElementById("teamMemberEndDate").value = member.endDate || "";
  document.getElementById("teamMemberBank").value = member.bank || "";
  document.getElementById("teamMemberAccountNumber").value =
    member.accountNumber || "";
  document.getElementById("teamMemberFee").value = member.fee || "";

  const pkwtStatusEl = document.getElementById("pkwtFileStatus");
  if (member.pkwtFileUrl) {
    pkwtStatusEl.innerHTML =
      '<small class="text-success"><i class="fas fa-check-circle"></i> File tersimpan: ' +
      escapeHtml(member.pkwtFileName || "PKWT Contract") +
      "</small><br>" +
      '<small class="text-muted">Upload file baru untuk mengganti</small>';
  } else {
    pkwtStatusEl.innerHTML =
      '<small class="text-warning">Belum ada file PKWT</small>';
  }

  document.getElementById("teamMemberPkwtFile").value = "";
  document.getElementById("teamMemberModalTitle").textContent = "Edit Anggota";
  document.getElementById("teamMemberSubmitBtn").textContent =
    "Simpan Perubahan";
}

/**
 * Extract form inputs into a plain JavaScript payload.
 * @param {string} activeDivision
 * @returns {Object}
 */
export function collectFormData(activeDivision) {
  const feeValue = document.getElementById("teamMemberFee").value.trim();
  return {
    name: document.getElementById("teamMemberName").value.trim(),
    division: normalizeDivision(activeDivision) || DIVISIONS[0],
    status: document.getElementById("teamMemberStatus").value,
    contractType: document.getElementById("teamMemberContractType").value,
    whatsapp: document.getElementById("teamMemberWhatsapp").value.trim(),
    email: document.getElementById("teamMemberEmail").value.trim(),
    instagram: document.getElementById("teamMemberInstagram").value.trim(),
    linkedin: document.getElementById("teamMemberLinkedin").value.trim(),
    address: document.getElementById("teamMemberAddress").value.trim(),
    birthDate: document.getElementById("teamMemberBirthDate").value,
    startDate: document.getElementById("teamMemberStartDate").value,
    endDate: document.getElementById("teamMemberEndDate").value,
    bank: document.getElementById("teamMemberBank").value.trim(),
    accountNumber: document
      .getElementById("teamMemberAccountNumber")
      .value.trim(),
    fee: feeValue === "" ? "" : Number(feeValue),
    pkwtFile: document.getElementById("teamMemberPkwtFile").files[0] || null,
  };
}

/**
 * Populate and display the Documents View modal.
 * @param {Object} member
 */
export function renderDocumentsViewModal(member) {
  const memberNameEl = document.getElementById("documentsMemberName");
  const listContainer = document.getElementById("documentsListContainer");

  if (memberNameEl) memberNameEl.textContent = member.name || "Unknown";

  const docs =
    member.documents && Array.isArray(member.documents) ? member.documents : [];
  if (docs.length === 0) {
    listContainer.innerHTML =
      '<div class="alert alert-info mb-0"><i class="fas fa-info-circle me-2"></i>Tidak ada dokumen</div>';
  } else {
    let html =
      '<table class="table table-sm table-striped mb-0"><tbody>' +
      docs
        .map((d) => {
          return (
            "<tr>" +
            '<td><i class="fas fa-file me-2 text-muted"></i>' +
            escapeHtml(d.fileName || "File") +
            "</td>" +
            '<td class="text-end" style="white-space: nowrap;">' +
            '<a href="' +
            escapeHtml(d.fileUrl) +
            '" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary me-2"><i class="fas fa-eye"></i> Lihat</a>' +
            '<a href="' +
            escapeHtml(d.fileUrl) +
            '" download class="btn btn-sm btn-outline-success"><i class="fas fa-download"></i> Download</a>' +
            "</td>" +
            "</tr>"
          );
        })
        .join("") +
      "</tbody></table>";
    listContainer.innerHTML = html;
  }
}
