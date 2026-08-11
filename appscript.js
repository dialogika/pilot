/**
 * DATABASE IDs - Gabungan v1.5 (Final Stable with Direct Drive Photo Link)
 * Sesuaikan ID Sheet dengan file Spreadsheet Anda
 */
const PROJECT_SHEET_ID = '1ctP2lGLlbsklFmFpeezOyPJFhGq1rHsNjDEIBbujwH4';
const LIST_SHEET_ID    = '1MKNFDUyl7E1tuScCEjTS2s2g4lI6r9kZ8EHbiERIWsQ';
const TASK_SHEET_ID    = '1EFUyGa3fPLQHlGGSQL-HdwKa2pCZbnoj-YgJWG1gSBQ';
const COMMENT_SHEET_ID = '1gQ35byn2ftxpC7oGCcvN4XyIsqqOmkF-T28R3L7IxKk';
const SUBS_SHEET_ID    = '1RRXSkJmgR03PG3LZcmlEHt-Tip-CKivOsrZGXN45efQ';
const TAG_SHEET_ID     = '14cZxGmm32hLvxL7Kd5Liy0tyoivvy2ehNFBGGrjhNE8';
const TASK_TAG_SHEET_ID= '1na1KfC3OdH7ghi8HsCcwjKWW71DS6TJBn5xQTMFSKTo';
const STATUS_SHEET_ID  = '1HVbobV81z_uKvtfHIBbCuZGp7C9CUkPeF6gIZwA_uJI';
const USER_SHEET_ID    = '1sFG5WY5UWD27d_77S1kCFDXeHB9vA2ZzasFHaDUu5Ns'; 
const LOG_SHEET_ID     = '1sKpP7h1HqLBJeWYm__B2DjHhRG3nx8HeVBfgWXom7ao';
const TRASH_SHEET_ID   = '1UI_66VMjmTyMvyBO9WlandLYYjChfUqjM6gsjyZxDi8';
const DRIVE_FOLDER_ID  = '1UBAZEr-n3evqA3Npvj7Kl7qvnt-gWLgE'; 

/**
 * GET REQUEST HANDLER
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
  const id = e && e.parameter ? e.parameter.id : null;

  if (action === 'getProjectData' || (id && id !== "")) {
    return getProjectCompleteData(id);
  }
  return getAllProjectsData();
};

/**
 * POST REQUEST HANDLER
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000); 
  try {
    const data = JSON.parse(e.postData.contents);
    let response;

    if (data.action === 'createProject')           response = createProject(data);
    else if (data.action === 'createList')         response = createList(data);
    else if (data.action === 'updateList')         response = updateList(data);
    else if (data.action === 'deleteList')         response = deleteList(data);
    else if (data.action === 'createTask')         response = createTask(data);
    else if (data.action === 'updateTaskStatus')   response = updateTaskStatus(data);
    else if (data.action === 'deleteTask')         response = deleteTask(data);
    else if (data.action === 'createComment')      response = createComment(data);
    else if (data.action === 'updateComment')      response = updateComment(data);
    else if (data.action === 'deleteComment')      response = deleteComment(data);
    else if (data.action === 'syncStatuses')       response = syncStatuses(data);
    else if (data.action === 'createTag')          response = createTag(data);
    else if (data.action === 'updateTag')          response = updateTag(data);
    else if (data.action === 'deleteTag')          response = deleteTag(data);
    else if (data.action === 'createStatus')       response = createStatus(data);
    else if (data.action === 'uploadFile')         response = uploadFileToDrive(data);
    else if (data.action === 'toggleSubscriber')   response = toggleSubscriber(data);
    else return responseJSON({ status: 'error', message: 'Action Unknown' });

    if (data.action !== 'uploadFile') {
      try {
        logAction(
          data.actorId || data.userId,
          data.action,
          data.contextId || data.listId || data.projectId || data.taskId || "",
          "",
          JSON.stringify(data)
        );
      } catch (e) {}
    }

    return response;
  } catch (err) { 
    return responseJSON({ status: 'error', message: err.toString() }); 
  } finally { 
    lock.releaseLock(); 
  }
}

function logAction(userId, action, contextId, oldValue, newValue) {
  const ss = SpreadsheetApp.openById(LOG_SHEET_ID).getSheets()[0];
  ss.appendRow([Utilities.getUuid(), contextId, userId, action, oldValue, newValue, new Date()]);
}

function moveToTrash(type, id, name, parentId, userId, originalData) {
  const ss = SpreadsheetApp.openById(TRASH_SHEET_ID).getSheets()[0];
  ss.appendRow([Utilities.getUuid(), type, id, name, parentId, userId, new Date(), JSON.stringify(originalData)]);
}

/** 
 * FUNGSI: MEMBUAT MASTER TAG BARU 
 */ 
