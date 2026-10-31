// pages/file-manager/file-manager.repository.js
// =====================================================================
// FILE MANAGER REPOSITORY — handles all data communication with Google Drive
// via Google Apps Script Web App (Scenario A - Shared Company Drive).
//
// Rules:
//  - No UI or DOM manipulation here.
//  - Encapsulates configuration, API endpoints, mock fallbacks, and storage.
// =====================================================================

const CONFIG_STORAGE_KEY = "dialogika_drive_config";

// Default Root Folder ID dari codebase Dialogika (pilot/backend/appscript.js)
const DEFAULT_CONFIG = {
  scriptUrl: "",
  rootFolderId: "1UBAZEr-n3evqA3Npvj7Kl7qvnt-gWLgE",
  rootFolderName: "Shared Storage Dialogika",
  isConfigured: false,
};

/**
 * Mengambil konfigurasi Google Drive saat ini (dari localStorage).
 * @returns {Object} { scriptUrl, rootFolderId, rootFolderName, isConfigured }
 */
export function getDriveConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      scriptUrl: parsed.scriptUrl || "",
      rootFolderId: parsed.rootFolderId || DEFAULT_CONFIG.rootFolderId,
      rootFolderName: parsed.rootFolderName || DEFAULT_CONFIG.rootFolderName,
      isConfigured: Boolean(parsed.scriptUrl && parsed.scriptUrl.trim() !== ""),
    };
  } catch (e) {
    console.error("Gagal membaca konfigurasi Google Drive:", e);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Menyimpan konfigurasi Google Drive baru.
 * @param {Object} config
 */
export function saveDriveConfig(config) {
  const current = getDriveConfig();
  const updated = {
    ...current,
    scriptUrl: (config.scriptUrl || "").trim(),
    rootFolderId: (config.rootFolderId || current.rootFolderId).trim(),
    rootFolderName: (config.rootFolderName || current.rootFolderName).trim(),
    isConfigured: Boolean(config.scriptUrl && config.scriptUrl.trim() !== ""),
  };
  localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

/**
 * Menguji koneksi ke endpoint Google Apps Script.
 * @param {string} [customScriptUrl]
 * @param {string} [customFolderId]
 * @returns {Promise<Object>}
 */
export async function testConnection(customScriptUrl, customFolderId) {
  const config = getDriveConfig();
  const url = customScriptUrl || config.scriptUrl;
  const folderId = customFolderId || config.rootFolderId;

  if (!url || !url.startsWith("http")) {
    throw new Error("Web App URL Google Apps Script belum diisi dengan benar.");
  }

  const endpoint = `${url}?action=testConnection&folderId=${encodeURIComponent(folderId)}`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.message || "Gagal menghubungi Google Drive.");
  }

  return data;
}

/**
 * Mengambil daftar sub-folder dan file di dalam folder tertentu.
 * @param {string} [folderId]
 * @returns {Promise<Object>}
 */
export async function fetchFolderContents(folderId) {
  const config = getDriveConfig();
  const targetId = folderId || config.rootFolderId;

  // Jika URL belum disetel, kembalikan data simulasi yang jelas agar UI bisa langsung dicoba
  if (!config.isConfigured) {
    return getSimulatedData(targetId, config);
  }

  try {
    const endpoint = `${config.scriptUrl}?action=getFolderContents&folderId=${encodeURIComponent(targetId)}`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!res.ok) {
      throw new Error(`Koneksi server gagal dengan kode: ${res.status}`);
    }

    const data = await res.json();
    if (data.status !== "success") {
      throw new Error(data.message || "Gagal mengambil data dari Google Drive.");
    }

    return {
      currentFolder: data.currentFolder || { id: targetId, name: "Folder" },
      folders: data.folders || [],
      files: data.files || [],
      isLive: true
    };
  } catch (error) {
    console.error("fetchFolderContents error:", error);
    throw error;
  }
}

/**
 * Melakukan pencarian file di Google Drive.
 * @param {string} query
 * @param {string} [folderId]
 * @returns {Promise<Array>}
 */
