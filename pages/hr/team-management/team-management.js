// pilot/pages/hr/team-management/team-management.js
// =====================================================================
// ORCHESTRATOR: Team Management
//
// Responsibilities:
// - Feature lifecycle & authentication check via requireAuth()
// - Mounting Shell Topbar and Sidebar
// - Coordinating Firestore real-time subscriptions with UI rendering
// - Handling form submissions, uploads, and modal workflows
// =====================================================================

import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import { renderRightbarRecruit } from "../../../element/rightbar-recruit.js";

import * as TeamRepo from "./team-management.repository.js";
import * as TeamUI from "./team-management.ui.js";

const state = {
  members: [],
  editingId: "",
  modal: null,
  documentsModal: null,
  pendingDocuments: [],
  removedDocumentKeys: new Set(),
  activeDivision: TeamRepo.DIVISIONS[0],
};

let unsubscribeTeamMembers = null;

/**
 * Open the Add Member modal for a specific division.
 * @param {string} division
 */
function openAddModal(division) {
  state.editingId = "";
  state.activeDivision =
    TeamUI.normalizeDivision(division) || TeamRepo.DIVISIONS[0];
  state.pendingDocuments = [];
  state.removedDocumentKeys = new Set();

  TeamUI.resetMemberForm(division);
  TeamUI.renderSelectedDocuments(
    state.pendingDocuments,
    [],
    state.removedDocumentKeys
  );

  if (state.modal) state.modal.show();
}

/**
 * Open the Edit Member modal with loaded member details.
 * @param {string} id
 */
function openEditModal(id) {
  const member = state.members.find((item) => item.id === id);
  if (!member) return;

  state.editingId = id;

  let activeDivision = member.division || TeamRepo.DIVISIONS[0];
  if (
    (member.status === "Ghosted" || member.status === "Resigned") &&
    member.originalDivision
  ) {
    activeDivision = member.originalDivision;
  }
  state.activeDivision =
    TeamUI.normalizeDivision(activeDivision) || TeamRepo.DIVISIONS[0];

  state.pendingDocuments = [];
  state.removedDocumentKeys = new Set();

  TeamUI.populateMemberForm(member);
  TeamUI.renderSelectedDocuments(
    state.pendingDocuments,
    member.documents || [],
    state.removedDocumentKeys
  );

  if (state.modal) state.modal.show();
}

/**
 * Open the Documents View modal for a member.
 * @param {string} memberId
 */
function openDocumentsModal(memberId) {
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return;

  TeamUI.renderDocumentsViewModal(member);

  const modalEl = document.getElementById("teamDocumentsViewModal");
  if (modalEl && window.bootstrap) {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.show();
  }
}

/**
 * Get current documents of the member being edited.
 * @returns {Array<Object>}
 */
function getCurrentEditingDocuments() {
  if (!state.editingId) return [];
  const member = state.members.find((item) => item.id === state.editingId);
  return member && Array.isArray(member.documents) ? member.documents : [];
}

/**
 * Handle new document files selected in input.
 * @param {Event} event
 */
function handleDocumentInputChange(event) {
  const files = Array.from(event.target.files || []);
  files.forEach((file) => {
    if (
      TeamRepo.isAllowedDocumentFile(file) &&
      !state.pendingDocuments.some(
        (existing) =>
          existing.name === file.name && existing.size === file.size
      )
    ) {
      state.pendingDocuments.push(file);
    }
  });
  event.target.value = "";
  TeamUI.renderSelectedDocuments(
    state.pendingDocuments,
    getCurrentEditingDocuments(),
    state.removedDocumentKeys
  );
}

/**
 * Save new or updated team member.
 * @param {Event} event
 */
