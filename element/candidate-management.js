// ===== IMPORTS =====
import { renderTopBar } from "./topbar.js";
import { renderSidebar } from "./sidebar.js";
import { renderRightbarRecruit } from "./rightbar-recruit.js";
import { getInterviewScheduleStatus, filterAndSortInterviewSchedules } from "./recruitment-interview-utils.js";
import { promptTeamDivision, resolveCandidateDivision, syncAcceptedCandidateToTeamManagement } from "./team-management-sync.js";
import { getCategoryTemplateDefs, getStoredTemplates, saveTemplates, setTemplatesLastModified } from "./template-manager.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { app, auth, db, storage } from "../assets/js/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, collection, getDoc, getDocs, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, serverTimestamp, arrayUnion, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// ===== FIREBASE INIT =====


window.app = app; window.auth = auth; window.db = db;
window.collection = collection; window.getDoc = getDoc; window.getDocs = getDocs;
window.addDoc = addDoc; window.doc = doc; window.updateDoc = updateDoc;
window.setDoc = setDoc; window.serverTimestamp = serverTimestamp;
window.storage = storage; window.storageRef = storageRef;
window.uploadBytes = uploadBytes; window.getDownloadURL = getDownloadURL;
window.toggleSidebar = () => { const s = document.getElementById("sidebarNav"); if (!s) return; s.classList.toggle("show"); document.body.classList.toggle("sidebar-collapsed"); };

// ===== LAYOUT =====
const topbarTarget = document.getElementById("topbarContainer"); renderTopBar(topbarTarget);
const sidebarTarget = document.getElementById("sidebarContainer"); renderSidebar(sidebarTarget); renderRightbarRecruit();

// ===== TAB CONFIG =====
const TAB_CONFIG = {
  team: {
    collectionName: "teams_screening", trashCollection: "teams_screening_trash",
    detailPage: "./team-candidate-detail.html", label: "Team", roleId: "team", roleName: "team",
    deletedSourcePage: "candidate-team", deletedSourceLabel: "Kandidat Team",
    statusPipeline: [
      { value: "screening", label: "Screening", badgeClass: "status-screening", caption: "Seleksi awal" },
      { value: "interview", label: "Interview", badgeClass: "status-interview", caption: "Proses wawancara" },
      { value: "accepted", label: "Accepted", badgeClass: "status-accepted", caption: "Lolos seleksi" },
      { value: "onboarding", label: "On Boarding", badgeClass: "status-onboarding", caption: "Siap bergabung" },
      { value: "rejected", label: "Rejected", badgeClass: "status-rejected", caption: "Tidak diterima" },
      { value: "canceled", label: "Canceled", badgeClass: "status-canceled", caption: "Dibatalkan" }
    ],
    roleFilter(data) {
      const basic = data.basic_info || {}; const scouting = data.scouting_info || {};
      const internship = data.internship || data.internship_info || {};
      const rid = (data.role_id || data.roleId || scouting.role_id || internship.role_id || "").toString().toLowerCase().replace(/\s/g, "");
      const rn = (data.role_name || data.role || basic.current_role || scouting.role_name || "").toString().toLowerCase().replace(/\s/g, "");
      const has = !!(rid || rn);
      const isTeam = rid === "team" || rn === "team";
      return isTeam || !has;
    },
    normalizeStatus(raw) {
      if (raw === "interview") return "interview";
      if (["accept","accepted","decision"].includes(raw)) return "accepted";
      if (raw === "onboarding") return "onboarding";
      if (["rejected","reject"].includes(raw)) return "rejected";
      if (["canceled","withdrawn","mengundurkan_diri","mengundurkan diri"].includes(raw)) return "canceled";
      return "screening";
    },
    resolveDisplayStatus(recruitment) {
      const s = recruitment || {};
      const cur = TAB_CONFIG.team.normalizeStatus((s.current || "screening").toString().trim().toLowerCase());
      const fd = (s.final_decision || s.finalDecision || "").toString().trim().toLowerCase();
      if (["rejected","reject"].includes(fd)) return "rejected";
      if (["canceled","withdrawn","mengundurkan_diri","mengundurkan diri"].includes(fd)) return "canceled";
      if (["accepted","accept"].includes(fd) && cur !== "onboarding") return "accepted";
      return cur;
    },
    hasOjtSection: true, hasTeamSync: true,
    positionField: (data, scouting, internship) => data.role_name || internship.role_name || scouting.role_name || "",
    interviewScheduleField: (recruitment, data) => recruitment.interview_schedule || recruitment.due_date || data.interview_schedule || ""
  },
  mentor: {
    collectionName: "mentors_screening", trashCollection: "mentors_screening_trash",
    detailPage: "./mentor-candidate-detail.html", label: "Mentor", roleId: "mentor", roleName: "mentor",
    deletedSourcePage: "candidate-mentor", deletedSourceLabel: "Kandidat Mentor",
    statusPipeline: [
      { value: "screening", label: "Screening", badgeClass: "status-screening", caption: "Seleksi awal" },
      { value: "interview", label: "Interview", badgeClass: "status-interview", caption: "Proses wawancara" },
      { value: "micro_teaching", label: "MT", badgeClass: "status-micro-teaching", caption: "Simulasi mengajar" },
      { value: "accepted", label: "Accepted", badgeClass: "status-accepted", caption: "Lolos seleksi" },
      { value: "rejected", label: "Rejected", badgeClass: "status-rejected", caption: "Tidak diterima" },
      { value: "canceled", label: "Canceled", badgeClass: "status-canceled", caption: "Dibatalkan" }
    ],
    roleFilter(data) {
      const basic = data.basic_info || {}; const scouting = data.scouting_info || {};
      const internship = data.internship || data.internship_info || {};
      const rid = (data.role_id || data.roleId || scouting.role_id || internship.role_id || "").toString().toLowerCase().replace(/\s/g, "");
      const rn = (data.role_name || data.role || basic.current_role || scouting.role_name || "").toString().toLowerCase().replace(/\s/g, "");
      const has = !!(rid || rn);
      const isMentor = rid === "mentor" || rn === "mentor";
      return isMentor || !has;
    },
    normalizeStatus(raw) {
      if (raw === "interview") return "interview";
      if (["accept","accepted","decision"].includes(raw)) return "accepted";
      if (raw === "micro_teaching") return "micro_teaching";
      if (["rejected","reject"].includes(raw)) return "rejected";
      if (["canceled","withdrawn","mengundurkan_diri","mengundurkan diri"].includes(raw)) return "canceled";
      return "screening";
    },
    resolveDisplayStatus(recruitment) {
      const s = recruitment || {};
      const cur = TAB_CONFIG.mentor.normalizeStatus((s.current || "screening").toString().trim().toLowerCase());
      const fd = (s.final_decision || s.finalDecision || "").toString().trim().toLowerCase();
      if (["rejected","reject"].includes(fd)) return "rejected";
      if (["canceled","withdrawn","mengundurkan_diri","mengundurkan diri"].includes(fd)) return "canceled";
      if (["accepted","accept"].includes(fd) && cur !== "micro_teaching") return "accepted";
      return cur;
    },
    hasOjtSection: false, hasTeamSync: false, hasMentorSync: true,
    positionField: (data, scouting, internship) => scouting.position_name || internship.position || "",
    interviewScheduleField: (recruitment) => {
      const dueDateRaw = recruitment.interview_schedule || recruitment.due_date || null;
      return formatScheduleSortValue(dueDateRaw);
    }
  },
  internship: {
    collectionName: "interns_screening", trashCollection: "interns_screening_trash",
    detailPage: "./internship-candidate-detail.html", label: "Internship", roleId: "internship", roleName: "internship",
    deletedSourcePage: "candidate-internship", deletedSourceLabel: "Kandidat Internship",
    statusPipeline: [
      { value: "screening", label: "Screening", badgeClass: "status-screening", caption: "Seleksi awal" },
      { value: "interview", label: "Interview", badgeClass: "status-interview", caption: "Proses wawancara" },
      { value: "accepted", label: "Accepted", badgeClass: "status-accepted", caption: "Lolos seleksi" },
      { value: "onboarding", label: "Onboarding", badgeClass: "status-onboarding", caption: "Siap bergabung" },
      { value: "rejected", label: "Rejected", badgeClass: "status-rejected", caption: "Tidak diterima" },
      { value: "canceled", label: "Canceled", badgeClass: "status-canceled", caption: "Dibatalkan" }
    ],
    roleFilter(data) {
      const basic = data.basic_info || {}; const scouting = data.scouting_info || {};
      const internship = data.internship || data.internship_info || {};
      const rid = (data.role_id || data.roleId || scouting.role_id || internship.role_id || "").toString().toLowerCase().replace(/\s/g, "");
      const rn = (data.role_name || data.role || basic.current_role || scouting.role_name || "").toString().toLowerCase().replace(/\s/g, "");
      return rid === "internship" && rn === "internship";
    },
    normalizeStatus(raw) {
      if (raw === "interview") return "interview";
      if (["accept","accepted","decision"].includes(raw)) return "accepted";
      if (raw === "onboarding") return "onboarding";
      if (["rejected","reject"].includes(raw)) return "rejected";
      if (["canceled","withdrawn","mengundurkan_diri","mengundurkan diri"].includes(raw)) return "canceled";
      return "screening";
    },
    resolveDisplayStatus(recruitment) {
      const s = recruitment || {};
      const cur = TAB_CONFIG.internship.normalizeStatus((s.current || "screening").toString().trim().toLowerCase());
      const fd = (s.final_decision || s.finalDecision || "").toString().trim().toLowerCase();
      if (["rejected","reject"].includes(fd)) return "rejected";
      if (["canceled","withdrawn","mengundurkan_diri","mengundurkan diri"].includes(fd)) return "canceled";
      if (["accepted","accept"].includes(fd) && cur !== "onboarding") return "accepted";
      return cur;
    },
    hasOjtSection: false, hasTeamSync: false,
    positionField: (data, scouting, internship) => {
      const raw = (internship.position_name || internship.position || scouting.position_name || scouting.position || data.position_name || data.position || "").toString().trim();
      if (raw && raw.toLowerCase() !== "internship") return raw;
      return "";
    },
    interviewScheduleField: (recruitment) => {
      const dueDateRaw = recruitment.interview_schedule || recruitment.due_date || null;
      return formatScheduleSortValue(dueDateRaw);
    }
  }
};

