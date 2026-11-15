// pages/file-manager/file-manager.ui.js
// =====================================================================
// FILE MANAGER UI — Pure DOM rendering and presentation layer.
//
// Rules:
//  - No API or Firestore calls here.
//  - All DOM queries and updates for File Manager live here.
// =====================================================================

/**
 * Format ukuran file ke format yang mudah dibaca (KB, MB, GB).
 */
export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format tanggal ISO ke format Indonesia sederhana (DD MMM YYYY).
 */
export function formatDate(isoStr) {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch (e) {
    return isoStr;
  }
}

/**
 * Mendapatkan ikon Bootstrap & warna berdasarkan MIME type file.
 */
export function getFileIconInfo(mimeType = "", fileName = "") {
  const mime = mimeType.toLowerCase();
  const name = fileName.toLowerCase();

  if (mime.includes("image") || name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".webp")) {
    return { icon: "bi-file-earmark-image", color: "#3b82f6", label: "Gambar" };
  }
  if (mime.includes("pdf") || name.endsWith(".pdf")) {
    return { icon: "bi-file-earmark-pdf", color: "#ef4444", label: "PDF" };
  }
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("spreadsheet") || name.endsWith(".xlsx") || name.endsWith(".csv")) {
    return { icon: "bi-file-earmark-excel", color: "#10b981", label: "Spreadsheet" };
  }
  if (mime.includes("word") || mime.includes("document") || name.endsWith(".docx") || name.endsWith(".doc")) {
    return { icon: "bi-file-earmark-word", color: "#2563eb", label: "Dokumen" };
  }
  if (mime.includes("presentation") || mime.includes("powerpoint") || name.endsWith(".pptx")) {
    return { icon: "bi-file-earmark-ppt", color: "#f97316", label: "Presentasi" };
  }
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("compressed")) {
    return { icon: "bi-file-earmark-zip", color: "#8b5cf6", label: "Arsip" };
  }
  if (mime.includes("video")) {
    return { icon: "bi-file-earmark-play", color: "#ec4899", label: "Video" };
  }
  return { icon: "bi-file-earmark-text", color: "#6b7280", label: "File" };
}

/**
 * Render Status Koneksi Google Drive di Banner Atas.
 */
export function renderConnectionStatus(config, testResult = null) {
  const dot = document.getElementById("fmStatusDot");
  const text = document.getElementById("fmStatusText");
  const subText = document.getElementById("fmStatusSubText");

  if (!dot || !text) return;

  if (config.isConfigured) {
    dot.className = "fm-status-dot connected";
    text.textContent = "Google Drive Shared Storage Terhubung";
    const emailInfo = testResult && testResult.userEmail ? `(${testResult.userEmail})` : "";
    if (subText) {
      subText.textContent = `Folder: ${config.rootFolderName || config.rootFolderId} ${emailInfo}`;
    }
  } else {
    dot.className = "fm-status-dot disconnected";
    text.textContent = "Google Drive Belum Dikonfigurasi (Mode Preview)";
    if (subText) {
      subText.textContent = "Klik 'Konfigurasi Drive' untuk memasukkan Web App URL hasil deploy.";
    }
  }
}

/**
 * Render Breadcrumb Navigasi Folder.
 */
export function renderBreadcrumbs(crumbs, onNavigate) {
  const container = document.getElementById("fmBreadcrumbContainer");
  if (!container) return;

  container.innerHTML = "";

  crumbs.forEach((crumb, index) => {
    const isLast = index === crumbs.length - 1;

    const item = document.createElement("a");
    item.className = `fm-crumb-item${isLast ? " active" : ""}`;
    item.innerHTML = index === 0 
      ? `<i class="bi bi-hdd-network"></i> <span>${crumb.name}</span>`
      : `<i class="bi bi-folder2"></i> <span>${crumb.name}</span>`;

    if (!isLast) {
      item.href = "javascript:void(0)";
      item.onclick = (e) => {
        e.preventDefault();
        onNavigate(crumb.id, index);
      };
    }

    container.appendChild(item);

    if (!isLast) {
      const sep = document.createElement("span");
      sep.className = "fm-crumb-sep";
      sep.innerHTML = '<i class="bi bi-chevron-right"></i>';
      container.appendChild(sep);
    }
  });
}