function createTag(data) { 
  const ss = SpreadsheetApp.openById(TAG_SHEET_ID).getSheets()[0]; 
  const tid = Utilities.getUuid(); 
  // Kolom: tag_id, tag_name, color 
  ss.appendRow([tid, data.tagName, data.color]); 
  return responseJSON({ status: 'success', tagId: tid, name: data.tagName, color: data.color }); 
} 

function updateTag(data) {
  try {
    const ss = SpreadsheetApp.openById(TAG_SHEET_ID).getSheets()[0];
    const vals = ss.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.tagId)) {
        if (data.tagName !== undefined) ss.getRange(i + 1, 2).setValue(data.tagName);
        if (data.color !== undefined) ss.getRange(i + 1, 3).setValue(data.color);
        return responseJSON({ status: 'success' });
      }
    }
    return responseJSON({ status: 'error', message: 'Tag not found' });
  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  }
}

function deleteTag(data) {
  try {
    const ss = SpreadsheetApp.openById(TAG_SHEET_ID).getSheets()[0];
    const vals = ss.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.tagId)) {
        ss.deleteRow(i + 1);
        break;
      }
    }
    try {
      const ttSheet = SpreadsheetApp.openById(TASK_TAG_SHEET_ID).getSheets()[0];
      const ttVals = ttSheet.getDataRange().getValues();
      for (let j = ttVals.length - 1; j >= 1; j--) {
        if (String(ttVals[j][1]) === String(data.tagId)) {
          ttSheet.deleteRow(j + 1);
        }
      }
    } catch (e) {}
    return responseJSON({ status: 'success' });
  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  }
}

/** 
 * FUNGSI: MENGAMBIL SEMUA DATA (PROJECT, LIST, STATUS, TAG, USERS) 
 */ 