// ===== SHARED HELPERS =====
function escapeHtml(str) { return (str || "").toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function getInitialsFromName(v) { const t = (v||"").toString().trim(); if (!t) return "NA"; return t.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w.charAt(0).toUpperCase()).join(""); }
function toDateObject(raw) { if (!raw) return null; if (typeof raw.toDate === "function") { const d = raw.toDate(); return d instanceof Date && !isNaN(d.getTime()) ? d : null; } if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw; if (typeof raw === "string" || typeof raw === "number") { const p = new Date(raw); return isNaN(p.getTime()) ? null : p; } return null; }
function formatCreatedDate(raw) { try { if (!raw) return ""; let d = null; if (typeof raw.toDate === "function") d = raw.toDate(); else if (raw instanceof Date) d = raw; else if (typeof raw === "string" || typeof raw === "number") { const t = new Date(raw); if (!isNaN(t.getTime())) d = t; } if (!d) return ""; return d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); } catch(e) { return ""; } }
function getCreatedTimestamp(raw) { try { if (!raw) return 0; if (typeof raw.toDate === "function") { const d = raw.toDate(); return d instanceof Date ? d.getTime() : 0; } if (raw instanceof Date) return raw.getTime(); if (typeof raw === "string" || typeof raw === "number") { const t = new Date(raw); return isNaN(t.getTime()) ? 0 : t.getTime(); } } catch(e) { return 0; } return 0; }
function formatDueDateForInput(raw) { if (!raw) return ""; let d = null; if (typeof raw.toDate === "function") d = raw.toDate(); else if (raw instanceof Date) d = raw; else if (typeof raw === "string" || typeof raw === "number") { const t = new Date(raw); if (!isNaN(t.getTime())) d = t; } if (!d) return ""; return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0"); }
function formatScheduleSortValue(raw) { const d = toDateObject(raw); if (!d) return ""; return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+"T"+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function formatInterviewDateOnly(raw) { const d = toDateObject(raw); if (!d) return "-"; const wd = new Intl.DateTimeFormat("id-ID",{weekday:"long"}).format(d); const dt = new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"long",year:"numeric"}).format(d); return wd.charAt(0).toUpperCase()+wd.slice(1)+", "+dt; }
function formatInterviewTimeOnly(raw) { const d = toDateObject(raw); if (!d) return "-"; const t = new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",hour12:false}).format(d); return t.replace(":",".")+ " WIB"; }
function getInterviewScheduleBoardBadgeMeta(s) { const st = (s||"").toString().trim().toLowerCase(); if (st==="today") return {label:"Today",className:"interview-schedule-badge badge-today"}; if (st==="completed") return {label:"Completed",className:"interview-schedule-badge badge-completed"}; return {label:"Upcoming",className:"interview-schedule-badge badge-upcoming"}; }
function normalizeInterviewerAvailability(raw, fallback) { const v = (raw||fallback||"").toString().trim().toLowerCase(); if (!v) return "available"; if (["booked","busy","occupied","taken","unavailable","not_available"].includes(v)) return "booked"; return "available"; }
function resolveInterviewerSpecialization(data) { if (!data || typeof data !== "object") return "General Recruitment"; return (data.specialization||data.interviewer_specialization||data.position_name||data.position||data.role_name||data.role||"General Recruitment").toString(); }
function getInterviewerAvailabilitySummary(interviewers) { if (!Array.isArray(interviewers) || !interviewers.length) return "available"; return interviewers.some(i => (i.availability||"") === "available") ? "available" : "booked"; }
function normalizeExternalUrl(v) { const r = (v||"").toString().trim(); if (!r) return ""; if (/^https?:\/\//i.test(r)) return r; return "https://"+r.replace(/^\/+/,""); }
function isInactiveCandidateRecord(data) { if (!data) return false; const rs = (data.record_status||data.recordStatus||"").toString().trim().toLowerCase(); return data.is_deleted===true || rs==="inactive" || !!data.deleted_at || !!data.deletedAt; }
function formatOjtDateRangeCompact(startDate, endDate) { const s = toDateObject(startDate); if (!s) return "-"; const st = s.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); const e = toDateObject(endDate); if (!e) return st; return st + " - " + e.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}); }
async function copyToClipboard(text) { const v = (text||"").toString(); if (!v) return; try { if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(v); else { const ta = document.createElement("textarea"); ta.value = v; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.focus(); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); } } catch(e) { console.error("Copy failed", e); } }
async function uploadFileToStorage(file, folder) { if (!file) return null; const path = (folder||"uploads")+"/"+Date.now()+"-"+file.name; const r = storageRef(storage, path); await uploadBytes(r, file); return await getDownloadURL(r); }
function getInterviewerDetailsFromIds(ids, usersMap) { return (Array.isArray(ids)?ids:[]).map(uid => { const u = usersMap[uid]||null; if (!u) return null; const av = normalizeInterviewerAvailability(u.availability, ids.length ? "booked" : "available"); return { id: uid, name: u.name||"User", photo: u.photo||null, specialization: u.specialization||"General Recruitment", availability: av }; }).filter(Boolean); }
function buildInterviewScheduleEntry(params, usersMap) { const d = toDateObject(params.scheduleRaw); if (!d) return null; const details = getInterviewerDetailsFromIds(params.interviewerIds, usersMap); return { candidateId: params.candidateId||"", candidateName: params.candidateName||"Tanpa Nama", positionName: params.positionName||"-", interviewerNames: details.map(i=>i.name).filter(Boolean), scheduleAt: d, scheduleIso: d.toISOString(), scheduleStatus: getInterviewScheduleStatus(d) }; }

// ===== PER-TAB STATE =====
const tabState = {};
function getTabState(cat) {
  if (!tabState[cat]) {
    tabState[cat] = { loaded: false, unsubCandidates: null, unsubUsers: null, renderToken: 0, usersMap: {},
      interviewSchedule: { entries: [], loading: false, page: 1, pageSize: 10, selectedRowKey: "" },
      currentEditingTalentId: null, currentAvatarUrl: null, currentPortfolioUrl: null, currentResumeUrl: null, viewMode: "grid"
    };
  }
  return tabState[cat];
}
let activeTab = "team";

// ===== STATUS HELPERS (per-tab) =====
function getStatusMeta(cat, status) { const cfg = TAB_CONFIG[cat]; const n = cfg.normalizeStatus((status||"screening").toString().trim().toLowerCase()); return cfg.statusPipeline.find(i=>i.value===n) || cfg.statusPipeline[0]; }
function getStatusLabel(cat, status) { return getStatusMeta(cat, status).label; }
function getStatusBadgeClasses(cat, status) { return "status-badge-modern " + getStatusMeta(cat, status).badgeClass; }
function getStatusOrder(cat, status) { const cfg = TAB_CONFIG[cat]; const n = cfg.normalizeStatus(status); const idx = cfg.statusPipeline.findIndex(i=>i.value===n); return idx===-1?0:idx; }
function buildStatusStepperHtml(cat, status) {
  const cfg = TAB_CONFIG[cat]; const ci = getStatusOrder(cat, status);
  return cfg.statusPipeline.map((step, i) => {
    let cls = "pipeline-step"; if (i < ci) cls += " is-complete"; if (i === ci) cls += " is-active";
    return '<div class="'+cls+'"><span class="pipeline-step-index">'+(i+1)+'</span><span class="pipeline-step-text"><span class="pipeline-step-label">'+step.label+'</span><span class="pipeline-step-caption">'+step.caption+'</span></span></div>';
  }).join("");
}

// ===== PIPELINE SUMMARY =====
function updatePipelineSummary(cat) {
  const cfg = TAB_CONFIG[cat]; const el = document.querySelector('.tab-pipeline[data-tab="'+cat+'"]'); if (!el) return;
  const counts = {}; cfg.statusPipeline.forEach(s => counts[s.value] = 0);
  const grid = document.querySelector('.tab-grid[data-tab="'+cat+'"]');
  if (grid) grid.querySelectorAll('.candidate-item').forEach(item => { if (item.style.display === "none") return; const n = cfg.normalizeStatus(item.dataset.status||""); counts[n] = (counts[n]||0)+1; });
  const total = Object.values(counts).reduce((a,b)=>a+b, 0);
  const totalNote = total === 0 ? 'Belum ada data yang dimuat.' : 'Total seluruh kandidat.';
  let html = '<div class="pipeline-stat-card pipeline-stat-total"><div class="pipeline-stat-label">Total Kandidat</div><div class="pipeline-stat-value">'+total+'</div><div class="pipeline-stat-note">'+totalNote+'</div></div>';
  cfg.statusPipeline.forEach(s => { const cnt = counts[s.value]||0; html += '<div class="pipeline-stat-card pipeline-stat-'+s.value+'"><div class="pipeline-stat-label">'+s.label+'</div><div class="pipeline-stat-value">'+cnt+'</div><div class="pipeline-stat-note">'+(s.caption||'')+'</div></div>'; });
  el.innerHTML = html;
  const countEl = document.getElementById("tabCount" + cat.charAt(0).toUpperCase() + cat.slice(1));
  if (countEl) countEl.textContent = total;
}

// ===== VIEW MODE =====
function setViewMode(cat, mode) {
  const state = getTabState(cat); state.viewMode = mode;
  const grid = document.querySelector('.tab-grid[data-tab="'+cat+'"]');
  const list = document.querySelector('.tab-list-wrap[data-tab="'+cat+'"]');
  const toggleBtn = document.querySelector('.tab-view-toggle[data-tab="'+cat+'"]');
  const gridBtn = document.querySelector('.tab-grid-btn[data-tab="'+cat+'"]');
  const listBtn = document.querySelector('.tab-list-btn[data-tab="'+cat+'"]');
  const isGrid = mode === "grid";
  if (grid) grid.style.display = isGrid ? "grid" : "none";
  if (list) list.style.display = isGrid ? "none" : "block";
  if (toggleBtn) { toggleBtn.classList.toggle("is-list", !isGrid); const icon = toggleBtn.querySelector(".view-mode-slider-thumb i"); if (icon) { icon.className = isGrid ? "fa-solid fa-table-cells-large" : "fa-solid fa-list"; } }
  if (gridBtn) gridBtn.classList.toggle("active", isGrid);
  if (listBtn) listBtn.classList.toggle("active", !isGrid);
}