async function handleSaveMember(event) {
  event.preventDefault();
  const payload = TeamUI.collectFormData(state.activeDivision);

  if (!payload.name) {
    alert("Nama wajib diisi.");
    return;
  }

  const submitBtn = document.getElementById("teamMemberSubmitBtn");
  if (submitBtn) submitBtn.disabled = true;

  try {
    if (state.editingId) {
      const existingMember = state.members.find(
        (m) => m.id === state.editingId
      );
      const oldStatus = existingMember?.status || "Active";
      const newStatus = payload.status;

      let pkwtFileUrl = existingMember?.pkwtFileUrl || null;
      let pkwtFileName = existingMember?.pkwtFileName || null;
      let pkwtFilePath = existingMember?.pkwtFilePath || null;

      if (payload.pkwtFile) {
        const fileResult = await TeamRepo.uploadPkwtFile(
          state.editingId,
          payload.pkwtFile,
          existingMember?.pkwtFilePath
        );
        pkwtFileUrl = fileResult.url;
        pkwtFileName = fileResult.fileName;
        pkwtFilePath = fileResult.filePath;
      }

      const existingDocuments = Array.isArray(existingMember?.documents)
        ? existingMember.documents
        : [];
      await TeamRepo.deleteRemovedDocuments(
        existingDocuments,
        state.removedDocumentKeys
      );

      const keptDocuments = existingDocuments.filter(
        (d) =>
          !state.removedDocumentKeys.has(TeamRepo.getDocumentKey(d))
      );
      const uploadedDocuments = await TeamRepo.uploadTeamDocuments(
        state.editingId,
        state.pendingDocuments
      );
      const documentsArray = TeamRepo.deduplicateDocuments(
        keptDocuments.concat(uploadedDocuments)
      );

      let divisionToSave = payload.division;
      let originalDivisionToSave =
        existingMember?.originalDivision || payload.division;

      if (newStatus === "Ghosted" || newStatus === "Resigned") {
        divisionToSave = newStatus;
        if (oldStatus !== "Ghosted" && oldStatus !== "Resigned") {
          originalDivisionToSave = payload.division;
        }
      } else {
        if (oldStatus === "Ghosted" || oldStatus === "Resigned") {
          if (existingMember?.originalDivision) {
            divisionToSave = existingMember.originalDivision;
          }
        } else {
          divisionToSave = payload.division;
        }
      }

      const updatePayload = {
        name: payload.name,
        division: divisionToSave,
        department: divisionToSave,
        originalDivision: originalDivisionToSave,
        status: newStatus,
        contractType: payload.contractType,
        whatsapp: payload.whatsapp,
        email: payload.email,
        instagram: payload.instagram,
        linkedin: payload.linkedin,
        address: payload.address,
        birthDate: payload.birthDate,
        startDate: payload.startDate,
        endDate: payload.endDate,
        bank: payload.bank,
        accountNumber: payload.accountNumber,
        fee: payload.fee,
        pkwtFileUrl,
        pkwtFileName,
        pkwtFilePath,
        documents: documentsArray,
      };

      await TeamRepo.updateTeamMember(state.editingId, updatePayload);
    } else {
      const status = payload.status || "Active";
      let divisionToSave = payload.division;
      let originalDivisionToSave = payload.division;

      if (status === "Ghosted" || status === "Resigned") {
        divisionToSave = status;
        originalDivisionToSave = state.activeDivision;
      }

      const createPayload = {
        name: payload.name,
        division: divisionToSave,
        department: divisionToSave,
        originalDivision: originalDivisionToSave,
        status,
        contractType: payload.contractType,
        whatsapp: payload.whatsapp,
        email: payload.email,
        instagram: payload.instagram,
        linkedin: payload.linkedin,
        address: payload.address,
        birthDate: payload.birthDate,
        startDate: payload.startDate,
        endDate: payload.endDate,
        bank: payload.bank,
        accountNumber: payload.accountNumber,
        fee: payload.fee,
        pkwtFileUrl: null,
        pkwtFileName: null,
        pkwtFilePath: null,
        documents: [],
      };

      const memberRef = await TeamRepo.createTeamMember(createPayload);

      let pkwtFileUrl = null;
      let pkwtFileName = null;
      let pkwtFilePath = null;

      if (payload.pkwtFile) {
        const fileResult = await TeamRepo.uploadPkwtFile(
          memberRef.id,
          payload.pkwtFile,
          null
        );
        pkwtFileUrl = fileResult.url;
        pkwtFileName = fileResult.fileName;
        pkwtFilePath = fileResult.filePath;
      }

      const uploadedDocuments = await TeamRepo.uploadTeamDocuments(
        memberRef.id,
        state.pendingDocuments
      );
      const documentsArray =
        TeamRepo.deduplicateDocuments(uploadedDocuments);

      if (pkwtFileUrl || documentsArray.length) {
        await TeamRepo.updateTeamMember(memberRef.id, {
          pkwtFileUrl,
          pkwtFileName,
          pkwtFilePath,
          documents: documentsArray,
        });
      }
    }

    if (state.modal) state.modal.hide();
  } catch (error) {
    console.error("Failed to save team member:", error);
    alert("Gagal menyimpan anggota team: " + error.message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

/**
 * Handle deleting a team member with confirmation.
 * @param {string} id
 */
async function handleDeleteMember(id) {
  if (!id) return;
  const member = state.members.find((item) => item.id === id);
  const name = member && member.name ? member.name : "anggota ini";
  const ok = confirm(`Hapus ${name} dari Team Management?`);
  if (!ok) return;

  try {
    await TeamRepo.deleteTeamMember(id);
  } catch (error) {
    console.error("Failed to delete team member:", error);
    alert("Gagal menghapus anggota team: " + error.message);
  }
}

/**
 * Attach DOM event listeners for forms, buttons, and document lists.
 */
function wireEvents() {
  const modalEl = document.getElementById("teamMemberModal");
  state.modal =
    modalEl && window.bootstrap
      ? bootstrap.Modal.getOrCreateInstance(modalEl)
      : null;

  const form = document.getElementById("teamMemberForm");
  if (form) {
    form.addEventListener("submit", handleSaveMember);
  }

  const documentInput = document.getElementById("teamMemberDocuments");
  if (documentInput) {
    documentInput.addEventListener("change", handleDocumentInputChange);
  }

  const documentChooseBtn = document.getElementById(
    "teamMemberDocumentsChooseBtn"
  );
  if (documentChooseBtn && documentInput) {
    documentChooseBtn.addEventListener("click", () => {
      documentInput.click();
    });
  }

  if (modalEl) {
    modalEl.addEventListener("click", (event) => {
      const pendingBtn = event.target.closest(".team-remove-pending-document");
      const existingBtn = event.target.closest(
        ".team-remove-existing-document"
      );

      if (pendingBtn) {
        const index = Number(pendingBtn.getAttribute("data-index"));
        if (!Number.isNaN(index)) {
          state.pendingDocuments.splice(index, 1);
          TeamUI.renderSelectedDocuments(
            state.pendingDocuments,
            getCurrentEditingDocuments(),
            state.removedDocumentKeys
          );
        }
        return;
      }

      if (existingBtn) {
        const key = existingBtn.getAttribute("data-key") || "";
        if (key) {
          state.removedDocumentKeys.add(key);
          TeamUI.renderSelectedDocuments(
            state.pendingDocuments,
            getCurrentEditingDocuments(),
            state.removedDocumentKeys
          );
        }
      }
    });
  }

  const container = document.getElementById("teamDivisionContainer");
  if (container) {
    container.addEventListener("click", (event) => {
      const addBtn = event.target.closest(".team-add-btn");
      const editBtn = event.target.closest(".team-edit-btn");
      const deleteBtn = event.target.closest(".team-delete-btn");
      const documentsBtn = event.target.closest(".team-documents-btn");

      if (addBtn) {
        openAddModal(
          addBtn.getAttribute("data-division") || TeamRepo.DIVISIONS[0]
        );
        return;
      }
      if (editBtn) {
        openEditModal(editBtn.getAttribute("data-id") || "");
        return;
      }
      if (deleteBtn) {
        handleDeleteMember(deleteBtn.getAttribute("data-id") || "");
        return;
      }
      if (documentsBtn) {
        openDocumentsModal(documentsBtn.getAttribute("data-id") || "");
      }
    });
  }
}

/**
 * Initialize Team Management page.
 */
async function init() {
  try {
    // 1. Initial UI structure setup
    const container = document.getElementById("teamDivisionContainer");
    TeamUI.renderDivisionSections(container);
    wireEvents();

    if (typeof renderRightbarRecruit === "function") {
      renderRightbarRecruit();
    }

    // 2. Auth Guard
    const authResult = await requireAuth();
    if (!authResult) return;

    const { user, role } = authResult;

    // 3. Mount Shell Topbar & Sidebar
    renderTopbar({ user, role: role || "member" });
    renderSidebar({ role: role || "member", activePage: "team-management" });

    // 4. Real-time Firestore sync
    if (unsubscribeTeamMembers) {
      unsubscribeTeamMembers();
    }
    unsubscribeTeamMembers = TeamRepo.subscribeTeamMembers(
      (members) => {
        state.members = members;
        TeamUI.renderMembers(members);
      },
      (error) => {
        console.error("Failed to load team management data:", error);
      }
    );
  } catch (error) {
    console.error("Initialization error in team-management:", error);
  }
}

// Start on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