function getProjectCompleteData(targetId) { 
  const targetIdStr = String(targetId).trim(); 
  
  // 1. Fetch Master Users 
  const uSheet = SpreadsheetApp.openById(USER_SHEET_ID).getSheets()[0]; 
  const uData = uSheet.getDataRange().getDisplayValues(); 
  let users = []; 
  for(let i=1; i<uData.length; i++) { 
    users.push({ 
      id: String(uData[i][0]).trim(),    // Kolom 1: Id 
      name: uData[i][1],                 // Kolom 2: Name 
      email: uData[i][2],                // Kolom 3: Email 
      photo: formatDriveUrl(uData[i][4]),// Kolom 5: Photo 
      role: uData[i][5]                  // Kolom 6: Role (Index 5) - INI YANG DIBUTUHKAN 
    }); 
  } 

  // 2. Fetch Master Tags 
  const tagSheet = SpreadsheetApp.openById(TAG_SHEET_ID).getSheets()[0]; 
  const tagRaw = tagSheet.getDataRange().getDisplayValues(); 
  let tags = []; 
  for(let i=1; i<tagRaw.length; i++) { 
    tags.push({ id: tagRaw[i][0], name: tagRaw[i][1], color: tagRaw[i][2] }); 
  } 

  // 3. Fetch Statuses 
  const sSheet = SpreadsheetApp.openById(STATUS_SHEET_ID).getSheets()[0]; 
  const sRaw = sSheet.getDataRange().getDisplayValues(); 
  let allStatuses = []; 
  for(let i=1; i<sRaw.length; i++) { 
    allStatuses.push({ 
      id: sRaw[i][0], 
      listId: sRaw[i][1], 
      name: sRaw[i][3], 
      type: sRaw[i][4], 
      color: sRaw[i][5], 
      position: sRaw[i][6] 
    }); 
  } 

  // ... (Logika Fetch Project, List, dan Task sama seperti sebelumnya, namun difilter berdasarkan project ID) 
  // [Kode fetching project & list disingkat, diasumsikan Anda sudah memiliki logikanya]
  
  // RE-USE EXISTING LOGIC FOR PROJECT, LISTS, TASKS
  
  let allRelevantIds = [targetIdStr];

  // 4. GET PROJECT
  const pSheet = SpreadsheetApp.openById(PROJECT_SHEET_ID).getSheets()[0];
  const pData = pSheet.getDataRange().getDisplayValues();
  let project = null;
  for(let i=1; i<pData.length; i++) {
    if(String(pData[i][0]).trim() === targetIdStr) {
      project = { id: pData[i][0], name: pData[i][1], desc: pData[i][2], department: pData[i][9] };
      break;
    }
  }
  if(!project) return responseJSON({ status: 'error', message: 'Project not found' });

  // 5. GET LISTS
  const lSheet = SpreadsheetApp.openById(LIST_SHEET_ID).getSheets()[0];
  const lData = lSheet.getDataRange().getDisplayValues();
  let lists = [], listIds = [];
  for(let i=1; i<lData.length; i++) {
    if(String(lData[i][1]).trim() === targetIdStr) {
      const lid = String(lData[i][0]).trim();
      lists.push({ id: lid, name: lData[i][2], desc: lData[i][3], description: lData[i][3], position: parseInt(lData[i][6]) || 0, tasks: [], statuses: [] });
      listIds.push(lid);
      allRelevantIds.push(lid);
    }
  }
  lists.sort((a, b) => (parseInt(a.position) || 0) - (parseInt(b.position) || 0));

  // 6. MAPPING STATUSES TO LISTS
  // allStatuses sudah diambil di atas (step 3)
  allStatuses.forEach(s => {
    let l = lists.find(x => String(x.id) === String(s.listId));
    if(l) {
        l.statuses.push({
            id: s.id, name: s.name, type: s.type, color: s.color, position: parseInt(s.position) || 0
        });
    }
  });

  // 7. GET TASKS
  let taskTagsMap = {};
  try {
    const ttSheet = SpreadsheetApp.openById(TASK_TAG_SHEET_ID).getSheets()[0];
    const ttData = ttSheet.getDataRange().getDisplayValues();
    for(let i=1; i<ttData.length; i++) {
       let tId = String(ttData[i][0]).trim();
       let tgId = String(ttData[i][1]).trim();
       if(!taskTagsMap[tId]) taskTagsMap[tId] = [];
       taskTagsMap[tId].push(tgId);
    }
  } catch(e) {}

  const tSheet = SpreadsheetApp.openById(TASK_SHEET_ID).getSheets()[0];
  const tData = tSheet.getDataRange().getDisplayValues();
  for(let i=1; i<tData.length; i++) {
    let tListId = String(tData[i][1]).trim();
    if(listIds.includes(tListId)) {
      let tid = tData[i][0]; 
      allRelevantIds.push(tid);
      let l = lists.find(x => x.id === tListId);
      if(l) l.tasks.push({ 
        id: tid, 
        title: tData[i][3], 
        description: tData[i][4],
        status: String(tData[i][5]),
        priority: tData[i][6],
        points: tData[i][16],
        assignedTo: tData[i][18], 
        notifyTo: tData[i][19],
        tags: taskTagsMap[tid] || []
      });
    }
  }

  // 8. GET COMMENTS
  let comments = [];
  try {
    const cSheet = SpreadsheetApp.openById(COMMENT_SHEET_ID).getSheets()[0];
    const cData = cSheet.getDataRange().getDisplayValues();
    for(let i=1; i<cData.length; i++) {
      // Filter berdasarkan context_id (projectId)
      if(allRelevantIds.includes(String(cData[i][2]).trim())) {
        comments.push({
          id: cData[i][0], 
          contextType: cData[i][1], 
          contextId: cData[i][2], 
          userId: String(cData[i][3]).trim(), // user_id di kolom 4 (indeks 3) 
          text: cData[i][4],   // comment_text
          date: cData[i][5],   // created_at
          attachment: cData[i][6] || "" // attachment
        });
      }
    }
  } catch(e) {}

  // 9. GET SUBSCRIBERS
  let subscribers = [];
  try {
    const subSheet = SpreadsheetApp.openById(SUBS_SHEET_ID).getSheets()[0];
    const subData = subSheet.getDataRange().getDisplayValues();
    for(let i=1; i<subData.length; i++) {
      // Perbaikan Index: Col 3 (Index 2) = context_id, Col 4 (Index 3) = user_id
      if(String(subData[i][2]).trim() === targetIdStr) {
        subscribers.push({ 
          id: subData[i][0], 
          projectId: subData[i][2], // context_id
          userId: subData[i][3]     // user_id
        });
      }
    }
  } catch(e) {
    console.error("Error subscriber: " + e);
  }
  
  return responseJSON({ 
    status: 'success', 
    data: { 
      project: project,
      lists: lists,
      users: users, 
      tags: tags, 
      statuses: allStatuses, 
      comments: comments,
      subscribers: subscribers
    } 
  }); 
}