// ===== FILTER / SORT =====
function applyFilters(cat) {
  const searchEl = document.querySelector('.tab-search-input[data-tab="'+cat+'"]');
  const statusEl = document.querySelector('.tab-status-filter[data-tab="'+cat+'"]');
  const sortEl = document.querySelector('.tab-sort-select[data-tab="'+cat+'"]');
  const term = (searchEl ? searchEl.value : "").toLowerCase();
  const statusVal = (statusEl ? statusEl.value : "").toLowerCase();
  const sortVal = sortEl ? sortEl.value : "none";
  const grid = document.querySelector('.tab-grid[data-tab="'+cat+'"]');
  const listWrap = document.querySelector('.tab-list-wrap[data-tab="'+cat+'"]');
  if (!grid) return;
  const gridItems = grid.querySelectorAll('.candidate-item');
  const listRows = listWrap ? listWrap.querySelectorAll('.candidate-row') : [];
  gridItems.forEach(item => { const t = item.innerText.toLowerCase(); const s = (item.dataset.status||"").toLowerCase(); item.style.display = (t.includes(term) && (!statusVal || s===statusVal)) ? "" : "none"; });
  listRows.forEach(row => { const t = row.innerText.toLowerCase(); const s = (row.dataset.status||"").toLowerCase(); row.style.display = (t.includes(term) && (!statusVal || s===statusVal)) ? "" : "none"; });
  if (sortVal === "none") { updatePipelineSummary(cat); return; }
  const compare = (a,b) => {
    const nA = (a.dataset.name||"").toLowerCase(), nB = (b.dataset.name||"").toLowerCase();
    const sA = (a.dataset.status||"").toLowerCase(), sB = (b.dataset.status||"").toLowerCase();
    const cA = Number(a.dataset.created||"0"), cB = Number(b.dataset.created||"0");
    const dA = a.dataset.dueDate||"", dB = b.dataset.dueDate||"";
    if (sortVal==="status") return sA.localeCompare(sB,"id");
    if (sortVal==="created_desc") return cB-cA;
    if (sortVal==="created_asc") return cA-cB;
    if (sortVal==="interview_asc") return (dA||"9999-12-31").localeCompare(dB||"9999-12-31","id");
    if (sortVal==="interview_desc") return (dB||"0000-01-01").localeCompare(dA||"0000-01-01","id");
    if (sortVal==="name_asc") return nA.localeCompare(nB,"id");
    if (sortVal==="name_desc") return nB.localeCompare(nA,"id");
    return 0;
  };
  const visGrid = Array.from(gridItems).filter(i=>i.style.display!=="none"); visGrid.sort(compare).forEach(i=>grid.appendChild(i));
  if (listWrap) { const tbody = listWrap.querySelector("tbody"); const visList = Array.from(listRows).filter(r=>r.style.display!=="none"); visList.sort(compare).forEach(r=>tbody.appendChild(r)); }
  updatePipelineSummary(cat);
}

// ===== BUILD DETAIL URL =====
function buildCandidateDetailUrl(cat, talentId) { return TAB_CONFIG[cat].detailPage + "?talentId=" + encodeURIComponent(talentId||""); }

// ===== CARD RENDERING =====
function appendCandidateToUI(cat, params) {
  const cfg = TAB_CONFIG[cat];
  const name = escapeHtml(params.name||"Tanpa Nama"); const position = escapeHtml(params.positionName||"");
  const avatarUrl = params.avatarUrl || "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=800";
  const mode = (params.mode||"").toString().toUpperCase(); const address = escapeHtml(params.address||"");
  const email = escapeHtml(params.email||""); const campus = escapeHtml(params.campus||"");
  const talentId = params.talentId||""; const rawStatus = params.status||"";
  const currentStatus = cfg.normalizeStatus(rawStatus) || "screening";
  const dueDateInputValue = params.dueDateInputValue||""; const interviewScheduleRaw = params.interviewScheduleRaw||"";
  const interviewerIds = Array.isArray(params.interviewerIds) ? params.interviewerIds : [];
  const createdSortValue = Number(params.createdSortValue||0);
  const finalDecisionAt = params.finalDecisionAt||null;
  const rejectionReason = escapeHtml(params.rejectionReason||""); const rejectionNotes = escapeHtml(params.rejectionNotes||"");
  const withdrawnNotes = escapeHtml(params.withdrawnNotes||"");
  const ojtStart = params.onJobTrainingStartDate||null; const ojtEnd = params.onJobTrainingEndDate||null;
  const isTeamMember = !!params.isTeamMember;
  const onboardingDate = params.onboardingDate||null;
  const onboardingTime = params.onboardingTime||"";
  const onboardingLocation = params.onboardingLocation||"";
  const state = getTabState(cat);
  const gridContainer = document.querySelector('.tab-grid[data-tab="'+cat+'"]');
  const listTbody = document.querySelector('.tab-list-wrap[data-tab="'+cat+'"] tbody');
  if (!gridContainer || !listTbody) return;
  const statusLabel = getStatusLabel(cat, currentStatus);
  const statusBadgeClasses = getStatusBadgeClasses(cat, currentStatus);
  const positionHtml = position ? '<span class="candidate-role">'+position+'</span>' : '<span class="candidate-role">-</span>';
  const emailValue = email||"-"; const addressValue = address||"-"; const modeValue = mode||"-"; const campusValue = campus||"-";
  const avatarAttr = escapeHtml(avatarUrl);
  let headerChipsHtml = '<div class="candidate-header-chips">'+positionHtml+'<span class="'+statusBadgeClasses+'">'+statusLabel+'</span>';
  if (cat === "team" && isTeamMember) headerChipsHtml += '<span class="team-member-badge"><i class="fa-solid fa-user-check"></i>Team Member</span>';
  headerChipsHtml += '</div>';
  // Status details for rejected/withdrawn
  let statusDetailsHtml = "";
  if (currentStatus === "rejected" || currentStatus === "canceled") {
    const dateText = finalDecisionAt ? formatCreatedDate(finalDecisionAt) : "-";
    let notesText = currentStatus === "rejected" ? (rejectionReason||rejectionNotes) : withdrawnNotes;
    const notesDisplay = notesText ? '<div class="candidate-detail-value essay-clamp" title="'+notesText+'">'+notesText+'</div>' : '<div class="candidate-detail-value text-muted">-</div>';
    statusDetailsHtml = '<div class="candidate-selection-meta mt-3 pt-3 border-t border-slate-100"><div class="candidate-interview-meta" style="gap:12px"><div class="candidate-extra-item"><div class="candidate-extra-label">Tanggal</div><div class="candidate-detail-value text-sm">'+escapeHtml(dateText)+'</div></div><div class="candidate-extra-item"><div class="candidate-extra-label">Catatan</div>'+notesDisplay+'</div></div></div>';
  }
  const detailListHtml = '<div class="candidate-details-list"><div class="candidate-detail-item detail-email"><div class="candidate-detail-icon"><i class="fa-regular fa-envelope"></i></div><div class="candidate-detail-content"><div class="candidate-detail-label">Email</div><div class="candidate-detail-value candidate-detail-value-email" title="'+emailValue+'">'+emailValue+'</div></div></div><div class="candidate-detail-item detail-location"><div class="candidate-detail-icon"><i class="fa-solid fa-location-dot"></i></div><div class="candidate-detail-content"><div class="candidate-detail-label">Lokasi</div><div class="candidate-detail-value" title="'+addressValue+'">'+addressValue+'</div></div></div><div class="candidate-detail-item detail-mode"><div class="candidate-detail-icon"><i class="fa-solid fa-building"></i></div><div class="candidate-detail-content"><div class="candidate-detail-label">Mode Kerja</div><div class="candidate-detail-value">'+modeValue+'</div></div></div></div>';
  const hasInterview = !!toDateObject(interviewScheduleRaw);
  const intStatus = hasInterview ? getInterviewScheduleStatus(interviewScheduleRaw) : "";
  const intDetails = getInterviewerDetailsFromIds(interviewerIds, state.usersMap);
  const intNames = intDetails.length ? intDetails.map(i=>i.name).join(", ") : "-";
  const intDate = hasInterview ? formatInterviewDateOnly(interviewScheduleRaw) : "-";
  const intTime = hasInterview ? formatInterviewTimeOnly(interviewScheduleRaw) : "-";
  const intBadge = hasInterview ? getInterviewScheduleBoardBadgeMeta(intStatus) : null;
  const intAvail = getInterviewerAvailabilitySummary(intDetails);
  const intGridHtml = intDetails.length ? intDetails.map(i => { const inner = i.photo ? '<img src="'+escapeHtml(i.photo)+'" alt="'+escapeHtml(i.name)+'">' : escapeHtml(getInitialsFromName(i.name)); return '<div class="interviewer-card"><div class="interviewer-avatar">'+inner+'</div><div class="interviewer-main"><div class="interviewer-name">'+escapeHtml(i.name)+'</div></div></div>'; }).join("") : '<div class="interviewer-card"><div class="interviewer-avatar">NA</div><div class="interviewer-main"><div class="interviewer-name">Belum Ditentukan</div></div></div>';
  const interviewSectionHtml = '<div class="candidate-selection-meta"><div class="candidate-interview-meta"><div class="candidate-extra-item candidate-extra-item-interviewer"><div class="candidate-extra-label">Interviewer</div><div class="interviewer-grid" data-bs-toggle="tooltip" data-bs-placement="top" title="'+escapeHtml(intNames)+'">'+intGridHtml+'</div></div><div class="candidate-extra-item candidate-extra-item-schedule"><div class="schedule-compact-header"><i class="fa-regular fa-calendar-days"></i><span>Jadwal Interview</span></div><div class="schedule-compact-details"><div class="schedule-compact-row"><span>Tanggal</span><strong>'+escapeHtml(intDate)+'</strong></div><div class="schedule-compact-row"><span>Jam</span><strong>'+escapeHtml(intTime)+'</strong></div><div class="schedule-compact-row"><span>Status</span><strong>'+(intBadge ? '<span class="'+intBadge.className+'">'+escapeHtml(intBadge.label)+'</span>' : '-')+'</strong></div></div></div></div></div>';
  let ojtSectionHtml = "";
  if (cfg.hasOjtSection && ojtStart) { const ojtDate = formatOjtDateRangeCompact(ojtStart, ojtEnd); ojtSectionHtml = '<div class="candidate-selection-meta mt-2"><div class="candidate-interview-meta"><div class="candidate-extra-item candidate-extra-item-schedule" style="border-left:3px solid #10b981"><div class="schedule-compact-header"><i class="fa-solid fa-graduation-cap"></i><span>Jadwal OJT</span></div><div class="schedule-compact-date">'+escapeHtml(ojtDate)+'</div></div></div></div>'; }
  let onboardingSectionHtml = "";
  if (currentStatus === "onboarding" && onboardingDate) {
    const onbDateObj = toDateObject(onboardingDate);
    const onbDateDisplay = onbDateObj ? formatInterviewDateOnly(onbDateObj) : escapeHtml(onboardingDate);
    const onbTimeDisplay = onboardingTime ? escapeHtml(onboardingTime.replace(":", ".") + " WIB") : "-";
    const onbLocationDisplay = onboardingLocation ? escapeHtml(onboardingLocation) : "-";
    onboardingSectionHtml = '<div class="candidate-selection-meta mt-2"><div class="candidate-interview-meta"><div class="candidate-extra-item candidate-extra-item-schedule" style="border-left:3px solid #6366f1"><div class="schedule-compact-header"><i class="fa-solid fa-user-check"></i><span>On Boarding</span></div><div class="schedule-compact-details"><div class="schedule-compact-row"><span>Tanggal</span><strong>'+onbDateDisplay+'</strong></div><div class="schedule-compact-row"><span>Jam</span><strong>'+onbTimeDisplay+'</strong></div><div class="schedule-compact-row"><span>Lokasi</span><strong>'+onbLocationDisplay+'</strong></div></div></div></div></div>';
  }
  const cancelBtnHtml = (!["rejected","canceled"].includes(currentStatus)) ? '<button type="button" class="candidate-inline-action candidate-cancel-btn" data-category="'+cat+'" data-talent-id="'+talentId+'" title="Canceled / Mengundurkan Diri" style="color:#b45309"><i class="fa-solid fa-user-xmark"></i></button>' : '';
  const actionBtn = '<div class="candidate-card-head-actions">'+cancelBtnHtml+'<button type="button" class="candidate-inline-action action-trash candidate-delete-btn" data-category="'+cat+'" title="Pindahkan ke Sampah"><i class="fa-solid fa-trash-can"></i></button></div>';
  let bodyContent = detailListHtml; if (statusDetailsHtml) bodyContent += statusDetailsHtml;
  const gridHtml = '<div class="candidate-item" data-name="'+name+'" data-position="'+position+'" data-email="'+emailValue+'" data-campus="'+campusValue+'" data-avatar="'+avatarAttr+'" data-status-label="'+escapeHtml(statusLabel)+'" data-talent-id="'+talentId+'" data-status="'+currentStatus+'" data-created="'+createdSortValue+'" data-due-date="'+escapeHtml(dueDateInputValue)+'" data-interview-status="'+intStatus+'" data-interviewer-availability="'+intAvail+'" data-category="'+cat+'" tabindex="0" role="link"><div class="candidate-card-modern"><div class="candidate-card-head"><div class="candidate-avatar-row"><img src="'+avatarUrl+'" alt="'+name+'" class="candidate-avatar-large"><div class="candidate-header-main"><div class="candidate-name">'+name+'</div>'+headerChipsHtml+'</div></div>'+actionBtn+(statusDetailsHtml ? "" : interviewSectionHtml+ojtSectionHtml+onboardingSectionHtml)+'</div><div class="candidate-card-body">'+bodyContent+'</div></div></div>';
  const listHtml = '<tr style="background-color:transparent" class="candidate-row candidate-row-main" data-name="'+name+'" data-position="'+position+'" data-email="'+emailValue+'" data-campus="'+campusValue+'" data-avatar="'+avatarAttr+'" data-status-label="'+escapeHtml(statusLabel)+'" data-status="'+currentStatus+'" data-created="'+createdSortValue+'" data-due-date="'+escapeHtml(dueDateInputValue)+'" data-interview-status="'+intStatus+'" data-interviewer-availability="'+intAvail+'" data-talent-id="'+talentId+'" data-category="'+cat+'"><td style="background-color:transparent" colspan="1" class="border-0 px-0 py-2"><div class="candidate-list-card" data-talent-id="'+talentId+'" data-category="'+cat+'" tabindex="0" role="link"><div class="candidate-list-main"><div class="candidate-list-topbar"><div class="d-flex gap-3 align-items-start flex-grow-1"><img src="'+avatarUrl+'" alt="'+name+'" class="list-img rounded-4 shadow-sm" style="width:64px;height:64px;object-fit:cover;border-radius:1rem"><div class="candidate-header-main"><div class="candidate-name">'+name+'</div>'+headerChipsHtml+'</div></div>'+cancelBtnHtml+'<button type="button" class="candidate-inline-action action-trash candidate-delete-btn" data-category="'+cat+'" title="Pindahkan ke Sampah"><i class="fa-solid fa-trash-can"></i></button></div>'+(statusDetailsHtml ? statusDetailsHtml : interviewSectionHtml+ojtSectionHtml+onboardingSectionHtml)+detailListHtml+'</div></div></td></tr>';
  gridContainer.insertAdjacentHTML("beforeend", gridHtml);
  listTbody.insertAdjacentHTML("beforeend", listHtml);
  if (window.refreshTooltips) window.refreshTooltips();
}

