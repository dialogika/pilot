// pages/branding/content-schedule/content-schedule.ui.js
// ===================================================================
// BRANDING CONTENT SCHEDULE — UI / PRESENTATION LAYER
// Seluruh manipulasi DOM diisolasi di sini. Tidak ada akses Firestore.
// ===================================================================

// ── Utilities ────────────────────────────────────────────────────

/**
 * Mengonversi nilai tanggal Firestore Timestamp atau Date ke objek Date JS.
 * @param {*} value
 * @returns {Date|null}
 */
export function toDate(value) {
    if (!value) return null;
    if (value && typeof value.toDate === 'function') return value.toDate();
    return new Date(value);
}

/**
 * Mengubah hex color ke rgba string dengan alpha tertentu.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
    const normalized = String(hex || '#0B2B6A').replace('#', '');
    const r = parseInt(normalized.substring(0, 2), 16);
    const g = parseInt(normalized.substring(2, 4), 16);
    const b = parseInt(normalized.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Format tanggal ke Bahasa Indonesia.
 * @param {Date} date
 * @param {object} options
 * @returns {string}
 */
export function formatDateIndo(date, options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
    return date.toLocaleDateString('id-ID', options);
}

/**
 * Mendapatkan class CSS badge berdasarkan nama milestone.
 * @param {string} name
 * @returns {string}
 */
function getMilestoneBadgeClass(name) {
    if (name === 'Script Writing') return 'bg-milestone-script';
    if (name === 'Design')         return 'bg-milestone-design';
    if (name === 'Take Video')     return 'bg-milestone-take';
    if (name === 'Video Editing')  return 'bg-milestone-edit';
    if (name === 'Publish')        return 'bg-milestone-publish';
    return 'bg-milestone-other';
}

/**
 * Mendapatkan icon flag prioritas.
 * @param {string} priority
 * @returns {string} HTML string icon flag.
 */
export function getPriorityFlag(priority) {
    if (priority === 'high')   return '<i class="bi bi-flag-fill text-danger me-1"></i>';
    if (priority === 'medium') return '<i class="bi bi-flag-fill text-warning me-1"></i>';
    return '<i class="bi bi-flag-fill text-success me-1"></i>';
}

// ── Autocomplete Content Titles ───────────────────────────────────

/**
 * Mengisi datalist autocomplete dengan judul konten yang sudah ada.
 * @param {Array} contents
 */
export function populateContentTitles(contents) {
    const datalist = document.getElementById('contentTitleList');
    if (!datalist) return;
    datalist.innerHTML = '';
    const seen = new Set();
    contents.forEach(c => {
        const title = (c.title || '').trim();
        if (title && !seen.has(title)) {
            seen.add(title);
            const opt = document.createElement('option');
            opt.value = title;
            datalist.appendChild(opt);
        }
    });
}

// ── Upcoming Deadlines Notification Panel ─────────────────────────

/**
 * Menggambar panel Upcoming Deadlines berdasarkan data konten.
 * @param {Array} contents
 */