/**
 * FUNGSI PEMBANTU: Konversi URL Google Drive ke Link Foto Langsung
 */
function formatDriveUrl(url) {
  if (!url || url === "" || url === "undefined") {
    return "https://ui-avatars.com/api/?background=random&color=fff&name=User";
  }

  if (url.indexOf("drive.google.com/uc") > -1) return url;

  try {
    let fileId = "";
    if (url.indexOf("id=") > -1) {
      fileId = url.split("id=")[1].split("&")[0];
    } else {
      let parts = url.split("/");
      let dIndex = parts.indexOf("d");
      if (dIndex > -1 && parts[dIndex + 1]) {
        fileId = parts[dIndex + 1];
      }
    }

    if (fileId !== "") {
      return "https://drive.google.com/uc?export=view&id=" + fileId;
    }
    return url;
  } catch (e) {
    return url;
  }
}

function createList(data) {
  try {
    const ss = SpreadsheetApp.openById(LIST_SHEET_ID).getSheets()[0];
    const lid = Utilities.getUuid(); // Generate ID unik
    const now = new Date();
    
    // Sesuaikan dengan urutan kolom di Spreadsheet List:
    // 1. list_id, 2. project_id, 3. list_name, 4. description, 5. is_tracked, 6. color_theme, 7. position, 8. created_at
    const row = [
      lid,                      // Column A: list_id
      data.projectId,           // Column B: project_id
      data.name,                // Column C: list_name (diambil dari data.name frontend)
      data.description || "",   // Column D: description (diambil dari data.description frontend)
      false,                    // Column E: is_tracked (default false)
      "#0B2B6A",                // Column F: color_theme (default)
      0,                        // Column G: position
      now                       // Column H: created_at
    ];
    
    ss.appendRow(row);
    const stSS = SpreadsheetApp.openById(STATUS_SHEET_ID).getSheets()[0];
    stSS.appendRow([Utilities.getUuid(), lid, "", "START", "not_started", "#64748b", 0]);
    stSS.appendRow([Utilities.getUuid(), lid, "", "COMPLETE", "done", "#10b981", 1]);
    return responseJSON({ status: 'success', listId: lid });
    
  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  }
}

/** 
 * FUNGSI: MEMBUAT TASK (Lengkap dengan Status, User Asli, dan Tags) 
 */ 
function createTask(data) { 
  const ss = SpreadsheetApp.openById(TASK_SHEET_ID).getSheets()[0]; 
  const tid = Utilities.getUuid(); 
  const now = new Date(); 

  const row = [ 
    tid, 
    data.listId, 
    "", 
    data.title, 
    data.description || "", 
    data.status || "OPEN", 
    data.priority || "normal", 
    data.startDate || "", 
    data.dueDate || "", 
    "", "", "", 
    data.userId, 
    now, 
    now, 
    "", 
    data.points || 0, 
    "pts", 
    data.assignTo || "", 
    data.notifyTo || "", 
    0 
  ]; 
   
  try { 
    ss.appendRow(row); 
 
    if (data.tagIds && data.tagIds.length > 0) { 
      const junctionSheet = SpreadsheetApp.openById(TASK_TAG_SHEET_ID).getSheets()[0]; 
      data.tagIds.forEach(tagId => { 
        junctionSheet.appendRow([tid, tagId]); 
      }); 
    } 
    return responseJSON({ status: 'success', taskId: tid }); 
  } catch (e) { 
    return responseJSON({ status: 'error', message: e.toString() }); 
  } 
} 