// ===== DATA LOADING =====
async function ensureUsersLoaded(cat) {
  const state = getTabState(cat);
  if (Object.keys(state.usersMap).length > 0) return state.usersMap;
  if (window.questUsersById && Object.keys(window.questUsersById).length > 0) { Object.assign(state.usersMap, window.questUsersById); return state.usersMap; }
  const cc = window.__appCache__;
  if (cc && cc.users && Date.now() - cc.usersLoadedAt < 300000) { Object.assign(state.usersMap, cc.users); return state.usersMap; }
  try { const snap = await getDocs(collection(db, "users")); snap.forEach(ds => { const d = ds.data()||{}; state.usersMap[ds.id] = { name: d.displayName||d.name||d.email||"User", photo: d.photo||d.photoURL||d.avatar_url||d.avatar||null, specialization: resolveInterviewerSpecialization(d), availability: normalizeInterviewerAvailability(d.interview_availability||d.availability||d.interviewer_status||d.status) }; }); if (cc) { cc.users = Object.assign({}, state.usersMap); cc.usersLoadedAt = Date.now(); } } catch(e) {}
  return state.usersMap;
}

async function loadCandidates(cat, snapshotOverride) {
  const cfg = TAB_CONFIG[cat]; const state = getTabState(cat);
  const renderToken = ++state.renderToken;
  const grid = document.querySelector('.tab-grid[data-tab="'+cat+'"]');
  const listTbody = document.querySelector('.tab-list-wrap[data-tab="'+cat+'"] tbody');
  if (!grid || !listTbody) return;
  grid.innerHTML = ""; listTbody.innerHTML = "";
  state.interviewSchedule.loading = true;
  updateInterviewMeta(cat);
  try {
    const intEntries = []; await ensureUsersLoaded(cat);
    if (renderToken !== state.renderToken) return;
    const snap = snapshotOverride || await getDocs(collection(db, cfg.collectionName));
    if (renderToken !== state.renderToken) return;
    if (snap.empty) { state.interviewSchedule.entries = []; state.interviewSchedule.page = 1; state.interviewSchedule.loading = false; updateInterviewMeta(cat); return; }
    let found = 0;
    snap.forEach(ds => {
      if (renderToken !== state.renderToken) return;
      const data = ds.data()||{};
      if (isInactiveCandidateRecord(data)) return;
      if (!cfg.roleFilter(data)) return;
      const basic = data.basic_info||{}; const scouting = data.scouting_info||{};
      const contact = data.contact_info||{}; const education = data.education||{};
      const internship = data.internship||data.internship_info||{};
      const name = basic.full_name||scouting.full_name||data.full_name||"Tanpa Nama";
      const positionName = cfg.positionField(data, scouting, internship);
      const avatarUrl = basic.avatar_url||null;
      const createdRaw = data.created_at||data.createdAt||data.created||null;
      const createdSortValue = getCreatedTimestamp(createdRaw);
      const recruitment = data.recruitment_status||data.recruitment_system||{};
      const currentStatus = cfg.resolveDisplayStatus(recruitment);
      const dueDateRaw = recruitment.due_date||null;
      const dueDateInputValue = formatDueDateForInput(dueDateRaw);
      const address = contact.address||internship.address||"";
      const email = contact.email||basic.email||internship.email||"";
      const campus = internship.campus||education.campus||education.university||"";
      const mode = internship.mode||"";
      const interviewers = Array.isArray(data.interviewers) ? data.interviewers.filter(Boolean) : [];
      const intScheduleRaw = cfg.interviewScheduleField(recruitment, data);
      const intEntry = (currentStatus === "interview") ? buildInterviewScheduleEntry({ candidateId: ds.id, candidateName: name, positionName, interviewerIds: interviewers, scheduleRaw: intScheduleRaw }, state.usersMap) : null;
      if (intEntry) intEntries.push(intEntry);
      const finalDecisionAt = recruitment.final_decision_at||null;
      const rejectionReason = recruitment.rejection_reason||"";
      const rejectionNotes = recruitment.rejection_notes||"";
      const withdrawnNotes = recruitment.withdrawn_notes||"";
      const ojtStart = recruitment.on_job_training_start_date||null;
      const ojtEnd = recruitment.on_job_training_end_date||null;
      const isTeamMember = !!(data.isTeamMember||data.is_team_member||data.teamManagementId||recruitment.is_team_member||recruitment.team_management_id);
      const onboardingDate = recruitment.onboarding_date||null;
      const onboardingTime = recruitment.onboarding_time||"";
      const onboardingLocation = recruitment.onboarding_location||"";
      appendCandidateToUI(cat, { name, positionName, avatarUrl, mode, address, email, campus, talentId: ds.id, status: currentStatus, dueDateInputValue, interviewScheduleRaw: intScheduleRaw, interviewerIds: interviewers, createdSortValue, finalDecisionAt, rejectionReason, rejectionNotes, withdrawnNotes, onJobTrainingStartDate: ojtStart, onJobTrainingEndDate: ojtEnd, isTeamMember, onboardingDate, onboardingTime, onboardingLocation });
      found += 1;
    });
    if (!found) {
      grid.innerHTML = '<div class="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 py-10 text-center text-slate-400 text-sm">Belum ada data kandidat '+cfg.label+' yang dapat ditampilkan.</div>';
      listTbody.innerHTML = '<tr><td class="text-center text-muted small py-4">Belum ada data kandidat '+cfg.label+' yang dapat ditampilkan.</td></tr>';
    }
    state.interviewSchedule.entries = intEntries;
    state.interviewSchedule.loading = false;
    state.loaded = true;
    updateInterviewMeta(cat);
    updatePipelineSummary(cat);
    applyFilters(cat);
  } catch(e) {
    console.error("Failed to load candidates for "+cat, e);
    state.interviewSchedule.loading = false; updateInterviewMeta(cat);
  }
}

