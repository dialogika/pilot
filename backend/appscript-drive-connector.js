/**
 * =====================================================================
 * DIALOGIKA GOOGLE DRIVE CONNECTOR (GOOGLE APPS SCRIPT)
 * =====================================================================
 * Skrip ini bertindak sebagai jembatan resmi antara Dashboard Dialogika
 * dan Google Drive Perusahaan (Skenario A - Shared Storage).
 *
 * CARA DEPLOY:
 * 1. Buka https://script.google.com dengan Akun Google Dialogika
 * 2. Buat proyek baru: "Dialogika Shared Drive Connector"
 * 3. Hapus kode default, lalu paste SELURUH isi file ini.
 * 4. Ganti ROOT_FOLDER_ID di bawah dengan ID Folder Google Drive Anda.
 * 5. Klik Deploy > New deployment:
 *    - Select type: Web app
 *    - Description: Dialogika File Manager API
 *    - Execute as: Me (akun Anda)
 *    - Who has access: Anyone
 * 6. Klik "Deploy", lalu klik "Authorize access" dan pilih "Allow".
 * 7. Salin "Web app URL" yang dihasilkan dan tempel di konfigurasi
 *    File Manager di dashboard Dialogika!
 * =====================================================================
 */

// GANTI ID INI DENGAN ID FOLDER GOOGLE DRIVE PERUSAHAAN ANDA
var DEFAULT_ROOT_FOLDER_ID = "1UBAZEr-n3evqA3Npvj7Kl7qvnt-gWLgE";

/**
 * Helper untuk response JSON dengan header CORS yang tepat
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET Handler - Membaca isi folder, pencarian, dan verifikasi koneksi
 */
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || "getFolderContents";
    var folderId = params.folderId || DEFAULT_ROOT_FOLDER_ID;

    // 1. Test Connection
    if (action === "testConnection") {
      var rootFolder = DriveApp.getFolderById(folderId);
      return createJsonResponse({
        status: "success",
        connected: true,
        rootFolderId: folderId,
        rootFolderName: rootFolder.getName(),
        userEmail: Session.getActiveUser().getEmail() || "Authenticated Google Account",
        timestamp: new Date().toISOString()
      });
    }

    // 2. Ambil isi folder (sub-folder dan file)
    if (action === "getFolderContents") {
      var currentFolder = DriveApp.getFolderById(folderId);
      var parentId = null;
      var parentName = null;

      // Cek apakah ada parent folder
      var parents = currentFolder.getParents();
      if (parents.hasNext()) {
        var parent = parents.next();
        parentId = parent.getId();
        parentName = parent.getName();
      }

      // Ambil Sub-folders
      var foldersIterator = currentFolder.getFolders();
      var folders = [];
      while (foldersIterator.hasNext()) {
        var f = foldersIterator.next();
        if (!f.isTrashed()) {
          folders.push({
            id: f.getId(),
            name: f.getName(),
            updated_at: f.getLastUpdated().toISOString(),
            url: f.getUrl()
          });
        }
      }

      // Sort folders A-Z
      folders.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });

      // Ambil Files
      var filesIterator = currentFolder.getFiles();
      var files = [];
      while (filesIterator.hasNext()) {
        var file = filesIterator.next();
        if (!file.isTrashed()) {
          var mime = file.getMimeType();
          files.push({
            id: file.getId(),
            name: file.getName(),
            mimeType: mime,
            size: file.getSize(),
            created_at: file.getDateCreated().toISOString(),
            updated_at: file.getLastUpdated().toISOString(),
            webViewLink: file.getUrl(),
            downloadUrl: "https://drive.google.com/uc?export=download&id=" + file.getId()
          });
        }
      }

      // Sort files A-Z
      files.sort(function(a, b) {
        return a.name.localeCompare(b.name);
      });

      return createJsonResponse({
        status: "success",
        currentFolder: {
          id: currentFolder.getId(),
          name: currentFolder.getName(),
          parentId: parentId,
          parentName: parentName
        },
        folders: folders,
        files: files
      });
    }

    // 3. Cari file berdasarkan kata kunci
    if (action === "search") {
      var query = params.query || "";
      var searchFolder = DriveApp.getFolderById(folderId);
      var searchIterator = searchFolder.searchFiles("title contains '" + query.replace(/'/g, "\\'") + "' and trashed = false");
      var searchResults = [];

      while (searchIterator.hasNext() && searchResults.length < 50) {
        var item = searchIterator.next();
        searchResults.push({
          id: item.getId(),
          name: item.getName(),
          mimeType: item.getMimeType(),
          size: item.getSize(),
          updated_at: item.getLastUpdated().toISOString(),
          webViewLink: item.getUrl(),
          downloadUrl: "https://drive.google.com/uc?export=download&id=" + item.getId()
        });
      }

      return createJsonResponse({
        status: "success",
        query: query,
        files: searchResults
      });
    }

    return createJsonResponse({
      status: "error",
      message: "Action tidak dikenali: " + action
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

/**
 * POST Handler - Upload file, buat folder, hapus item
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    var action = data.action;
    var targetFolderId = data.folderId || data.parentFolderId || DEFAULT_ROOT_FOLDER_ID;

    // 1. Upload File
    if (action === "uploadFile") {
      var folder = DriveApp.getFolderById(targetFolderId);
      var contentType = data.mimeType || "application/octet-stream";
      var rawData = data.fileData;

      if (rawData.indexOf(",") > -1) {
        rawData = rawData.split(",")[1];
      }

      var blob = Utilities.newBlob(Utilities.base64Decode(rawData), contentType, data.fileName);
      var createdFile = folder.createFile(blob);

      // Pastikan siapapun dengan link bisa view/download jika diperlukan
      createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return createJsonResponse({
        status: "success",
        message: "File berhasil diunggah",
        file: {
          id: createdFile.getId(),
          name: createdFile.getName(),
          size: createdFile.getSize(),
          mimeType: createdFile.getMimeType(),
          webViewLink: createdFile.getUrl(),
          downloadUrl: "https://drive.google.com/uc?export=download&id=" + createdFile.getId()
        }
      });
    }

    // 2. Buat Folder Baru
    if (action === "createFolder") {
      var parentF = DriveApp.getFolderById(targetFolderId);
      var folderName = (data.name || "Folder Baru").trim();
      var newFolder = parentF.createFolder(folderName);

      return createJsonResponse({
        status: "success",
        message: "Folder berhasil dibuat",
        folder: {
          id: newFolder.getId(),
          name: newFolder.getName(),
          updated_at: newFolder.getLastUpdated().toISOString(),
          url: newFolder.getUrl()
        }
      });
    }

    // 3. Hapus File / Folder (Pindah ke Sampah)
    if (action === "deleteItem") {
      var itemId = data.id;
      var itemType = data.type || "file";

      if (itemType === "folder") {
        var fol = DriveApp.getFolderById(itemId);
        fol.setTrashed(true);
      } else {
        var fil = DriveApp.getFileById(itemId);
        fil.setTrashed(true);
      }

      return createJsonResponse({
        status: "success",
        message: (itemType === "folder" ? "Folder" : "File") + " berhasil dipindahkan ke sampah."
      });
    }

    return createJsonResponse({
      status: "error",
      message: "Action POST tidak dikenali: " + action
    });

  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