export function renderNotifications(contents) {
    const container = document.getElementById('notificationPanelContainer');
    if (!container) return;
    container.innerHTML = '';

    const now          = new Date();
    const today        = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow     = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const groups = { overdue: [], today: [], tomorrow: [], thisWeek: [] };

    contents.forEach(content => {
        if (content.status === 'completed' || content.status === 'cancelled') return;
        (content.milestones || []).forEach((milestone, idx) => {
            if (milestone.status === 'completed' || !milestone.deadline) return;
            const mDate = toDate(milestone.deadline);
            if (!mDate) return;
            const compareDate = new Date(mDate.getFullYear(), mDate.getMonth(), mDate.getDate());

            const item = {
                contentId:      content.id,
                contentTitle:   content.title,
                milestoneName:  milestone.name,
                deadline:       compareDate,
                milestoneIndex: idx,
                priority:       content.priority,
            };

            if      (compareDate < today)                                               groups.overdue.push(item);
            else if (compareDate.getTime() === today.getTime())                         groups.today.push(item);
            else if (compareDate.getTime() === tomorrow.getTime())                      groups.tomorrow.push(item);
            else if (compareDate > tomorrow && compareDate <= sevenDaysLater)           groups.thisWeek.push(item);
        });
    });

    const allGroups = [
        { title: 'Terlewat / Overdue', items: groups.overdue,   colorClass: 'border-danger text-danger bg-danger bg-opacity-10',   icon: 'bi-exclamation-octagon-fill' },
        { title: 'Hari Ini',           items: groups.today,     colorClass: 'border-warning text-warning bg-warning bg-opacity-10', icon: 'bi-exclamation-circle-fill' },
        { title: 'Besok',              items: groups.tomorrow,  colorClass: 'border-primary text-primary bg-primary bg-opacity-10', icon: 'bi-info-circle-fill' },
        { title: 'Minggu Ini',         items: groups.thisWeek,  colorClass: 'border-info text-info bg-info bg-opacity-10',          icon: 'bi-calendar-event' },
    ];

    let hasNotification = false;
    allGroups.forEach(group => {
        if (group.items.length === 0) return;
        hasNotification = true;

        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-3';
        col.innerHTML = `
            <div class="card notification-card h-100 ${group.colorClass}">
                <div class="card-body p-3">
                    <h6 class="fw-bold mb-2 small d-flex align-items-center">
                        <i class="bi ${group.icon} me-2"></i>${group.title}
                    </h6>
                    <div class="d-flex flex-column gap-2">
                        ${group.items.map(item => `
                            <div class="d-flex justify-content-between align-items-start border-bottom border-secondary border-opacity-10 pb-1 mb-1">
                                <div class="small">
                                    <span class="fw-bold d-block">${getPriorityFlag(item.priority)}${item.milestoneName}</span>
                                    <span class="text-muted d-block" style="font-size:0.75rem">${item.contentTitle}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(col);
    });

    if (!hasNotification) {
        container.innerHTML = `
            <div class="col-12 text-center text-muted py-3">
                <i class="bi bi-check-circle text-success me-2"></i>Semua timeline berjalan lancar, tidak ada deadline terdekat.
            </div>
        `;
    }
}

// ── Calendar ──────────────────────────────────────────────────────

/**
 * Menggambar grid kalender bulanan.
 * @param {Date}     activeDate
 * @param {Array}    contents
 * @param {Array}    dutySchedules
 * @param {function} onDateClick    Callback(date) saat tanggal diklik.
 */