function subscribeRealtimeUpdates(cat) {
  const cfg = TAB_CONFIG[cat]; const state = getTabState(cat);
  if (state.unsubCandidates) state.unsubCandidates();
  state.unsubCandidates = onSnapshot(collection(db, cfg.collectionName), snap => { loadCandidates(cat, snap); }, err => { console.error("Realtime "+cat+" gagal", err); });
  if (state.unsubUsers) state.unsubUsers();
  state.unsubUsers = onSnapshot(collection(db, "users"), snap => {
    Object.keys(state.usersMap).forEach(k => delete state.usersMap[k]);
    snap.forEach(ds => { const d = ds.data()||{}; state.usersMap[ds.id] = { name: d.displayName||d.name||d.email||"User", photo: d.photo||d.photoURL||d.avatar_url||d.avatar||null, specialization: resolveInterviewerSpecialization(d), availability: normalizeInterviewerAvailability(d.interview_availability||d.availability||d.interviewer_status||d.status) }; });
  }, err => { console.error("Realtime users gagal", err); });
}

// ===== STATUS UPDATE / REMOVE UI =====
function updateCandidateStatusUI(cat, talentId, status) {
  const cfg = TAB_CONFIG[cat]; const n = cfg.normalizeStatus(status);
  const lbl = getStatusLabel(cat, n); const bcls = getStatusBadgeClasses(cat, n); const stepperHtml = buildStatusStepperHtml(cat, n);
  document.querySelectorAll('[data-category="'+cat+'"][data-talent-id="'+talentId+'"]').forEach(c => {
    c.dataset.status = n;
    c.querySelectorAll(".status-badge-modern").forEach(b => { b.className = bcls; b.textContent = lbl; });
  });
  updatePipelineSummary(cat); applyFilters(cat);
}
function removeCandidateFromUI(cat, talentId) {
  document.querySelectorAll('[data-category="'+cat+'"][data-talent-id="'+talentId+'"]').forEach(el => el.remove());
  updatePipelineSummary(cat); applyFilters(cat);
}

// ===== INTERVIEW SCHEDULE =====
function updateInterviewMeta(cat) {
  // Meta elements are hidden in the compact toolbar layout; no visual update needed.
}

let interviewModalInstance = null;
function renderInterviewScheduleTable() {
  const state = getTabState(activeTab); const sched = state.interviewSchedule;
  const loadEl = document.getElementById("interviewScheduleLoading"); const emptyEl = document.getElementById("interviewScheduleEmpty");
  const wrapEl = document.getElementById("interviewScheduleTableWrap"); const bodyEl = document.getElementById("interviewScheduleTableBody");
  const pagWrap = document.getElementById("interviewSchedulePagWrap"); const pagMeta = document.getElementById("interviewSchedulePagMeta");
  const prevBtn = document.getElementById("interviewSchedulePrevBtn"); const nextBtn = document.getElementById("interviewScheduleNextBtn");
  if (!loadEl||!emptyEl||!wrapEl||!bodyEl||!pagWrap||!pagMeta||!prevBtn||!nextBtn) return;
  if (sched.loading) { loadEl.classList.remove("d-none"); emptyEl.classList.add("d-none"); wrapEl.classList.add("d-none"); pagWrap.classList.add("d-none"); return; }
  const searchEl = document.getElementById("interviewScheduleSearch"); const dateEl = document.getElementById("interviewScheduleDateFilter");
  const sortEl = document.getElementById("interviewScheduleSort"); const statusEl = document.getElementById("interviewScheduleStatusFilter");
  const q = searchEl ? searchEl.value : ""; const df = dateEl ? dateEl.value : ""; const s = sortEl ? sortEl.value : "nearest";
  const sf = statusEl ? (statusEl.value||"").toLowerCase() : "";
  let filtered = filterAndSortInterviewSchedules(sched.entries, { query: q, date: df, sort: s||"nearest" });
  if (sf) filtered = filtered.filter(i => (i.scheduleStatus||"").toLowerCase() === sf);
  const total = filtered.length; const ps = sched.pageSize; const tp = Math.max(1, Math.ceil(total/ps));
  if (sched.page > tp) sched.page = tp;
  const page = Math.max(1, sched.page); const start = (page-1)*ps; const end = Math.min(start+ps, total); const paged = filtered.slice(start, end);
  if (!total) { loadEl.classList.add("d-none"); emptyEl.classList.remove("d-none"); wrapEl.classList.add("d-none"); pagWrap.classList.add("d-none"); bodyEl.innerHTML = ""; return; }
  loadEl.classList.add("d-none"); emptyEl.classList.add("d-none"); wrapEl.classList.remove("d-none"); pagWrap.classList.remove("d-none");
  const cfg = TAB_CONFIG[activeTab];
  bodyEl.innerHTML = paged.map(item => {
    const intText = Array.isArray(item.interviewerNames) && item.interviewerNames.length ? item.interviewerNames.join(", ") : "Belum Ditentukan";
    const detailLink = cfg.detailPage + "?talentId=" + encodeURIComponent(item.candidateId||"") + "&source=list";
    const cn = escapeHtml(item.candidateName||"Tanpa Nama"); const pn = escapeHtml(item.positionName||"-");
    const id = escapeHtml(formatInterviewDateOnly(item.scheduleAt||"")); const it = escapeHtml(formatInterviewTimeOnly(item.scheduleAt||""));
    const rs = ((item.scheduleStatus||"").toLowerCase()==="today") ? "booked" : "available";
    const rk = (item.candidateId||"") + "|" + (item.scheduleAt||""); const isSel = sched.selectedRowKey === rk;
    const selCls = isSel ? " schedule-selected" : ""; const stCls = rs==="booked" ? " schedule-status-booked" : " schedule-status-available";
    const tt = "Interviewer: "+intText+" | "+id+" | "+it;
    return '<tr class="schedule-clickable-row'+stCls+selCls+'" tabindex="0" role="button" data-bs-toggle="tooltip" data-bs-placement="top" title="'+escapeHtml(tt)+'" data-detail-link="'+detailLink+'" data-candidate-id="'+escapeHtml(item.candidateId||"")+'" data-row-key="'+escapeHtml(rk)+'"><td>'+id+'</td><td>'+it+'</td><td><div class="fw-semibold text-dark d-flex align-items-center"><span>'+cn+'</span>'+(isSel?'<span class="schedule-selected-check"><i class="fa-solid fa-check"></i></span>':'')+'</div></td><td>'+escapeHtml(intText)+'</td><td>'+pn+'</td></tr>';
  }).join("");
  if (window.refreshTooltips) window.refreshTooltips();
  pagMeta.textContent = "Menampilkan "+(start+1)+"-"+end+" dari "+total+" jadwal";
  prevBtn.disabled = page <= 1; nextBtn.disabled = page >= tp;
}

// ===== TEMPLATE EDITOR (per-category) =====
let templateModalInstance = null;
let activeTemplateCategory = "team";
const CATEGORY_LABELS = { intern: "Intern", team: "Team", mentor: "Mentor" };
function renderTemplateEditor(category) {
  activeTemplateCategory = category || "team";
  const el = document.getElementById("templateEditorGrid"); if (!el) return;
  const defs = getCategoryTemplateDefs(activeTemplateCategory);
  const values = getStoredTemplates(activeTemplateCategory);
  el.innerHTML = defs.map(item => { const tl = item.requiredTokens.join(", "); return '<div class="template-editor-item"><h6 class="template-editor-item-title">'+escapeHtml(item.title)+'</h6><p class="template-editor-item-desc">'+escapeHtml(item.description)+'</p><p class="template-editor-item-desc mb-1"><strong>Placeholder:</strong> '+escapeHtml(tl)+'</p><textarea class="form-control" data-template-input="'+item.id+'" rows="7">'+escapeHtml(values[item.id]||item.defaultTemplate)+'</textarea></div>'; }).join("");
  // Update category label in modal header
  const catLabel = document.getElementById("templateCategoryLabel");
  if (catLabel) catLabel.textContent = "Template WhatsApp — " + (CATEGORY_LABELS[activeTemplateCategory] || activeTemplateCategory);
}
function setTemplateValidation(msg, tone) {
  const el = document.getElementById("templateBaseValidationMsg"); if (!el) return;
  if (!msg) { el.textContent = ""; el.className = "alert alert-warning d-none py-2 px-3 mb-3"; return; }
  el.textContent = msg; el.className = "alert py-2 px-3 mb-3 "+(tone==="success"?"alert-success":tone==="danger"?"alert-danger":"alert-warning");
}