function deleteTask(data) {
  try {
    const ss = SpreadsheetApp.openById(TASK_SHEET_ID).getSheets()[0];
    const vals = ss.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(data.taskId)) {
        moveToTrash('task', vals[i][0], vals[i][3], vals[i][1], data.userId, vals[i]);
        ss.deleteRow(i + 1);
        try {
          const ttSheet = SpreadsheetApp.openById(TASK_TAG_SHEET_ID).getSheets()[0];
          const ttVals = ttSheet.getDataRange().getValues();
          for (let j = ttVals.length - 1; j >= 1; j--) {
            if (String(ttVals[j][0]) === String(data.taskId)) {
              ttSheet.deleteRow(j + 1);
            }
          }
        } catch (e) {}
        return responseJSON({ status: 'success' });
      }
    }
    return responseJSON({ status: 'error', message: 'Task not found' });
  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  }
}
 
/** 
 * FUNGSI: MEMBUAT STATUS BARU 
 */ 
function createStatus(data) { 
  const ss = SpreadsheetApp.openById(STATUS_SHEET_ID).getSheets()[0]; 
  const sid = Utilities.getUuid(); 
  
  // Kolom: status_id, list_id, task_id, status_name, status_type, color, position 
  ss.appendRow([ 
    sid, 
    data.listId, 
    "", // task_id biasanya kosong jika status level list 
    data.statusName, 
    data.statusType || "active", 
    data.color || "#64748b", 
    data.position || 0 
  ]); 
  return responseJSON({ status: 'success', statusId: sid }); 
}

function syncStatuses(data) {
  try {
    const ss = SpreadsheetApp.openById(STATUS_SHEET_ID).getSheets()[0];
    const vals = ss.getDataRange().getValues();
    
    // 1. Hapus status lama untuk list_id ini
    // Kita hapus baris dari bawah ke atas agar index tidak berantakan
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][1]) === String(data.listId)) {
        ss.deleteRow(i + 1);
      }
    }
    
    // 2. Tambahkan data baru hasil sinkronisasi
    data.statuses.forEach((s) => {
      ss.appendRow([
        Utilities.getUuid(), // status_id
        data.listId,         // list_id
        "",                  // task_id (kosongkan jika template)
        s.name,              // status_name
        s.type,              // status_type (not_started, active, dll)
        s.color,             // color
        s.position           // position
      ]);
    });
    
    return responseJSON({ status: 'success' });
  } catch (e) {
    return responseJSON({ status: 'error', message: e.toString() });
  }
}



function uploadFileToDrive(data) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const contentType = data.mimeType || "application/octet-stream";
    let rawData = data.fileData;
    if (rawData.indexOf(',') > -1) rawData = rawData.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(rawData), contentType, data.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return responseJSON({ status: 'success', fileUrl: file.getUrl(), fileName: file.getName() });
  } catch (e) { return responseJSON({ status: 'error', message: e.toString() }); }
}

/** 
 * FUNGSI: MEMBUAT KOMENTAR (Pastikan data.userId masuk ke Kolom 4) 
 */ 
function createComment(data) { 
   const ss = SpreadsheetApp.openById(COMMENT_SHEET_ID).getSheets()[0]; 
   const cid = Utilities.getUuid(); 
   
   // Sesuai PDF: 1:comment_id, 2:context_type, 3:context_id, 4:user_id, 5:comment_text, 6:created_at 
   // Kita gunakan String() untuk memastikan ID tidak dianggap angka yang hilang formatnya 
   ss.appendRow([ 
     cid,                            // Col 1: comment_id 
     data.contextType || "project",  // Col 2: context_type 
     data.contextId,                 // Col 3: context_id 
     String(data.userId),            // Col 4: user_id (DIPERBAIKI) 
     data.text,                      // Col 5: comment_text 
     new Date(),                     // Col 6: created_at 
     data.attachmentUrl || ""        // Col 7: attachment_url (opsional) 
   ]); 
   
   return responseJSON({ status: 'success' }); 
}

