// pages/file-manager/file-manager.js
// =====================================================================
// FILE MANAGER ORCHESTRATOR — coordinates auth, shell, repository and UI.
//
// Rules:
//  - Uses requireAuth() before loading anything.
//  - Mounts renderTopbar and renderSidebar (activePage: "file-manager").
//  - Coordinates state: folder navigation, breadcrumbs, search, upload,
//    and config synchronization.
// =====================================================================

import { requireAuth } from "/assets/js/auth-guard.js";
import { renderTopbar } from "/assets/js/components/topbar/topbar.js";
import { renderSidebar } from "/assets/js/components/sidebar/sidebar.js";
import * as repo from "./file-manager.repository.js";
import * as ui from "./file-manager.ui.js";

let currentUser = null;
let currentRole = null;

// State navigasi
let driveConfig = repo.getDriveConfig();
let currentFolderId = driveConfig.rootFolderId;
let breadcrumbs = [
  { id: driveConfig.rootFolderId, name: driveConfig.rootFolderName || "Shared Drive" }
];
let rawFolders = [];
let rawFiles = [];
let currentViewMode = "grid"; // 'grid' | 'list'
let currentSortMode = "name"; // 'name' | 'newest' | 'size'
let searchQuery = "";

// Modals
let uploadModal = null;
let newFolderModal = null;
let configModal = null;
let previewModal = null;

/**
 * Entry point utama inisialisasi File Manager.
 */
async function initializeFileManager() {
  try {
    // 1. Auth Guard (Pemeriksaan sesi login)
    const authState = await requireAuth();
    if (!authState) return;

    currentUser = authState.user;
    currentRole = authState.role;

    // 2. Mount App Shell Components
    renderTopbar({ user: currentUser, role: currentRole });
    renderSidebar({ role: currentRole, activePage: "file-manager" });

    // 3. Inisialisasi Modals Bootstrap
    initModals();

    // 4. Update status koneksi di banner atas
    ui.renderConnectionStatus(driveConfig);

    // 5. Bind User Events (Search, Toolbar, Modals)
    bindEvents();

    // 6. Muat isi folder root awal
    await navigateToFolder(driveConfig.rootFolderId, 0);

    console.log("File Manager feature successfully initialized.");
  } catch (err) {
    console.error("Gagal menginisialisasi File Manager:", err);
    ui.renderError(err.message || "Gagal memuat halaman File Manager.", () => {
      initializeFileManager();
    });
  }
}

/**
 * Inisialisasi referensi Bootstrap modal.
 */
function initModals() {
  const elUpload = document.getElementById("fmUploadModal");
  if (elUpload && window.bootstrap) uploadModal = new bootstrap.Modal(elUpload);

  const elFolder = document.getElementById("fmNewFolderModal");
  if (elFolder && window.bootstrap) newFolderModal = new bootstrap.Modal(elFolder);

  const elConfig = document.getElementById("fmConfigModal");
  if (elConfig && window.bootstrap) configModal = new bootstrap.Modal(elConfig);

  const elPreview = document.getElementById("fmPreviewModal");
  if (elPreview && window.bootstrap) previewModal = new bootstrap.Modal(elPreview);
}

/**
 * Memuat isi folder berdasarkan folderId dan memperbarui UI.
 */
async function navigateToFolder(folderId, crumbIndex = null) {
  try {
    ui.renderLoading(true);
    currentFolderId = folderId;

    // Update breadcrumbs
    if (crumbIndex !== null && crumbIndex >= 0) {
      breadcrumbs = breadcrumbs.slice(0, crumbIndex + 1);
    }

    const data = await repo.fetchFolderContents(folderId);

    // Update crumb name jika folder root terdeteksi
    if (data.currentFolder && data.currentFolder.name && breadcrumbs.length > 0) {
      breadcrumbs[breadcrumbs.length - 1].name = data.currentFolder.name;
    }

    rawFolders = data.folders || [];
    rawFiles = data.files || [];

    // Render breadcrumbs
    ui.renderBreadcrumbs(breadcrumbs, (targetId, index) => {
      navigateToFolder(targetId, index);
    });

    // Render data
    applyFilterAndRender();
    ui.renderLoading(false);
  } catch (error) {
    console.error("Gagal memuat folder:", error);
    ui.renderLoading(false);
    ui.renderError(`Gagal membaca folder Google Drive: ${error.message}`, () => {
      navigateToFolder(folderId, crumbIndex);
    });
  }
}