// ===== FIRESTORE ACTIONS =====
async function updateCandidateStatus(cat, talentId, newStatus, actorName) {
  const cfg = TAB_CONFIG[cat]; if (!talentId||!newStatus) return false;
  const ref = doc(db, cfg.collectionName, talentId); const nowIso = new Date().toISOString();
  try { await updateDoc(ref, { "recruitment_status.current": newStatus, "recruitment_status.history": arrayUnion({ status: newStatus, date: nowIso }), logs: arrayUnion({ action: "status_change", to: newStatus, by: actorName||null, date: nowIso }) }); return true; } catch(e) { console.error("Status update failed", e); return false; }
}
async function cancelCandidateStatus(cat, talentId, notes, actorName) {
  const cfg = TAB_CONFIG[cat]; if (!talentId) return false;
  const ref = doc(db, cfg.collectionName, talentId); const nowIso = new Date().toISOString();
  try {
    await updateDoc(ref, {
      "recruitment_status.current": "canceled",
      "recruitment_status.final_decision": "canceled",
      "recruitment_status.final_decision_at": nowIso,
      "recruitment_status.withdrawn_notes": notes || "",
      "recruitment_status.history": arrayUnion({ status: "canceled", previousStatus: "active", date: nowIso, by: actorName||null }),
      logs: arrayUnion({ action: "status_change", to: "canceled", by: actorName||null, date: nowIso, notes: notes||"" })
    });
    return true;
  } catch(e) { console.error("Cancel status update failed", e); return false; }
}
async function deleteSyncedCandidateData(cat, talentId) {
  const cfg = TAB_CONFIG[cat];
  try {
    if (cfg.hasMentorSync) {
      const mentorRef = doc(db, "mentor", talentId);
      const mentorSnap = await getDoc(mentorRef);
      if (mentorSnap.exists()) {
        await deleteDoc(mentorRef);
        console.log("[Cancel Sync] Deleted mentor doc:", talentId);
      }
    }
    if (cfg.hasTeamSync) {
      const tmQuery = query(collection(db, "team_management"), where("candidateId", "==", talentId), limit(1));
      const tmSnap = await getDocs(tmQuery);
      if (!tmSnap.empty) {
        const tmDoc = tmSnap.docs[0];
        await deleteDoc(doc(db, "team_management", tmDoc.id));
        console.log("[Cancel Sync] Deleted team_management doc:", tmDoc.id);
      }
      await updateDoc(doc(db, cfg.collectionName, talentId), {
        isTeamMember: false,
        is_team_member: false,
        "recruitment_status.is_team_member": false,
        "recruitment_status.team_management_id": null,
        "recruitment_status.team_member_division": null,
        "recruitment_status.team_member_department": null,
        teamManagementId: null
      });
      console.log("[Cancel Sync] Cleared team flags for:", talentId);
    }
  } catch(e) {
    console.error("[Cancel Sync] Failed to clean synced data:", e);
  }
}
async function handleCancelCandidate(cat, talentId) {
  const actor = window.auth?.currentUser;
  const actorName = actor?.displayName || actor?.email || "";
  const result = await Swal.fire({
    icon: "warning",
    title: "Canceled / Mengundurkan Diri",
    text: "Apakah Anda yakin ingin menandai kandidat ini sebagai Canceled / Mengundurkan Diri? Kandidat akan keluar dari pipeline aktif.",
    input: "textarea",
    inputLabel: "Catatan / alasan pengunduran diri (opsional)",
    inputPlaceholder: "Tuliskan alasan atau catatan...",
    showCancelButton: true,
    confirmButtonText: "Ya, batalkan",
    cancelButtonText: "Batal",
    reverseButtons: true,
    confirmButtonColor: "#b45309"
  });
  if (!result.isConfirmed) return;
  const notes = (result.value || "").toString().trim();
  const ok = await cancelCandidateStatus(cat, talentId, notes, actorName);
  if (!ok) { alert("Gagal mengupdate status kandidat."); return; }
  try { await deleteSyncedCandidateData(cat, talentId); } catch(err) { console.error("Sync cleanup failed", err); }
  updateCandidateStatusUI(cat, talentId, "canceled");
}
async function moveCandidateToTrash(cat, talentId, payload) {
  const cfg = TAB_CONFIG[cat]; if (!talentId) return;
  const user = auth.currentUser; const dbn = user ? user.displayName||user.email||"Recruitment Team" : "Recruitment Team"; const dbe = user ? user.email||"" : "";
  try {
    await setDoc(doc(db, cfg.trashCollection, talentId), { source_doc_id: talentId, source_collection: cfg.collectionName, name: payload?.name||"Tanpa Nama", position: payload?.position||"-", email: payload?.email||"-", campus: payload?.campus||"-", avatar_url: payload?.avatarUrl||"", last_status: payload?.lastStatus||"Screening", is_deleted: true, record_status: "inactive", deleted_source_page: cfg.deletedSourcePage, deleted_source_label: cfg.deletedSourceLabel, deleted_at: serverTimestamp(), deleted_by_uid: user?user.uid:"", deleted_by_name: dbn, deleted_by_email: dbe, updated_at: serverTimestamp() });
    await updateDoc(doc(db, cfg.collectionName, talentId), { is_deleted: true, record_status: "inactive", deleted_source_page: cfg.deletedSourcePage, deleted_source_label: cfg.deletedSourceLabel, deleted_at: serverTimestamp(), deleted_by_uid: user?user.uid:"", deleted_by_name: dbn, deleted_by_email: dbe });
  } catch(e) { throw e; }
}

// ===== MENTOR SYNC (accepted → mentor collection) =====
async function syncAcceptedMentorFromScreening(candidateId) {
  if (!candidateId) return;
  try {
    const snap = await getDoc(doc(db, "mentors_screening", candidateId));
    if (!snap.exists()) { console.warn("Mentor candidate not found:", candidateId); return; }
    const sourceData = snap.data() || {};
    const basic = sourceData.basic_info || {};
    const contact = sourceData.contact_info || {};
    const internship = sourceData.internship || sourceData.internship_info || {};
    const scouting = sourceData.scouting_info || {};
    const education = sourceData.education || {};
    const fullName = basic.full_name || scouting.full_name || sourceData.full_name || "Tanpa Nama";
    const nickName = (fullName.split(" ")[0] || "").trim();
    const whatsappRaw = internship.whatsapp || contact.whatsapp || contact.phone || sourceData.whatsapp || "";
    const digits = (whatsappRaw || "").toString().replace(/\D/g, "");
    const whatsappLink = digits ? "https://wa.me/" + digits : "";
    const location = internship.address || contact.address || sourceData.location || sourceData.city || "";
    const teachingType = scouting.teaching_type || internship.teaching_type || sourceData.teaching_type || "";
    const deliveryType = internship.mode || sourceData.type || sourceData.deliveryType || "";
    const mentorPayload = {
      fullName, nickName, whatsapp: whatsappLink, location,
      rating: 0, teaching: teachingType, type: deliveryType,
      activeClasses: 0, totalClasses: 0, status: "active",
      contractEnd: null, contractDurationMonths: null, lastActiveDays: 0,
      completionRate: 0, attendanceRate: 0, complaintCount: 0, avgFeedback: 0,
      totalEarning: 0, pendingPayment: 0, feeOnline: 0, feeOffline: 0,
      availability: [], classHistory: [], contractNotes: "",
      bankName: "", accountNumber: "", accountHolderName: fullName,
      email: internship.email || contact.email || basic.email || "",
      campus: internship.campus || education.campus || education.university || "",
      major: internship.major || education.major || education.department || education.faculty || "",
      instagram: internship.instagram || contact.instagram || "",
      linkedin: internship.linkedin || contact.linkedin || scouting.channel_url || "",
      address: contact.address || internship.address || "",
      avatar_url: basic.avatar_url || "",
      source_candidate_id: candidateId,
      source_collection: "mentors_screening",
      copied_to_mentor_at: new Date().toISOString(),
      createdAt: sourceData.created_at || sourceData.createdAt || serverTimestamp()
    };
    await setDoc(doc(db, "mentor", candidateId), mentorPayload, { merge: true });
    console.log("[Mentor Sync] Candidate", candidateId, "synced to mentor collection.");
  } catch (e) {
    console.error("[Mentor Sync] Failed to sync candidate to mentor collection:", e);
  }
}