/**
 * Render Daftar Folder.
 */
export function renderFolders(folders, onOpenFolder, onDeleteFolder) {
  const section = document.getElementById("fmFoldersSection");
  const container = document.getElementById("fmFoldersGrid");
  const badge = document.getElementById("fmFoldersBadge");

  if (!section || !container) return;

  if (badge) badge.textContent = folders.length;

  if (!folders || folders.length === 0) {
    section.style.display = "none";
    container.innerHTML = "";
    return;
  }

  section.style.display = "block";
  container.innerHTML = "";

  folders.forEach((folder) => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-md-4 col-xl-3";

    col.innerHTML = `
      <div class="fm-folder-card" data-folder-id="${folder.id}">
        <div class="fm-folder-info">
          <div class="fm-folder-icon">
            <i class="bi bi-folder-fill"></i>
          </div>
          <div class="fm-folder-text">
            <div class="fm-folder-name" title="${folder.name}">${folder.name}</div>
            <div class="fm-folder-meta">Google Drive Folder</div>
          </div>
        </div>
        <div class="dropdown" onclick="event.stopPropagation();">
          <button class="btn btn-sm btn-link text-muted p-1" data-bs-toggle="dropdown" aria-expanded="false">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
            <li>
              <a class="dropdown-item text-danger d-flex align-items-center gap-2 btn-delete-folder" href="javascript:void(0)" data-folder-id="${folder.id}" data-folder-name="${folder.name}">
                <i class="bi bi-trash"></i> Hapus Folder
              </a>
            </li>
          </ul>
        </div>
      </div>
    `;

    // Click on card opens folder
    const card = col.querySelector(".fm-folder-card");
    card.addEventListener("click", () => onOpenFolder(folder));

    // Delete folder
    const btnDel = col.querySelector(".btn-delete-folder");
    if (btnDel) {
      btnDel.addEventListener("click", () => onDeleteFolder(folder));
    }

    container.appendChild(col);
  });
}

/**
 * Render Daftar File (Grid View atau List View).
 */