export function renderCalendar(activeDate, contents, dutySchedules, onDateClick) {
    const monthDisplay = document.getElementById('currentMonthYear');
    if (monthDisplay) {
        monthDisplay.textContent = activeDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    const grid = document.getElementById('calendarDaysGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const year  = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const firstDayIndex  = new Date(year, month, 1).getDay();
    const daysInMonth    = new Date(year, month + 1, 0).getDate();
    const prevMonthDays  = new Date(year, month, 0).getDate();

    // Padding bulan sebelumnya
    for (let i = firstDayIndex; i > 0; i--) {
        const dayNum = prevMonthDays - i + 1;
        const cell   = document.createElement('div');
        cell.className = 'calendar-day-cell text-muted bg-light opacity-50';
        cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
        grid.appendChild(cell);
    }

    const today = new Date();

    // Hari-hari bulan ini
    for (let i = 1; i <= daysInMonth; i++) {
        const cellDate = new Date(year, month, i);
        const isToday  = cellDate.toDateString() === today.toDateString();

        const cell = document.createElement('div');
        cell.className = `calendar-day-cell${isToday ? ' today' : ''}`;
        cell.innerHTML = `<span class="day-number">${i}</span><div class="calendar-dots-container"></div>`;

        const dotsContainer = cell.querySelector('.calendar-dots-container');

        // Badge milestone konten
        contents.forEach(content => {
            (content.milestones || []).forEach(milestone => {
                if (!milestone.deadline) return;
                const mDate = toDate(milestone.deadline);
                if (!mDate || mDate.toDateString() !== cellDate.toDateString()) return;

                const badge = document.createElement('span');
                badge.className = `milestone-badge ${getMilestoneBadgeClass(milestone.name)}`;
                badge.innerHTML = `${getPriorityFlag(content.priority)}${milestone.name}: ${content.title}`;
                if (milestone.status === 'completed') {
                    badge.style.textDecoration = 'line-through';
                    badge.style.opacity = '0.6';
                    badge.innerHTML += ' ✓';
                }
                dotsContainer.appendChild(badge);
            });
        });

        // Badge piket/duty dari duty_schedules (grouped by type)
        const dailyDuty = getDutyAssignmentsByDate(cellDate, dutySchedules);
        const typeGroups = {};
        dailyDuty.forEach(item => {
            const key = item.schedule.type_id || item.schedule.type_name || 'piket';
            if (!typeGroups[key]) {
                typeGroups[key] = {
                    type_name:    item.schedule.type_name || 'Piket',
                    color:        item.schedule.type_color || '#0B2B6A',
                    count:        0,
                    hasCompleted: false,
                };
            }
            typeGroups[key].count++;
            if (item.assignment.status === 'completed') typeGroups[key].hasCompleted = true;
        });

        Object.values(typeGroups).forEach(group => {
            const badge = document.createElement('span');
            badge.className = 'milestone-badge';
            badge.style.backgroundColor = hexToRgba(group.color, 0.12);
            badge.style.color           = group.color;
            badge.style.border          = `1px solid ${group.color}`;
            badge.innerHTML = `<i class="bi bi-person-fill me-1"></i>${group.type_name}${group.count > 1 ? `(${group.count})` : ''}`;
            if (group.hasCompleted) {
                badge.style.textDecoration = 'line-through';
                badge.style.opacity = '0.6';
                badge.innerHTML += ' ✓';
            }
            dotsContainer.appendChild(badge);
        });

        cell.addEventListener('click', () => {
            if (onDateClick) onDateClick(cellDate);
        });
        grid.appendChild(cell);
    }
}

// ── Day Details & Date Click Modal ────────────────────────────────

/**
 * Mendapatkan semua milestone deadline yang jatuh pada tanggal tertentu.
 * @param {Date}  date
 * @param {Array} contents
 * @returns {Array}
 */
export function getMilestonesByDate(date, contents) {
    const result = [];
    contents.forEach(content => {
        (content.milestones || []).forEach((milestone, idx) => {
            if (!milestone.deadline) return;
            const mDate = toDate(milestone.deadline);
            if (mDate && mDate.toDateString() === date.toDateString()) {
                result.push({ content, milestone, milestoneIndex: idx });
            }
        });
    });
    return result;
}

/**
 * Mendapatkan semua penugasan piket yang jatuh pada tanggal tertentu.
 * @param {Date}  date
 * @param {Array} dutySchedules
 * @returns {Array}
 */
export function getDutyAssignmentsByDate(date, dutySchedules) {
    const result = [];
    dutySchedules.forEach(schedule => {
        if (schedule.status === 'archived') return;
        const assignments = Array.isArray(schedule.assignments) ? schedule.assignments : [];
        assignments.forEach(item => {
            const aDate = toDate(item.assignment_date || schedule.start_date);
            if (!aDate) return;
            if (aDate.toDateString() === date.toDateString()) {
                result.push({ schedule, assignment: item });
            }
        });
    });
    return result;
}

/**
 * Memperbarui tampilan kartu jadwal hari yang dipilih di bawah kalender.
 * @param {Date|null} selectedDate
 * @param {Array}     contents
 * @param {Array}     dutySchedules
 * @param {object}    actions         { onComplete, onEdit, onDelete }
 */
export function renderSelectedDayCard(selectedDate, contents, dutySchedules, actions = {}) {
    const container = document.getElementById('selectedDayCard');
    const list      = document.getElementById('selectedDayList');
    if (!container || !list) return;

    if (!selectedDate) {
        container.classList.add('d-none');
        return;
    }

    container.classList.remove('d-none');
    const titleEl = document.getElementById('selectedDateTitle');
    if (titleEl) titleEl.textContent = `Jadwal pada tanggal: ${formatDateIndo(selectedDate)}`;

    list.innerHTML = '';

    const matchedContents = getMilestonesByDate(selectedDate, contents);
    const matchedDuties   = getDutyAssignmentsByDate(selectedDate, dutySchedules);

    if (matchedContents.length === 0 && matchedDuties.length === 0) {
        list.innerHTML = `<p class="text-muted small mb-0 text-center py-3">Tidak ada jadwal atau deadline untuk tanggal ini.</p>`;
        return;
    }

    matchedContents.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-3 border rounded-3 bg-light d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 overflow-hidden';
        div.innerHTML = `
            <div class="min-w-0 overflow-hidden" style="flex:1 1 auto; word-break:break-word">
                <span class="badge ${item.milestone.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'} mb-2">
                    ${item.milestone.status === 'completed' ? 'Selesai' : 'Pending'}
                </span>
                <h6 class="fw-bold mb-1">${getPriorityFlag(item.content.priority)}${item.content.title}</h6>
                <small class="text-muted d-block">Milestone: <strong>${item.milestone.name}</strong></small>
                <small class="text-muted d-block text-break">${item.content.description || 'Tidak ada deskripsi'}</small>
            </div>
            <div class="d-flex gap-2 flex-shrink-0">
                ${item.milestone.status !== 'completed' ? `
                    <button class="btn btn-sm btn-success rounded-pill px-3 cs-action-complete"
                        data-content-id="${item.content.id}" data-milestone-index="${item.milestoneIndex}">
                        Selesaikan
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-outline-primary rounded-pill px-3 cs-action-edit"
                    data-content-id="${item.content.id}">
                    Detail / Edit
                </button>
                <button class="btn btn-sm btn-outline-danger rounded-circle p-2 lh-1 cs-action-delete"
                    data-content-id="${item.content.id}">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `;
        _bindCardActions(div, actions);
        list.appendChild(div);
    });

    matchedDuties.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-3 border rounded-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 overflow-hidden';
        div.style.borderLeft = `5px solid ${item.schedule.type_color || '#0B2B6A'}`;
        div.innerHTML = `
            <div class="min-w-0 overflow-hidden" style="flex:1 1 auto; word-break:break-word">
                <h6 class="fw-bold mb-1">Piket: ${item.schedule.type_name || 'Tugas'}</h6>
                <small class="text-muted d-block text-break">${item.schedule.title}</small>
            </div>
            <div class="d-flex gap-2 flex-shrink-0">
                <a href="/piket-branding" class="btn btn-sm btn-outline-primary rounded-pill px-3">
                    Lihat Piket
                </a>
            </div>
        `;
        list.appendChild(div);
    });
}

/**
 * Membuka modal Date Click dan mengisi isinya.
 * @param {Date}     date
 * @param {Array}    contents
 * @param {Array}    dutySchedules
 * @param {object}   actions        { onComplete, onAddContent }
 */
export function openDateClickModal(date, contents, dutySchedules, actions = {}) {
    const titleEl  = document.getElementById('dateClickModalTitle');
    const section  = document.getElementById('dateClickDeadlinesSection');
    const list     = document.getElementById('dateClickDeadlinesList');
    if (!titleEl || !section || !list) return;

    titleEl.textContent = formatDateIndo(date);
    list.innerHTML = '';

    const matchedContents = getMilestonesByDate(date, contents);
    const matchedDuties   = getDutyAssignmentsByDate(date, dutySchedules);

    if (matchedContents.length === 0 && matchedDuties.length === 0) {
        section.classList.add('d-none');
    } else {
        section.classList.remove('d-none');

        matchedContents.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 border rounded-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 overflow-hidden';
            div.innerHTML = `
                <div class="min-w-0 overflow-hidden" style="flex:1 1 auto; word-break:break-word">
                    <span class="badge ${item.milestone.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'} mb-2">
                        ${item.milestone.status === 'completed' ? 'Selesai' : 'Pending'}
                    </span>
                    <h6 class="fw-bold mb-1">${getPriorityFlag(item.content.priority)}${item.content.title}</h6>
                    <small class="text-muted d-block">${item.milestone.name}</small>
                    ${item.content.description ? `<small class="text-muted d-block text-break">${item.content.description}</small>` : ''}
                </div>
                ${item.milestone.status !== 'completed' ? `
                    <button type="button" class="btn btn-sm btn-success rounded-pill px-3 flex-shrink-0 cs-modal-complete"
                        data-content-id="${item.content.id}" data-milestone-index="${item.milestoneIndex}">
                        Selesaikan
                    </button>
                ` : ''}
            `;
            if (actions.onComplete) {
                const btn = div.querySelector('.cs-modal-complete');
                if (btn) {
                    btn.addEventListener('click', () => {
                        actions.onComplete(item.content.id, item.milestoneIndex);
                    });
                }
            }
            list.appendChild(div);
        });

        matchedDuties.forEach(item => {
            const div = document.createElement('div');
            div.className = 'p-3 border rounded-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 overflow-hidden';
            div.style.borderColor = item.schedule.type_color || '#0B2B6A';
            div.innerHTML = `
                <div class="min-w-0 overflow-hidden" style="flex:1 1 auto; word-break:break-word">
                    <span class="badge mb-2" style="background-color: ${hexToRgba(item.schedule.type_color || '#0B2B6A', 0.12)}; color: ${item.schedule.type_color || '#0B2B6A'}">
                        PIKET
                    </span>
                    <h6 class="fw-bold mb-1">${item.schedule.type_name || 'Piket'}</h6>
                    <small class="text-muted d-block">${item.schedule.title}</small>
                </div>
                <a href="/piket-branding" class="btn btn-sm btn-outline-primary rounded-pill px-3 flex-shrink-0">
                    Lihat Detail
                </a>
            `;
            list.appendChild(div);
        });
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('dateClickModal'));
    modal.show();
}

// ── Content Modal (Add/Edit) ──────────────────────────────────────

/**
 * Membuka dan mereset form modal tambah/edit konten.
 * @param {'add'|'edit'} mode
 * @param {object|null}  content      Data konten (untuk mode 'edit').
 * @param {Date|null}    pendingDate  Tanggal awal yang sudah dipilih dari kalender.
 */
export function openContentModal(mode, content = null, pendingDate = null) {
    const titleEl    = document.getElementById('modalTitle');
    const idInput    = document.getElementById('contentId');
    const titleInput = document.getElementById('contentTitle');
    const descInput  = document.getElementById('contentDesc');
    const prioInput  = document.getElementById('contentPriority');
    const container  = document.getElementById('milestonesContainer');

    if (!titleEl || !idInput || !titleInput || !descInput || !prioInput || !container) return;

    container.innerHTML = '';

    if (mode === 'edit' && content) {
        titleEl.textContent     = 'Edit Rencana Konten';
        idInput.value           = content.id;
        titleInput.value        = content.title || '';
        descInput.value         = content.description || '';
        prioInput.value         = content.priority || 'normal';

        (content.milestones || []).forEach(m => {
            let dateStr = '';
            if (m.deadline) {
                const d = toDate(m.deadline);
                dateStr = d ? d.toISOString().split('T')[0] : '';
            }
            addMilestoneRow(container, m.name, dateStr, m.status, pendingDate);
        });
    } else {
        titleEl.textContent = 'Tambah Rencana Konten';
        idInput.value       = '';
        titleInput.value    = '';
        descInput.value     = '';
        prioInput.value     = 'normal';
        addMilestoneRow(container, '', '', 'pending', pendingDate);
    }

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('contentModal'));
    modal.show();
}

/**
 * Menambah baris milestone dinamis ke container form.
 * @param {HTMLElement} container
 * @param {string}      name
 * @param {string}      dateStr
 * @param {string}      status
 * @param {Date|null}   pendingDate
 */
export function addMilestoneRow(container, name = '', dateStr = '', status = 'pending', pendingDate = null) {
    const PRESET_NAMES = ['Script Writing', 'Design', 'Take Video', 'Video Editing', 'Publish'];
    const isCustom     = name && !PRESET_NAMES.includes(name);

    const div = document.createElement('div');
    div.className = 'row g-2 milestone-row align-items-end';
    div.innerHTML = `
        <div class="col-md-5">
            <label class="form-label small text-muted mb-1">Nama Milestone</label>
            <select class="form-select rounded-3 milestone-name" required>
                <option value="Script Writing" ${name === 'Script Writing' ? 'selected' : ''}>Script Writing</option>
                <option value="Design"         ${name === 'Design'         ? 'selected' : ''}>Design</option>
                <option value="Take Video"     ${name === 'Take Video'     ? 'selected' : ''}>Take Video</option>
                <option value="Video Editing"  ${name === 'Video Editing'  ? 'selected' : ''}>Video Editing</option>
                <option value="Publish"        ${name === 'Publish'        ? 'selected' : ''}>Publish</option>
                <option value="Lainnya"        ${isCustom                  ? 'selected' : ''}>Lainnya</option>
            </select>
            <input type="text"
                class="form-control rounded-3 mt-1 milestone-custom-name ${isCustom ? '' : 'd-none'}"
                placeholder="Nama custom..."
                value="${isCustom ? name : ''}">
        </div>
        <div class="col-md-4">
            <label class="form-label small text-muted mb-1">Tanggal Deadline</label>
            <input type="date" class="form-control rounded-3 milestone-date" value="${dateStr}" required>
        </div>
        <div class="col-md-2">
            <label class="form-label small text-muted mb-1">Status</label>
            <select class="form-select rounded-3 milestone-status">
                <option value="pending"   ${status === 'pending'   ? 'selected' : ''}>Pending</option>
                <option value="completed" ${status === 'completed' ? 'selected' : ''}>Selesai</option>
            </select>
        </div>
        <div class="col-md-1 text-end pb-1">
            <button type="button" class="btn btn-outline-danger rounded-circle p-2 lh-1 cs-remove-milestone">
                <i class="bi bi-trash"></i>
            </button>
        </div>
    `;

    // Toggle custom name input
    const selectName  = div.querySelector('.milestone-name');
    const customInput = div.querySelector('.milestone-custom-name');
    selectName.addEventListener('change', () => {
        if (selectName.value === 'Lainnya') {
            customInput.classList.remove('d-none');
            customInput.required = true;
        } else {
            customInput.classList.add('d-none');
            customInput.required = false;
        }
    });

    // Remove row
    div.querySelector('.cs-remove-milestone').addEventListener('click', () => div.remove());

    // Pre-fill pendingDate jika belum ada value
    if (pendingDate && !dateStr) {
        const d = new Date(pendingDate);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        div.querySelector('.milestone-date').value = d.toISOString().split('T')[0];
    }

    container.appendChild(div);
}

/**
 * Mengumpulkan data milestones dari form.
 * @param {HTMLElement} container
 * @returns {Array}  Array milestone objects atau null jika ada field yang tidak valid.
 */
export function collectMilestones(container) {
    const rows      = container.querySelectorAll('.milestone-row');
    const milestones = [];
    const { Timestamp } = window.__firestoreExports || {};

    for (const row of rows) {
        const selectName  = row.querySelector('.milestone-name').value;
        const customInput = row.querySelector('.milestone-custom-name').value.trim();
        const name        = selectName === 'Lainnya' ? customInput : selectName;
        const dateVal     = row.querySelector('.milestone-date').value;
        const status      = row.querySelector('.milestone-status').value;

        if (name && dateVal) {
            const d = new Date(dateVal);
            milestones.push({ name, deadline: d, status });
        }
    }
    return milestones;
}

// ── Internal Helper ───────────────────────────────────────────────

/**
 * Mengikat event listener untuk tombol aksi di kartu jadwal (selected day card).
 * @param {HTMLElement} el
 * @param {object}      actions  { onComplete, onEdit, onDelete }
 */
function _bindCardActions(el, actions) {
    const completeBtn = el.querySelector('.cs-action-complete');
    const editBtn     = el.querySelector('.cs-action-edit');
    const deleteBtn   = el.querySelector('.cs-action-delete');

    if (completeBtn && actions.onComplete) {
        completeBtn.addEventListener('click', () => {
            actions.onComplete(
                completeBtn.dataset.contentId,
                parseInt(completeBtn.dataset.milestoneIndex, 10)
            );
        });
    }
    if (editBtn && actions.onEdit) {
        editBtn.addEventListener('click', () => {
            actions.onEdit(editBtn.dataset.contentId);
        });
    }
    if (deleteBtn && actions.onDelete) {
        deleteBtn.addEventListener('click', () => {
            actions.onDelete(deleteBtn.dataset.contentId);
        });
    }
}
