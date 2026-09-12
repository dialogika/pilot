// pages/branding/piket-branding/piket-branding.js
// ================================================================
// PIKET BRANDING — ORCHESTRATOR
// Koordinasi: auth → shell → repository → UI → events → cleanup
// ================================================================

import { requireAuth }  from '../../../assets/js/auth-guard.js';
import { renderTopbar } from '../../../assets/js/components/topbar/topbar.js';
import { renderSidebar } from '../../../assets/js/components/sidebar/sidebar.js';
import * as repo from './piket-branding.repository.js';
import * as ui   from './piket-branding.ui.js';
import {
    Timestamp,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Default Types (hanya digunakan jika duty_types kosong) ────────────
const DEFAULT_TYPES = [
    {
        name: 'Webinar',
        slug: 'webinar',
        color: '#7204cf',
        icon: 'bi-camera-video',
        description: 'Piket untuk persiapan dan pelaksanaan webinar',
        default_tasks: ['Reminder di webinar', 'Admin Google Form', 'Announcement di groupchat', 'Pendataan pertanyaan', 'Pendataan peserta webinar', 'Live report'],
        is_active: true,
    },
    {
        name: 'Live Report',
        slug: 'live-report',
        color: '#0B2B6A',
        icon: 'bi-broadcast',
        description: 'Piket pelaporan aktivitas dan dokumentasi harian',
        default_tasks: ['Live report', 'Upload dokumentasi', 'Rekap aktivitas'],
        is_active: true,
    },
    {
        name: 'Boost Community Discord',
        slug: 'boost-community-discord',
        color: '#f97316',
        icon: 'bi-discord',
        description: 'Piket untuk menjaga engagement community Discord',
        default_tasks: ['Aktifkan diskusi Discord', 'Reply member', 'Naikkan engagement channel'],
        is_active: true,
    },
];

// ── Application State ─────────────────────────────────────────────────
let currentUser    = null;
let currentUserDoc = null;
let isAdminMode    = false;
let dutyTypes      = [];
let schedules      = [];
let users          = [];
let isSeeding      = false;

let unsubTypes     = null;
let unsubSchedules = null;

// ── Access Mode ───────────────────────────────────────────────────────

function applyAccessMode() {
    const access        = currentUserDoc.access || {};
    const rawRole       = currentUserDoc.role || currentUserDoc.role_id || access.role || access.role_id || currentUserDoc.roleName || access.roleName || '';
    const roleValue     = String(rawRole || '').trim().toLowerCase();
    const positionValue = String(currentUserDoc.position || currentUserDoc.employment?.position || '').trim().toLowerCase();
    const isIntern      = ['intern', 'internship', 'magang'].includes(roleValue) || ['intern', 'internship', 'magang'].includes(positionValue);
    isAdminMode         = !isIntern;

    document.body.classList.toggle('viewer-mode', !isAdminMode);
    document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.toggle('viewer-hidden', !isAdminMode);
    });

    const subtitle = document.getElementById('heroSubtitle');
    if (subtitle) {
        subtitle.textContent = 'Lihat jadwal piket, anggota yang bertugas, dan deskripsi tugas masing-masing.';
    }
}

// ── Rendering ─────────────────────────────────────────────────────────

function renderAll() {
    ui.renderTypeOptions(dutyTypes);
    ui.renderTypesList(dutyTypes);
    ui.renderSchedules(schedules, dutyTypes, isAdminMode, ui.getFilters());
}

// ── Real-time Listeners ───────────────────────────────────────────────

