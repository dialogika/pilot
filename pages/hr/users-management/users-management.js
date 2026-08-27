/**
 * users-management.js
 *
 * Orchestrator for the Users Management feature.
 *
 * Responsibilities:
 * - Initialize feature and authenticate
 * - Coordinate repository and UI modules
 * - Manage state and event wiring
 * - Persist all Firestore calls in the repository module
 */
import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";

import {
  listUsers,
  loadPositionsMap,
  getUser,
  addUser,
  updateUser,
  updateUserRole,
  deleteUser,
} from "./users-management.repository.js";

import {
  renderTable,
  renderEmptyTable,
  renderError,
  renderSkeleton,
  renderRoleOptions,
  renderPositionOptions,
  renderFilterRoleOptions,
  renderPagination,
  updateModalTitle,
  updateSubmitButtonLabel,
  populateEditForm,
  getFormData,
  setEditModeFields,
  setDeleteUserLabel,
  setSearchInputHandler,
  setFiltersChangeHandler,
  setAddUserClickHandler,
  setRowsPerPageChangeHandler,
  setPrevPageHandler,
  setNextPageHandler,
  setPageNumberClickHandler,
  setTableActionHandler,
  setAddModalSaveHandler,
  setDeleteConfirmHandler,
  showAddEditModal,
  hideAddEditModal,
  showDeleteModal,
  hideDeleteModal,
  wireModalCloseButtons,
  notifySuccess,
  notifyError,
} from "./users-management.ui.js";

let _users = [];
let _positionsMap = {};
let _searchQuery = "";
let _roleFilter = "";
let _currentPage = 1;
let _rowsPerPage = 10;
let _activeModalType = null; // 'add' | 'edit'
let _editingUser = null;
let _deletingUser = null;

/* ───────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────── */

function filteredUsers() {
  let list = [..._users];

  if (_searchQuery) {
    const q = _searchQuery.toLowerCase();
    list = list.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.nickname || "").toLowerCase().includes(q)
    );
  }

  if (_roleFilter) {
    list = list.filter(
      (u) => (u.role || "").toLowerCase() === _roleFilter.toLowerCase()
    );
  }

  return list;
}

function clampedPage(total) {
  const max = Math.max(1, Math.ceil(total / _rowsPerPage));
  if (_currentPage > max) _currentPage = max;
}

function resetPagination() {
  _currentPage = 1;
}

/* ───────────────────────────────────────────
   Render: table + pagination
   ─────────────────────────────────────────── */

function refreshTable() {
  const all = filteredUsers();
  clampedPage(all.length);
  const start = (_currentPage - 1) * _rowsPerPage;
  const pageRows = all.slice(start, start + _rowsPerPage);

  if (_users.length === 0) {
    renderEmptyTable();
  } else {
    renderTable(pageRows, {}, _positionsMap);
  }

  renderPagination({
    currentPage: _currentPage,
    totalRows: all.length,
    rowsPerPage: _rowsPerPage,
    totalPages: Math.ceil(all.length / _rowsPerPage),
  });
}

/* ───────────────────────────────────────────
   Event wiring
   ─────────────────────────────────────────── */

