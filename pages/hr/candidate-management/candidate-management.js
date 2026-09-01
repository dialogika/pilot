import { requireAuth } from "../../../assets/js/auth-guard.js";
import { renderTopbar } from "../../../assets/js/components/topbar/topbar.js";
import { renderSidebar } from "../../../assets/js/components/sidebar/sidebar.js";
import { renderRightbarRecruit } from "../../../element/rightbar-recruit.js";

import * as CandidateRepo from "./candidate-management.repository.js";
import * as CandidateUI from "./candidate-management.ui.js";
import { promptTeamDivision } from "../../../element/team-management-sync.js";
import { getCategoryTemplateDefs, getStoredTemplates } from "../../../element/template-manager.js";

// ===== TAB CONFIGURATIONS =====
export const TAB_CONFIG = {
  team: {
    collectionName: "teams_screening",
    fallbackCollection: "team_screening",
    trashCollection: "teams_screening_trash",
    detailPage: "/team-candidate-detail",
    label: "Team",
    roleId: "team",
    roleName: "team",
    deletedSourcePage: "candidate-team",
    deletedSourceLabel: "Kandidat Team",
    statusPipeline: [
      { value: "screening", label: "Screening", badgeClass: "status-screening", caption: "Seleksi awal" },
      { value: "interview", label: "Interview", badgeClass: "status-interview", caption: "Proses wawancara" },
      { value: "accepted", label: "Accepted", badgeClass: "status-accepted", caption: "Lolos seleksi" },
      { value: "onboarding", label: "On Boarding", badgeClass: "status-onboarding", caption: "Siap bergabung" },
      { value: "rejected", label: "Rejected", badgeClass: "status-rejected", caption: "Tidak diterima" },
      { value: "canceled", label: "Canceled", badgeClass: "status-canceled", caption: "Dibatalkan" }
    ],
    roleFilter(data) {
      const scouting = data.scouting_info || {};
      const internship = data.internship || data.internship_info || {};
      const rid = (data.role_id || data.roleId || scouting.role_id || internship.role_id || "").toString().toLowerCase().replace(/\s/g, "");
      const rn = (data.role_name || data.role || scouting.role_name || "").toString().toLowerCase().replace(/\s/g, "");
      const isIntern = rid === "internship" || rn === "internship";
      const isMentor = rid === "mentor" || rn === "mentor";
      return !isIntern && !isMentor;
    },
    normalizeStatus(raw) {
      if (raw === "interview") return "interview";
      if (["accept", "accepted", "decision"].includes(raw)) return "accepted";
      if (raw === "onboarding") return "onboarding";
      if (["rejected", "reject"].includes(raw)) return "rejected";
      if (["canceled", "withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(raw)) return "canceled";
      return "screening";
    },
    resolveDisplayStatus(recruitment) {
      const s = recruitment || {};
      const cur = TAB_CONFIG.team.normalizeStatus((s.current || "screening").toString().trim().toLowerCase());
      const fd = (s.final_decision || s.finalDecision || "").toString().trim().toLowerCase();
      if (["rejected", "reject"].includes(fd)) return "rejected";
      if (["canceled", "withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(fd)) return "canceled";
      if (["accepted", "accept"].includes(fd) && cur !== "onboarding") return "accepted";
      return cur;
    },
    hasOjtSection: true,
    hasTeamSync: true,
    positionField: (data, scouting, internship) => data.role_name || internship.role_name || scouting.role_name || "",
    interviewScheduleField: (recruitment, data) => recruitment.interview_schedule || recruitment.due_date || data.interview_schedule || ""
  },
  mentor: {
    collectionName: "mentors_screening",
    fallbackCollection: "mentor_screening",
    trashCollection: "mentors_screening_trash",
    detailPage: "/mentor-candidate-detail",
    label: "Mentor",
    roleId: "mentor",
    roleName: "mentor",
    deletedSourcePage: "candidate-mentor",
    deletedSourceLabel: "Kandidat Mentor",
    statusPipeline: [
      { value: "screening", label: "Screening", badgeClass: "status-screening", caption: "Seleksi awal" },
      { value: "interview", label: "Interview", badgeClass: "status-interview", caption: "Proses wawancara" },
      { value: "micro_teaching", label: "MT", badgeClass: "status-micro-teaching", caption: "Simulasi mengajar" },
      { value: "accepted", label: "Accepted", badgeClass: "status-accepted", caption: "Lolos seleksi" },
      { value: "rejected", label: "Rejected", badgeClass: "status-rejected", caption: "Tidak diterima" },
      { value: "canceled", label: "Canceled", badgeClass: "status-canceled", caption: "Dibatalkan" }
    ],
    roleFilter(data) {
      const scouting = data.scouting_info || {};
      const internship = data.internship || data.internship_info || {};
      const rid = (data.role_id || data.roleId || scouting.role_id || internship.role_id || "").toString().toLowerCase().replace(/\s/g, "");
      const rn = (data.role_name || data.role || scouting.role_name || "").toString().toLowerCase().replace(/\s/g, "");
      const isIntern = rid === "internship" || rn === "internship";
      const isTeam = rid === "team" || rn === "team";
      return !isIntern && !isTeam;
    },
    normalizeStatus(raw) {
      if (raw === "interview") return "interview";
      if (["accept", "accepted", "decision"].includes(raw)) return "accepted";
      if (raw === "micro_teaching") return "micro_teaching";
      if (["rejected", "reject"].includes(raw)) return "rejected";
      if (["canceled", "withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(raw)) return "canceled";
      return "screening";
    },
    resolveDisplayStatus(recruitment) {
      const s = recruitment || {};
      const cur = TAB_CONFIG.mentor.normalizeStatus((s.current || "screening").toString().trim().toLowerCase());
      const fd = (s.final_decision || s.finalDecision || "").toString().trim().toLowerCase();
      if (["rejected", "reject"].includes(fd)) return "rejected";
      if (["canceled", "withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(fd)) return "canceled";
      if (["accepted", "accept"].includes(fd) && cur !== "micro_teaching") return "accepted";
      return cur;
    },
    hasOjtSection: false,
    hasTeamSync: false,
    hasMentorSync: true,
    positionField: (data, scouting, internship) => scouting.position_name || internship.position || "",
    interviewScheduleField: (recruitment) => {
      const dueDateRaw = recruitment.interview_schedule || recruitment.due_date || null;
      return CandidateUI.formatScheduleSortValue(dueDateRaw);
    }
  },
  internship: {
    collectionName: "interns_screening",
    fallbackCollection: "intern_screening",
    trashCollection: "interns_screening_trash",
    detailPage: "/internship-candidate-detail",
    label: "Internship",
    roleId: "internship",
    roleName: "internship",
    deletedSourcePage: "candidate-internship",
    deletedSourceLabel: "Kandidat Internship",
    statusPipeline: [
      { value: "screening", label: "Screening", badgeClass: "status-screening", caption: "Seleksi awal" },
      { value: "interview", label: "Interview", badgeClass: "status-interview", caption: "Proses wawancara" },
      { value: "accepted", label: "Accepted", badgeClass: "status-accepted", caption: "Lolos seleksi" },
      { value: "onboarding", label: "Onboarding", badgeClass: "status-onboarding", caption: "Siap bergabung" },
      { value: "rejected", label: "Rejected", badgeClass: "status-rejected", caption: "Tidak diterima" },
      { value: "canceled", label: "Canceled", badgeClass: "status-canceled", caption: "Dibatalkan" }
    ],
    roleFilter(data) {
      const scouting = data.scouting_info || {};
      const rid = (data.role_id || data.roleId || scouting.role_id || "").toString().toLowerCase().replace(/\s/g, "");
      const rn = (data.role_name || data.role || scouting.role_name || "").toString().toLowerCase().replace(/\s/g, "");
      const isMentor = rid === "mentor" || rn === "mentor";
      const isTeam = rid === "team" || rn === "team";
      return !isMentor && !isTeam;
    },
    normalizeStatus(raw) {
      if (raw === "interview") return "interview";
      if (["accept", "accepted", "decision"].includes(raw)) return "accepted";
      if (raw === "onboarding") return "onboarding";
      if (["rejected", "reject"].includes(raw)) return "rejected";
      if (["canceled", "withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(raw)) return "canceled";
      return "screening";
    },
    resolveDisplayStatus(recruitment) {
      const s = recruitment || {};
      const cur = TAB_CONFIG.internship.normalizeStatus((s.current || "screening").toString().trim().toLowerCase());
      const fd = (s.final_decision || s.finalDecision || "").toString().trim().toLowerCase();
      if (["rejected", "reject"].includes(fd)) return "rejected";
      if (["canceled", "withdrawn", "mengundurkan_diri", "mengundurkan diri"].includes(fd)) return "canceled";
      if (["accepted", "accept"].includes(fd) && cur !== "onboarding") return "accepted";
      return cur;
    },
    hasOjtSection: false,
    hasTeamSync: false,
    positionField: (data, scouting, internship) => {
      const raw = (internship.position_name || internship.position || scouting.position_name || scouting.position || data.position_name || data.position || "").toString().trim();
      if (raw && raw.toLowerCase() !== "internship") return raw;
      return "";
    },
    interviewScheduleField: (recruitment) => {
      const dueDateRaw = recruitment.interview_schedule || recruitment.due_date || null;
      return CandidateUI.formatScheduleSortValue(dueDateRaw);
    }
  }
};

// ===== STATE MANAGEMENT =====
const tabState = {};
function getTabState(cat) {
  if (!tabState[cat]) {
    tabState[cat] = {
      loaded: false,
      unsubCandidates: null,
      unsubUsers: null,
      renderToken: 0,
      usersMap: {},
      interviewSchedule: { entries: [], loading: false, page: 1, pageSize: 10, selectedRowKey: "" },
      currentEditingTalentId: null,
      viewMode: "grid"
    };
  }
  return tabState[cat];
}

let activeTab = "team";
let positionsData = [];
let positionsLoaded = false;
let positionModalInstance = null;
let interviewModalInstance = null;
let templateModalInstance = null;
let activeTemplateCategory = "team";

// ===== UPDATE PIPELINE SUMMARY =====
function updatePipelineSummary(cat) {
  const cfg = TAB_CONFIG[cat];
  if (!cfg) return;
  const counts = {};
  cfg.statusPipeline.forEach((s) => (counts[s.value] = 0));

  const grid = document.querySelector(`.tab-grid[data-tab="${cat}"]`);
  if (grid) {
    grid.querySelectorAll(".candidate-item").forEach((item) => {
      if (item.style.display === "none") return;
      const n = cfg.normalizeStatus(item.dataset.status || "");
      counts[n] = (counts[n] || 0) + 1;
    });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  CandidateUI.renderPipelineSummary(cat, cfg, counts, total);
}

// ===== VIEW MODE TOGGLE =====
function setViewMode(cat, mode) {
  const state = getTabState(cat);
  state.viewMode = mode;
  const grid = document.querySelector(`.tab-grid[data-tab="${cat}"]`);
  const list = document.querySelector(`.tab-list-wrap[data-tab="${cat}"]`);
  const toggleBtn = document.querySelector(`.tab-view-toggle[data-tab="${cat}"]`);
  const gridBtn = document.querySelector(`.tab-grid-btn[data-tab="${cat}"]`);
  const listBtn = document.querySelector(`.tab-list-btn[data-tab="${cat}"]`);
  const isGrid = mode === "grid";

  if (grid) grid.style.display = isGrid ? "grid" : "none";
  if (list) list.style.display = isGrid ? "none" : "block";
  if (toggleBtn) {
    toggleBtn.classList.toggle("is-list", !isGrid);
    const icon = toggleBtn.querySelector(".view-mode-slider-thumb i");
    if (icon) {
      icon.className = isGrid ? "fa-solid fa-table-cells-large" : "fa-solid fa-list";
    }
  }
  if (gridBtn) gridBtn.classList.toggle("active", isGrid);
  if (listBtn) listBtn.classList.toggle("active", !isGrid);
}

// ===== FILTER / SORT =====
function applyFilters(cat) {
  const searchEl = document.querySelector(`.tab-search-input[data-tab="${cat}"]`);
  const statusEl = document.querySelector(`.tab-status-filter[data-tab="${cat}"]`);
  const sortEl = document.querySelector(`.tab-sort-select[data-tab="${cat}"]`);

  const term = (searchEl ? searchEl.value : "").toLowerCase();
  const statusVal = (statusEl ? statusEl.value : "").toLowerCase();
  const sortVal = sortEl ? sortEl.value : "none";

  const grid = document.querySelector(`.tab-grid[data-tab="${cat}"]`);
  const listWrap = document.querySelector(`.tab-list-wrap[data-tab="${cat}"]`);
  if (!grid) return;

  const gridItems = grid.querySelectorAll(".candidate-item");
  const listRows = listWrap ? listWrap.querySelectorAll(".candidate-row") : [];

  gridItems.forEach((item) => {
    const t = item.innerText.toLowerCase();
    const s = (item.dataset.status || "").toLowerCase();
    item.style.display = t.includes(term) && (!statusVal || s === statusVal) ? "" : "none";
  });

  listRows.forEach((row) => {
    const t = row.innerText.toLowerCase();
    const s = (row.dataset.status || "").toLowerCase();
    row.style.display = t.includes(term) && (!statusVal || s === statusVal) ? "" : "none";
  });

  if (sortVal === "none") {
    updatePipelineSummary(cat);
    return;
  }

  const compare = (a, b) => {
    const nA = (a.dataset.name || "").toLowerCase(),
      nB = (b.dataset.name || "").toLowerCase();
    const sA = (a.dataset.status || "").toLowerCase(),
      sB = (b.dataset.status || "").toLowerCase();
    const cA = Number(a.dataset.created || "0"),
      cB = Number(b.dataset.created || "0");
    const dA = a.dataset.dueDate || "",
      dB = b.dataset.dueDate || "";

    if (sortVal === "status") return sA.localeCompare(sB, "id");
    if (sortVal === "created_desc") return cB - cA;
    if (sortVal === "created_asc") return cA - cB;
    if (sortVal === "interview_asc") return (dA || "9999-12-31").localeCompare(dB || "9999-12-31", "id");
    if (sortVal === "interview_desc") return (dB || "0000-01-01").localeCompare(dA || "0000-01-01", "id");
    if (sortVal === "name_asc") return nA.localeCompare(nB, "id");
    if (sortVal === "name_desc") return nB.localeCompare(nA, "id");
    return 0;
  };

  const visGrid = Array.from(gridItems).filter((i) => i.style.display !== "none");
  visGrid.sort(compare).forEach((i) => grid.appendChild(i));

  if (listWrap) {
    const tbody = listWrap.querySelector("tbody");
    const visList = Array.from(listRows).filter((r) => r.style.display !== "none");
    visList.sort(compare).forEach((r) => tbody.appendChild(r));
  }

  updatePipelineSummary(cat);
}

// ===== CANDIDATE DATA LOADING =====
async function ensureUsersLoaded(cat) {
  const state = getTabState(cat);
  if (Object.keys(state.usersMap).length > 0) return state.usersMap;
  state.usersMap = await CandidateRepo.fetchUsersMap();
  return state.usersMap;
}

async function loadCandidates(cat, snapshotOverride) {
  const cfg = TAB_CONFIG[cat];
  const state = getTabState(cat);
  const renderToken = ++state.renderToken;

  const grid = document.querySelector(`.tab-grid[data-tab="${cat}"]`);
  const listTbody = document.querySelector(`.tab-list-wrap[data-tab="${cat}"] tbody`);
  if (!grid || !listTbody) return;

  grid.innerHTML = "";
  listTbody.innerHTML = "";
  state.interviewSchedule.loading = true;

  try {
    const intEntries = [];
    await ensureUsersLoaded(cat);
    if (renderToken !== state.renderToken) return;

    let snap = snapshotOverride;
    if (!snap) {
      const res = await CandidateRepo.fetchCandidates(cfg.collectionName, cfg.fallbackCollection);
      snap = res.snap;
    }
    if (renderToken !== state.renderToken) return;

    if (snap.empty) {
      state.interviewSchedule.entries = [];
      state.interviewSchedule.page = 1;
      state.interviewSchedule.loading = false;
      grid.innerHTML = `<div class="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 py-10 text-center text-slate-400 text-sm">Belum ada data kandidat ${cfg.label} yang dapat ditampilkan.</div>`;
      listTbody.innerHTML = `<tr><td class="text-center text-muted small py-4">Belum ada data kandidat ${cfg.label} yang dapat ditampilkan.</td></tr>`;
      updatePipelineSummary(cat);
      return;
    }

    let found = 0;
    let gridHtmlBuffer = "";
    let listHtmlBuffer = "";

    snap.forEach((ds) => {
      if (renderToken !== state.renderToken) return;
      const data = ds.data() || {};
      if (CandidateUI.isInactiveCandidateRecord(data)) return;
      if (!cfg.roleFilter(data)) return;

      const basic = data.basic_info || {};
      const scouting = data.scouting_info || {};
      const contact = data.contact_info || {};
      const education = data.education || {};
      const internship = data.internship || data.internship_info || {};

      const name = basic.full_name || scouting.full_name || data.full_name || "Tanpa Nama";
      const positionName = cfg.positionField(data, scouting, internship);
      const avatarUrl = basic.avatar_url || null;
      const createdRaw = data.created_at || data.createdAt || data.created || null;
      const createdSortValue = CandidateUI.getCreatedTimestamp(createdRaw);
      const recruitment = data.recruitment_status || data.recruitment_system || {};
      const currentStatus = cfg.resolveDisplayStatus(recruitment);
      const dueDateRaw = recruitment.due_date || null;
      const dueDateInputValue = CandidateUI.formatDueDateForInput(dueDateRaw);
      const address = contact.address || internship.address || "";
      const email = contact.email || basic.email || internship.email || "";
      const campus = internship.campus || education.campus || education.university || "";
      const mode = internship.mode || "";
      const interviewers = Array.isArray(data.interviewers) ? data.interviewers.filter(Boolean) : [];
      const intScheduleRaw = cfg.interviewScheduleField(recruitment, data);

      const intEntry =
        currentStatus === "interview"
          ? CandidateUI.buildInterviewScheduleEntry(
              {
                candidateId: ds.id,
                candidateName: name,
                positionName,
                interviewerIds: interviewers,
                scheduleRaw: intScheduleRaw
              },
              state.usersMap
            )
          : null;
      if (intEntry) intEntries.push(intEntry);

      const finalDecisionAt = recruitment.final_decision_at || null;
      const rejectionReason = recruitment.rejection_reason || "";
      const rejectionNotes = recruitment.rejection_notes || "";
      const withdrawnNotes = recruitment.withdrawn_notes || "";
      const ojtStart = recruitment.on_job_training_start_date || null;
      const ojtEnd = recruitment.on_job_training_end_date || null;
      const isTeamMember = !!(
        data.isTeamMember ||
        data.is_team_member ||
        data.teamManagementId ||
        recruitment.is_team_member ||
        recruitment.team_management_id
      );
      const onboardingDate = recruitment.onboarding_date || null;
      const onboardingTime = recruitment.onboarding_time || "";
      const onboardingLocation = recruitment.onboarding_location || "";

      const itemPayload = {
        name,
        positionName,
        avatarUrl,
        mode,
        address,
        email,
        campus,
        talentId: ds.id,
        status: currentStatus,
        dueDateInputValue,
        interviewScheduleRaw: intScheduleRaw,
        interviewerIds: interviewers,
        createdSortValue,
        finalDecisionAt,
        rejectionReason,
        rejectionNotes,
        withdrawnNotes,
        onJobTrainingStartDate: ojtStart,
        onJobTrainingEndDate: ojtEnd,
        isTeamMember,
        onboardingDate,
        onboardingTime,
        onboardingLocation
      };

      gridHtmlBuffer += CandidateUI.buildCandidateCardHtml(cat, cfg, itemPayload, state.usersMap);
      listHtmlBuffer += CandidateUI.buildCandidateRowHtml(cat, cfg, itemPayload, state.usersMap);
      found += 1;
    });

    if (!found) {
      grid.innerHTML = `<div class="col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 py-10 text-center text-slate-400 text-sm">Belum ada data kandidat ${cfg.label} yang dapat ditampilkan.</div>`;
      listTbody.innerHTML = `<tr><td class="text-center text-muted small py-4">Belum ada data kandidat ${cfg.label} yang dapat ditampilkan.</td></tr>`;
    } else {
      grid.innerHTML = gridHtmlBuffer;
      listTbody.innerHTML = listHtmlBuffer;
    }

    state.interviewSchedule.entries = intEntries;
    state.interviewSchedule.loading = false;
    state.loaded = true;
    CandidateUI.refreshTooltips();
    updatePipelineSummary(cat);
    applyFilters(cat);
  } catch (e) {
    console.error(`[Candidate] Failed to load candidates for ${cat}:`, e);
    state.interviewSchedule.loading = false;
  }
}

function subscribeRealtimeUpdates(cat) {
  const cfg = TAB_CONFIG[cat];
  const state = getTabState(cat);
  if (state.unsubCandidates) state.unsubCandidates();
  state.unsubCandidates = CandidateRepo.subscribeCandidates(
    cfg.collectionName,
    cfg.fallbackCollection,
    (snap) => {
      loadCandidates(cat, snap);
      refreshAllTabCounts();
    }
  );

  if (state.unsubUsers) state.unsubUsers();
  state.unsubUsers = CandidateRepo.subscribeUsers((usersMap) => {
    state.usersMap = usersMap;
  });
}

/**
 * Refreshes candidate count for all tabs.
 */
async function refreshAllTabCounts() {
  for (const cat of ["team", "mentor", "internship"]) {
    const cfg = TAB_CONFIG[cat];
    try {
      const { snap } = await CandidateRepo.fetchCandidates(cfg.collectionName, cfg.fallbackCollection);
      let count = 0;
      snap.forEach((ds) => {
        const data = ds.data() || {};
        if (CandidateUI.isInactiveCandidateRecord(data)) return;
        if (!cfg.roleFilter(data)) return;
        count++;
      });
      const countEl = document.getElementById(`tabCount${cat.charAt(0).toUpperCase() + cat.slice(1)}`);
      if (countEl) countEl.textContent = count;
    } catch (e) {
      console.warn(`[Candidate] Failed to refresh tab count for ${cat}:`, e);
    }
  }
}

function updateCandidateStatusUI(cat, talentId, status) {
  const cfg = TAB_CONFIG[cat];
  const n = cfg.normalizeStatus(status);
  const statusMeta = cfg.statusPipeline.find((i) => i.value === n) || cfg.statusPipeline[0];
  const lbl = statusMeta.label;
  const bcls = "status-badge-modern " + statusMeta.badgeClass;

  document.querySelectorAll(`[data-category="${cat}"][data-talent-id="${talentId}"]`).forEach((c) => {
    c.dataset.status = n;
    c.querySelectorAll(".status-badge-modern").forEach((b) => {
      b.className = bcls;
      b.textContent = lbl;
    });
  });
  updatePipelineSummary(cat);
  applyFilters(cat);
}

function removeCandidateFromUI(cat, talentId) {
  document.querySelectorAll(`[data-category="${cat}"][data-talent-id="${talentId}"]`).forEach((el) => el.remove());
  updatePipelineSummary(cat);
  applyFilters(cat);
}

// ===== TAB SWITCHING =====
function switchTab(cat) {
  activeTab = cat;
  document.querySelectorAll(".candidate-tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === cat));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + cat));

  if (cat === "positions") {
    if (!positionsLoaded) {
      loadRecruitmentPositions();
      positionsLoaded = true;
    }
    return;
  }

  const state = getTabState(cat);
  if (!state.loaded) {
    loadCandidates(cat);
    subscribeRealtimeUpdates(cat);
  }
}

// ===== POSITIONS MANAGEMENT =====
function getPositionCategoryFilter() {
  const activeBtn = document.querySelector("#positionCategorySubtabs .position-subtab-btn.active");
  return activeBtn ? activeBtn.dataset.category || "internship" : "internship";
}

async function loadRecruitmentPositions() {
  const grid = document.getElementById("positionsCardGrid");
  if (grid) grid.innerHTML = '<div class="text-center py-4 text-muted" style="grid-column:1/-1">Memuat data...</div>';
  try {
    positionsData = await CandidateRepo.fetchPositions();
    CandidateUI.renderPositionsCards(positionsData, getPositionCategoryFilter());
  } catch (e) {
    console.error("[Positions] Failed to load:", e);
    if (grid) grid.innerHTML = '<div class="text-center py-4 text-danger" style="grid-column:1/-1">Gagal memuat data.</div>';
  }
}

function openPositionModal(docId = "") {
  const form = document.getElementById("positionForm");
  if (form) form.reset();
  document.getElementById("positionDocId").value = docId || "";
  const title = document.getElementById("positionFormModalLabel");
  document.getElementById("positionActiveInput").value = "true";

  if (docId) {
    const pos = positionsData.find((p) => p.id === docId);
    if (title) title.innerHTML = '<i class="fa-solid fa-sliders"></i> Edit Posisi';
    if (pos) {
      document.getElementById("positionNameInput").value = pos.name || "";
      document.getElementById("positionCategoryInput").value = pos.category || "";
      document.getElementById("positionActiveInput").value = pos.active ? "true" : "false";
    }
  } else {
    if (title) title.innerHTML = '<i class="fa-solid fa-sliders"></i> Tambah Posisi';
  }
  if (positionModalInstance) positionModalInstance.show();
}

async function savePosition() {
  const docId = (document.getElementById("positionDocId")?.value || "").trim();
  const name = (document.getElementById("positionNameInput")?.value || "").trim();
  const category = document.getElementById("positionCategoryInput")?.value || "";
  const active = document.getElementById("positionActiveInput")?.value === "true";

  if (!name) {
    alert("Nama posisi tidak boleh kosong.");
    return;
  }
  if (!category) {
    alert("Pilih kategori posisi.");
    return;
  }

  const payload = { name, category, active };
  try {
    if (docId) {
      await CandidateRepo.updatePosition(docId, payload);
    } else {
      await CandidateRepo.addPosition(payload);
    }
    if (positionModalInstance) positionModalInstance.hide();
    await loadRecruitmentPositions();
  } catch (e) {
    console.error("[Positions] Save failed:", e);
    alert("Gagal menyimpan posisi.");
  }
}

async function handleTogglePositionActive(docId) {
  const pos = positionsData.find((p) => p.id === docId);
  if (!pos) return;
  try {
    await CandidateRepo.togglePositionActive(docId, pos.active);
    await loadRecruitmentPositions();
  } catch (e) {
    console.error("[Positions] Toggle failed:", e);
    alert("Gagal mengubah status posisi.");
  }
}

async function handleDeletePosition(docId) {
  const pos = positionsData.find((p) => p.id === docId);
  const name = pos ? pos.name : docId;
  if (!confirm(`Hapus posisi "${name}"?\nData yang sudah dihapus tidak dapat dikembalikan.`)) return;
  try {
    await CandidateRepo.deletePosition(docId);
    await loadRecruitmentPositions();
  } catch (e) {
    console.error("[Positions] Delete failed:", e);
    alert("Gagal menghapus posisi.");
  }
}

// ===== CANDIDATE ACTIONS =====
async function handleCancelCandidate(cat, talentId) {
  const cfg = TAB_CONFIG[cat];
  const user = window.auth?.currentUser;
  const actorName = user?.displayName || user?.email || "";

  if (window.Swal) {
    const result = await window.Swal.fire({
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
    const ok = await CandidateRepo.cancelCandidateStatus(cfg.collectionName, talentId, notes, actorName);
    if (!ok) {
      alert("Gagal mengupdate status kandidat.");
      return;
    }
    await CandidateRepo.deleteSyncedCandidateData(cfg, talentId);
    updateCandidateStatusUI(cat, talentId, "canceled");
  } else {
    if (!confirm("Tandai kandidat ini sebagai Canceled / Mengundurkan Diri?")) return;
    const ok = await CandidateRepo.cancelCandidateStatus(cfg.collectionName, talentId, "", actorName);
    if (!ok) {
      alert("Gagal mengupdate status kandidat.");
      return;
    }
    await CandidateRepo.deleteSyncedCandidateData(cfg, talentId);
    updateCandidateStatusUI(cat, talentId, "canceled");
  }
}

async function handleMoveToTrash(cat, talentId, payload) {
  const cfg = TAB_CONFIG[cat];
  if (!confirm("Pindahkan kandidat ke sampah?")) return;
  try {
    await CandidateRepo.moveCandidateToTrash(cfg, talentId, payload);
    removeCandidateFromUI(cat, talentId);
  } catch (err) {
    console.error("[Candidate] Move to trash failed:", err);
    alert("Gagal memindahkan kandidat ke sampah.");
  }
}

// ===== EVENT BINDING =====
function bindEvents() {
  // Tab buttons
  document.querySelectorAll(".candidate-tab-btn").forEach((btn) =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );

  // View toggles
  document.querySelectorAll(".tab-view-toggle").forEach((btn) =>
    btn.addEventListener("click", () => {
      const s = getTabState(btn.dataset.tab);
      setViewMode(btn.dataset.tab, s.viewMode === "grid" ? "list" : "grid");
    })
  );
  document.querySelectorAll(".tab-grid-btn").forEach((btn) =>
    btn.addEventListener("click", () => setViewMode(btn.dataset.tab, "grid"))
  );
  document.querySelectorAll(".tab-list-btn").forEach((btn) =>
    btn.addEventListener("click", () => setViewMode(btn.dataset.tab, "list"))
  );

  // Search / filter / sort
  document.querySelectorAll(".tab-search-input").forEach((el) =>
    el.addEventListener("input", () => applyFilters(el.dataset.tab))
  );
  document.querySelectorAll(".tab-status-filter").forEach((el) =>
    el.addEventListener("change", () => applyFilters(el.dataset.tab))
  );
  document.querySelectorAll(".tab-sort-select").forEach((el) =>
    el.addEventListener("change", () => applyFilters(el.dataset.tab))
  );

  // Interview schedule modal
  const intModalEl = document.getElementById("interviewScheduleModal");
  if (intModalEl && window.bootstrap) interviewModalInstance = new window.bootstrap.Modal(intModalEl);

  document.querySelectorAll(".tab-interview-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      const state = getTabState(activeTab);
      state.interviewSchedule.page = 1;
      ["interviewScheduleSearch", "interviewScheduleDateFilter", "interviewScheduleStatusFilter"].forEach((id) => {
        const e = document.getElementById(id);
        if (e) e.value = "";
      });
      const sortEl = document.getElementById("interviewScheduleSort");
      if (sortEl) sortEl.value = "nearest";
      CandidateUI.renderInterviewScheduleTable(state.interviewSchedule.entries, state.interviewSchedule, TAB_CONFIG[activeTab]);
      if (interviewModalInstance) interviewModalInstance.show();
    })
  );

  ["interviewScheduleSearch"].forEach((id) => {
    const e = document.getElementById(id);
    if (e) {
      e.addEventListener("input", () => {
        const state = getTabState(activeTab);
        state.interviewSchedule.page = 1;
        CandidateUI.renderInterviewScheduleTable(state.interviewSchedule.entries, state.interviewSchedule, TAB_CONFIG[activeTab]);
      });
    }
  });

  ["interviewScheduleDateFilter", "interviewScheduleStatusFilter", "interviewScheduleSort"].forEach((id) => {
    const e = document.getElementById(id);
    if (e) {
      e.addEventListener("change", () => {
        const state = getTabState(activeTab);
        state.interviewSchedule.page = 1;
        CandidateUI.renderInterviewScheduleTable(state.interviewSchedule.entries, state.interviewSchedule, TAB_CONFIG[activeTab]);
      });
    }
  });

  document.getElementById("interviewSchedulePrevBtn")?.addEventListener("click", () => {
    const s = getTabState(activeTab);
    s.interviewSchedule.page = Math.max(1, s.interviewSchedule.page - 1);
    CandidateUI.renderInterviewScheduleTable(s.interviewSchedule.entries, s.interviewSchedule, TAB_CONFIG[activeTab]);
  });

  document.getElementById("interviewScheduleNextBtn")?.addEventListener("click", () => {
    const s = getTabState(activeTab);
    s.interviewSchedule.page += 1;
    CandidateUI.renderInterviewScheduleTable(s.interviewSchedule.entries, s.interviewSchedule, TAB_CONFIG[activeTab]);
  });

  // Schedule row click navigation
  document.getElementById("interviewScheduleTableBody")?.addEventListener("click", (ev) => {
    const row = ev.target.closest("tr.schedule-clickable-row");
    if (!row) return;
    const cid = row.dataset?.candidateId || "";
    const dl = row.dataset?.detailLink || "";
    const rk = row.dataset?.rowKey || "";
    const state = getTabState(activeTab);
    if (rk) state.interviewSchedule.selectedRowKey = rk;
    CandidateUI.renderInterviewScheduleTable(state.interviewSchedule.entries, state.interviewSchedule, TAB_CONFIG[activeTab]);
    const cfg = TAB_CONFIG[activeTab];
    const detailUrl = cfg.detailPage + "?talentId=" + encodeURIComponent(cid);
    setTimeout(() => {
      if (cid) window.location.href = detailUrl;
      else if (dl) window.location.href = dl;
    }, 160);
  });

  // WhatsApp Template modal
  const tplModalEl = document.getElementById("templateBaseModal");
  if (tplModalEl && window.bootstrap) templateModalInstance = new window.bootstrap.Modal(tplModalEl);

  document.querySelectorAll(".tab-template-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cat = btn.dataset.tab || activeTab;
      activeTemplateCategory = cat;
      const defs = getCategoryTemplateDefs(activeTemplateCategory);
      const values = getStoredTemplates(activeTemplateCategory);
      CandidateUI.renderTemplateEditor(activeTemplateCategory, defs, values);
      CandidateUI.setTemplateValidation("", "");
      if (templateModalInstance) templateModalInstance.show();
    })
  );

  document.getElementById("saveTemplateBaseBtn")?.addEventListener("click", () => {
    const cat = activeTemplateCategory;
    const defs = getCategoryTemplateDefs(cat);
    const values = {};
    defs.forEach((d) => {
      const f = document.querySelector(`[data-template-input="${d.id}"]`);
      values[d.id] = f ? (f.value || "").trim() : "";
    });

    for (const d of defs) {
      if (!values[d.id]) {
        CandidateUI.setTemplateValidation(`Template "${d.title}" tidak boleh kosong.`, "danger");
        return;
      }
      for (const t of d.requiredTokens) {
        if (!values[d.id].includes(t)) {
          CandidateUI.setTemplateValidation(`Template "${d.title}" harus memuat ${t}.`, "danger");
          return;
        }
      }
    }

    try {
      CandidateRepo.saveCategoryTemplates(values, cat);
      window.dispatchEvent(
        new CustomEvent("dialogika:chat-templates-updated", {
          detail: { category: cat, updatedAt: Date.now() }
        })
      );
    } catch (e) {
      CandidateUI.setTemplateValidation("Gagal menyimpan.", "danger");
      return;
    }
    CandidateUI.setTemplateValidation("Berhasil disimpan.", "success");
    setTimeout(() => {
      if (templateModalInstance) templateModalInstance.hide();
    }, 500);
  });

  // Positions tab controls
  const posModalEl = document.getElementById("positionFormModal");
  if (posModalEl && window.bootstrap) positionModalInstance = new window.bootstrap.Modal(posModalEl);

  document.getElementById("btnAddPosition")?.addEventListener("click", () => openPositionModal(""));
  document.getElementById("btnSavePosition")?.addEventListener("click", savePosition);

  document.querySelectorAll("#positionCategorySubtabs .position-subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#positionCategorySubtabs .position-subtab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      CandidateUI.renderPositionsCards(positionsData, getPositionCategoryFilter());
    });
  });

  const positionActionHandler = async (ev) => {
    const btn = ev.target.closest(".position-action-btn");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!id) return;
    if (action === "toggle") await handleTogglePositionActive(id);
    else if (action === "edit") openPositionModal(id);
    else if (action === "delete") await handleDeletePosition(id);
  };
  document.getElementById("positionsCardGrid")?.addEventListener("click", positionActionHandler);
  document.getElementById("inactivePositionsGrid")?.addEventListener("click", positionActionHandler);

  // Delegated clicks on candidates
  document.addEventListener("click", async (e) => {
    const deleteBtn = e.target.closest(".candidate-delete-btn");
    const cancelBtn = e.target.closest(".candidate-cancel-btn");
    const detailCard = e.target.closest(".candidate-item, .candidate-list-card");

    if (deleteBtn) {
      e.stopPropagation();
      const cat = deleteBtn.dataset.category;
      const row = deleteBtn.closest("tr");
      const card = deleteBtn.closest(".candidate-item");
      const el = row || card;
      const talentId = el?.dataset?.talentId;
      if (!talentId) return;

      const payload = {
        name: el.dataset.name || "Tanpa Nama",
        position: el.dataset.position || "-",
        email: el.dataset.email || "-",
        campus: el.dataset.campus || "-",
        avatarUrl: el.dataset.avatar || "",
        lastStatus: el.dataset.statusLabel || "Screening"
      };
      await handleMoveToTrash(cat, talentId, payload);
      return;
    }

    if (cancelBtn) {
      e.stopPropagation();
      const cat = cancelBtn.dataset.category;
      const talentId = cancelBtn.dataset.talentId;
      if (!cat || !talentId) return;
      await handleCancelCandidate(cat, talentId);
      return;
    }

    if (detailCard && !e.target.closest(".candidate-inline-action")) {
      const cat = detailCard.dataset?.category || activeTab;
      const tid = detailCard.dataset?.talentId;
      if (!tid) return;
      const cfg = TAB_CONFIG[cat];
      const detailUrl = (cfg ? cfg.detailPage : "/data/team-candidate-detail.html") + "?talentId=" + encodeURIComponent(tid);
      window.location.href = detailUrl;
    }
  });
}

// ===== FEATURE INITIALIZATION =====
async function init() {
  try {
    bindEvents();
    if (typeof renderRightbarRecruit === "function") {
      renderRightbarRecruit();
    }

    const authResult = await requireAuth();
    if (!authResult) return;
    const { user, role } = authResult;

    // Mount Shell Topbar & Sidebar
    renderTopbar({ user, role: role || "member" });
    renderSidebar({ role: role || "member", activePage: "candidate-management" });

    CandidateUI.refreshTooltips();

    // Initial load for active tab & calculate tab counts
    await loadCandidates("team");
    subscribeRealtimeUpdates("team");
    refreshAllTabCounts();
  } catch (err) {
    console.error("[Candidate] Init error:", err);
  }
}

// ===== CLEANUP =====
window.addEventListener("beforeunload", () => {
  Object.keys(tabState).forEach((cat) => {
    if (tabState[cat].unsubCandidates) tabState[cat].unsubCandidates();
    if (tabState[cat].unsubUsers) tabState[cat].unsubUsers();
  });
});

init();