function startListeners() {
    if (unsubTypes)     unsubTypes();
    if (unsubSchedules) unsubSchedules();

    unsubTypes = repo.subscribeTypes(
        async (types) => {
            dutyTypes = types;

            // Seed default types hanya jika koleksi benar-benar kosong dan user adalah admin
            if (!dutyTypes.length && isAdminMode && !isSeeding) {
                isSeeding = true;
                try {
                    await repo.seedDefaultTypes(DEFAULT_TYPES, currentUser.uid);
                } finally {
                    isSeeding = false;
                }
                return; // listener akan terpanggil lagi setelah seed
            }

            // Bersihkan duplikasi di Firestore jika terdeteksi (admin only)
            if (isAdminMode && dutyTypes.length > 0) {
                repo.cleanupDuplicateTypes(dutyTypes);
            }

            renderAll();
        },
        (err) => {
            console.error('[piket-branding] duty_types listener error:', err);
        },
    );

    unsubSchedules = repo.subscribeSchedules(
        (data) => {
            schedules = data;
            ui.renderSchedules(schedules, dutyTypes, isAdminMode, ui.getFilters());
        },
        (err) => {
            console.error('[piket-branding] duty_schedules listener error:', err);
            ui.showErrorState('Gagal memuat jadwal piket.');
        },
    );
}

// ── Save Schedule ─────────────────────────────────────────────────────

