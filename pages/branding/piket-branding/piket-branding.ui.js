// pages/branding/piket-branding/piket-branding.ui.js
// ================================================================
// PIKET BRANDING — UI MODULE
// Bertanggung jawab atas semua DOM rendering dan event DOM.
// Tidak boleh mengakses Firestore langsung.
// ================================================================

import {
    Timestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── DOM Element Cache ─────────────────────────────────────────────────
const els = () => ({
    scheduleList: document.getElementById('scheduleList'),
    typeFilter: document.getElementById('typeFilter'),
    periodFilter: document.getElementById('periodFilter'),
    statusFilter: document.getElementById('statusFilter'),
    searchInput: document.getElementById('searchInput'),
    scheduleForm: document.getElementById('scheduleForm'),
    scheduleType: document.getElementById('scheduleType'),
    assignmentsContainer: document.getElementById('assignmentsContainer'),
    typesList: document.getElementById('typesList'),
});

// ── Loading / Error / Empty States ───────────────────────────────────

export function showLoadingState() {
    const el = document.getElementById('scheduleList');
    if (el) {
        el.innerHTML = `
            <div class="empty-state">
                <div class="spinner-border text-primary mb-3" role="status"></div>
                <div class="fw-semibold">Memuat jadwal piket...</div>
            </div>`;
    }
}

export function showErrorState(message) {
    const el = document.getElementById('scheduleList');
    if (el) {
        el.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-exclamation-triangle text-danger fs-2 d-block mb-2"></i>
                ${escapeHtml(message || 'Gagal memuat jadwal piket.')}
            </div>`;
    }
}

// ── Type Options (filter dropdown + schedule form) ────────────────────

export function renderTypeOptions(types) {
    const e = els();
    if (!e.typeFilter || !e.scheduleType) return;

    const activeTypes = types.filter(t => t.is_active !== false);

    // Deduplikasi opsi berdasarkan slug atau nama
    const seen = new Set();
    const uniqueTypes = [];
    activeTypes.forEach(t => {
        const key = (t.slug || t.name || t.id).trim().toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTypes.push(t);
        }
    });

    e.typeFilter.innerHTML = '<option value="">Semua Jenis</option>';
    e.scheduleType.innerHTML = '<option value="" disabled selected>Pilih jenis piket</option>';

    uniqueTypes.forEach(type => {
        const opt1 = document.createElement('option');
        opt1.value = type.id;
        opt1.textContent = type.name || type.id;
        e.typeFilter.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = type.id;
        opt2.textContent = type.name || type.id;
        e.scheduleType.appendChild(opt2);
    });
}

// ── Types List (modal manajemen jenis) ────────────────────────────────

export function renderTypesList(types) {
    const el = document.getElementById('typesList');
    if (!el) return;

    if (!types.length) {
        el.innerHTML = '<div class="text-muted small">Belum ada jenis piket.</div>';
        return;
    }

    // Deduplikasi daftar jenis piket
    const seen = new Set();
    const uniqueTypes = [];
    types.forEach(t => {
        const key = (t.slug || t.name || t.id).trim().toLowerCase();
        if (!seen.has(key)) {
            seen.add(key);
            uniqueTypes.push(t);
        }
    });

    el.innerHTML = uniqueTypes.map(type => `
        <div class="type-card-row d-flex justify-content-between align-items-center gap-3">
            <div class="d-flex align-items-center gap-3">
                <div class="rounded-circle d-flex align-items-center justify-content-center text-white"
                     style="width: 38px; height: 38px; background:${escapeAttr(type.color || '#0B2B6A')}">
                    <i class="bi ${escapeAttr(type.icon || 'bi-calendar-check')}"></i>
                </div>
                <div>
                    <div class="fw-bold">${escapeHtml(type.name || 'Tanpa Nama')}</div>
                    <div class="text-muted small">${escapeHtml(type.description || 'Tidak ada deskripsi')}</div>
                </div>
            </div>
            <button class="btn btn-sm ${type.is_active === false ? 'btn-outline-success' : 'btn-outline-secondary'} rounded-pill admin-only"
                    data-toggle-type-id="${escapeAttr(type.id)}"
                    data-toggle-activate="${type.is_active === false ? 'true' : 'false'}">
                ${type.is_active === false ? 'Aktifkan' : 'Nonaktifkan'}
            </button>
        </div>
    `).join('');
}

// ── Stats ─────────────────────────────────────────────────────────────

export function updateStats(filteredSchedules, types) {
    const today = startOfDay(new Date());
    const members = new Set();
    let todayCount = 0;

    filteredSchedules.forEach(schedule => {
        const assignments = Array.isArray(schedule.assignments) ? schedule.assignments : [];
        assignments.forEach(item => {
            if (item.user_id || item.name) members.add(item.user_id || item.name);
            const date = startOfDay(toDate(item.assignment_date || schedule.start_date));
            if (date.getTime() === today.getTime()) todayCount++;
        });
    });

    // Hitung jumlah jenis unik yang aktif
    const uniqueActiveTypes = new Set(
        types.filter(t => t.is_active !== false).map(t => (t.slug || t.name || t.id).trim().toLowerCase())
    );

    setText('statToday', todayCount);
    setText('statActive', filteredSchedules.filter(s => (s.status || 'scheduled') === 'scheduled').length);
    setText('statMembers', members.size);
    setText('statTypes', uniqueActiveTypes.size);
}

// ── Schedule List ─────────────────────────────────────────────────────

export function renderSchedules(schedules, types, isAdminMode, filters) {
    const el = document.getElementById('scheduleList');
    if (!el) return;

    const filtered = getFilteredSchedules(schedules, types, filters);
    updateStats(filtered, types);

    if (!filtered.length) {
        el.innerHTML = `
            <div class="empty-state">
                <i class="bi bi-calendar2-week fs-1 text-primary d-block mb-3"></i>
                <div class="fw-bold text-dark mb-1">Belum ada jadwal piket</div>
                <div class="small">${isAdminMode
                ? 'Klik Tambah Jadwal untuk membuat jadwal baru.'
                : 'Jadwal akan muncul setelah dibuat oleh Team.'}</div>
            </div>`;
        return;
    }

    el.innerHTML = filtered.map(s => renderScheduleCard(s, types, isAdminMode)).join('');
}

// ── Schedule Card ─────────────────────────────────────────────────────

function renderScheduleCard(schedule, types, isAdminMode) {
    const type = types.find(t => t.id === schedule.type_id) || types.find(t => t.name === schedule.type_name);
    const color = type?.color || schedule.type_color || '#0B2B6A';
    const icon = type?.icon || 'bi-calendar-check';
    const assignments = Array.isArray(schedule.assignments) ? schedule.assignments : [];
    const grouped = groupAssignments(assignments);
    const groupKeys = Object.keys(grouped);
    const period = formatPeriod(schedule.start_date, schedule.end_date);
    const statusClass = schedule.status === 'completed'
        ? 'success'
        : schedule.status === 'cancelled'
            ? 'danger'
            : 'primary';

    const adminButtons = isAdminMode ? `
        <button class="btn btn-sm btn-outline-primary rounded-pill admin-only"
                data-edit-schedule="${escapeAttr(schedule.id)}">
            <i class="bi bi-pencil me-1"></i>Edit
        </button>
        <button class="btn btn-sm btn-outline-danger rounded-pill admin-only"
                data-delete-schedule="${escapeAttr(schedule.id)}">
            <i class="bi bi-trash me-1"></i>Hapus
        </button>
    ` : '';

    return `
        <article class="schedule-card">
            <div class="p-3 p-lg-4">
                <div class="d-flex gap-3">
                    <div class="schedule-type-bar" style="background:${escapeAttr(color)}"></div>
                    <div class="flex-grow-1 min-w-0">
                        <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                            <div>
                                <span class="type-pill mb-2"
                                      style="background:${hexToRgba(color, 0.12)}; color:${escapeAttr(color)}">
                                    <i class="bi ${escapeAttr(icon)}"></i>${escapeHtml(schedule.type_name || type?.name || 'Jenis Piket')}
                                </span>
                                <h5 class="fw-bold mb-1">${escapeHtml(schedule.title || 'Tanpa Judul')}</h5>
                                <div class="text-muted small">
                                    <i class="bi bi-calendar-range me-1"></i>${period}
                                </div>
                                ${schedule.description ? `<p class="text-muted small mt-2 mb-0">${escapeHtml(schedule.description)}</p>` : ''}
                            </div>
                            <div class="d-flex align-items-start gap-2 flex-wrap justify-content-lg-end">
                                <span class="badge rounded-pill text-bg-${statusClass} text-uppercase">
                                    ${escapeHtml(schedule.status || 'scheduled')}
                                </span>
                                ${adminButtons}
                            </div>
                        </div>

                        <div class="row g-3 mt-2">
                            ${groupKeys.map(key =>
        renderAssignmentGroup(key, grouped[key], color, groupKeys.length === 1)
    ).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    `;
}

function renderAssignmentGroup(dateKey, group, color, isSingleDay = false) {
    return `
        <div class="${isSingleDay ? 'col-12' : 'col-md-6 col-xl-4'}">
            <div class="assignment-card h-100 ${isSingleDay ? 'assignment-group-single' : ''}">
                <div class="fw-bold text-dark mb-3 ${isSingleDay ? 'small' : ''}">
                    <i class="bi bi-clock me-1" style="color:${escapeAttr(color)}"></i>
                    ${escapeHtml(dateKey)}
                </div>
                <div class="assignment-members">
                    ${group.map(item => renderAssignmentItem(item, color)).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderAssignmentItem(item, color) {
    const tasks = Array.isArray(item.tasks) ? item.tasks : [];
    return `
        <div class="assignment-member-item">
            <div class="d-flex align-items-center gap-2">
                <img class="member-avatar"
                     src="${escapeAttr(item.photo || `https://i.pravatar.cc/120?u=${item.user_id || item.name || 'member'}`)}"
                     alt="">
                <div>
                    <div class="fw-semibold assignment-member-name">${escapeHtml(item.name || 'Tanpa Nama')}</div>
                    ${item.role_label ? `<div class="text-muted assignment-role-label">${escapeHtml(item.role_label)}</div>` : ''}
                </div>
            </div>
            ${tasks.map(task => `
                <div class="task-bullet" style="border-color:${escapeAttr(color)}">
                    <div class="fw-semibold text-dark assignment-task-title">${escapeHtml(task.title || 'Tugas')}</div>
                    ${task.description ? `<div class="text-muted assignment-task-desc">${escapeHtml(task.description)}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

// ── Schedule Modal ────────────────────────────────────────────────────

export function openScheduleModal(schedule, users) {
    const e = els();
    if (!e.scheduleForm) return;

    e.scheduleForm.reset();
    e.assignmentsContainer.innerHTML = '';

    document.getElementById('scheduleId').value = schedule?.id || '';
    document.getElementById('scheduleModalTitle').textContent =
        schedule ? 'Edit Jadwal Piket' : 'Tambah Jadwal Piket';

    if (schedule) {
        document.getElementById('scheduleType').value = schedule.type_id || '';
        document.getElementById('scheduleTitle').value = schedule.title || '';
        document.getElementById('scheduleDescription').value = schedule.description || '';
        document.getElementById('startDate').value = toInputDate(schedule.start_date);
        document.getElementById('endDate').value = toInputDate(schedule.end_date || schedule.start_date);
        document.getElementById('scheduleStatus').value = schedule.status || 'scheduled';
        (schedule.assignments || []).forEach(item => addAssignmentRow(item, users));
    } else {
        const now = new Date();
        document.getElementById('startDate').value = toInputDate(now);
        document.getElementById('endDate').value = toInputDate(now);
        addAssignmentRow({}, users);
    }

    const modal = document.getElementById('scheduleModal');
    if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();
}

export function closeScheduleModal() {
    const modal = document.getElementById('scheduleModal');
    if (modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    }
}

export function addAssignmentRow(data = {}, users = []) {
    const e = els();
    if (!e.assignmentsContainer) return;

    const index = Date.now() + Math.floor(Math.random() * 1000);
    const div = document.createElement('div');
    div.className = 'assignment-row-form';
    div.dataset.assignmentRow = 'true';
    div.innerHTML = `
        <div class="row g-3 align-items-end mb-3">
            <div class="col-md-4">
                <label class="field-label">Anggota</label>
                <select class="form-select rounded-3 assignment-user" required>
                    <option value="" disabled selected>Pilih anggota</option>
                    ${users.map(u =>
        `<option value="${escapeAttr(u.id)}"
                                 data-name="${escapeAttr(u.name)}"
                                 data-photo="${escapeAttr(u.photo)}"
                                 ${data.user_id === u.id ? 'selected' : ''}>
                            ${escapeHtml(u.name)}
                         </option>`
    ).join('')}
                </select>
            </div>
            <div class="col-md-3">
                <label class="field-label">Tanggal Tugas</label>
                <input type="date" class="form-control rounded-3 assignment-date"
                       value="${data.assignment_date ? toInputDate(data.assignment_date) : ''}">
            </div>
            <div class="col-md-3">
                <label class="field-label">Role/PIC</label>
                <input type="text" class="form-control rounded-3 assignment-role"
                       placeholder="Optional" value="${escapeAttr(data.role_label || '')}">
            </div>
            <div class="col-md-2 text-md-end">
                <button type="button" class="btn btn-outline-danger rounded-pill w-100"
                        onclick="this.closest('[data-assignment-row]').remove()">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
        <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="small fw-bold text-muted">Daftar Tugas</span>
            <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill"
                    data-add-task="${index}">
                <i class="bi bi-plus me-1"></i>Tambah Tugas
            </button>
        </div>
        <div class="d-flex flex-column gap-2 assignment-tasks"></div>
    `;

    e.assignmentsContainer.appendChild(div);
    const tasksWrap = div.querySelector('.assignment-tasks');
    const existingTasks = Array.isArray(data.tasks) && data.tasks.length
        ? data.tasks
        : [{ title: '', description: '' }];
    existingTasks.forEach(task => addTaskRow(tasksWrap, task));
    div.querySelector('[data-add-task]').addEventListener('click', () => addTaskRow(tasksWrap));
}

function addTaskRow(container, data = {}) {
    const div = document.createElement('div');
    div.className = 'task-row-form';
    div.innerHTML = `
        <div class="row g-2 align-items-start">
            <div class="col-md-4">
                <input type="text" class="form-control rounded-3 task-title"
                       placeholder="Nama tugas (opsional)" value="${escapeAttr(data.title || '')}">
            </div>
            <div class="col-md-7">
                <input type="text" class="form-control rounded-3 task-desc"
                       placeholder="Deskripsi tugas" value="${escapeAttr(data.description || '')}">
            </div>
            <div class="col-md-1 text-end">
                <button type="button" class="btn btn-light border rounded-circle"
                        onclick="this.closest('.task-row-form').remove()">
                    <i class="bi bi-x"></i>
                </button>
            </div>
        </div>
    `;
    container.appendChild(div);
}

/**
 * Kumpulkan semua data assignment dari form DOM.
 */
export function collectAssignments(defaultDate) {
    const rows = Array.from(document.querySelectorAll('[data-assignment-row]'));
    return rows.map(row => {
        const userSelect = row.querySelector('.assignment-user');
        const opt = userSelect.options[userSelect.selectedIndex];
        const dateValue = row.querySelector('.assignment-date').value || defaultDate;
        const tasks = Array.from(row.querySelectorAll('.task-row-form')).map(taskRow => ({
            title: taskRow.querySelector('.task-title').value.trim(),
            description: taskRow.querySelector('.task-desc').value.trim(),
            status: 'pending',
        })).filter(task => task.title);

        if (!userSelect.value) return null;

        return {
            assignment_date: Timestamp.fromDate(new Date(dateValue)),
            day_label: new Date(dateValue).toLocaleDateString('id-ID', { weekday: 'long' }),
            user_id: userSelect.value,
            name: opt?.dataset.name || opt?.textContent || '',
            photo: opt?.dataset.photo || '',
            role_label: row.querySelector('.assignment-role').value.trim(),
            tasks,
        };
    }).filter(Boolean);
}

// ── Filters ───────────────────────────────────────────────────────────

export function getFilters() {
    const e = els();
    return {
        type: e.typeFilter?.value || '',
        status: e.statusFilter?.value || '',
        period: e.periodFilter?.value || 'week',
        search: e.searchInput?.value.trim().toLowerCase() || '',
    };
}

// ── Internal Helpers ──────────────────────────────────────────────────

function getFilteredSchedules(schedules, types, filters) {
    const range = getPeriodRange(filters.period);
    const selectedType = Array.isArray(types) && filters.type ? types.find(t => t.id === filters.type) : null;
    return schedules.filter(s => {
        if (s.status === 'archived') return false;
        if (filters.type) {
            const matchesId = s.type_id === filters.type;
            const matchesName = Boolean(selectedType?.name && s.type_name === selectedType.name);
            if (!matchesId && !matchesName) return false;
        }
        if (filters.status && s.status !== filters.status) return false;
        if (range && !isRangeOverlap(toDate(s.start_date), toDate(s.end_date), range.start, range.end)) return false;
        if (filters.search && !scheduleMatchesSearch(s, filters.search)) return false;
        return true;
    }).sort((a, b) => toDate(a.start_date) - toDate(b.start_date));
}

function scheduleMatchesSearch(schedule, search) {
    const text = [
        schedule.title, schedule.description, schedule.type_name, schedule.period_label,
        ...(schedule.assignments || []).flatMap(item =>
            [item.name, item.role_label, ...(item.tasks || []).flatMap(t => [t.title, t.description])]
        ),
    ].filter(Boolean).join(' ').toLowerCase();
    return text.includes(search);
}

function groupAssignments(assignments) {
    const grouped = {};
    assignments.forEach(item => {
        const label = item.assignment_date ? formatFullDate(item.assignment_date) : 'Tanggal utama';
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(item);
    });
    return grouped;
}

function getPeriodRange(period) {
    const now = new Date();
    if (period === 'all') return null;
    if (period === 'today') return { start: startOfDay(now), end: endOfDay(now) };
    if (period === 'week') {
        const day = now.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff));
        const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6));
        return { start, end };
    }
    if (period === 'month') {
        return {
            start: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
            end: endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
        };
    }
    return null;
}

function isRangeOverlap(startA, endA, startB, endB) {
    if (!startA || !endA) return false;
    return startA <= endB && endA >= startB;
}

// ── Date Utilities ────────────────────────────────────────────────────

export function toDate(value) {
    if (!value) return new Date();
    if (value.toDate) return value.toDate();
    return new Date(value);
}

export function toInputDate(value) {
    const d = toDate(value);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
}

export function formatFullDate(value) {
    return toDate(value).toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
}

export function formatPeriod(start, end) {
    const s = toDate(start);
    const e = toDate(end || start);
    if (s.toDateString() === e.toDateString()) return formatFullDate(s);
    return `${s.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} – ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

export function formatPeriodLabel(startValue, endValue) {
    const s = new Date(startValue);
    const e = new Date(endValue);
    if (s.toDateString() === e.toDateString())
        return s.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${s.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} – ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

// ── HTML Escape Utilities ─────────────────────────────────────────────

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])
    );
}

export function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
}

export function hexToRgba(hex, alpha) {
    const normalized = String(hex || '#0B2B6A').replace('#', '');
    const bigint = parseInt(
        normalized.length === 3
            ? normalized.split('').map(c => c + c).join('')
            : normalized,
        16,
    );
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function slugify(text) {
    return String(text || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Small DOM Helper ──────────────────────────────────────────────────
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}