function wireEventHandlers() {
  // Search
  setSearchInputHandler((q) => {
    _searchQuery = q;
    resetPagination();
    refreshTable();
  });

  // Role filter
  setFiltersChangeHandler(({ role }) => {
    _roleFilter = role || "";
    resetPagination();
    refreshTable();
  });

  // Rows per page
  setRowsPerPageChangeHandler((val) => {
    _rowsPerPage = val;
    resetPagination();
    refreshTable();
  });

  // Pagination nav
  setPrevPageHandler(() => {
    if (_currentPage > 1) {
      _currentPage--;
      refreshTable();
    }
  });

  setNextPageHandler(() => {
    const total = filteredUsers().length;
    const max = Math.ceil(total / _rowsPerPage);
    if (_currentPage < max) {
      _currentPage++;
      refreshTable();
    }
  });

  setPageNumberClickHandler((page) => {
    _currentPage = page;
    refreshTable();
  });

  // Table row actions (edit / delete) — no shield action (removed)
  setTableActionHandler((action, userId) => {
    if (action === "edit") startEdit(userId);
    else if (action === "delete") startDelete(userId);
  });

  // Add user button
  setAddUserClickHandler(() => {
    _activeModalType = "add";
    _editingUser = null;
    updateModalTitle("Add User");
    updateSubmitButtonLabel("Save");
    renderRoleOptions({});
    renderPositionOptions(_positionsMap);
    setEditModeFields(false);
    // Clear form — add mode shows Display Name + Password per legacy add
    populateEditForm({
      fullName: "",
      displayName: "",
      email: "",
      role: "staff",
      position: "",
      department: "",
      phone: "",
      status: "Active",
      password: "",
    });
    showAddEditModal();
  });

  // Save (add or edit) — role change via Cloud Function when editing
  let _saving = false;
  setAddModalSaveHandler(async () => {
    if (_saving) return;
    const data = getFormData();
    if (!data.fullName && !data.email) {
      notifyError("Full name or email is required");
      return;
    }

    const btn = document.getElementById("um-submit-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving…";
    }
    _saving = true;

    try {
      if (_activeModalType === "edit" && _editingUser) {
        const uid = _editingUser.id; // Firestore doc ID == Auth UID (established architecture)
        const originalRole = String(_editingUser.role || "").toLowerCase();
        const newRole = String(data.role || "").toLowerCase();
        const roleChanged = newRole && newRole !== originalRole;

        // 1) Role change via trusted Cloud Function (must not directly update claims)
        if (roleChanged) {
          try {
            await updateUserRole(uid, newRole);
          } catch (roleErr) {
            console.error("[UsersManagement] setUserRole failed:", roleErr);
            notifyError(roleErr.message || "Failed to update role. Role not changed.");
            throw roleErr; // prevent success UI
          }
        }

        // 2) Other profile fields via partial Firestore update (no overwrite, no role duplicate)
        const patch = {};
        // Only send fields that are part of edit modal (Display Name/Password removed)
        if (data.fullName !== undefined) patch.name = data.fullName;
        if (data.email !== undefined) patch.email = data.email;
        if (data.position !== undefined) patch.position = data.position;
        // Phone: task requires data.phone (legacy phoneNumber as fallback already in repo)
        if (data.phone !== undefined) patch.phone = data.phone;
        if (data.department !== undefined) patch.department = data.department;
        if (data.status !== undefined) patch.status = data.status;
        // Do NOT send nickname/displayName or password for edit (removed); role already handled

        // Remove empty patch case — if only role changed, patch may be minimal
        const hasPatch = Object.keys(patch).some((k) => patch[k] !== "" && patch[k] !== undefined);
        if (hasPatch) {
          await updateUser(uid, patch);
        }

        notifySuccess(roleChanged ? "User and role updated successfully" : "User updated successfully");
      } else {
        // Add flow — create Firestore doc (no Auth creation; role is display data)
        // Note: displayName and password collected only for add mode; password not used for Firestore-only create
        await addUser({
          name: data.fullName,
          nickname: data.displayName || "",
          email: data.email,
          role: data.role || "staff",
          position: data.position,
          phone: data.phone || "",
          status: data.status || "Active",
          department: data.department || "",
        });
        notifySuccess("User created successfully");
      }
      hideAddEditModal();
      await _reload();
    } catch (err) {
      console.error("[UsersManagement] Save error:", err);
      // Only show generic if not already shown for role failure
      if (err && !err._roleHandled) {
        // notifyError already called for role; avoid duplicate
        // For non-role errors, show error
        if (err.message && !err.message.includes("Failed to update role")) {
          notifyError(err.message || "Failed to save user");
        }
      }
      // Keep modal open on failure, do not refresh table (preserve previous role)
    } finally {
      _saving = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = _activeModalType === "edit" ? "Update" : "Save";
      }
    }
  });

  // Delete confirm
  setDeleteConfirmHandler(async () => {
    if (!_deletingUser) return;
    const btn = document.getElementById("um-confirm-delete-btn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Deleting…";
    }

    try {
      await deleteUser(_deletingUser.id);
      notifySuccess("User deleted");
      hideDeleteModal();
      await _reload();
    } catch (err) {
      console.error("[UsersManagement] Delete error:", err);
      notifyError(err.message || "Failed to delete user");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Delete";
      }
    }
  });
}

/* ───────────────────────────────────────────
   Public API — called from table row actions
   ─────────────────────────────────────────── */

async function startEdit(userId) {
  const fallbackUser = _users.find((u) => u.id === userId);
  if (!fallbackUser) return;
  _activeModalType = "edit";
  _editingUser = fallbackUser;
  updateModalTitle("Edit User");
  updateSubmitButtonLabel("Update");
  renderRoleOptions({});
  renderPositionOptions(_positionsMap);
  setEditModeFields(true);

  // Load complete user document for phone and latest fields (not just table row)
  let full = null;
  try {
    full = await getUser(userId);
  } catch (e) {
    console.warn("[UsersManagement] getUser failed, fallback to table row", e);
  }
  const src = full || fallbackUser;
  // src from getUser has phone, name, email, role, position; fallback has same keys except may miss phone
  const phoneVal = src.phone || src.phoneNumber || fallbackUser.phone || "";
  populateEditForm({
    fullName: src.name || "",
    displayName: "", // hidden in edit mode
    email: src.email || "",
    role: src.role || fallbackUser.role || "",
    position: src.position || fallbackUser.position || "",
    department: src.department || "",
    phone: phoneVal,
    status: src.status || fallbackUser.status || "Active",
    password: "", // hidden
  });
  showAddEditModal();
}

function startDelete(userId) {
  const user = _users.find((u) => u.id === userId);
  if (!user) return;
  _deletingUser = user;
  setDeleteUserLabel(user);
  showDeleteModal();
}

/* ───────────────────────────────────────────
   Data loading
   ─────────────────────────────────────────── */

async function _reload() {
  try {
    _users = await listUsers();
  } catch (err) {
    console.error("[UsersManagement] Failed to reload users:", err);
  }
  refreshTable();
}

/* ───────────────────────────────────────────
   Initialize
   ─────────────────────────────────────────── */

export async function initialize() {
  try {
    console.log("[UsersManagement] initialize start");
    renderSkeleton();

    const [users, positionsMap] = await Promise.allSettled([
      listUsers(),
      loadPositionsMap(),
    ]);

    _users = users.status === "fulfilled" ? users.value : [];
    _positionsMap =
      positionsMap.status === "fulfilled" ? positionsMap.value : {};

    console.log(
      `[UsersManagement] Loaded ${_users.length} users, ${Object.keys(_positionsMap).length} positions`
    );

    wireModalCloseButtons();
    wireEventHandlers();
    refreshTable();
  } catch (err) {
    console.error("[UsersManagement] Failed to initialize:", err);
    renderError(err.message || "Failed to load Users Management");
  }
}

/* ── Boot — integrated with shared shell (matches performance-appraisal) ── */
async function initializeWithShell() {
  const { user, role } = await requireAuth();
  renderTopbar({ user, role });
  renderSidebar({ role, activePage: "users-management" });
  return initialize();
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initializeWithShell().catch((e) => console.error("[UsersManagement] boot error", e));
    });
  } else {
    initializeWithShell().catch((e) => console.error("[UsersManagement] boot error", e));
  }
}