// ===== TAB SWITCHING =====
function switchTab(cat) {
  activeTab = cat;
  document.querySelectorAll('.candidate-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === cat));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'panel-'+cat));
  if (cat === "positions") { if (!positionsLoaded) { loadRecruitmentPositions(); positionsLoaded = true; } return; }
  const state = getTabState(cat);
  if (!state.loaded) { loadCandidates(cat); subscribeRealtimeUpdates(cat); }
}

// ===== POSITION MANAGEMENT =====
let positionsData = [];
let positionsLoaded = false;
let positionModalInstance = null;

async function loadRecruitmentPositions() {
  const grid = document.getElementById("positionsCardGrid");
  if (grid) grid.innerHTML = '<div class="text-center py-4 text-muted" style="grid-column:1/-1">Memuat data...</div>';
  try {
    const snap = await getDocs(collection(db, "recruitment_positions"));
    positionsData = [];
    snap.forEach(ds => {
      const raw = ds.data() || {};
      // Normalize category: could be array or string in Firestore
      let cat = raw.category;
      if (Array.isArray(cat)) cat = cat[0] || "";
      cat = (cat || "").toString().toLowerCase();
      // Normalize active: Firestore uses is_active, code uses active
      const isActive = raw.active !== undefined ? !!raw.active : !!raw.is_active;
      // Normalize created date: Firestore uses created_at, code uses createdAt
      const createdAt = raw.createdAt || raw.created_at || null;
      positionsData.push({ id: ds.id, ...raw, category: cat, active: isActive, createdAt });
    });
    positionsData.sort((a,b) => (a.name||"").localeCompare(b.name||"","id"));
    renderPositionsCards();
  } catch (e) {
    console.error("[Positions] Failed to load:", e);
    if (grid) grid.innerHTML = '<div class="text-center py-4 text-danger" style="grid-column:1/-1">Gagal memuat data.</div>';
  }
}

// Color palette for position cards — cycles through for visual variety
const POSITION_CARD_COLORS = [
  { bg: '#f0f9ff', border: '#bae6fd', accent: '#0284c7' },
  { bg: '#fdf4ff', border: '#f0abfc', accent: '#a21caf' },
  { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a' },
  { bg: '#fff7ed', border: '#fdba74', accent: '#ea580c' },
  { bg: '#faf5ff', border: '#c4b5fd', accent: '#7c3aed' },
  { bg: '#fefce8', border: '#fde047', accent: '#ca8a04' },
  { bg: '#fff1f2', border: '#fda4af', accent: '#e11d48' },
  { bg: '#ecfeff', border: '#67e8f9', accent: '#0891b2' },
  { bg: '#f8fafc', border: '#94a3b8', accent: '#475569' },
  { bg: '#fef2f2', border: '#fca5a5', accent: '#dc2626' }
];

function getPositionCategoryFilter() {
  const activeBtn = document.querySelector('#positionCategorySubtabs .position-subtab-btn.active');
  return activeBtn ? (activeBtn.dataset.category || '') : 'internship';
}

function renderPositionsCards() {
  const grid = document.getElementById("positionsCardGrid"); if (!grid) return;
  const inactiveSection = document.getElementById("inactivePositionsSection");
  const inactiveGrid = document.getElementById("inactivePositionsGrid");
  const inactiveCount = document.getElementById("inactivePositionCount");
  const catFilter = getPositionCategoryFilter();
  let filtered = positionsData.filter(p => {
    if (catFilter && (p.category||"") !== catFilter) return false;
    return true;
  });
  const activePositions = filtered.filter(p => p.active);
  const inactivePositions = filtered.filter(p => !p.active);

  // Render active positions
  if (!activePositions.length) {
    grid.innerHTML = '<div class="candidate-empty-state" style="grid-column:1/-1">Tidak ada posisi aktif untuk kategori ini.</div>';
  } else {
    grid.innerHTML = activePositions.map((p, idx) => {
      const color = POSITION_CARD_COLORS[idx % POSITION_CARD_COLORS.length];
      const createdStr = formatCreatedDate(p.createdAt);
      return '<div class="position-card" data-id="'+escapeHtml(p.id)+'" style="background:'+color.bg+';border:1px solid '+color.border+'">'+
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
          '<div class="position-card-title">'+escapeHtml(p.name||"-")+'</div>'+
          '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:700;color:#16a34a"><i class="fa-solid fa-circle" style="font-size:0.35rem"></i>Aktif</span>'+
        '</div>'+
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
          '<div class="position-card-date"><i class="fa-regular fa-calendar"></i>'+escapeHtml(createdStr||"-")+'</div>'+
          '<div style="display:flex;gap:4px">'+
            '<button type="button" class="position-action-btn" data-action="toggle" data-id="'+escapeHtml(p.id)+'" title="Nonaktifkan" style="color:#16a34a"><i class="fa-solid fa-toggle-on"></i></button>'+
            '<button type="button" class="position-action-btn" data-action="edit" data-id="'+escapeHtml(p.id)+'" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>'+
            '<button type="button" class="position-action-btn action-danger" data-action="delete" data-id="'+escapeHtml(p.id)+'" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join("");
  }

  // Render inactive positions
  if (inactiveSection && inactiveGrid) {
    if (!inactivePositions.length) {
      inactiveSection.style.display = "none";
      inactiveGrid.innerHTML = "";
    } else {
      inactiveSection.style.display = "block";
      if (inactiveCount) inactiveCount.textContent = inactivePositions.length;
      inactiveGrid.innerHTML = inactivePositions.map(p => {
        const createdStr = formatCreatedDate(p.createdAt);
        return '<div class="position-card position-card-inactive" data-id="'+escapeHtml(p.id)+'">'+
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
            '<div class="position-card-title">'+escapeHtml(p.name||"-")+'</div>'+
            '<span style="display:inline-flex;align-items:center;gap:4px;font-size:0.68rem;font-weight:700;color:#94a3b8"><i class="fa-solid fa-circle" style="font-size:0.35rem"></i>Nonaktif</span>'+
          '</div>'+
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
            '<div class="position-card-date"><i class="fa-regular fa-calendar"></i>'+escapeHtml(createdStr||"-")+'</div>'+
            '<div style="display:flex;gap:4px">'+
              '<button type="button" class="position-action-btn" data-action="toggle" data-id="'+escapeHtml(p.id)+'" title="Aktifkan" style="color:#94a3b8"><i class="fa-solid fa-toggle-off"></i></button>'+
              '<button type="button" class="position-action-btn" data-action="edit" data-id="'+escapeHtml(p.id)+'" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>'+
              '<button type="button" class="position-action-btn action-danger" data-action="delete" data-id="'+escapeHtml(p.id)+'" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>'+
            '</div>'+
          '</div>'+
        '</div>';
      }).join("");
    }
  }
  if (window.refreshTooltips) window.refreshTooltips();
}

function openPositionModal(docId) {
  const form = document.getElementById("positionForm"); if (form) form.reset();
  document.getElementById("positionDocId").value = docId || "";
  const title = document.getElementById("positionFormModalLabel");
  // Status is always defaulted to active for new positions; for edits, keep existing value in Firestore
  document.getElementById("positionActiveInput").value = "true";
  if (docId) {
    const pos = positionsData.find(p => p.id === docId);
    if (title) title.innerHTML = '<i class="fa-solid fa-sliders"></i>Edit Posisi';
    if (pos) {
      document.getElementById("positionNameInput").value = pos.name || "";
      document.getElementById("positionCategoryInput").value = pos.category || "";
      // Preserve existing active state when editing
      document.getElementById("positionActiveInput").value = pos.active ? "true" : "false";
    }
  } else {
    if (title) title.innerHTML = '<i class="fa-solid fa-sliders"></i>Tambah Posisi';
  }
  if (positionModalInstance) positionModalInstance.show();
}

async function savePosition() {
  const docId = (document.getElementById("positionDocId")?.value || "").trim();
  const name = (document.getElementById("positionNameInput")?.value || "").trim();
  const category = document.getElementById("positionCategoryInput")?.value || "";
  const active = document.getElementById("positionActiveInput")?.value === "true";
  if (!name) { alert("Nama posisi tidak boleh kosong."); return; }
  if (!category) { alert("Pilih kategori posisi."); return; }
  const payload = { name, category, active, is_active: active, updatedAt: serverTimestamp() };
  try {
    if (docId) {
      await updateDoc(doc(db, "recruitment_positions", docId), payload);
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, "recruitment_positions"), payload);
    }
    if (positionModalInstance) positionModalInstance.hide();
    await loadRecruitmentPositions();
  } catch (e) {
    console.error("[Positions] Save failed:", e);
    alert("Gagal menyimpan posisi.");
  }
}

async function togglePositionActive(docId) {
  const pos = positionsData.find(p => p.id === docId); if (!pos) return;
  try {
    const newActive = !pos.active;
    await updateDoc(doc(db, "recruitment_positions", docId), { active: newActive, is_active: newActive, updatedAt: serverTimestamp() });
    await loadRecruitmentPositions();
  } catch (e) { console.error("[Positions] Toggle failed:", e); alert("Gagal mengubah status."); }
}

async function deletePosition(docId) {
  const pos = positionsData.find(p => p.id === docId);
  const name = pos ? pos.name : docId;
  if (!confirm("Hapus posisi \"" + name + "\"?\nData yang sudah dihapus tidak dapat dikembalikan.")) return;
  try {
    await deleteDoc(doc(db, "recruitment_positions", docId));
    await loadRecruitmentPositions();
  } catch (e) { console.error("[Positions] Delete failed:", e); alert("Gagal menghapus posisi."); }
}

// ===== EVENT BINDING =====
function bindEvents() {
  // Tab buttons
  document.querySelectorAll('.candidate-tab-btn').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  // View toggles
  document.querySelectorAll('.tab-view-toggle').forEach(btn => btn.addEventListener('click', () => { const s = getTabState(btn.dataset.tab); setViewMode(btn.dataset.tab, s.viewMode==="grid"?"list":"grid"); }));
  document.querySelectorAll('.tab-grid-btn').forEach(btn => btn.addEventListener('click', () => setViewMode(btn.dataset.tab, "grid")));
  document.querySelectorAll('.tab-list-btn').forEach(btn => btn.addEventListener('click', () => setViewMode(btn.dataset.tab, "list")));
  // Search / filter / sort
  document.querySelectorAll('.tab-search-input').forEach(el => el.addEventListener('input', () => applyFilters(el.dataset.tab)));
  document.querySelectorAll('.tab-status-filter').forEach(el => el.addEventListener('change', () => applyFilters(el.dataset.tab)));
  document.querySelectorAll('.tab-sort-select').forEach(el => el.addEventListener('change', () => applyFilters(el.dataset.tab)));
  // Interview schedule modal
  const intModalEl = document.getElementById("interviewScheduleModal");
  if (intModalEl && window.bootstrap) interviewModalInstance = new bootstrap.Modal(intModalEl);
  document.querySelectorAll('.tab-interview-btn').forEach(btn => btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    const state = getTabState(activeTab); state.interviewSchedule.page = 1;
    ['interviewScheduleSearch','interviewScheduleDateFilter','interviewScheduleStatusFilter'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ""; });
    const sortEl = document.getElementById("interviewScheduleSort"); if (sortEl) sortEl.value = "nearest";
    renderInterviewScheduleTable();
    if (interviewModalInstance) interviewModalInstance.show();
  }));
  ['interviewScheduleSearch'].forEach(id => { const e = document.getElementById(id); if (e) e.addEventListener('input', () => { getTabState(activeTab).interviewSchedule.page = 1; renderInterviewScheduleTable(); }); });
  ['interviewScheduleDateFilter','interviewScheduleStatusFilter','interviewScheduleSort'].forEach(id => { const e = document.getElementById(id); if (e) e.addEventListener('change', () => { getTabState(activeTab).interviewSchedule.page = 1; renderInterviewScheduleTable(); }); });
  document.getElementById("interviewSchedulePrevBtn")?.addEventListener('click', () => { const s = getTabState(activeTab); s.interviewSchedule.page = Math.max(1, s.interviewSchedule.page-1); renderInterviewScheduleTable(); });
  document.getElementById("interviewScheduleNextBtn")?.addEventListener('click', () => { getTabState(activeTab).interviewSchedule.page += 1; renderInterviewScheduleTable(); });
  // Schedule row click
  document.getElementById("interviewScheduleTableBody")?.addEventListener('click', (ev) => {
    const row = ev.target.closest("tr.schedule-clickable-row"); if (!row) return;
    const cid = row.dataset?.candidateId||""; const dl = row.dataset?.detailLink||""; const rk = row.dataset?.rowKey||"";
    const state = getTabState(activeTab); if (rk) state.interviewSchedule.selectedRowKey = rk;
    renderInterviewScheduleTable();
    const detailUrl = buildCandidateDetailUrl(activeTab, cid);
    console.log("[NAV] Schedule row click → navigating to:", detailUrl);
    setTimeout(() => { if (cid) window.location.href = detailUrl; else if (dl) { console.log("[NAV] Fallback detail link:", dl); window.location.href = dl; } }, 160);
  });
  // Template modal (per-category)
  const tplModalEl = document.getElementById("templateBaseModal");
  if (tplModalEl && window.bootstrap) templateModalInstance = new bootstrap.Modal(tplModalEl);
  document.querySelectorAll('.tab-template-btn').forEach(btn => btn.addEventListener('click', () => { const cat = btn.dataset.tab || activeTab; renderTemplateEditor(cat); setTemplateValidation("",""); if (templateModalInstance) templateModalInstance.show(); }));
  document.getElementById("saveTemplateBaseBtn")?.addEventListener('click', () => {
    const cat = activeTemplateCategory;
    const defs = getCategoryTemplateDefs(cat);
    const values = {}; defs.forEach(d => { const f = document.querySelector('[data-template-input="'+d.id+'"]'); values[d.id] = f ? (f.value||"").trim() : ""; });
    for (const d of defs) { if (!values[d.id]) { setTemplateValidation("Template `"+d.title+"` tidak boleh kosong.","danger"); return; } for (const t of d.requiredTokens) { if (!values[d.id].includes(t)) { setTemplateValidation("Template `"+d.title+"` harus memuat "+t+".","danger"); return; } } }
    try { saveTemplates(values, cat); setTemplatesLastModified(cat); window.dispatchEvent(new CustomEvent("dialogika:chat-templates-updated",{detail:{category:cat,updatedAt:Date.now()}})); } catch(e) { setTemplateValidation("Gagal menyimpan.","danger"); return; }
    setTemplateValidation("Berhasil disimpan.","success"); setTimeout(() => { if (templateModalInstance) templateModalInstance.hide(); }, 500);
  });
  document.getElementById("templateEditorGrid")?.addEventListener('input', (ev) => { if (ev.target.tagName === "TEXTAREA") { ev.target.style.height = "auto"; ev.target.style.height = Math.max(ev.target.scrollHeight, 170)+"px"; } });
  // ===== POSITION MANAGEMENT BINDINGS =====
  const posModalEl = document.getElementById("positionFormModal");
  if (posModalEl && window.bootstrap) positionModalInstance = new bootstrap.Modal(posModalEl);
  document.getElementById("btnAddPosition")?.addEventListener('click', () => openPositionModal(""));
  document.getElementById("btnSavePosition")?.addEventListener('click', savePosition);
  // Position category subtab buttons
  document.querySelectorAll('#positionCategorySubtabs .position-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#positionCategorySubtabs .position-subtab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderPositionsCards();
    });
  });
  // Delegated clicks on position action buttons
  const positionActionHandler = async (ev) => {
    const btn = ev.target.closest('.position-action-btn'); if (!btn) return;
    const action = btn.dataset.action; const id = btn.dataset.id; if (!id) return;
    if (action === "toggle") await togglePositionActive(id);
    else if (action === "edit") openPositionModal(id);
    else if (action === "delete") await deletePosition(id);
  };
  document.getElementById("positionsCardGrid")?.addEventListener('click', positionActionHandler);
  document.getElementById("inactivePositionsGrid")?.addEventListener('click', positionActionHandler);
  // Delegated click events
  document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.candidate-delete-btn');
    const detailCard = e.target.closest('.candidate-item, .candidate-list-card');
    if (deleteBtn) {
      e.stopPropagation();
      const cat = deleteBtn.dataset.category; const row = deleteBtn.closest('tr'); const card = deleteBtn.closest('.candidate-item');
      const el = row||card; const talentId = el?.dataset?.talentId; if (!talentId) return;
      const payload = { name: el.dataset.name||"Tanpa Nama", position: el.dataset.position||"-", email: el.dataset.email||"-", campus: el.dataset.campus||"-", avatarUrl: el.dataset.avatar||"", lastStatus: el.dataset.statusLabel||getStatusLabel(cat, el.dataset.status||"screening") };
      if (!confirm("Pindahkan kandidat ke sampah?")) return;
      try { await moveCandidateToTrash(cat, talentId, payload); removeCandidateFromUI(cat, talentId); } catch(err) { console.error(err); alert("Gagal memindahkan kandidat."); }
      return;
    }
    const cancelBtn = e.target.closest('.candidate-cancel-btn');
    if (cancelBtn) {
      e.stopPropagation();
      const cat = cancelBtn.dataset.category;
      const talentId = cancelBtn.dataset.talentId;
      if (!cat || !talentId) return;
      await handleCancelCandidate(cat, talentId);
      return;
    }
    if (detailCard && !e.target.closest('.candidate-inline-action')) {
      const cat = detailCard.dataset?.category || activeTab;
      const tid = detailCard.dataset?.talentId;
      if (!tid) return;
      const detailUrl = buildCandidateDetailUrl(cat, tid);
      console.log("[NAV] Card click → category:", cat, "talentId:", tid, "url:", detailUrl);
      window.location.href = detailUrl;
    }
  });
  // Keyboard on cards
  document.addEventListener('keydown', (e) => { if (e.key!=="Enter"&&e.key!==" ") return; const c = e.target.closest('.candidate-item, .candidate-list-card'); if (!c) return; e.preventDefault(); const cat = c.dataset?.category||activeTab; const tid = c.dataset?.talentId; if (tid) { const detailUrl = buildCandidateDetailUrl(cat, tid); console.log("[NAV] Keyboard → navigating to:", detailUrl); window.location.href = detailUrl; } });
  // Status change
  document.addEventListener('change', async (e) => {
    const sel = e.target.closest('.candidate-status-select'); if (!sel) return;
    const cat = sel.dataset?.category || activeTab; const cfg = TAB_CONFIG[cat];
    let talentId = "";
    const container = sel.closest("[data-talent-id]"); if (container) talentId = container.dataset.talentId;
    const newVal = sel.value||""; const normalized = cfg.normalizeStatus(newVal);
    let actorName = ""; if (window.auth?.currentUser) actorName = window.auth.currentUser.displayName||window.auth.currentUser.email||"";
    if (talentId && normalized) {
      if (cfg.hasTeamSync && normalized === "accepted") {
        let div = await resolveCandidateDivision(db, cfg.collectionName, talentId);
        if (!div) div = await promptTeamDivision();
        if (!div) { sel.value = "screening"; return; }
        const ok = await updateCandidateStatus(cat, talentId, normalized, actorName);
        if (!ok) { await loadCandidates(cat); alert("Gagal update status."); return; }
        try { await syncAcceptedCandidateToTeamManagement({ db, candidateCollection: cfg.collectionName, candidateId: talentId, division: div, source: "candidate-"+cat }); } catch(err) { console.error("Sync failed", err); }
        updateCandidateStatusUI(cat, talentId, normalized);
      } else if (cfg.hasMentorSync && normalized === "accepted") {
        const ok = await updateCandidateStatus(cat, talentId, normalized, actorName);
        if (!ok) { await loadCandidates(cat); alert("Gagal update status."); return; }
        try { await syncAcceptedMentorFromScreening(talentId); } catch(err) { console.error("Mentor sync failed", err); }
        updateCandidateStatusUI(cat, talentId, normalized);
      } else if (normalized === "canceled") {
        const result = await Swal.fire({
          icon: "warning",
          title: "Canceled / Mengundurkan Diri",
          text: "Tandai kandidat ini sebagai Canceled / Mengundurkan Diri?",
          input: "textarea",
          inputLabel: "Catatan / alasan pengunduran diri (opsional)",
          inputPlaceholder: "Tuliskan alasan atau catatan...",
          showCancelButton: true,
          confirmButtonText: "Ya, batalkan",
          cancelButtonText: "Batal",
          reverseButtons: true,
          confirmButtonColor: "#b45309"
        });
        if (!result.isConfirmed) { sel.value = "screening"; return; }
        const notes = (result.value || "").toString().trim();
        const ok = await cancelCandidateStatus(cat, talentId, notes, actorName);
        if (!ok) { await loadCandidates(cat); alert("Gagal update status."); return; }
        try { await deleteSyncedCandidateData(cat, talentId); } catch(err) { console.error("Sync cleanup failed", err); }
        updateCandidateStatusUI(cat, talentId, "canceled");
      } else {
        const ok = await updateCandidateStatus(cat, talentId, normalized, actorName);
        if (!ok) { await loadCandidates(cat); alert("Gagal update status."); return; }
        updateCandidateStatusUI(cat, talentId, normalized);
      }
    }
  });
}

// ===== AUTH GUARD =====
onAuthStateChanged(auth, (user) => {
  if (!user) { window.location.href = "../index.html"; return; }
  bindEvents();
  // Initialize tooltips for icon buttons
  if (window.refreshTooltips) window.refreshTooltips();
  loadCandidates("team");
  subscribeRealtimeUpdates("team");
});

// ===== CLEANUP =====
window.addEventListener("beforeunload", () => {
  Object.keys(tabState).forEach(cat => {
    if (tabState[cat].unsubCandidates) tabState[cat].unsubCandidates();
    if (tabState[cat].unsubUsers) tabState[cat].unsubUsers();
  });
});