export function renderFiles(files, viewMode = "grid", handlers = {}) {
  const section = document.getElementById("fmFilesSection");
  const gridContainer = document.getElementById("fmFilesGrid");
  const listContainer = document.getElementById("fmFilesList");
  const badge = document.getElementById("fmFilesBadge");
  const emptyState = document.getElementById("fmEmptyState");

  if (!section) return;

  if (badge) badge.textContent = files.length;

  if (!files || files.length === 0) {
    if (gridContainer) gridContainer.innerHTML = "";
    if (listContainer) listContainer.innerHTML = "";
    if (gridContainer) gridContainer.style.display = "none";
    if (listContainer) listContainer.style.display = "none";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";

  if (viewMode === "grid") {
    if (listContainer) listContainer.style.display = "none";
    if (gridContainer) {
      gridContainer.style.display = "flex";
      renderFilesGrid(files, gridContainer, handlers);
    }
  } else {
    if (gridContainer) gridContainer.style.display = "none";
    if (listContainer) {
      listContainer.style.display = "block";
      renderFilesList(files, listContainer, handlers);
    }
  }
}

/**
 * Render File Mode Grid.
 */
function renderFilesGrid(files, container, handlers) {
  container.innerHTML = "";

  files.forEach((file) => {
    const iconInfo = getFileIconInfo(file.mimeType, file.name);
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-md-4 col-xl-3";

    col.innerHTML = `
      <div class="fm-file-grid-card">
        <div>
          <div class="fm-file-preview-box">
            <i class="bi ${iconInfo.icon} fm-file-type-icon" style="color: ${iconInfo.color};"></i>
          </div>
          <div class="fm-file-title" title="${file.name}">${file.name}</div>
          <div class="fm-file-meta-row">
            <span>${formatFileSize(file.size)}</span>
            <span>${formatDate(file.updated_at || file.created_at)}</span>
          </div>
        </div>
        <div class="fm-file-actions">
          <button class="btn btn-sm btn-light border rounded-pill flex-fill btn-preview-file" data-file-id="${file.id}">
            <i class="bi bi-eye"></i> Buka
          </button>
          <a href="${file.downloadUrl || '#'}" target="_blank" class="btn btn-sm btn-light border rounded-pill px-3" title="Download">
            <i class="bi bi-download"></i>
          </a>
          <button class="btn btn-sm btn-light border rounded-pill text-danger px-2 btn-delete-file" data-file-id="${file.id}" data-file-name="${file.name}" title="Hapus">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;

    // Events
    col.querySelector(".btn-preview-file")?.addEventListener("click", () => {
      if (handlers.onPreview) handlers.onPreview(file);
    });
    col.querySelector(".btn-delete-file")?.addEventListener("click", () => {
      if (handlers.onDelete) handlers.onDelete(file);
    });

    container.appendChild(col);
  });
}

/**
 * Render File Mode List (Table).
 */
function renderFilesList(files, container, handlers) {
  let tbodyHtml = files.map((file) => {
    const iconInfo = getFileIconInfo(file.mimeType, file.name);
    return `
      <tr>
        <td style="width: 48px;">
          <i class="bi ${iconInfo.icon} fs-4" style="color: ${iconInfo.color};"></i>
        </td>
        <td>
          <div class="fw-semibold text-truncate" style="max-width: 320px;" title="${file.name}">${file.name}</div>
          <small class="text-muted">${iconInfo.label}</small>
        </td>
        <td>${formatFileSize(file.size)}</td>
        <td>${formatDate(file.updated_at || file.created_at)}</td>
        <td class="text-end">
          <div class="btn-group">
            <button class="btn btn-sm btn-light border btn-preview-file-list" data-file-id="${file.id}">
              <i class="bi bi-eye me-1"></i> Buka
            </button>
            <a href="${file.downloadUrl || '#'}" target="_blank" class="btn btn-sm btn-light border" title="Download">
              <i class="bi bi-download"></i>
            </a>
            <button class="btn btn-sm btn-light border text-danger btn-delete-file-list" data-file-id="${file.id}" data-file-name="${file.name}" title="Hapus">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="fm-list-table table-responsive">
      <table class="table align-middle">
        <thead>
          <tr>
            <th></th>
            <th>Nama File</th>
            <th>Ukuran</th>
            <th>Diperbarui</th>
            <th class="text-end">Aksi</th>
          </tr>
        </thead>
        <tbody>${tbodyHtml}</tbody>
      </table>
    </div>
  `;

  // Attach events
  container.querySelectorAll(".btn-preview-file-list").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      if (handlers.onPreview) handlers.onPreview(files[idx]);
    });
  });
  container.querySelectorAll(".btn-delete-file-list").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      if (handlers.onDelete) handlers.onDelete(files[idx]);
    });
  });
}

/**
 * Tampilkan Loading State.
 */
export function renderLoading(show = true) {
  const loading = document.getElementById("fmLoadingState");
  const content = document.getElementById("fmContentArea");

  if (loading) loading.style.display = show ? "block" : "none";
  if (content) content.style.display = show ? "none" : "block";
}

/**
 * Tampilkan Error State.
 */
export function renderError(message, onRetry) {
  const errorBox = document.getElementById("fmErrorState");
  const errorMsg = document.getElementById("fmErrorMessage");
  const retryBtn = document.getElementById("fmRetryBtn");
  const content = document.getElementById("fmContentArea");

  if (content) content.style.display = "none";
  if (errorBox) {
    errorBox.style.display = "block";
    if (errorMsg) errorMsg.textContent = message;
    if (retryBtn && onRetry) {
      retryBtn.onclick = onRetry;
    }
  }
}