export async function searchFiles(query, folderId) {
  const config = getDriveConfig();
  const targetId = folderId || config.rootFolderId;

  if (!config.isConfigured) {
    const sim = getSimulatedData(targetId, config);
    const q = (query || "").toLowerCase();
    return sim.files.filter(f => f.name.toLowerCase().includes(q));
  }

  const endpoint = `${config.scriptUrl}?action=search&query=${encodeURIComponent(query)}&folderId=${encodeURIComponent(targetId)}`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  if (!res.ok) throw new Error(`Pencarian gagal: HTTP ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

/**
 * Membuat sub-folder baru di Google Drive.
 * @param {string} folderName
 * @param {string} parentFolderId
 * @returns {Promise<Object>}
 */
export async function createFolder(folderName, parentFolderId) {
  const config = getDriveConfig();
  if (!config.isConfigured) {
    throw new Error("Silakan hubungkan Web App URL Google Apps Script terlebih dahulu.");
  }

  const payload = {
    action: "createFolder",
    name: folderName,
    parentFolderId: parentFolderId || config.rootFolderId
  };

  const res = await fetch(config.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.message || "Gagal membuat folder di Google Drive.");
  }
  return data;
}

/**
 * Mengunggah file ke Google Drive (dikonversi ke base64).
 * @param {File} file
 * @param {string} targetFolderId
 * @returns {Promise<Object>}
 */
export async function uploadFileToDrive(file, targetFolderId) {
  const config = getDriveConfig();
  if (!config.isConfigured) {
    throw new Error("Silakan hubungkan Web App URL Google Apps Script terlebih dahulu.");
  }

  const base64Data = await readFileAsBase64(file);
  const payload = {
    action: "uploadFile",
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileData: base64Data,
    folderId: targetFolderId || config.rootFolderId
  };

  const res = await fetch(config.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.message || "Gagal mengunggah file ke Google Drive.");
  }
  return data;
}

/**
 * Menghapus file atau folder dari Google Drive (pindah ke sampah).
 * @param {string} id
 * @param {'file'|'folder'} type
 * @returns {Promise<Object>}
 */
export async function deleteDriveItem(id, type = "file") {
  const config = getDriveConfig();
  if (!config.isConfigured) {
    throw new Error("Silakan hubungkan Web App URL Google Apps Script terlebih dahulu.");
  }

  const payload = {
    action: "deleteItem",
    id: id,
    type: type
  };

  const res = await fetch(config.scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (data.status !== "success") {
    throw new Error(data.message || "Gagal menghapus item.");
  }
  return data;
}

/**
 * Helper: Mengubah File objek browser menjadi base64 string
 */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Data simulasi awal jika admin belum menempelkan Google Script Web App URL.
 */
function getSimulatedData(folderId, config) {
  const isRoot = folderId === config.rootFolderId;

  if (isRoot) {
    return {
      currentFolder: {
        id: config.rootFolderId,
        name: config.rootFolderName,
        parentId: null
      },
      folders: [
        { id: "f_branding", name: "01. Branding & Creative Assets", updated_at: new Date().toISOString() },
        { id: "f_hr", name: "02. Dokumen HR & Intern", updated_at: new Date().toISOString() },
        { id: "f_product", name: "03. Materi Kelas & Silabus", updated_at: new Date().toISOString() },
        { id: "f_templates", name: "04. Template Proposal & Invoice", updated_at: new Date().toISOString() }
      ],
      files: [
        {
          id: "doc_sop",
          name: "SOP Kerja Tim Dialogika 2026.pdf",
          mimeType: "application/pdf",
          size: 1420000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          webViewLink: "https://drive.google.com",
          downloadUrl: "#"
        },
        {
          id: "sheet_roster",
          name: "Jadwal Piket & Roster Intern.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 850000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          webViewLink: "https://drive.google.com",
          downloadUrl: "#"
        },
        {
          id: "img_banner",
          name: "Dialogika Primary Logo 2026.png",
          mimeType: "image/png",
          size: 512000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          webViewLink: "https://www.dialogika.co/assets/img/logo.webp",
          downloadUrl: "https://www.dialogika.co/assets/img/logo.webp"
        }
      ],
      isLive: false
    };
  }

  return {
    currentFolder: {
      id: folderId,
      name: "Sub-Folder Arsip",
      parentId: config.rootFolderId,
      parentName: config.rootFolderName
    },
    folders: [],
    files: [
      {
        id: "doc_example",
        name: "Catatan Arsip Divisi.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 320000,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        webViewLink: "https://drive.google.com",
        downloadUrl: "#"
      }
    ],
    isLive: false
  };
}