function updateComment(data) {
  const ss = SpreadsheetApp.openById(COMMENT_SHEET_ID).getSheets()[0];
  const rows = ss.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.commentId)) {
      ss.getRange(i + 1, 5).setValue(data.text);
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error', message: 'Comment not found' });
}

function deleteComment(data) {
  const ss = SpreadsheetApp.openById(COMMENT_SHEET_ID).getSheets()[0];
  const rows = ss.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.commentId)) {
      ss.deleteRow(i + 1);
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error', message: 'Comment not found' });
}

function updateTaskStatus(data) {
  const ss = SpreadsheetApp.openById(TASK_SHEET_ID).getSheets()[0];
  const vals = ss.getDataRange().getValues();
  for(let i=1; i<vals.length; i++){
    if(String(vals[i][0]) === String(data.taskId)){
      ss.getRange(i+1, 6).setValue(data.status);
      ss.getRange(i+1, 15).setValue(new Date());
      return responseJSON({status:'success'});
    }
  }
  return responseJSON({status:'error', message: 'Task not found'});
}

/** 
 * FUNGSI: TOGGLE SUBSCRIBER (Revisi untuk 5 Kolom) 
 */ 
function toggleSubscriber(data) { 
  const ss = SpreadsheetApp.openById(SUBS_SHEET_ID).getSheets()[0]; 
  const allData = ss.getDataRange().getValues(); 
  let foundRowIndex = -1; 
  
  // Cari berdasarkan context_id (kolom 3/index 2) dan user_id (kolom 4/index 3) 
  for (let i = 1; i < allData.length; i++) { 
    if (String(allData[i][2]) === String(data.contextId) && String(allData[i][3]) === String(data.userId)) { 
      foundRowIndex = i + 1; 
      break; 
    } 
  } 
  
  if (foundRowIndex !== -1) { 
    ss.deleteRow(foundRowIndex); 
    return responseJSON({ status: 'success', message: 'Unsubscribed' }); 
  } else { 
    const sid = Utilities.getUuid(); 
    // Kolom: subscription_id, context_type, context_id, user_id, created_at 
    ss.appendRow([ 
      sid, 
      "project",      // context_type 
      data.contextId, // context_id 
      data.userId,    // user_id 
      new Date()      // created_at 
    ]); 
    return responseJSON({ status: 'success', message: 'Subscribed' }); 
  } 
}

function getAllProjectsData() {
  const ss = SpreadsheetApp.openById(PROJECT_SHEET_ID).getSheets()[0];
  const d = ss.getDataRange().getDisplayValues();
  let p=[];
  for(let i=1; i<d.length; i++){
    if(d[i][0]) p.push({id:d[i][0], name:d[i][1], desc:d[i][2], department:d[i][9], pinned:d[i][8]});
  }
  return responseJSON({status:'success', data:p});
}

function updateList(data) { 
  const ss = SpreadsheetApp.openById(LIST_SHEET_ID).getSheets()[0]; 
  const vals = ss.getDataRange().getValues(); 
  for (let i = 1; i < vals.length; i++) { 
    if (String(vals[i][0]) === String(data.listId)) { 
      if (data.name !== undefined) { 
        ss.getRange(i + 1, 3).setValue(data.name); 
      } 
      if (data.description !== undefined) { 
        ss.getRange(i + 1, 4).setValue(data.description); 
      } 
      if (data.position !== undefined) { 
        ss.getRange(i + 1, 7).setValue(data.position); 
      } 
      return responseJSON({ status: 'success' }); 
    } 
  } 
  return responseJSON({ status: 'error', message: 'List not found' }); 
} 

function deleteList(data) { 
  const ss = SpreadsheetApp.openById(LIST_SHEET_ID).getSheets()[0]; 
  const vals = ss.getDataRange().getValues(); 
  for (let i = 1; i < vals.length; i++) { 
    if (String(vals[i][0]) === String(data.listId)) { 
      moveToTrash('list', data.listId, vals[i][2], vals[i][1], data.userId, vals[i]);
      ss.deleteRow(i + 1); 
      // Opsional: Hapus juga task yang terkait dengan list_id ini di TASK_SHEET_ID 
      return responseJSON({ status: 'success' }); 
    } 
  } 
  return responseJSON({ status: 'error', message: 'List not found' }); 
}

function responseJSON(obj) { 
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); 
}