async function handleSaveSchedule(e) {
    e.preventDefault();
    if (!isAdminMode) return;

    const id        = document.getElementById('scheduleId').value;
    const typeId    = document.getElementById('scheduleType').value;
    const type      = dutyTypes.find(t => t.id === typeId);
    const startDate = document.getElementById('startDate').value;
    const endDate   = document.getElementById('endDate').value;
    const assignments = ui.collectAssignments(startDate);

    if (!assignments.length) {
        window.Swal?.fire({ title: 'Data belum lengkap', text: 'Tambahkan minimal satu anggota bertugas.', icon: 'warning' });
        return;
    }

    const payload = {
        type_id:      type?.id   || typeId,
        type_name:    type?.name || 'Jenis Piket',
        type_color:   type?.color || '#0B2B6A',
        title:        document.getElementById('scheduleTitle').value.trim(),
        description:  document.getElementById('scheduleDescription').value.trim(),
        period_label: ui.formatPeriodLabel(startDate, endDate),
        start_date:   Timestamp.fromDate(new Date(startDate)),
        end_date:     Timestamp.fromDate(new Date(endDate)),
        status:       document.getElementById('scheduleStatus').value,
        visibility:   'all',
        assignments,
        updated_at:   serverTimestamp(),
        updated_by:   currentUser.uid,
    };

    try {
        if (id) {
            await repo.updateSchedule(id, payload);
        } else {
            await repo.createSchedule(payload, currentUser.uid);
        }
        ui.closeScheduleModal();
        window.Swal?.fire({ title: 'Berhasil', text: 'Jadwal piket berhasil disimpan.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (err) {
        console.error('[piket-branding] saveSchedule failed:', err);
        window.Swal?.fire({ title: 'Gagal', text: 'Jadwal piket gagal disimpan.', icon: 'error' });
    }
}

// ── Delete Schedule ───────────────────────────────────────────────────

async function handleDeleteSchedule(id) {
    if (!isAdminMode) return;
    const res = await window.Swal?.fire({
        title: 'Hapus jadwal?',
        text: 'Jadwal piket akan dihapus permanen.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#dc2626',
    });
    if (!res?.isConfirmed) return;

    try {
        await repo.deleteSchedule(id);
        window.Swal?.fire({ title: 'Terhapus', text: 'Jadwal piket sudah dihapus.', icon: 'success', timer: 1400, showConfirmButton: false });
    } catch (err) {
        console.error('[piket-branding] deleteSchedule failed:', err);
        window.Swal?.fire({ title: 'Gagal', text: 'Jadwal piket gagal dihapus.', icon: 'error' });
    }
}

// ── Save Type ─────────────────────────────────────────────────────────

async function handleSaveType(e) {
    e.preventDefault();
    if (!isAdminMode) return;

    const name = document.getElementById('typeName').value.trim();
    if (!name) return;

    const payload = {
        name,
        slug:          ui.slugify(name),
        color:         document.getElementById('typeColor').value || '#0B2B6A',
        icon:          document.getElementById('typeIcon').value.trim() || 'bi-calendar-check',
        description:   '',
        default_tasks: [],
        is_active:     true,
    };

    try {
        await repo.createType(payload, currentUser.uid);
        document.getElementById('typeForm').reset();
        document.getElementById('typeColor').value = '#0B2B6A';
        document.getElementById('typeIcon').value  = 'bi-calendar-check';
    } catch (err) {
        console.error('[piket-branding] saveType failed:', err);
        window.Swal?.fire({ title: 'Gagal', text: 'Jenis piket gagal ditambahkan.', icon: 'error' });
    }
}

// ── Toggle Type Active ────────────────────────────────────────────────

async function handleToggleTypeActive(typeId, shouldActivate) {
    if (!isAdminMode) return;
    try {
        await repo.toggleTypeActive(typeId, shouldActivate, currentUser.uid);
    } catch (err) {
        console.error('[piket-branding] toggleTypeActive failed:', err);
    }
}

// ── Event Wireup ──────────────────────────────────────────────────────

function wireEventListeners() {
    // Add schedule
    document.getElementById('addScheduleBtn')?.addEventListener('click', () => {
        if (isAdminMode) ui.openScheduleModal(null, users);
    });

    // Manage types modal
    document.getElementById('manageTypesBtn')?.addEventListener('click', () => {
        bootstrap.Modal.getOrCreateInstance(document.getElementById('typesModal')).show();
    });

    // Add assignment row in modal
    document.getElementById('addAssignmentBtn')?.addEventListener('click', () => {
        ui.addAssignmentRow({}, users);
    });

    // Save schedule form
    document.getElementById('scheduleForm')?.addEventListener('submit', handleSaveSchedule);

    // Save type form
    document.getElementById('typeForm')?.addEventListener('submit', handleSaveType);

    // Filter changes
    ['typeFilter', 'periodFilter', 'statusFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            ui.renderSchedules(schedules, dutyTypes, isAdminMode, ui.getFilters());
        });
    });

    // Search
    document.getElementById('searchInput')?.addEventListener('input', () => {
        ui.renderSchedules(schedules, dutyTypes, isAdminMode, ui.getFilters());
    });

    // Event delegation: edit / delete schedule buttons and toggle type buttons
    document.addEventListener('click', async (e) => {
        // Edit schedule
        const editBtn = e.target.closest('[data-edit-schedule]');
        if (editBtn) {
            const id = editBtn.dataset.editSchedule;
            const schedule = schedules.find(s => s.id === id);
            if (schedule) ui.openScheduleModal(schedule, users);
            return;
        }

        // Delete schedule
        const deleteBtn = e.target.closest('[data-delete-schedule]');
        if (deleteBtn) {
            const id = deleteBtn.dataset.deleteSchedule;
            if (id) await handleDeleteSchedule(id);
            return;
        }

        // Toggle type active
        const toggleBtn = e.target.closest('[data-toggle-type-id]');
        if (toggleBtn) {
            const typeId       = toggleBtn.dataset.toggleTypeId;
            const shouldActivate = toggleBtn.dataset.toggleActivate === 'true';
            if (typeId) await handleToggleTypeActive(typeId, shouldActivate);
            return;
        }
    });

    // Cleanup on page unload
    window.addEventListener('unload', () => {
        if (unsubTypes)     unsubTypes();
        if (unsubSchedules) unsubSchedules();
    });
}

// ── Initialize ────────────────────────────────────────────────────────

async function initialize() {
    try {
        const { user, role } = await requireAuth();
        currentUser = user;

        // Load current user document
        currentUserDoc = await repo.getCurrentUser(user.uid);
        applyAccessMode();

        // Render shared shell
        renderTopbar({ user, role });
        renderSidebar({ role, activePage: 'piket-branding' });

        // Load users for assignment dropdown
        users = await repo.getActiveUsers();

        // Show loading placeholder
        ui.showLoadingState();

        // Wire all event listeners
        wireEventListeners();

        // Start real-time listeners
        startListeners();

        console.log('[piket-branding] initialized successfully');
    } catch (err) {
        console.error('[piket-branding] initialize failed:', err);
        ui.showErrorState('Terjadi kesalahan saat inisialisasi halaman.');
    }
}

initialize();
