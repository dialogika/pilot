// assets/js/components/quest-modal/quest-modal.ui.js
// =====================================================================
// QUEST MODAL UI — Pure rendering, DOM manipulation, event handling,
// loading/empty/error states, sub-modal interactions for Daily & Quest.
//
// RULES:
//  - NO Firestore queries here (use quest-modal.repository.js).
//  - Pure view logic; receives plain data, renders into DOM.
// =====================================================================

import { escapeHtml, formatDateID } from "../../utils.js";
import { toast, setButtonBusy } from "../../ui.js";
import { createRichEditor } from "../rich-editor/rich-editor.js";

let questDescEditorInstance = null;

function el(id) {
  return document.getElementById(id);
}

/**
 * Ensure the Quest Modal DOM structure exists in the page body.
 */
export function ensureQuestModalDOM() {
  if (el("dgQuestModalOverlay")) return;

  // Dynamically ensure the stylesheets are loaded
  if (!document.querySelector('link[href*="quest-modal.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "../../assets/js/components/quest-modal/quest-modal.css";
    document.head.appendChild(link);
  }
  if (!document.querySelector('link[href*="rich-editor.css"]')) {
    const linkEditor = document.createElement("link");
    linkEditor.rel = "stylesheet";
    linkEditor.href = "../../assets/js/components/rich-editor/rich-editor.css";
    document.head.appendChild(linkEditor);
  }

  const container = document.createElement("div");
  container.id = "dgQuestModalMount";
  container.innerHTML = `
    <!-- Main Quest Modal Overlay -->
    <div id="dgQuestModalOverlay" class="dg-quest-modal-overlay">
      <div class="dg-quest-modal-dialog">
        <!-- Header -->
        <div class="dg-quest-modal-header">
          <div class="dg-quest-modal-title-area">
            <div class="dg-quest-modal-icon-badge">
              <i class="bi bi-bullseye" id="dgQuestModalHeaderIcon"></i>
            </div>
            <div class="dg-quest-modal-title-text">
              <h2 id="dgQuestModalTitle">Daily &amp; Quest</h2>
              <p id="dgQuestModalSubtitle">Fokus, ringkas, dan pantau aktivitas harian Anda</p>
            </div>
          </div>
          <div class="dg-quest-modal-actions">
            <button type="button" id="dgQuestOverdueBtn" class="dg-quest-btn-icon text-danger d-none" title="Overdue">
              <i class="bi bi-clock-history"></i>
            </button>
            <button type="button" id="dgQuestAddBtn" class="dg-quest-btn-icon dg-quest-btn-add" title="Tambah Baru">
              <i class="bi bi-plus-lg"></i>
            </button>
            <button type="button" id="dgQuestModalCloseBtn" class="dg-quest-btn-close" title="Tutup">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <!-- Tabs Bar -->
        <div class="dg-quest-tabs-bar">
          <button type="button" class="dg-quest-tab-btn active" id="dgQuestTabDaily" data-tab="daily">
            <i class="bi bi-bullseye"></i> Daily
          </button>
          <button type="button" class="dg-quest-tab-btn" id="dgQuestTabQuest" data-tab="quest">
            <i class="bi bi-stars"></i> Quest
          </button>
        </div>

        <!-- Body with Panels -->
        <div class="dg-quest-modal-body">
          <!-- DAILY PANEL -->
          <div id="dgDailyPanel">
            <section class="dg-quest-section" id="dgDailyOverdueSection">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title text-danger">Overdue</h3>
                  <p class="dg-quest-section-sub">Daily yang melewati deadline.</p>
                </div>
              </div>
              <div id="dgDailyOverdueList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Today</h3>
                  <p class="dg-quest-section-sub">Daily yang dikerjakan untuk hari ini.</p>
                </div>
                <button type="button" id="dgDailySubmitReportBtn" class="dg-quest-btn-submit-report">
                  <i class="bi bi-file-earmark-text"></i> Submit Report
                </button>
              </div>
              <div id="dgDailyTodayList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Upcoming</h3>
                  <p class="dg-quest-section-sub">Maksimal 2 daily berikutnya.</p>
                </div>
              </div>
              <div id="dgDailyUpcomingList" class="dg-quest-card-list"></div>
            </section>
          </div>

          <!-- QUEST PANEL -->
          <div id="dgQuestPanel" class="d-none">
            <section class="dg-quest-section" id="dgQuestOverdueSection">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title text-danger">Overdue</h3>
                  <p class="dg-quest-section-sub">Quest yang melewati deadline.</p>
                </div>
              </div>
              <div id="dgQuestOverdueList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Today</h3>
                  <p class="dg-quest-section-sub">Quest yang dikerjakan untuk hari ini.</p>
                </div>
                <button type="button" id="dgQuestSubmitReportBtn" class="dg-quest-btn-submit-report">
                  <i class="bi bi-file-earmark-text"></i> Submit Report
                </button>
              </div>
              <div id="dgQuestTodayList" class="dg-quest-card-list"></div>
            </section>

            <section class="dg-quest-section">
              <div class="dg-quest-section-head">
                <div>
                  <h3 class="dg-quest-section-title">Upcoming</h3>
                  <p class="dg-quest-section-sub">Maksimal 2 quest berikutnya.</p>
                </div>
              </div>
              <div id="dgQuestUpcomingList" class="dg-quest-card-list"></div>
            </section>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Detail Sub-Modal -->
    <div id="dgQuestDetailModal" class="dg-quest-submodal" hidden>
      <div class="dg-quest-submodal-dialog">
        <div class="dg-quest-submodal-head">
          <h3 id="dgQuestDetailTitle" class="dg-quest-submodal-title">Detail</h3>
          <button type="button" class="dg-quest-btn-close" data-close="dgQuestDetailModal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div id="dgQuestDetailBody" class="dg-quest-submodal-body"></div>
      </div>
    </div>

    <!-- Task Create / Edit Sub-Modal -->
    <div id="dgQuestFormModal" class="dg-quest-submodal" hidden>
      <div class="dg-quest-submodal-dialog dg-quest-form-dialog">
        <div class="dg-quest-submodal-head dg-quest-form-head">
          <div class="dg-quest-form-head-left">
            <span class="dg-quest-form-head-icon">
              <i class="bi bi-bullseye"></i>
            </span>
            <div class="dg-quest-form-head-text">
              <h3 id="dgQuestFormTitle" class="dg-quest-submodal-title">Add New Quest</h3>
              <p id="dgQuestFormSubtitle" class="dg-quest-form-subtitle">Lengkapi detail quest di bawah ini</p>
            </div>
          </div>
          <button type="button" class="dg-quest-btn-close-circle" data-close="dgQuestFormModal" title="Close">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <form id="dgQuestForm" class="dg-quest-form-body" novalidate>
          <input type="hidden" id="dgQuestFormId" />
          
          <div class="dg-quest-form-group">
            <label class="dg-quest-form-label">QUEST TITLE</label>
            <input type="text" id="dgQuestNameInput" class="dg-quest-form-input" placeholder="What needs to be done?" required />
          </div>

          <div class="dg-quest-form-group">
            <label class="dg-quest-form-label">DESCRIPTION</label>
            <div id="dgQuestDescEditorContainer" class="dg-quest-editor-wrap"></div>
            <input type="hidden" id="dgQuestDescEditor" />
          </div>

          <div class="dg-quest-form-row">
            <div class="dg-quest-form-col">
              <label class="dg-quest-form-label">DEPARTMENT</label>
              <div class="dg-quest-select-wrapper">
                <select id="dgQuestDeptSelect" class="dg-quest-form-select">
                  <option value="">Select Department</option>
                </select>
                <i class="bi bi-chevron-down dg-quest-select-icon"></i>
              </div>
            </div>
            <div class="dg-quest-form-col">
              <label class="dg-quest-form-label">POSITION</label>
              <div class="dg-quest-select-wrapper">
                <select id="dgQuestPosSelect" class="dg-quest-form-select">
                  <option value="">Select Position</option>
                </select>
                <i class="bi bi-chevron-down dg-quest-select-icon"></i>
              </div>
            </div>
          </div>

          <div class="dg-quest-form-group">
            <label class="dg-quest-form-label">ASSIGN TO</label>
            <div class="dg-quest-tag-selector" id="dgQuestAssignSelectorWrapper">
              <div class="dg-quest-tag-selector-control" id="dgQuestAssignControl">
                <div class="dg-quest-tag-selected-list" id="dgQuestAssignSelectedList">
                  <span class="dg-quest-placeholder" id="dgQuestAssignPlaceholder">Select users...</span>
                </div>
                <i class="bi bi-chevron-down dg-quest-caret"></i>
              </div>
              <div class="dg-quest-assign-dropdown" id="dgQuestAssignDropdown" style="display: none;">
                <input type="text" class="dg-quest-assign-search" id="dgQuestAssignSearch" placeholder="Search user..." />
                <div class="dg-quest-assign-list" id="dgQuestAssignList"></div>
              </div>
            </div>
            <!-- Keep hidden multi-select for fallback data sync -->
            <select id="dgQuestAssignSelect" class="d-none" multiple></select>
          </div>

          <div class="dg-quest-form-group">
            <label class="dg-quest-form-label">REPORT TO</label>
            <div class="dg-quest-tag-selector" id="dgQuestReportToSelectorWrapper">
              <div class="dg-quest-tag-selector-control" id="dgQuestReportToControl">
                <div class="dg-quest-tag-selected-list" id="dgQuestReportToSelectedList">
                  <span class="dg-quest-placeholder" id="dgQuestReportToPlaceholder">Select manager / supervisor...</span>
                </div>
                <i class="bi bi-chevron-down dg-quest-caret"></i>
              </div>
              <div class="dg-quest-assign-dropdown" id="dgQuestReportToDropdown" style="display: none;">
                <input type="text" class="dg-quest-assign-search" id="dgQuestReportToSearch" placeholder="Search supervisor..." />
                <div class="dg-quest-assign-list" id="dgQuestReportToList"></div>
              </div>
            </div>
            <!-- Keep hidden multi-select for fallback data sync -->
            <select id="dgQuestReportToSelect" class="d-none" multiple></select>
          </div>

          <div class="dg-quest-form-row dg-quest-form-row-3">
            <div class="dg-quest-form-col">
              <label class="dg-quest-form-label">DEADLINE</label>
              <div class="dg-quest-duepicker-wrapper" id="dgQuestDuePickerWrapper">
                <div class="dg-quest-duepicker-btn" id="dgQuestDuePickerBtn">
                  <i class="bi bi-calendar3 dg-quest-duepicker-icon"></i>
                  <span id="dgQuestDuePickerText" class="dg-quest-duepicker-text">Add deadline...</span>
                  <i class="bi bi-clock dg-quest-duepicker-clock-icon" id="dgQuestDuePickerClockIcon" style="display:none;"></i>
                </div>
                <input type="hidden" id="dgQuestDeadlineTime" />
                <input type="hidden" id="dgQuestDueDate" />

                <!-- ClickUp Style Dark Theme Due Date & Time Popup Picker -->
                <div class="dg-clickup-picker-popup" id="dgClickUpPickerPopup" style="display: none;">
                  <div class="dg-clickup-picker-header">
                    <!-- Unified Start Date + Time Card -->
                    <div class="dg-clickup-unified-pill active" id="dgClickUpStartPill">
                      <div class="dg-clickup-pill-date-part">
                        <i class="bi bi-calendar3"></i>
                        <span id="dgClickUpPillStartDate">Today</span>
                        <button type="button" class="dg-clickup-pill-clear" id="dgClickUpClearStartDate" title="Clear start date">&times;</button>
                      </div>
                      <div class="dg-clickup-pill-time-part" id="dgClickUpStartTimePart">
                        <span id="dgClickUpPillStartTime">Add time</span>
                        <input type="time" id="dgClickUpStartTimeInput" class="dg-clickup-time-input" />
                        <button type="button" class="dg-clickup-pill-clear" id="dgClickUpClearStartTime" style="display:none;" title="Clear start time">&times;</button>
                      </div>
                    </div>

                    <!-- Unified Due Date + Time Card -->
                    <div class="dg-clickup-unified-pill" id="dgClickUpDuePill">
                      <div class="dg-clickup-pill-date-part">
                        <i class="bi bi-calendar3"></i>
                        <span id="dgClickUpPillDueDate">Due date</span>
                        <button type="button" class="dg-clickup-pill-clear" id="dgClickUpClearDueDate" style="display:none;" title="Clear due date">&times;</button>
                      </div>
                      <div class="dg-clickup-pill-time-part" id="dgClickUpDueTimePart">
                        <span id="dgClickUpPillDueTime">Add time</span>
                        <input type="time" id="dgClickUpDueTimeInput" class="dg-clickup-time-input" />
                        <button type="button" class="dg-clickup-pill-clear" id="dgClickUpClearDueTime" style="display:none;" title="Clear due time">&times;</button>
                      </div>
                    </div>
                  </div>
                  <div class="dg-clickup-picker-body">
                    <!-- Left Quick Presets -->
                    <div class="dg-clickup-presets">
                      <div class="dg-clickup-preset-item" data-preset="today">
                        <span class="dg-clickup-preset-label">Today</span>
                        <span class="dg-clickup-preset-val" id="dgPresetTodayVal">Fri</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="later">
                        <span class="dg-clickup-preset-label">Later</span>
                        <span class="dg-clickup-preset-val">06:00 pm</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="tomorrow">
                        <span class="dg-clickup-preset-label">Tomorrow</span>
                        <span class="dg-clickup-preset-val" id="dgPresetTomorrowVal">Sat</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="this-weekend">
                        <span class="dg-clickup-preset-label">This weekend</span>
                        <span class="dg-clickup-preset-val" id="dgPresetWeekendVal">Sat</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="next-week">
                        <span class="dg-clickup-preset-label">Next week</span>
                        <span class="dg-clickup-preset-val" id="dgPresetNextWeekVal">Mon</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="next-weekend">
                        <span class="dg-clickup-preset-label">Next weekend</span>
                        <span class="dg-clickup-preset-val" id="dgPresetNextWeekendVal">Sat</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="2-weeks">
                        <span class="dg-clickup-preset-label">2 weeks</span>
                        <span class="dg-clickup-preset-val" id="dgPreset2WeeksVal">2 wks</span>
                      </div>
                      <div class="dg-clickup-preset-item" data-preset="4-weeks">
                        <span class="dg-clickup-preset-label">4 weeks</span>
                        <span class="dg-clickup-preset-val" id="dgPreset4WeeksVal">4 wks</span>
                      </div>
                    </div>

                    <!-- Right Interactive Calendar -->
                    <div class="dg-clickup-calendar">
                      <div class="dg-clickup-cal-header">
                        <span class="dg-clickup-cal-month" id="dgClickUpCalMonth">August 2026</span>
                        <div class="dg-clickup-cal-nav">
                          <button type="button" class="dg-clickup-cal-nav-btn" id="dgClickUpCalToday">Today</button>
                          <button type="button" class="dg-clickup-cal-nav-btn" id="dgClickUpCalPrev"><i class="bi bi-chevron-up"></i></button>
                          <button type="button" class="dg-clickup-cal-nav-btn" id="dgClickUpCalNext"><i class="bi bi-chevron-down"></i></button>
                        </div>
                      </div>
                      <div class="dg-clickup-cal-weekdays">
                        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
                      </div>
                      <div class="dg-clickup-cal-grid" id="dgClickUpCalGrid"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="dg-quest-form-col">
              <label class="dg-quest-form-label">TASK POINT</label>
              <input
                type="number"
                id="dgQuestPointSelect"
                class="dg-quest-form-input"
                placeholder="0"
                min="0"
                step="1"
                oninput="this.value = this.value.replace(/[^0-9]/g, '')"
                onkeydown="if (['.', ',', 'e', 'E', '+', '-'].includes(event.key)) event.preventDefault();"
              />
            </div>
            <div class="dg-quest-form-col">
              <label class="dg-quest-form-label">URGENT</label>
              <div class="dg-quest-select-wrapper">
                <select id="dgQuestPrioritySelect" class="dg-quest-form-select">
                  <option value="">Select urgency...</option>
                  <option value="urgent">🔴 Urgent</option>
                  <option value="normal">🟡 Normal</option>
                  <option value="low">🟢 Low</option>
                  <option value="none">⚪ None</option>
                </select>
                <i class="bi bi-chevron-down dg-quest-select-icon"></i>
              </div>
            </div>
          </div>

          <!-- Recurring Section for Daily -->
          <div id="dgQuestRecurSection" class="dg-quest-form-group">
            <label class="dg-quest-form-label">RECURRING</label>
            <div class="dg-quest-recur-card">
              <div class="dg-quest-recur-header">
                <div class="dg-quest-recur-title">
                  <input type="checkbox" id="dgQuestRecurCheckbox" class="dg-quest-recur-checkbox" checked />
                  <i class="bi bi-arrow-repeat"></i>
                  <span>Recurring Pattern</span>
                </div>
                <div class="dg-quest-recur-controls" id="dgQuestRecurControls">
                  <span class="dg-quest-recur-lbl">EVERY</span>
                  <input type="number" id="dgQuestRecurInterval" min="1" max="31" value="1" class="dg-quest-recur-num" />
                  <div class="dg-quest-select-wrapper dg-quest-select-sm">
                    <select id="dgQuestRecurUnit" class="dg-quest-form-select">
                      <option value="week" selected>Week</option>
                      <option value="day">Day</option>
                      <option value="month">Month</option>
                    </select>
                    <i class="bi bi-chevron-down dg-quest-select-icon"></i>
                  </div>
                  <button type="button" id="dgQuestRecurEverydayBtn" class="dg-quest-recur-everyday-btn">Everyday</button>
                </div>
              </div>

              <div id="dgQuestRecurWeeklyWrap" class="dg-quest-recur-body">
                <span class="dg-quest-recur-sublbl">REPEAT ON</span>
                <div class="dg-quest-recur-days-grid" id="dgQuestRecurDaysGrid">
                  <button type="button" data-day="0" class="dg-quest-recur-day">Su</button>
                  <button type="button" data-day="1" class="dg-quest-recur-day">Mo</button>
                  <button type="button" data-day="2" class="dg-quest-recur-day">Tu</button>
                  <button type="button" data-day="3" class="dg-quest-recur-day">We</button>
                  <button type="button" data-day="4" class="dg-quest-recur-day">Th</button>
                  <button type="button" data-day="5" class="dg-quest-recur-day">Fr</button>
                  <button type="button" data-day="6" class="dg-quest-recur-day">Sa</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Hidden tags input for parity -->
          <input type="hidden" id="dgQuestTagsInput" value="" />
        </form>
        <div class="dg-quest-submodal-foot dg-quest-form-foot">
          <button type="button" class="dg-quest-form-btn-cancel" data-close="dgQuestFormModal">Cancel</button>
          <button type="submit" form="dgQuestForm" id="dgQuestFormSubmit" class="dg-quest-form-btn-submit">Create Quest</button>
        </div>
      </div>
    </div>

    <!-- Daily Report Sub-Modal -->
    <div id="dgDailyReportModal" class="dg-quest-submodal" hidden>
      <div class="dg-quest-submodal-dialog">
        <div class="dg-quest-submodal-head">
          <h3 class="dg-quest-submodal-title"><i class="bi bi-file-earmark-text text-success me-1"></i> Submit Daily Report</h3>
          <button type="button" class="dg-quest-btn-close" data-close="dgDailyReportModal"><i class="bi bi-x-lg"></i></button>
        </div>
        <div class="dg-quest-submodal-body">
          <div class="row g-2 mb-3">
            <div class="col-6">
              <label class="form-label small fw-bold mb-1">Tanggal</label>
              <input type="text" id="dgReportDateInput" class="form-control form-control-sm bg-light" readonly />
            </div>
            <div class="col-6">
              <label class="form-label small fw-bold mb-1">Nama</label>
              <input type="text" id="dgReportNameInput" class="form-control form-control-sm bg-light" readonly />
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-bold mb-1">Department</label>
            <input type="text" id="dgReportDeptInput" class="form-control form-control-sm bg-light" readonly />
          </div>
          <label class="form-label small fw-bold mb-2">Pekerjaan yang Dilaporkan:</label>
          <div id="dgReportTasksContainer" class="d-flex flex-column gap-2"></div>
        </div>
        <div class="dg-quest-submodal-foot">
          <button type="button" class="btn btn-sm btn-secondary" data-close="dgDailyReportModal">Batal</button>
          <button type="button" id="dgSubmitReportBtn" class="btn btn-sm btn-success px-4">Kirim Laporan</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);
}

/* ------------------------------------------------------------------ */
/* Modal Open / Close                                                  */
/* ------------------------------------------------------------------ */

export function showModalOverlay() {
  ensureQuestModalDOM();
  const overlay = el("dgQuestModalOverlay");
  if (overlay) {
    overlay.classList.add("show");
    document.body.style.overflow = "hidden";
  }
}

export function hideModalOverlay() {
  const overlay = el("dgQuestModalOverlay");
  if (overlay) {
    overlay.classList.remove("show");
    document.body.style.overflow = "";
  }
}

function openSubModal(id) {
  const node = el(id);
  if (node) node.hidden = false;
}

function closeSubModal(id) {
  const node = el(id);
  if (node) node.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Tab Switching                                                       */
/* ------------------------------------------------------------------ */

export function setActiveTab(tab) {
  const isDaily = tab === "daily";
  el("dgDailyPanel")?.classList.toggle("d-none", !isDaily);
  el("dgQuestPanel")?.classList.toggle("d-none", isDaily);

  el("dgQuestTabDaily")?.classList.toggle("active", isDaily);
  el("dgQuestTabQuest")?.classList.toggle("active", !isDaily);

  if (el("dgQuestModalHeaderIcon")) {
    el("dgQuestModalHeaderIcon").className = isDaily
      ? "bi bi-bullseye"
      : "bi bi-stars";
  }
  if (el("dgQuestModalTitle")) {
    el("dgQuestModalTitle").textContent = isDaily ? "Daily" : "Quest";
  }
}

/* ------------------------------------------------------------------ */
/* Render Board Sections                                               */
/* ------------------------------------------------------------------ */

export function renderBoard(tab, sections, ctx) {
  const isDaily = tab === "daily";
  const prefix = isDaily ? "dgDaily" : "dgQuest";

  const overdueList = el(prefix + "OverdueList");
  const todayList = el(prefix + "TodayList");
  const upcomingList = el(prefix + "UpcomingList");
  const overdueSection = el(prefix + "OverdueSection");

  if (overdueList) {
    overdueList.innerHTML =
      sections.overdue.length === 0
        ? emptyState(`Tidak ada ${isDaily ? "daily" : "quest"} overdue.`)
        : sections.overdue.map((t) => card(t, "overdue", ctx, tab)).join("");
    if (overdueSection) {
      overdueSection.style.display =
        sections.overdue.length === 0 ? "none" : "block";
    }
  }

  if (todayList) {
    todayList.innerHTML =
      sections.today.length === 0
        ? emptyState(`Tidak ada ${isDaily ? "daily" : "quest"} untuk hari ini.`)
        : sections.today.map((t) => card(t, "today", ctx, tab)).join("");
  }

  if (upcomingList) {
    upcomingList.innerHTML =
      sections.upcoming.length === 0
        ? emptyState(`Tidak ada ${isDaily ? "daily" : "quest"} berikutnya.`)
        : sections.upcoming.map((t) => card(t, "upcoming", ctx, tab)).join("");
  }
}

function emptyState(text) {
  return `<p class="dg-quest-empty-msg">${escapeHtml(text)}</p>`;
}

function priorityStyle(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "urgent" || p === "high")
    return { label: "Urgent", color: "#dc2626" };
  if (p === "normal" || p === "medium")
    return { label: "Normal", color: "#f59e0b" };
  if (p === "low")
    return { label: "Low", color: "#16a34a" };
  if (p === "none")
    return { label: "None", color: "#94a3b8" };
  return null;
}

function borderColor(task, category) {
  const p = String(task.priority || "").toLowerCase();
  if (category === "overdue" || task.questDeadlinePassed) return "#dc2626";
  if (p === "urgent" || p === "high") return "#dc2626";
  if (p === "normal" || p === "medium") return "#f59e0b";
  if (p === "low") return "#16a34a";
  if (p === "none") return "#94a3b8";
  return "#3b82f6";
}

function deadlineBg(category) {
  if (category === "overdue") return "#dc2626";
  if (category === "upcoming") return "#16a34a";
  return "#2563eb";
}

function getAssignList(task) {
  if (!task.assign_to) return [];
  return Array.isArray(task.assign_to)
    ? task.assign_to.slice()
    : [task.assign_to];
}

function card(task, category, ctx, tab) {
  const id = task.id;
  const title = escapeHtml(
    task.title || (tab === "daily" ? "Untitled Daily" : "Untitled Quest"),
  );
  const desc = escapeHtml(task.descText || "Tidak ada deskripsi.");
  const dueText = escapeHtml(task.deadline_time || "");
  const priority = priorityStyle(task.priority);
  const assign = getAssignList(task);

  const lockState = task.lockState || { claimed: false, done: false };
  const locked = lockState.claimed;
  const done = lockState.done || /reported|done|complete/i.test(task.status);
  const doneClass = done ? "dg-quest-done" : "";

  let avatars = "";
  const max = 4;
  assign.slice(0, max).forEach((uid) => {
    const user =
      ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
    avatars += renderAvatar(user);
  });
  if (assign.length > max) {
    avatars += `<span class="dg-quest-avatar">+${assign.length - max}</span>`;
  }

  let tags = "";
  (task.tags || []).forEach((t) => {
    if (t) tags += `<span class="dg-quest-tag">${escapeHtml(String(t))}</span>`;
  });

  const pointsHtml =
    task.points > 0
      ? `<span class="dg-quest-points">${task.points} Pt</span>`
      : "";
  const prioHtml = priority
    ? `<span class="dg-quest-badge" style="background:${priority.color}20;color:${priority.color};">${escapeHtml(priority.label)}</span>`
    : "";
  const recurHtml = task.recur ? " <i class='bi bi-arrow-repeat'></i>" : "";
  const deadlineHtml = dueText
    ? `<span class="dg-quest-deadline" style="background:${deadlineBg(category)};"><i class="bi bi-clock"></i> ${escapeHtml(dueText)}${recurHtml}</span>`
    : "";

  let actions = "";
  if (category !== "upcoming") {
    const isChecked = task.isChecked ? " checked" : "";
    actions += `<button type="button" class="dg-quest-check-btn${isChecked}" data-check="${id}" title="Centang untuk laporan" ${done ? "disabled" : ""}><i class="bi bi-check-lg"></i></button>`;
  }

  actions += `<button type="button" class="dg-quest-link-btn" data-detail="${id}"><i class="bi bi-eye"></i> Detail</button>`;

  if (
    task.isOwner ||
    ctx.currentRole === "super-admin" ||
    ctx.currentRole === "admin"
  ) {
    actions += `<button type="button" class="dg-quest-link-btn dg-warn" data-edit="${id}"><i class="bi bi-pencil"></i> Edit</button>`;
    actions += `<button type="button" class="dg-quest-link-btn dg-danger" data-delete="${id}"><i class="bi bi-trash"></i> Hapus</button>`;
  }

  return `
    <div class="dg-quest-card ${doneClass}" style="border-left-color:${borderColor(task, category)};" data-task-id="${id}">
      <div class="dg-quest-card-main">
        <div class="dg-quest-card-title-row">
          <h4 class="dg-quest-card-title">${title}</h4>
          ${prioHtml}
          ${done ? '<span class="dg-quest-badge" style="background:#dcfce7;color:#15803d;">✓ Reported</span>' : ""}
        </div>
        ${deadlineHtml}
        <p class="dg-quest-card-desc">${desc}</p>
        <div class="dg-quest-card-meta">
          ${avatars ? `<div class="dg-quest-avatars">${avatars}</div>` : ""}
          ${tags}
          ${pointsHtml}
        </div>
      </div>
      <div class="dg-quest-card-actions">
        ${actions}
      </div>
    </div>
  `;
}

function renderAvatar(user) {
  const name = user.name || user.email || user.uid || "U";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  if (user.photo) {
    return `<span class="dg-quest-avatar"><img src="${escapeHtml(user.photo)}" alt="${escapeHtml(name)}" title="${escapeHtml(name)}" /></span>`;
  }
  return `<span class="dg-quest-avatar" title="${escapeHtml(name)}">${escapeHtml(initials || "U")}</span>`;
}

/* ------------------------------------------------------------------ */
export const DEPARTMENT_POSITIONS_MAP = {
  happy: ["Recruitment Specialist", "People Development"],
  rebuy: ["Product Manager", "Admin Kelas"],
  team: [
    "Chief Executive Officer",
    "Department Head",
    "Human Capital Management",
  ],
  branding: [
    "Content Creator",
    "Branding Team",
    "Design Specialist",
    "Website Development",
    "Content Writer",
    "Video Editor",
  ],
  closing: [
    "Admin Marketing",
    "Community Management",
    "Marketing Strategy",
    "Sales Department",
    "Digital Advertiser",
  ],
};

export function populatePositionsForDept(
  deptKey,
  currentPosId,
  positionsList = [],
) {
  const posSelect = el("dgQuestPosSelect");
  if (!posSelect) return;
  posSelect.innerHTML = '<option value="">Select Position</option>';

  const cleanKey = String(deptKey || "")
    .trim()
    .toLowerCase();
  if (!cleanKey) return;

  const mapped = DEPARTMENT_POSITIONS_MAP[cleanKey];
  const added = {};

  if (Array.isArray(mapped) && mapped.length > 0) {
    mapped.forEach((pName) => {
      const opt = document.createElement("option");
      opt.value = pName;
      opt.textContent = pName;
      posSelect.appendChild(opt);
      added[pName.toLowerCase()] = true;
    });
  }

  // Only add positions from positionsList IF they explicitly belong to this department
  (positionsList || []).forEach((p) => {
    const pDept = String(
      p.department || p.department_name || p.departmentId || "",
    ).toLowerCase();
    if (pDept === cleanKey) {
      const pName = p.name || p.id;
      if (!added[String(pName).toLowerCase()]) {
        const opt = document.createElement("option");
        opt.value = p.id || pName;
        opt.textContent = pName;
        posSelect.appendChild(opt);
        added[String(pName).toLowerCase()] = true;
      }
    }
  });

  if (currentPosId) {
    posSelect.value = currentPosId;
  }
}

/* ------------------------------------------------------------------ */
/* Form Sub-Modal State & Setup                                       */
/* ------------------------------------------------------------------ */

let formSelectedUserIds = [];
let formUsersCache = [];
let formSelectedWeekdays = [0, 1, 2, 3, 4, 5, 6]; // default everyday

function getTargetDeptKey() {
  const deptSelect = el("dgQuestDeptSelect");
  return deptSelect ? String(deptSelect.value || "").trim().toLowerCase() : "";
}

function getTargetPosKey() {
  const posSelect = el("dgQuestPosSelect");
  return posSelect ? String(posSelect.value || "").trim().toLowerCase() : "";
}

function normalizeKey(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isUserMatchDeptAndPos(u, targetDept, targetPos) {
  if (!targetDept && !targetPos) return true;

  const normTargetDept = normalizeKey(targetDept);
  const normTargetPos = normalizeKey(targetPos);

  // Position matching
  let matchesPos = true;
  if (normTargetPos) {
    const userPositions = [];
    if (u.position) userPositions.push(u.position);
    if (u.position_name) userPositions.push(u.position_name);
    if (u.job_position) userPositions.push(u.job_position);
    if (u.employment && u.employment.position) userPositions.push(u.employment.position);
    if (u.role_title) userPositions.push(u.role_title);
    if (u.role) userPositions.push(u.role);
    if (Array.isArray(u.positions)) {
      u.positions.forEach((p) => {
        if (typeof p === "object" && p) userPositions.push(p.name || p.title || p.id || "");
        else if (p) userPositions.push(p);
      });
    }

    matchesPos = userPositions.some((p) => {
      const normP = normalizeKey(p);
      return normP && (normP === normTargetPos || normP.includes(normTargetPos) || normTargetPos.includes(normP));
    });

    // Semantic aliases for common leadership/team positions:
    if (!matchesPos) {
      if (normTargetPos.includes("chiefexecutive") || normTargetPos.includes("ceo")) {
        matchesPos = userPositions.some((p) => {
          const np = normalizeKey(p);
          return np.includes("ceo") || np.includes("chiefexecutive") || np.includes("director") || np.includes("founder") || np.includes("leader") || np === "superadmin";
        });
      } else if (normTargetPos.includes("humancapital") || normTargetPos.includes("hcm")) {
        matchesPos = userPositions.some((p) => {
          const np = normalizeKey(p);
          return np.includes("humancapital") || np.includes("hcm") || np.includes("hr") || np.includes("peopledev");
        });
      } else if (normTargetPos.includes("departmenthead") || normTargetPos.includes("depthead")) {
        matchesPos = userPositions.some((p) => {
          const np = normalizeKey(p);
          return np.includes("head") || np.includes("lead") || np.includes("manager");
        });
      }
    }
  }

  // Department matching
  let matchesDept = true;
  if (normTargetDept) {
    const userDepts = [];
    if (u.department) userDepts.push(u.department);
    if (u.department_name) userDepts.push(u.department_name);
    if (u.dept) userDepts.push(u.dept);
    if (u.employment && u.employment.department) userDepts.push(u.employment.department);
    if (Array.isArray(u.departments)) {
      u.departments.forEach((d) => {
        if (typeof d === "object" && d) userDepts.push(d.name || d.id || "");
        else if (d) userDepts.push(d);
      });
    }

    matchesDept = userDepts.some((d) => {
      const normD = normalizeKey(d);
      return normD && (normD === normTargetDept || normD.includes(normTargetDept) || normTargetDept.includes(normD));
    });

    // Flexible fallback for "team" or management department:
    // If targetDept is "team" and the user matches the position in team, consider department matched!
    if (!matchesDept && (normTargetDept === "team" || normTargetDept === "management")) {
      const roleStr = normalizeKey(u.role || u.role_title || "");
      if (
        matchesPos ||
        roleStr.includes("admin") ||
        roleStr.includes("ceo") ||
        roleStr.includes("director") ||
        roleStr.includes("founder") ||
        roleStr.includes("head") ||
        roleStr.includes("manager") ||
        roleStr.includes("team")
      ) {
        matchesDept = true;
      }
    }
  }

  return matchesDept && matchesPos;
}

function setupAssignSelector(usersList) {
  formUsersCache = usersList || [];
  const control = el("dgQuestAssignControl");
  const dropdown = el("dgQuestAssignDropdown");
  const searchInput = el("dgQuestAssignSearch");
  const listContainer = el("dgQuestAssignList");

  if (!control || !dropdown) return;

  // Toggle dropdown on control click
  control.onclick = (e) => {
    e.stopPropagation();
    const isHidden = dropdown.style.display === "none";
    dropdown.style.display = isHidden ? "block" : "none";
    if (isHidden && searchInput) {
      searchInput.value = "";
      filterAssignList("");
      searchInput.focus();
    }
  };

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#dgQuestAssignSelectorWrapper")) {
      if (dropdown) dropdown.style.display = "none";
    }
  });

  if (searchInput) {
    searchInput.oninput = (e) => {
      filterAssignList(e.target.value);
    };
    searchInput.onclick = (e) => e.stopPropagation();
  }

  window.__dgFilterAssignList__ = filterAssignList;

  function filterAssignList(query) {
    const q = String(query || "").toLowerCase().trim();
    if (!listContainer) return;

    const targetDept = getTargetDeptKey();
    const targetPos = getTargetPosKey();

    const filtered = formUsersCache.filter((u) => {
      const nm = String(u.name || u.email || u.id).toLowerCase();
      const matchesSearch = !q || nm.includes(q);
      const matchesDeptPos = isUserMatchDeptAndPos(u, targetDept, targetPos);
      return matchesSearch && matchesDeptPos;
    });

    if (!filtered.length) {
      listContainer.innerHTML = '<div class="p-2 text-center text-muted small">No matching users found</div>';
      return;
    }

    listContainer.innerHTML = filtered
      .map((u) => {
        const isSelected = formSelectedUserIds.includes(u.id);
        const name = u.name || u.email || u.id;
        const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "U";
        const avatarHtml = u.photo
          ? `<img src="${escapeHtml(u.photo)}" alt="${escapeHtml(name)}" />`
          : escapeHtml(initials);
        return `
          <div class="dg-quest-assign-option${isSelected ? " selected" : ""}" data-user-id="${escapeHtml(u.id)}">
            <span class="dg-quest-assign-avatar">${avatarHtml}</span>
            <span class="dg-quest-assign-name">${escapeHtml(name)}</span>
          </div>
        `;
      })
      .join("");

    listContainer.querySelectorAll(".dg-quest-assign-option").forEach((row) => {
      row.onclick = (e) => {
        e.stopPropagation();
        const uid = row.dataset.userId;
        if (!uid) return;
        const idx = formSelectedUserIds.indexOf(uid);
        if (idx !== -1) {
          formSelectedUserIds.splice(idx, 1);
        } else {
          formSelectedUserIds.push(uid);
        }
        updateAssignSelectedUI();
        filterAssignList(searchInput ? searchInput.value : "");
      };
    });
  }

  filterAssignList("");
}

function updateAssignSelectedUI() {
  const container = el("dgQuestAssignSelectedList");
  if (!container) return;

  // Sync to hidden native select
  const nativeSelect = el("dgQuestAssignSelect");
  if (nativeSelect) {
    Array.from(nativeSelect.options).forEach((opt) => {
      opt.selected = formSelectedUserIds.includes(opt.value);
    });
  }

  if (typeof window.__dgSyncFormLockState__ === "function") {
    window.__dgSyncFormLockState__();
  }

  if (!formSelectedUserIds.length) {
    container.innerHTML = '<span class="dg-quest-placeholder">Select users...</span>';
    return;
  }

  container.innerHTML = formSelectedUserIds
    .map((uid) => {
      const user = formUsersCache.find((u) => u.id === uid) || { id: uid, name: uid };
      const name = user.name || user.email || uid;
      return `
        <span class="dg-quest-assign-pill">
          ${escapeHtml(name)}
          <button type="button" class="dg-quest-assign-pill-remove" data-remove-user="${escapeHtml(uid)}">&times;</button>
        </span>
      `;
    })
    .join("");

  container.querySelectorAll("[data-remove-user]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const uid = btn.dataset.removeUser;
      formSelectedUserIds = formSelectedUserIds.filter((id) => id !== uid);
      updateAssignSelectedUI();
      const searchInput = el("dgQuestAssignSearch");
      if (searchInput) searchInput.dispatchEvent(new Event("input"));
    };
  });
}

let formSelectedReportToIds = [];
let formReportToUsersCache = [];

function setupReportToSelector(usersList) {
  formReportToUsersCache = usersList || [];
  const control = el("dgQuestReportToControl");
  const dropdown = el("dgQuestReportToDropdown");
  const searchInput = el("dgQuestReportToSearch");
  const listContainer = el("dgQuestReportToList");

  if (!control || !dropdown) return;

  // Toggle dropdown on control click
  control.onclick = (e) => {
    e.stopPropagation();
    const isHidden = dropdown.style.display === "none";
    dropdown.style.display = isHidden ? "block" : "none";
    if (isHidden && searchInput) {
      searchInput.value = "";
      filterReportToList("");
      searchInput.focus();
    }
  };

  // Close dropdown on click outside
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#dgQuestReportToSelectorWrapper")) {
      if (dropdown) dropdown.style.display = "none";
    }
  });

  if (searchInput) {
    searchInput.oninput = (e) => {
      filterReportToList(e.target.value);
    };
    searchInput.onclick = (e) => e.stopPropagation();
  }

  function filterReportToList(query) {
    const q = String(query || "").toLowerCase().trim();
    if (!listContainer) return;

    const filtered = formReportToUsersCache.filter((u) => {
      const nm = String(u.name || u.email || u.id).toLowerCase();
      return !q || nm.includes(q);
    });

    if (!filtered.length) {
      listContainer.innerHTML = '<div class="p-2 text-center text-muted small">No users found</div>';
      return;
    }

    listContainer.innerHTML = filtered
      .map((u) => {
        const isSelected = formSelectedReportToIds.includes(u.id);
        const name = u.name || u.email || u.id;
        const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "U";
        const avatarHtml = u.photo
          ? `<img src="${escapeHtml(u.photo)}" alt="${escapeHtml(name)}" />`
          : escapeHtml(initials);
        return `
          <div class="dg-quest-assign-option${isSelected ? " selected" : ""}" data-report-user-id="${escapeHtml(u.id)}">
            <span class="dg-quest-assign-avatar">${avatarHtml}</span>
            <span class="dg-quest-assign-name">${escapeHtml(name)}</span>
          </div>
        `;
      })
      .join("");

    listContainer.querySelectorAll(".dg-quest-assign-option").forEach((row) => {
      row.onclick = (e) => {
        e.stopPropagation();
        const uid = row.dataset.reportUserId;
        if (!uid) return;
        const idx = formSelectedReportToIds.indexOf(uid);
        if (idx !== -1) {
          formSelectedReportToIds.splice(idx, 1);
        } else {
          formSelectedReportToIds.push(uid);
        }
        updateReportToSelectedUI();
        filterReportToList(searchInput ? searchInput.value : "");
      };
    });
  }

  filterReportToList("");
}

function updateReportToSelectedUI() {
  const container = el("dgQuestReportToSelectedList");
  if (!container) return;

  // Sync to hidden native select
  const nativeSelect = el("dgQuestReportToSelect");
  if (nativeSelect) {
    Array.from(nativeSelect.options).forEach((opt) => {
      opt.selected = formSelectedReportToIds.includes(opt.value);
    });
  }

  if (typeof window.__dgSyncFormLockState__ === "function") {
    window.__dgSyncFormLockState__();
  }

  if (!formSelectedReportToIds.length) {
    container.innerHTML = '<span class="dg-quest-placeholder">Select manager / supervisor...</span>';
    return;
  }

  container.innerHTML = formSelectedReportToIds
    .map((uid) => {
      const user = formReportToUsersCache.find((u) => u.id === uid) || { id: uid, name: uid };
      const name = user.name || user.email || uid;
      return `
        <span class="dg-quest-assign-pill">
          ${escapeHtml(name)}
          <button type="button" class="dg-quest-assign-pill-remove" data-remove-report-user="${escapeHtml(uid)}">&times;</button>
        </span>
      `;
    })
    .join("");

  container.querySelectorAll("[data-remove-report-user]").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const uid = btn.dataset.removeReportUser;
      formSelectedReportToIds = formSelectedReportToIds.filter((id) => id !== uid);
      updateReportToSelectedUI();
      const searchInput = el("dgQuestReportToSearch");
      if (searchInput) searchInput.dispatchEvent(new Event("input"));
    };
  });
}

let formSelectedStartDate = ""; // YYYY-MM-DD
let formSelectedStartTime = ""; // HH:MM
let formSelectedDueDate = ""; // YYYY-MM-DD
let formSelectedDueTime = ""; // HH:MM
let currentPickerTab = "start"; // "start" or "due"
let calViewDate = new Date();

function setupDueDatePicker(initialStartDate, initialStartTime, initialDueDate, initialDueTime) {
  formSelectedStartDate = initialStartDate || "";
  formSelectedStartTime = initialStartTime || "";
  formSelectedDueDate = initialDueDate || "";
  formSelectedDueTime = initialDueTime || "";
  currentPickerTab = "start";

  const targetDate = formSelectedStartDate || formSelectedDueDate;
  calViewDate = targetDate ? new Date(targetDate) : new Date();
  if (isNaN(calViewDate.getTime())) calViewDate = new Date();

  const wrapper = el("dgQuestDuePickerWrapper");
  const btn = el("dgQuestDuePickerBtn");
  const popup = el("dgClickUpPickerPopup");

  const startPill = el("dgClickUpStartPill");
  const pillStartDate = el("dgClickUpPillStartDate");
  const clearStartDateBtn = el("dgClickUpClearStartDate");
  const pillStartTime = el("dgClickUpPillStartTime");
  const startTimeInput = el("dgClickUpStartTimeInput");
  const clearStartTimeBtn = el("dgClickUpClearStartTime");

  const duePill = el("dgClickUpDuePill");
  const pillDueDate = el("dgClickUpPillDueDate");
  const clearDueDateBtn = el("dgClickUpClearDueDate");
  const pillDueTime = el("dgClickUpPillDueTime");
  const dueTimeInput = el("dgClickUpDueTimeInput");
  const clearDueTimeBtn = el("dgClickUpClearDueTime");

  const mainText = el("dgQuestDuePickerText");
  const clockIcon = el("dgQuestDuePickerClockIcon");
  const hiddenTime = el("dgQuestDeadlineTime");
  const hiddenDate = el("dgQuestDueDate");

  if (!btn || !popup) return;

  // Toggle Popup
  btn.onclick = (e) => {
    e.stopPropagation();
    const isHidden = popup.style.display === "none";
    popup.style.display = isHidden ? "block" : "none";
    if (isHidden) {
      renderCalendar();
      updatePickerDisplay();
    }
  };

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#dgQuestDuePickerWrapper")) {
      if (popup) popup.style.display = "none";
    }
  });

  // Switch active tab between Start Date and Due Date
  if (startPill) {
    startPill.onclick = (e) => {
      e.stopPropagation();
      currentPickerTab = "start";
      startPill.classList.add("active");
      if (duePill) duePill.classList.remove("active");
      if (formSelectedStartDate) calViewDate = new Date(formSelectedStartDate);
      renderCalendar();
      updatePickerDisplay();
    };
  }

  if (duePill) {
    duePill.onclick = (e) => {
      e.stopPropagation();
      currentPickerTab = "due";
      duePill.classList.add("active");
      if (startPill) startPill.classList.remove("active");
      if (formSelectedDueDate) calViewDate = new Date(formSelectedDueDate);
      renderCalendar();
      updatePickerDisplay();
    };
  }

  const startTimePart = el("dgClickUpStartTimePart");
  const dueTimePart = el("dgClickUpDueTimePart");

  // Reliable Time Picker Trigger
  if (startTimePart && startTimeInput) {
    startTimePart.onclick = (e) => {
      e.stopPropagation();
      if (e.target === clearStartTimeBtn) return;
      if (typeof startTimeInput.showPicker === "function") {
        startTimeInput.showPicker();
      } else {
        startTimeInput.focus();
        startTimeInput.click();
      }
    };
  }

  if (dueTimePart && dueTimeInput) {
    dueTimePart.onclick = (e) => {
      e.stopPropagation();
      if (e.target === clearDueTimeBtn) return;
      if (typeof dueTimeInput.showPicker === "function") {
        dueTimeInput.showPicker();
      } else {
        dueTimeInput.focus();
        dueTimeInput.click();
      }
    };
  }

  // Start Time Input Handling
  if (startTimeInput) {
    startTimeInput.value = formSelectedStartTime;
    startTimeInput.onchange = (e) => {
      formSelectedStartTime = e.target.value;
      updatePickerDisplay();
    };
    startTimeInput.oninput = (e) => {
      formSelectedStartTime = e.target.value;
      updatePickerDisplay();
    };
  }

  if (clearStartTimeBtn) {
    clearStartTimeBtn.onclick = (e) => {
      e.stopPropagation();
      formSelectedStartTime = "";
      if (startTimeInput) startTimeInput.value = "";
      updatePickerDisplay();
    };
  }

  if (clearStartDateBtn) {
    clearStartDateBtn.onclick = (e) => {
      e.stopPropagation();
      formSelectedStartDate = "";
      formSelectedStartTime = "";
      if (startTimeInput) startTimeInput.value = "";
      renderCalendar();
      updatePickerDisplay();
    };
  }

  // Due Time Input Handling
  if (dueTimeInput) {
    dueTimeInput.value = formSelectedDueTime;
    dueTimeInput.onchange = (e) => {
      formSelectedDueTime = e.target.value;
      updatePickerDisplay();
    };
    dueTimeInput.oninput = (e) => {
      formSelectedDueTime = e.target.value;
      updatePickerDisplay();
    };
  }

  if (clearDueTimeBtn) {
    clearDueTimeBtn.onclick = (e) => {
      e.stopPropagation();
      formSelectedDueTime = "";
      if (dueTimeInput) dueTimeInput.value = "";
      updatePickerDisplay();
    };
  }

  if (clearDueDateBtn) {
    clearDueDateBtn.onclick = (e) => {
      e.stopPropagation();
      formSelectedDueDate = "";
      formSelectedDueTime = "";
      if (dueTimeInput) dueTimeInput.value = "";
      renderCalendar();
      updatePickerDisplay();
    };
  }

  // Quick Presets
  const daysShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatYMD(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  // Update labels for presets
  const today = new Date();
  const tmrw = new Date(today);
  tmrw.setDate(today.getDate() + 1);

  const sat = new Date(today);
  const daysToSat = (6 - today.getDay() + 7) % 7 || 7;
  sat.setDate(today.getDate() + daysToSat);

  const nextMon = new Date(today);
  const daysToMon = (8 - today.getDay()) % 7 || 7;
  nextMon.setDate(today.getDate() + daysToMon);

  const nextSat = new Date(sat);
  nextSat.setDate(sat.getDate() + 7);

  const w2 = new Date(today);
  w2.setDate(today.getDate() + 14);

  const w4 = new Date(today);
  w4.setDate(today.getDate() + 28);

  const presetTodayEl = el("dgPresetTodayVal");
  if (presetTodayEl) presetTodayEl.textContent = daysShort[today.getDay()];
  const presetTmrwEl = el("dgPresetTomorrowVal");
  if (presetTmrwEl) presetTmrwEl.textContent = daysShort[tmrw.getDay()];
  const presetWkndEl = el("dgPresetWeekendVal");
  if (presetWkndEl) presetWkndEl.textContent = daysShort[sat.getDay()];
  const presetNextMonEl = el("dgPresetNextWeekVal");
  if (presetNextMonEl) presetNextMonEl.textContent = daysShort[nextMon.getDay()];
  const presetNextWkndEl = el("dgPresetNextWeekendVal");
  if (presetNextWkndEl) presetNextWkndEl.textContent = `${nextSat.getDate()} ${monthsShort[nextSat.getMonth()]}`;
  const preset2wEl = el("dgPreset2WeeksVal");
  if (preset2wEl) preset2wEl.textContent = `${w2.getDate()} ${monthsShort[w2.getMonth()]}`;
  const preset4wEl = el("dgPreset4WeeksVal");
  if (preset4wEl) preset4wEl.textContent = `${w4.getDate()} ${monthsShort[w4.getMonth()]}`;

  popup.querySelectorAll("[data-preset]").forEach((item) => {
    item.onclick = (e) => {
      e.stopPropagation();
      const p = item.dataset.preset;
      let chosenYMD = "";
      let chosenTime = "";

      if (p === "today") {
        chosenYMD = formatYMD(today);
      } else if (p === "later") {
        chosenYMD = formatYMD(today);
        chosenTime = "18:00";
      } else if (p === "tomorrow") {
        chosenYMD = formatYMD(tmrw);
      } else if (p === "this-weekend") {
        chosenYMD = formatYMD(sat);
      } else if (p === "next-week") {
        chosenYMD = formatYMD(nextMon);
      } else if (p === "next-weekend") {
        chosenYMD = formatYMD(nextSat);
      } else if (p === "2-weeks") {
        chosenYMD = formatYMD(w2);
      } else if (p === "4-weeks") {
        chosenYMD = formatYMD(w4);
      }

      if (currentPickerTab === "start") {
        formSelectedStartDate = chosenYMD;
        if (chosenTime) {
          formSelectedStartTime = chosenTime;
          if (startTimeInput) startTimeInput.value = chosenTime;
        }
        // Auto-focus due date pill after choosing start date
        currentPickerTab = "due";
        if (duePill) duePill.classList.add("active");
        if (startPill) startPill.classList.remove("active");
      } else {
        formSelectedDueDate = chosenYMD;
        if (chosenTime) {
          formSelectedDueTime = chosenTime;
          if (dueTimeInput) dueTimeInput.value = chosenTime;
        }
      }

      calViewDate = chosenYMD ? new Date(chosenYMD) : new Date();
      renderCalendar();
      updatePickerDisplay();
    };
  });

  // Calendar Nav
  const calMonthEl = el("dgClickUpCalMonth");
  const calGridEl = el("dgClickUpCalGrid");
  const prevBtn = el("dgClickUpCalPrev");
  const nextBtn = el("dgClickUpCalNext");
  const todayBtn = el("dgClickUpCalToday");

  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      calViewDate.setMonth(calViewDate.getMonth() - 1);
      renderCalendar();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      calViewDate.setMonth(calViewDate.getMonth() + 1);
      renderCalendar();
    };
  }
  if (todayBtn) {
    todayBtn.onclick = (e) => {
      e.stopPropagation();
      calViewDate = new Date();
      const todayYMD = formatYMD(new Date());
      if (currentPickerTab === "start") {
        formSelectedStartDate = todayYMD;
        currentPickerTab = "due";
        if (duePill) duePill.classList.add("active");
        if (startPill) startPill.classList.remove("active");
      } else {
        formSelectedDueDate = todayYMD;
      }
      renderCalendar();
      updatePickerDisplay();
    };
  }

  function renderCalendar() {
    if (!calGridEl || !calMonthEl) return;
    const monthsFull = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    calMonthEl.textContent = `${monthsFull[calViewDate.getMonth()]} ${calViewDate.getFullYear()}`;

    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDayIndex = firstDay.getDay(); // 0 is Sunday
    const totalDays = lastDay.getDate();

    const prevLastDay = new Date(year, month, 0).getDate();

    let cellsHtml = "";
    const todayStr = formatYMD(new Date());

    // Prev month days
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dNum = prevLastDay - i;
      const dObj = new Date(year, month - 1, dNum);
      const dStr = formatYMD(dObj);
      cellsHtml += `<div class="dg-clickup-cal-cell other-month" data-date="${dStr}">${dNum}</div>`;
    }

    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const dObj = new Date(year, month, day);
      const dStr = formatYMD(dObj);
      const isToday = dStr === todayStr;
      const isStart = dStr === formSelectedStartDate;
      const isDue = dStr === formSelectedDueDate;
      const isSelected = isStart || isDue;
      const isInRange = Boolean(formSelectedStartDate && formSelectedDueDate && dStr > formSelectedStartDate && dStr < formSelectedDueDate);

      const classes = [
        "dg-clickup-cal-cell",
        isToday ? "today" : "",
        isSelected ? "selected" : "",
        isInRange ? "range-in" : "",
      ].filter(Boolean).join(" ");

      cellsHtml += `<div class="${classes}" data-date="${dStr}">${day}</div>`;
    }

    // Next month days to fill 35 or 42 cells
    const cellCountSoFar = startDayIndex + totalDays;
    const nextDaysNeeded = (cellCountSoFar % 7 === 0) ? 0 : 7 - (cellCountSoFar % 7);
    for (let i = 1; i <= nextDaysNeeded; i++) {
      const dObj = new Date(year, month + 1, i);
      const dStr = formatYMD(dObj);
      cellsHtml += `<div class="dg-clickup-cal-cell other-month" data-date="${dStr}">${i}</div>`;
    }

    calGridEl.innerHTML = cellsHtml;

    calGridEl.querySelectorAll(".dg-clickup-cal-cell").forEach((cell) => {
      cell.onclick = (e) => {
        e.stopPropagation();
        const clickedDate = cell.dataset.date;
        if (currentPickerTab === "start") {
          formSelectedStartDate = clickedDate;
          // If due date is before start date, clear due date
          if (formSelectedDueDate && formSelectedDueDate < formSelectedStartDate) {
            formSelectedDueDate = "";
          }
          currentPickerTab = "due";
          if (duePill) duePill.classList.add("active");
          if (startPill) startPill.classList.remove("active");
        } else {
          formSelectedDueDate = clickedDate;
          // If user picked a due date that is before start date, treat it as start date
          if (formSelectedStartDate && formSelectedDueDate < formSelectedStartDate) {
            formSelectedStartDate = clickedDate;
            formSelectedDueDate = "";
          }
        }
        renderCalendar();
        updatePickerDisplay();
      };
    });
  }

  function updatePickerDisplay() {
    // Sync to hidden inputs (due date and due time take precedence for deadline)
    if (hiddenDate) hiddenDate.value = formSelectedDueDate || formSelectedStartDate;
    if (hiddenTime) hiddenTime.value = formSelectedDueTime || formSelectedStartTime;

    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayYMD = formatYMD(new Date());

    // Start Date Pill
    if (pillStartDate) {
      if (formSelectedStartDate) {
        const dObj = new Date(formSelectedStartDate);
        const isToday = formSelectedStartDate === todayYMD;
        pillStartDate.textContent = isToday ? "Today" : days[dObj.getDay()] || formSelectedStartDate;
        if (clearStartDateBtn) clearStartDateBtn.style.display = "inline";
        if (startTimePart) startTimePart.classList.add("visible");
      } else {
        pillStartDate.textContent = "Start date";
        if (clearStartDateBtn) clearStartDateBtn.style.display = "none";
        if (startTimePart) startTimePart.classList.remove("visible");
      }
    }

    if (pillStartTime) {
      if (formSelectedStartTime) {
        pillStartTime.textContent = formSelectedStartTime;
        if (clearStartTimeBtn) clearStartTimeBtn.style.display = "inline";
      } else {
        pillStartTime.textContent = "Add time";
        if (clearStartTimeBtn) clearStartTimeBtn.style.display = "none";
      }
    }

    // Due Date Pill
    if (pillDueDate) {
      if (formSelectedDueDate) {
        const dObj = new Date(formSelectedDueDate);
        const isToday = formSelectedDueDate === todayYMD;
        pillDueDate.textContent = isToday ? "Today" : days[dObj.getDay()] || formSelectedDueDate;
        if (clearDueDateBtn) clearDueDateBtn.style.display = "inline";
        if (dueTimePart) dueTimePart.classList.add("visible");
      } else {
        pillDueDate.textContent = "Due date";
        if (clearDueDateBtn) clearDueDateBtn.style.display = "none";
        if (dueTimePart) dueTimePart.classList.remove("visible");
      }
    }

    if (pillDueTime) {
      if (formSelectedDueTime) {
        pillDueTime.textContent = formSelectedDueTime;
        if (clearDueTimeBtn) clearDueTimeBtn.style.display = "inline";
      } else {
        pillDueTime.textContent = "Add time";
        if (clearDueTimeBtn) clearDueTimeBtn.style.display = "none";
      }
    }

    // Helper functions for ClickUp style formatting
    const daysAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthsAbbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    function formatClickUpDate(dStr) {
      if (!dStr) return "";
      if (dStr === todayYMD) return "Today";
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      if (dStr === formatYMD(tmrw)) return "Tomorrow";

      const dObj = new Date(dStr);
      if (isNaN(dObj.getTime())) return dStr;

      const diffDays = Math.round((dObj.getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
      // Within the upcoming week (2 to 6 days away), show day name like 'Wed'
      if (diffDays > 0 && diffDays < 7) {
        return daysAbbr[dObj.getDay()];
      }
      // Otherwise show day + month like '25 Aug'
      return `${dObj.getDate()} ${monthsAbbr[dObj.getMonth()]}`;
    }

    function formatClickUpTime(timeStr) {
      if (!timeStr) return "";
      const parts = timeStr.split(":");
      if (parts.length < 2) return timeStr;
      let hour = parseInt(parts[0], 10);
      const min = parseInt(parts[1], 10);
      const ampm = hour >= 12 ? "pm" : "am";
      hour = hour % 12;
      hour = hour ? hour : 12; // 0 becomes 12
      const minStr = min === 0 ? "" : `:${String(min).padStart(2, "0")}`;
      return `${hour}${minStr}${ampm}`;
    }

    // Main Trigger Button Display
    if (mainText) {
      if (formSelectedStartDate || formSelectedDueDate || formSelectedDueTime || formSelectedStartTime) {
        let startPart = "";
        if (formSelectedStartDate) {
          startPart = formatClickUpDate(formSelectedStartDate);
          if (formSelectedStartTime) {
            startPart += `, ${formatClickUpTime(formSelectedStartTime)}`;
          }
        } else if (formSelectedStartTime) {
          startPart = formatClickUpTime(formSelectedStartTime);
        }

        let duePart = "";
        if (formSelectedDueDate) {
          duePart = formatClickUpDate(formSelectedDueDate);
          if (formSelectedDueTime) {
            duePart += `, ${formatClickUpTime(formSelectedDueTime)}`;
          }
        } else if (formSelectedDueTime) {
          duePart = formatClickUpTime(formSelectedDueTime);
        }

        let label = "";
        if (startPart && duePart) {
          label = `${startPart} - ${duePart}`;
        } else if (startPart) {
          label = startPart;
        } else if (duePart) {
          label = duePart;
        }

        mainText.textContent = label;
        mainText.classList.remove("placeholder");
        if (clockIcon) clockIcon.style.display = (formSelectedStartTime || formSelectedDueTime) ? "inline" : "none";
      } else {
        mainText.textContent = "Add deadline...";
        mainText.classList.add("placeholder");
        if (clockIcon) clockIcon.style.display = "none";
      }
    }
  }

  renderCalendar();
  updatePickerDisplay();
}

function setupRecurringControls(initialRecur) {
  const grid = el("dgQuestRecurDaysGrid");
  const everydayBtn = el("dgQuestRecurEverydayBtn");
  const intervalInput = el("dgQuestRecurInterval");
  const unitSelect = el("dgQuestRecurUnit");
  const recurCheckbox = el("dgQuestRecurCheckbox");
  const recurControls = el("dgQuestRecurControls");
  const weeklyWrap = el("dgQuestRecurWeeklyWrap");

  if (!grid || !everydayBtn) return;

  const isEnabled = initialRecur !== null && initialRecur !== false;
  if (recurCheckbox) {
    recurCheckbox.checked = isEnabled;
  }

  function syncRecurEnabledState() {
    const enabled = recurCheckbox ? recurCheckbox.checked : true;
    if (recurControls) {
      recurControls.style.opacity = enabled ? "1" : "0.35";
      recurControls.style.pointerEvents = enabled ? "auto" : "none";
    }
    if (weeklyWrap) {
      weeklyWrap.style.opacity = enabled ? "1" : "0.35";
      weeklyWrap.style.pointerEvents = enabled ? "auto" : "none";
    }
  }

  if (recurCheckbox) {
    recurCheckbox.onchange = () => {
      syncRecurEnabledState();
    };
  }

  if (initialRecur && typeof initialRecur === "object") {
    if (initialRecur.interval) intervalInput.value = initialRecur.interval;
    if (initialRecur.unit) unitSelect.value = initialRecur.unit === "day" ? "day" : initialRecur.unit === "month" ? "month" : "week";
    if (Array.isArray(initialRecur.weekdays) && initialRecur.weekdays.length) {
      formSelectedWeekdays = initialRecur.weekdays.map(Number);
    } else if (Array.isArray(initialRecur.days) && initialRecur.days.length) {
      formSelectedWeekdays = initialRecur.days.map(Number);
    } else {
      formSelectedWeekdays = [0, 1, 2, 3, 4, 5, 6];
    }
  } else {
    intervalInput.value = 1;
    unitSelect.value = "week";
    formSelectedWeekdays = [0, 1, 2, 3, 4, 5, 6];
  }

  function renderRecurringUI() {
    grid.querySelectorAll(".dg-quest-recur-day").forEach((btn) => {
      const day = Number(btn.dataset.day);
      btn.classList.toggle("active", formSelectedWeekdays.includes(day));
    });
    everydayBtn.classList.toggle("active", formSelectedWeekdays.length === 7);
  }

  grid.querySelectorAll(".dg-quest-recur-day").forEach((btn) => {
    btn.onclick = (e) => {
      e.preventDefault();
      const day = Number(btn.dataset.day);
      const idx = formSelectedWeekdays.indexOf(day);
      if (idx !== -1) {
        formSelectedWeekdays.splice(idx, 1);
      } else {
        formSelectedWeekdays.push(day);
      }
      renderRecurringUI();
    };
  });

  everydayBtn.onclick = (e) => {
    e.preventDefault();
    if (formSelectedWeekdays.length === 7) {
      formSelectedWeekdays = [];
    } else {
      formSelectedWeekdays = [0, 1, 2, 3, 4, 5, 6];
    }
    renderRecurringUI();
  };

  renderRecurringUI();
  syncRecurEnabledState();
}

export function openQuestForm(mode, task, refs, tab) {
  const isEdit = mode === "edit";
  const isDaily = tab === "daily";

  el("dgQuestFormTitle").textContent = isEdit
    ? isDaily
      ? "Edit Daily"
      : "Edit Quest"
    : isDaily
      ? "Add New Daily"
      : "Add New Quest";
  el("dgQuestFormSubtitle").textContent = isDaily
    ? "Lengkapi detail daily di bawah ini"
    : "Lengkapi detail quest di bawah ini";
  el("dgQuestFormSubmit").textContent = isEdit ? "Save Changes" : "Create Quest";

  // Hide or show Due Date vs Recurring Section
  const dueDateWrapper = el("dgQuestDueDateWrapper");
  if (dueDateWrapper) {
    dueDateWrapper.style.display = isDaily ? "none" : "block";
  }
  const recurSection = el("dgQuestRecurSection");
  if (recurSection) {
    recurSection.style.display = isDaily ? "block" : "none";
  }

  // Populate departments
  const defaultDepts = ["happy", "rebuy", "team", "branding", "closing"];
  const seenDepts = {};
  let deptOptions = '<option value="">Select Department</option>';
  defaultDepts.forEach((dKey) => {
    deptOptions += `<option value="${escapeHtml(dKey)}">${escapeHtml(dKey)}</option>`;
    seenDepts[dKey.toLowerCase()] = true;
  });
  (refs.departments || []).forEach((d) => {
    const key = String(d.name || d.id).toLowerCase();
    if (!seenDepts[key]) {
      deptOptions += `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`;
      seenDepts[key] = true;
    }
  });
  el("dgQuestDeptSelect").innerHTML = deptOptions;

  const initialDept = isEdit && task && task.deptId
    ? task.deptId
    : (refs.userDept || "");
  el("dgQuestDeptSelect").value = initialDept;

  populatePositionsForDept(
    initialDept,
    isEdit && task && task.posId ? task.posId : "",
    refs.positions || [],
  );

  el("dgQuestDeptSelect").onchange = (e) => {
    populatePositionsForDept(e.target.value, "", refs.positions || []);
    if (typeof window.__dgFilterAssignList__ === "function") {
      const searchInput = el("dgQuestAssignSearch");
      window.__dgFilterAssignList__(searchInput ? searchInput.value : "");
    }
    if (typeof window.__dgSyncFormLockState__ === "function") {
      window.__dgSyncFormLockState__();
    }
  };

  el("dgQuestPosSelect").onchange = () => {
    if (typeof window.__dgFilterAssignList__ === "function") {
      const searchInput = el("dgQuestAssignSearch");
      window.__dgFilterAssignList__(searchInput ? searchInput.value : "");
    }
    if (typeof window.__dgSyncFormLockState__ === "function") {
      window.__dgSyncFormLockState__();
    }
  };

  // Populate native hidden select & custom user selector (include all users including current user)
  const currentUserId = refs.currentUserId || "";
  const uniqueUsers = [];
  const seenUserIds = new Set();

  (refs.users || []).forEach((u) => {
    if (!u || !u.id) return;
    if (seenUserIds.has(u.id)) return;
    seenUserIds.add(u.id);
    uniqueUsers.push(u);
  });

  el("dgQuestAssignSelect").innerHTML = uniqueUsers
    .map(
      (u) =>
        `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name || u.email || u.id)}</option>`,
    )
    .join("");

  // Populate custom user selector — for new tasks, default assign to the logged-in user!
  if (isEdit && task && task.assign_to) {
    formSelectedUserIds = Array.isArray(task.assign_to) ? task.assign_to.slice() : [task.assign_to];
  } else {
    formSelectedUserIds = currentUserId ? [currentUserId] : [];
  }
  setupAssignSelector(uniqueUsers);
  updateAssignSelectedUI();

  // Populate Report To selector (supervisors / managers / any team member)
  const allUsersForReport = (refs.users || []).slice();
  el("dgQuestReportToSelect").innerHTML = allUsersForReport
    .map(
      (u) =>
        `<option value="${escapeHtml(u.id)}">${escapeHtml(u.name || u.email || u.id)}</option>`,
    )
    .join("");

  if (isEdit && task && task.report_to) {
    formSelectedReportToIds = Array.isArray(task.report_to) ? task.report_to.slice() : [task.report_to];
  } else {
    formSelectedReportToIds = [];
  }
  setupReportToSelector(allUsersForReport);
  updateReportToSelectedUI();

  // Setup ClickUp Style Due Date & Time Picker (Supports Start Date/Time & Due Date/Time)
  const initialStartDate = isEdit && task ? (task.start_date || (task.startDate ? String(task.startDate).slice(0, 10) : "")) : "";
  const initialStartTime = isEdit && task ? (task.start_time || task.startTime || "") : "";
  const initialDueDate = isEdit && task ? (task.due_date ? String(task.due_date).slice(0, 10) : "") : "";
  const initialDueTime = isEdit && task ? (task.deadline_time || task.due_time || "") : "";

  setupDueDatePicker(
    initialStartDate,
    initialStartTime,
    initialDueDate,
    initialDueTime,
  );

  // Setup Recurring Controls
  setupRecurringControls(isEdit && task ? task.recur : null);

  // Setup Rich Text Editor for Description
  const descWrap = el("dgQuestDescEditorContainer");
  if (descWrap && !questDescEditorInstance) {
    questDescEditorInstance = createRichEditor(descWrap, {
      placeholder: "Add a description for this quest...",
      disabled: false,
    });
    questDescEditorInstance?.on("input", () => {
      if (typeof window.__dgSyncFormLockState__ === "function") {
        window.__dgSyncFormLockState__();
      }
    });
  }

  // Fill values
  el("dgQuestFormId").value = isEdit && task ? task.id : "";
  el("dgQuestNameInput").value = isEdit && task ? task.title || "" : "";
  
  const initialDesc = isEdit && task ? (task.description || "") : "";
  if (questDescEditorInstance) {
    questDescEditorInstance.setHTML(initialDesc);
  }
  if (el("dgQuestDescEditor")) {
    el("dgQuestDescEditor").value = initialDesc;
  }

  el("dgQuestDeptSelect").value =
    isEdit && task && task.deptId ? task.deptId : "";
  el("dgQuestPosSelect").value = isEdit && task && task.posId ? task.posId : "";
  el("dgQuestDeadlineTime").value =
    isEdit && task ? task.deadline_time || "" : "";
  el("dgQuestPointSelect").value =
    isEdit && task && task.points ? String(task.points) : "";
  el("dgQuestPrioritySelect").value =
    isEdit && task && task.priority ? task.priority : "";
  el("dgQuestTagsInput").value =
    isEdit && task && task.tags ? task.tags.join(", ") : "";
  el("dgQuestDueDate").value =
    isEdit && task && task.due_date ? String(task.due_date).slice(0, 10) : "";

  // Step-by-step cascading progression:
  // 1. Title must be filled -> unlocks Description
  // 2. Description must be filled -> unlocks Department
  // 3. Department must be selected -> unlocks Position
  // 4. Position must be selected -> unlocks Assign To
  // 5. Assign To must have at least 1 user -> unlocks Report To
  // 6. Report To must have at least 1 user -> unlocks Deadline, Task Point, Urgent & Recurring / Due Date
  function syncFormLockState() {
    const isEditing = isEdit && Boolean(task && task.id);

    const titleVal = String(el("dgQuestNameInput")?.value || "").trim();
    const hasTitle = isEditing || titleVal.length > 0;

    const descText = questDescEditorInstance ? questDescEditorInstance.getText().trim() : "";
    const descHtml = questDescEditorInstance ? questDescEditorInstance.getHTML().trim() : "";
    const hasDesc = isEditing || (hasTitle && (descText.length > 0 || descHtml.length > 0));

    const deptVal = String(el("dgQuestDeptSelect")?.value || "").trim();
    const hasDept = isEditing || (hasDesc && deptVal.length > 0);

    const posVal = String(el("dgQuestPosSelect")?.value || "").trim();
    const hasPos = isEditing || (hasDept && posVal.length > 0);

    const hasAssign = isEditing || (hasPos && formSelectedUserIds.length > 0);
    const hasReport = isEditing || (hasAssign && formSelectedReportToIds.length > 0);

    // Elements
    const deptEl = el("dgQuestDeptSelect");
    const posEl = el("dgQuestPosSelect");
    const assignCtrl = el("dgQuestAssignControl");
    const reportCtrl = el("dgQuestReportToControl");
    const dueBtn = el("dgQuestDuePickerBtn");
    const pointEl = el("dgQuestPointSelect");
    const prioEl = el("dgQuestPrioritySelect");
    const tagsEl = el("dgQuestTagsInput");
    const recurCard = document.querySelector("#dgQuestRecurSection .dg-quest-recur-card");

    if (questDescEditorInstance) {
      questDescEditorInstance.setDisabled(!hasTitle);
    }
    if (deptEl) deptEl.disabled = !hasDesc;
    if (posEl) posEl.disabled = !hasDept;

    if (assignCtrl) {
      if (hasPos) assignCtrl.classList.remove("dg-quest-control-disabled");
      else assignCtrl.classList.add("dg-quest-control-disabled");
    }

    if (reportCtrl) {
      if (hasAssign) reportCtrl.classList.remove("dg-quest-control-disabled");
      else reportCtrl.classList.add("dg-quest-control-disabled");
    }

    if (dueBtn) {
      if (hasReport) dueBtn.classList.remove("dg-quest-control-disabled");
      else dueBtn.classList.add("dg-quest-control-disabled");
    }

    if (pointEl) pointEl.disabled = !hasReport;
    if (prioEl) prioEl.disabled = !hasReport;
    if (tagsEl) tagsEl.disabled = !hasReport;

    if (recurCard) {
      if (hasReport) recurCard.classList.remove("dg-quest-card-disabled");
      else recurCard.classList.add("dg-quest-card-disabled");
    }
  }

  window.__dgSyncFormLockState__ = syncFormLockState;

  const nameInput = el("dgQuestNameInput");
  if (nameInput) nameInput.oninput = syncFormLockState;

  syncFormLockState();

  openSubModal("dgQuestFormModal");
}

export function closeQuestForm() {
  closeSubModal("dgQuestFormModal");
}

export function readQuestForm(tab) {
  const dept = el("dgQuestDeptSelect").value;
  const pos = el("dgQuestPosSelect").value;
  const isDaily = tab === "daily";

  let recurPayload = null;
  const isRecurActive = el("dgQuestRecurCheckbox") ? el("dgQuestRecurCheckbox").checked : true;
  if (isDaily && isRecurActive) {
    const interval = parseInt(el("dgQuestRecurInterval")?.value, 10) || 1;
    const unit = el("dgQuestRecurUnit")?.value || "week";
    recurPayload = {
      frequency: unit === "day" ? "daily" : unit === "month" ? "monthly" : "weekly",
      unit: unit,
      interval: interval,
      weekdays: formSelectedWeekdays.slice(),
    };
  }

  return {
    id: el("dgQuestFormId").value,
    title: el("dgQuestNameInput").value.trim(),
    description: questDescEditorInstance
      ? questDescEditorInstance.getHTML().trim()
      : (el("dgQuestDescEditor")?.value || "").trim(),
    deptId: dept,
    posId: pos,
    deptName: el("dgQuestDeptSelect").selectedOptions[0]?.text || "",
    posName: el("dgQuestPosSelect").selectedOptions[0]?.text || "",
    assignTo: formSelectedUserIds.slice(),
    reportTo: formSelectedReportToIds.slice(),
    start_date: formSelectedStartDate || "",
    start_time: formSelectedStartTime || "",
    due_date: formSelectedDueDate || el("dgQuestDueDate").value || "",
    due_time: formSelectedDueTime || "",
    deadline_time: formSelectedDueTime || el("dgQuestDeadlineTime").value || formSelectedStartTime || "",
    points: parseInt(el("dgQuestPointSelect").value, 10) || 0,
    priority: el("dgQuestPrioritySelect").value || "normal",
    tags: el("dgQuestTagsInput")
      .value.split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    type: isDaily ? "main" : "side",
    recur: recurPayload,
  };
}

/* ------------------------------------------------------------------ */
/* Detail Sub-Modal                                                    */
/* ------------------------------------------------------------------ */

export function openQuestDetail(task, ctx, tab) {
  el("dgQuestDetailTitle").textContent =
    task.title || (tab === "daily" ? "Detail Daily" : "Detail Quest");
  const body = el("dgQuestDetailBody");

  const deadlineTime = task.deadline_time || "—";
  const priority = String(task.priority || "normal").toLowerCase();
  const points = task.points || 0;
  const descHtml =
    task.description &&
    String(task.description)
      .replace(/<[^>]*>/g, "")
      .trim().length > 0
      ? task.description
      : '<em style="color:#94a3b8">Tidak ada deskripsi.</em>';
  const deptNames = (task.departments || [])
    .map((d) => d && d.name)
    .filter(Boolean);
  const posNames = (task.positions || [])
    .map((p) => p && p.name)
    .filter(Boolean);
  const tags = task.tags || [];
  const assign = getAssignList(task);

  let prioColor = "#94a3b8";
  let prioLabel = "None";
  if (priority === "urgent" || priority === "high") {
    prioColor = "#dc2626";
    prioLabel = "Urgent";
  } else if (priority === "normal" || priority === "medium") {
    prioColor = "#f59e0b";
    prioLabel = "Normal";
  } else if (priority === "low") {
    prioColor = "#16a34a";
    prioLabel = "Low";
  }
  const statusText = task.status || "Initiate";
  const statusColor = /reported|done|complete/i.test(statusText)
    ? "#16a34a"
    : "#64748b";

  let assignees = "";
  if (assign.length) {
    assignees =
      '<div class="small fw-bold text-muted mt-3 mb-1">Ditugaskan Kepada (Assign To):</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      assign
        .slice(0, 4)
        .map((uid) => {
          const u =
            ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
          const nm = u.name || u.email || uid;
          const init = nm
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0] || "")
            .join("")
            .toUpperCase();
          const inner = u.photo
            ? `<img src="${escapeHtml(u.photo)}" style="width:1.25rem;height:1.25rem;border-radius:50%;object-fit:cover" alt="" />`
            : `<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#dbeafe;color:#2563eb;font-size:0.55rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${escapeHtml(init)}</span>`;
          return `<span style="display:inline-flex;align-items:center;gap:0.4rem;border-radius:999px;border:1px solid #e2e8f0;background:#fff;padding:0.15rem 0.6rem 0.15rem 0.2rem;font-size:0.75rem">${inner} ${escapeHtml(nm)}</span>`;
        })
        .join("") +
      (assign.length > 4
        ? `<span class="dg-quest-tag">+${assign.length - 4} lainnya</span>`
        : "") +
      "</div>";
  }

  const reportToList = Array.isArray(task.report_to)
    ? task.report_to
    : task.report_to
      ? [task.report_to]
      : [];
  let reportToHtml = "";
  if (reportToList.length) {
    reportToHtml =
      '<div class="small fw-bold text-muted mt-3 mb-1">Lapor Kepada (Report To):</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      reportToList
        .slice(0, 4)
        .map((uid) => {
          const u =
            ctx.users && ctx.users[uid] ? ctx.users[uid] : { uid, name: uid };
          const nm = u.name || u.email || uid;
          const init = nm
            .split(" ")
            .slice(0, 2)
            .map((w) => w[0] || "")
            .join("")
            .toUpperCase();
          const inner = u.photo
            ? `<img src="${escapeHtml(u.photo)}" style="width:1.25rem;height:1.25rem;border-radius:50%;object-fit:cover" alt="" />`
            : `<span style="width:1.25rem;height:1.25rem;border-radius:50%;background:#fef3c7;color:#b45309;font-size:0.55rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center">${escapeHtml(init)}</span>`;
          return `<span style="display:inline-flex;align-items:center;gap:0.4rem;border-radius:999px;border:1px solid #fde68a;background:#fffbeb;padding:0.15rem 0.6rem 0.15rem 0.2rem;font-size:0.75rem">${inner} ${escapeHtml(nm)}</span>`;
        })
        .join("") +
      "</div>";
  }

  let tagsHtml = "";
  if (tags.length) {
    tagsHtml =
      '<div class="small fw-bold text-muted mt-3 mb-1">Tags:</div><div style="display:flex;flex-wrap:wrap;gap:0.4rem">' +
      tags
        .map(
          (t) => `<span class="dg-quest-tag">${escapeHtml(String(t))}</span>`,
        )
        .join("") +
      "</div>";
  }

  body.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center;">
      <span class="dg-quest-badge" style="background:${statusColor}1a;color:${statusColor}">● ${escapeHtml(statusText)}</span>
      <span class="dg-quest-badge" style="background:${prioColor}1a;color:${prioColor}"><i class="bi bi-flag"></i> ${escapeHtml(prioLabel)}</span>
      ${points > 0 ? `<span class="dg-quest-points">${points} Point</span>` : ""}
      ${task.recur ? "<span class='text-primary small fw-semibold'><i class='bi bi-arrow-repeat'></i> Berulang harian</span>" : ""}
    </div>
    <div class="row g-2 mt-2">
      <div class="col-4">
        <div class="p-2 border rounded bg-light">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;">Deadline</div>
          <div class="fw-bold small">${escapeHtml(deadlineTime)}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 border rounded bg-light">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;">Department</div>
          <div class="fw-bold small">${deptNames.length ? escapeHtml(deptNames.join(", ")) : "—"}</div>
        </div>
      </div>
      <div class="col-4">
        <div class="p-2 border rounded bg-light">
          <div class="text-muted" style="font-size:10px;text-transform:uppercase;">Position</div>
          <div class="fw-bold small">${posNames.length ? escapeHtml(posNames.join(", ")) : "—"}</div>
        </div>
      </div>
    </div>
    ${assignees}
    ${tagsHtml}
    <div class="small fw-bold text-muted mt-3 mb-1">Deskripsi / Catatan:</div>
    <div class="p-3 border rounded bg-light small dg-quest-desc-content" style="line-height:1.6">${descHtml}</div>
  `;

  openSubModal("dgQuestDetailModal");
}

export function closeQuestDetail() {
  closeSubModal("dgQuestDetailModal");
}

/* ------------------------------------------------------------------ */
/* Daily Report Sub-Modal                                              */
/* ------------------------------------------------------------------ */

export function openDailyReportModal(checkedTasks, userName) {
  const now = new Date();
  el("dgReportDateInput").value = now.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  el("dgReportNameInput").value = userName || "Intern";

  const deptSet = {};
  checkedTasks.forEach((t) => {
    (t.departments || []).forEach((d) => {
      if (d && d.name) deptSet[d.name] = true;
    });
  });
  el("dgReportDeptInput").value = Object.keys(deptSet).length
    ? Object.keys(deptSet).join(", ")
    : "—";

  const container = el("dgReportTasksContainer");
  if (!checkedTasks.length) {
    container.innerHTML =
      '<p class="dg-quest-empty-msg">Belum ada item yang dicentang. Silakan centang to-do Anda terlebih dahulu di board.</p>';
  } else {
    container.innerHTML = checkedTasks
      .map(
        (t, i) => `
        <div class="dg-quest-report-item" data-task-id="${t.id}">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
              <span class="dg-quest-report-item-title">${i + 1}. ${escapeHtml(t.title || "Untitled")}</span>
              <span class="dg-quest-report-item-points">${t.points || 0} Pt</span>
            </div>
            <textarea rows="2" class="dg-quest-report-item-detail" data-detail-for="${t.id}" placeholder="Catatan / bukti pengerjaan (opsional)..."></textarea>
          </div>
        </div>
      `,
      )
      .join("");
  }

  openSubModal("dgDailyReportModal");
}

export function closeDailyReportModal() {
  closeSubModal("dgDailyReportModal");
}

export function setReportSubmitBusy(busy, label) {
  setButtonBusy(el("dgSubmitReportBtn"), busy, label || "Mengirim...");
}

export function collectReportDetails() {
  const details = {};
  el("dgReportTasksContainer")
    ?.querySelectorAll(".dg-quest-report-item")
    .forEach((item) => {
      const id = item.getAttribute("data-task-id");
      const input = item.querySelector("[data-detail-for]");
      if (id && input) details[id] = input.value.trim();
    });
  return details;
}

export function collectCheckedIds() {
  const ids = [];
  el("dgReportTasksContainer")
    ?.querySelectorAll(".dg-quest-report-item")
    .forEach((item) => {
      ids.push(item.getAttribute("data-task-id"));
    });
  return ids;
}

/* ------------------------------------------------------------------ */
/* Feedback & Helpers                                                 */
/* ------------------------------------------------------------------ */

export function showBoardLoading() {
  [
    "dgDailyOverdueList",
    "dgDailyTodayList",
    "dgDailyUpcomingList",
    "dgQuestOverdueList",
    "dgQuestTodayList",
    "dgQuestUpcomingList",
  ].forEach((id) => {
    const node = el(id);
    if (node)
      node.innerHTML = '<p class="dg-quest-empty-msg">Memuat data...</p>';
  });
}

export function showBoardError(msg) {
  const node = el("dgDailyTodayList");
  if (node)
    node.innerHTML = `<p class="dg-quest-empty-msg text-danger">Gagal memuat: ${escapeHtml(msg)}</p>`;
}

export function notifySuccess(msg) {
  toast(msg, "success");
}

export function notifyError(msg) {
  toast(msg, "error");
}

export function closeSubModalById(modalId) {
  closeSubModal(modalId);
}

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}