/**
 * Filter pencarian, sorting, dan render ulang ke UI.
 */
function applyFilterAndRender() {
  let filteredFolders = [...rawFolders];
  let filteredFiles = [...rawFiles];

  // 1. Search Query
  if (searchQuery && searchQuery.trim() !== "") {
    const q = searchQuery.toLowerCase().trim();
    filteredFolders = filteredFolders.filter(f => f.name.toLowerCase().includes(q));
    filteredFiles = filteredFiles.filter(f => f.name.toLowerCase().includes(q));
  }

  // 2. Sorting
  if (currentSortMode === "name") {
    filteredFolders.sort((a, b) => a.name.localeCompare(b.name));
    filteredFiles.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSortMode === "newest") {
    filteredFiles.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
  } else if (currentSortMode === "size") {
    filteredFiles.sort((a, b) => (b.size || 0) - (a.size || 0));
  }

  // Render Folders
  ui.renderFolders(
    filteredFolders,
    // onOpenFolder
    (folder) => {
      breadcrumbs.push({ id: folder.id, name: folder.name });
      navigateToFolder(folder.id);
    },
    // onDeleteFolder
    (folder) => {
      handleDeleteItem(folder.id, "folder", folder.name);
    }
  );

  // Render Files
  ui.renderFiles(
    filteredFiles,
    currentViewMode,
    {
      onPreview: (file) => handlePreviewFile(file),
      onDelete: (file) => handleDeleteItem(file.id, "file", file.name)
    }
  );
}

/**
 * Handle Preview File (modal).
 */
function handlePreviewFile(file) {
  const title = document.getElementById("fmPreviewModalTitle");
  const body = document.getElementById("fmPreviewModalBody");
  const openLink = document.getElementById("fmPreviewOpenLink");

  if (title) title.textContent = file.name;
  if (openLink) openLink.href = file.webViewLink || "#";

  if (body) {
    const isImage = (file.mimeType || "").includes("image") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    if (isImage && file.downloadUrl && file.downloadUrl !== "#") {
      body.innerHTML = `
        <div class="text-center p-3">
          <img src="${file.downloadUrl}" alt="${file.name}" class="img-fluid rounded" style="max-height: 480px; object-fit: contain;">
        </div>
      `;
    } else {
      body.innerHTML = `
        <div class="text-center p-4">
          <i class="bi bi-file-earmark-text text-primary" style="font-size: 3.5rem;"></i>
          <h6 class="mt-3 fw-bold">${file.name}</h6>
          <p class="text-muted small">Ukuran: ${ui.formatFileSize(file.size)}</p>
          <div class="mt-4">
            <a href="${file.webViewLink || '#'}" target="_blank" class="btn btn-dlg-blue rounded-pill px-4">
              <i class="bi bi-box-arrow-up-right me-1"></i> Buka di Google Drive
            </a>
          </div>
        </div>
      `;
    }
  }

  if (previewModal) previewModal.show();
}

/**
 * Handle Delete Item (File / Folder).
 */
async function handleDeleteItem(itemId, itemType, itemName) {
  const label = itemType === "folder" ? "Folder" : "File";
  if (!confirm(`Apakah Anda yakin ingin memindahkan ${label} "${itemName}" ke sampah Google Drive?`)) {
    return;
  }

  try {
    ui.renderLoading(true);
    await repo.deleteDriveItem(itemId, itemType);
    if (window.Swal) {
      Swal.fire({
        icon: "success",
        title: "Berhasil",
        text: `${label} berhasil dipindahkan ke sampah.`,
        timer: 1800,
        showConfirmButton: false
      });
    } else {
      alert(`${label} berhasil dipindahkan ke sampah.`);
    }
    await navigateToFolder(currentFolderId);
  } catch (error) {
    ui.renderLoading(false);
    alert(`Gagal menghapus ${label}: ${error.message}`);
  }
}

/**
 * Event Listeners.
 */
function bindEvents() {
  // 1. Search Bar
  const searchInput = document.getElementById("fmSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value || "";
      applyFilterAndRender();
    });
  }

  // 2. View Mode Toggle (Grid vs List)
  const btnGrid = document.getElementById("fmBtnViewGrid");
  const btnList = document.getElementById("fmBtnViewList");
  if (btnGrid && btnList) {
    btnGrid.addEventListener("click", () => {
      currentViewMode = "grid";
      btnGrid.classList.add("active");
      btnList.classList.remove("active");
      applyFilterAndRender();
    });
    btnList.addEventListener("click", () => {
      currentViewMode = "list";
      btnList.classList.add("active");
      btnGrid.classList.remove("active");
      applyFilterAndRender();
    });
  }

  // 3. Sorting Mode
  const sortSelect = document.getElementById("fmSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      currentSortMode = e.target.value;
      applyFilterAndRender();
    });
  }

  // 4. Modal: Konfigurasi Drive
  const btnOpenConfig = document.getElementById("fmBtnOpenConfig");
  if (btnOpenConfig) {
    btnOpenConfig.addEventListener("click", () => {
      driveConfig = repo.getDriveConfig();
      const inputUrl = document.getElementById("cfgScriptUrl");
      const inputFolder = document.getElementById("cfgFolderId");
      if (inputUrl) inputUrl.value = driveConfig.scriptUrl || "";
      if (inputFolder) inputFolder.value = driveConfig.rootFolderId || "";
      if (configModal) configModal.show();
    });
  }

  const formConfig = document.getElementById("fmConfigForm");
  if (formConfig) {
    formConfig.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputUrl = document.getElementById("cfgScriptUrl");
      const inputFolder = document.getElementById("cfgFolderId");
      const btnSave = document.getElementById("fmBtnSaveConfig");

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menyimpan...';
      }

      try {
        const saved = repo.saveDriveConfig({
          scriptUrl: inputUrl ? inputUrl.value : "",
          rootFolderId: inputFolder ? inputFolder.value : "",
        });

        driveConfig = saved;
        ui.renderConnectionStatus(driveConfig);

        if (configModal) configModal.hide();
        if (window.Swal) {
          Swal.fire({
            icon: "success",
            title: "Konfigurasi Tersimpan",
            text: "Pengaturan integrasi Google Drive berhasil disimpan.",
            timer: 2000,
            showConfirmButton: false
          });
        }

        // Muat ulang folder
        breadcrumbs = [{ id: driveConfig.rootFolderId, name: driveConfig.rootFolderName || "Shared Drive" }];
        await navigateToFolder(driveConfig.rootFolderId, 0);
      } catch (err) {
        alert("Gagal menyimpan konfigurasi: " + err.message);
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = "Simpan Konfigurasi";
        }
      }
    });
  }

  // Test Connection Button in Config Modal
  const btnTestConn = document.getElementById("fmBtnTestConnection");
  if (btnTestConn) {
    btnTestConn.addEventListener("click", async () => {
      const inputUrl = document.getElementById("cfgScriptUrl");
      const inputFolder = document.getElementById("cfgFolderId");
      const testResultBox = document.getElementById("fmTestResultBox");

      btnTestConn.disabled = true;
      btnTestConn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menguji...';
      if (testResultBox) testResultBox.innerHTML = "";

      try {
        const result = await repo.testConnection(
          inputUrl ? inputUrl.value : "",
          inputFolder ? inputFolder.value : ""
        );
        if (testResultBox) {
          testResultBox.innerHTML = `
            <div class="alert alert-success mt-2 mb-0 py-2 small">
              <i class="bi bi-check-circle-fill me-1"></i> Terhubung! Folder: <strong>${result.rootFolderName}</strong> (${result.userEmail})
            </div>
          `;
        }
      } catch (err) {
        if (testResultBox) {
          testResultBox.innerHTML = `
            <div class="alert alert-danger mt-2 mb-0 py-2 small">
              <i class="bi bi-x-circle-fill me-1"></i> Koneksi Gagal: ${err.message}
            </div>
          `;
        }
      } finally {
        btnTestConn.disabled = false;
        btnTestConn.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Tes Koneksi';
      }
    });
  }

  // 5. Modal: Buat Folder Baru
  const btnOpenNewFolder = document.getElementById("fmBtnNewFolder");
  if (btnOpenNewFolder) {
    btnOpenNewFolder.addEventListener("click", () => {
      const input = document.getElementById("newFolderNameInput");
      if (input) input.value = "";
      if (newFolderModal) newFolderModal.show();
    });
  }

  const formNewFolder = document.getElementById("fmNewFolderForm");
  if (formNewFolder) {
    formNewFolder.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("newFolderNameInput");
      const btnSubmit = document.getElementById("fmBtnSubmitNewFolder");
      const folderName = input ? input.value.trim() : "";

      if (!folderName) return;

      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Membuat...';
      }

      try {
        await repo.createFolder(folderName, currentFolderId);
        if (newFolderModal) newFolderModal.hide();
        if (window.Swal) {
          Swal.fire({
            icon: "success",
            title: "Folder Dibuat",
            text: `Folder "${folderName}" berhasil dibuat di Google Drive.`,
            timer: 1800,
            showConfirmButton: false
          });
        }
        await navigateToFolder(currentFolderId);
      } catch (err) {
        alert("Gagal membuat folder: " + err.message);
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.textContent = "Buat Folder";
        }
      }
    });
  }

  // 6. Modal: Upload File
  const btnOpenUpload = document.getElementById("fmBtnUpload");
  if (btnOpenUpload) {
    btnOpenUpload.addEventListener("click", () => {
      const fileInput = document.getElementById("fmFileInput");
      const selectedName = document.getElementById("fmSelectedFileName");
      if (fileInput) fileInput.value = "";
      if (selectedName) selectedName.textContent = "";
      if (uploadModal) uploadModal.show();
    });
  }

  const dropzone = document.getElementById("fmDropzone");
  const fileInput = document.getElementById("fmFileInput");
  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        const nameEl = document.getElementById("fmSelectedFileName");
        if (nameEl) nameEl.textContent = `File terpilih: ${fileInput.files[0].name} (${ui.formatFileSize(fileInput.files[0].size)})`;
      }
    });

    // Drag and drop events
    ["dragenter", "dragover"].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
      });
    });
    dropzone.addEventListener("drop", (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        const nameEl = document.getElementById("fmSelectedFileName");
        if (nameEl) nameEl.textContent = `File terpilih: ${fileInput.files[0].name} (${ui.formatFileSize(fileInput.files[0].size)})`;
      }
    });
  }

  const formUpload = document.getElementById("fmUploadForm");
  if (formUpload) {
    formUpload.addEventListener("submit", async (e) => {
      e.preventDefault();
      const file = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;
      if (!file) {
        alert("Silakan pilih file terlebih dahulu.");
        return;
      }

      const btnUploadSubmit = document.getElementById("fmBtnSubmitUpload");
      if (btnUploadSubmit) {
        btnUploadSubmit.disabled = true;
        btnUploadSubmit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Mengunggah ke Google Drive...';
      }

      try {
        await repo.uploadFileToDrive(file, currentFolderId);
        if (uploadModal) uploadModal.hide();
        if (window.Swal) {
          Swal.fire({
            icon: "success",
            title: "File Terunggah",
            text: `File "${file.name}" berhasil diunggah ke Google Drive.`,
            timer: 2000,
            showConfirmButton: false
          });
        }
        await navigateToFolder(currentFolderId);
      } catch (err) {
        alert("Gagal mengunggah file: " + err.message);
      } finally {
        if (btnUploadSubmit) {
          btnUploadSubmit.disabled = false;
          btnUploadSubmit.textContent = "Unggah Sekarang";
        }
      }
    });
  }
}

// Inisialisasi saat DOM selesai dimuat
document.addEventListener("DOMContentLoaded", initializeFileManager);

