// pages/branding/content-schedule/content-schedule.js
// ===================================================================
// BRANDING CONTENT SCHEDULE — ORCHESTRATOR
// Koordinasi: auth → shell → repository → UI → events → cleanup
// Koleksi Firestore: branding_content (CRUD) | duty_schedules (Read)
// ===================================================================

import { requireAuth }   from '../../../assets/js/auth-guard.js';
import { renderTopbar }  from '../../../assets/js/components/topbar/topbar.js';
import { renderSidebar } from '../../../assets/js/components/sidebar/sidebar.js';
import * as repo from './content-schedule.repository.js';
import * as ui   from './content-schedule.ui.js';
import {
    Timestamp,
    serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ── Application State ─────────────────────────────────────────────
let currentUser         = null;
let activeDate          = new Date();
let allContents         = [];
let dutySchedules       = [];
let currentSelectedDate = null;
let pendingDateForAdd   = null;

let unsubContent  = null;
let unsubDuty     = null;

// ── Re-render Helpers ─────────────────────────────────────────────

function refreshCalendar() {
    ui.renderCalendar(activeDate, allContents, dutySchedules, onDateClick);
}

function refreshNotifications() {
    ui.renderNotifications(allContents);
}

function refreshSelectedDayCard() {
    ui.renderSelectedDayCard(currentSelectedDate, allContents, dutySchedules, {
        onComplete: handleMilestoneComplete,
        onEdit:     handleEditContent,
        onDelete:   handleDeleteContent,
    });
}

// ── Realtime Listeners ────────────────────────────────────────────

function startListeners() {
    unsubContent = repo.subscribeBrandingContent(
        (items) => {
            allContents = items;
            ui.populateContentTitles(allContents);
            refreshCalendar();
            refreshNotifications();
            refreshSelectedDayCard();
        },
        (err) => console.error('[content-schedule] branding_content listener error:', err)
    );

    unsubDuty = repo.subscribeDutySchedules(
        (items) => {
            dutySchedules = items;
            refreshCalendar();
            refreshSelectedDayCard();
        },
        (err) => console.error('[content-schedule] duty_schedules listener error:', err)
    );
}

// ── Date Click Handler ────────────────────────────────────────────

function onDateClick(date) {
    currentSelectedDate = date;
    pendingDateForAdd   = date;

    refreshSelectedDayCard();

    ui.openDateClickModal(date, allContents, dutySchedules, {
        onComplete: async (contentId, milestoneIndex) => {
            await handleMilestoneComplete(contentId, milestoneIndex);
            // Refresh modal dengan data terbaru setelah complete
            ui.openDateClickModal(pendingDateForAdd, allContents, dutySchedules, {
                onComplete: handleMilestoneComplete,
                onAddContent: () => {
                    closeModal('dateClickModal');
                    openAddModal();
                },
            });
        },
        onAddContent: () => {
            closeModal('dateClickModal');
            openAddModal();
        },
    });
}

// ── Inline Complete Milestone ─────────────────────────────────────

async function handleMilestoneComplete(contentId, milestoneIndex) {
    try {
        await repo.updateMilestoneStatus(contentId, milestoneIndex, 'completed');
        Swal.fire({ title: 'Selesai!', text: 'Milestone telah diselesaikan.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error('[content-schedule] handleMilestoneComplete failed:', e);
        Swal.fire({ title: 'Gagal!', text: 'Gagal mengubah status milestone.', icon: 'error' });
    }
}

// ── Edit Content ──────────────────────────────────────────────────

async function handleEditContent(contentId) {
    try {
        const content = await repo.getContentById(contentId);
        if (!content) {
            Swal.fire({ title: 'Gagal!', text: 'Konten tidak ditemukan.', icon: 'error' });
            return;
        }
        ui.openContentModal('edit', content, pendingDateForAdd);
    } catch (e) {
        console.error('[content-schedule] handleEditContent failed:', e);
        Swal.fire({ title: 'Gagal!', text: 'Gagal memuat detail konten.', icon: 'error' });
    }
}

// ── Delete Content ────────────────────────────────────────────────

async function handleDeleteContent(contentId) {
    const res = await Swal.fire({
        title:             'Apakah Anda yakin?',
        text:              'Jadwal konten ini akan dihapus permanen.',
        icon:              'warning',
        showCancelButton:  true,
        confirmButtonColor: '#d33',
        cancelButtonColor:  '#3085d6',
        confirmButtonText: 'Ya, Hapus!',
        cancelButtonText:  'Batal',
    });

    if (!res.isConfirmed) return;

    try {
        await repo.deleteContent(contentId);
        Swal.fire({ title: 'Terhapus!', text: 'Rencana konten telah dihapus.', icon: 'success', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error('[content-schedule] handleDeleteContent failed:', e);
        Swal.fire({ title: 'Gagal!', text: 'Gagal menghapus rencana konten.', icon: 'error' });
    }
}

// ── Open Add Modal ────────────────────────────────────────────────

function openAddModal(date = null) {
    if (date) pendingDateForAdd = date;
    ui.openContentModal('add', null, pendingDateForAdd);
}

// ── Close Modal Helper ────────────────────────────────────────────

function closeModal(modalId) {
    const modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
    if (modal) modal.hide();
}

// ── Event Wiring ──────────────────────────────────────────────────

function wireEventListeners() {
    // Tombol Tambah Konten (header)
    const addBtn = document.getElementById('addContentBtn');
    if (addBtn) addBtn.addEventListener('click', () => openAddModal());

    // Navigasi bulan kalender
    const prevBtn = document.getElementById('calPrevBtn');
    const nextBtn = document.getElementById('calNextBtn');
    const todayBtn = document.getElementById('calTodayBtn');

    if (prevBtn) prevBtn.addEventListener('click', () => {
        activeDate.setMonth(activeDate.getMonth() - 1);
        refreshCalendar();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        activeDate.setMonth(activeDate.getMonth() + 1);
        refreshCalendar();
    });
    if (todayBtn) todayBtn.addEventListener('click', () => {
        activeDate = new Date();
        refreshCalendar();
    });

    // Tutup kartu hari yang dipilih
    const closeSelectedBtn = document.getElementById('closeSelectedDayBtn');
    if (closeSelectedBtn) closeSelectedBtn.addEventListener('click', () => {
        currentSelectedDate = null;
        ui.renderSelectedDayCard(null, [], [], {});
    });

    // Tombol "Tambah Konten Baru" di dalam modal date click
    const addFromDateBtn = document.getElementById('addContentFromDateBtn');
    if (addFromDateBtn) addFromDateBtn.addEventListener('click', () => {
        closeModal('dateClickModal');
        openAddModal();
    });

    // Tombol tambah baris milestone di form
    const addMilestoneBtn = document.getElementById('addMilestoneBtn');
    if (addMilestoneBtn) {
        addMilestoneBtn.addEventListener('click', () => {
            const container = document.getElementById('milestonesContainer');
            if (container) ui.addMilestoneRow(container, '', '', 'pending', pendingDateForAdd);
        });
    }

    // Form submit (tambah / edit konten)
    const form = document.getElementById('contentForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id          = document.getElementById('contentId').value;
            const title       = document.getElementById('contentTitle').value.trim();
            const description = document.getElementById('contentDesc').value.trim();
            const priority    = document.getElementById('contentPriority').value;

            // Kumpulkan milestones dan konversi Date ke Firestore Timestamp
            const container  = document.getElementById('milestonesContainer');
            const rawMilestones = ui.collectMilestones(container);
            const milestones = rawMilestones.map(m => ({
                name:     m.name,
                deadline: Timestamp.fromDate(m.deadline),
                status:   m.status,
            }));

            const allCompleted = milestones.length > 0 && milestones.every(m => m.status === 'completed');
            const contentData  = {
                title,
                description,
                priority,
                milestones,
                status: allCompleted ? 'completed' : 'active',
                updated_at: serverTimestamp(),
            };

            try {
                if (id) {
                    await repo.updateContent(id, contentData);
                    Swal.fire({ title: 'Berhasil!', text: 'Rencana konten berhasil diperbarui.', icon: 'success', timer: 1500, showConfirmButton: false });
                } else {
                    await repo.createContent(contentData, currentUser.uid);
                    Swal.fire({ title: 'Berhasil!', text: 'Rencana konten berhasil dibuat.', icon: 'success', timer: 1500, showConfirmButton: false });
                }
                closeModal('contentModal');
            } catch (err) {
                console.error('[content-schedule] form submit failed:', err);
                Swal.fire({ title: 'Gagal!', text: 'Gagal menyimpan rencana konten.', icon: 'error' });
            }
        });
    }
}

// ── Initialize ────────────────────────────────────────────────────

async function initialize() {
    try {
        const { user, role } = await requireAuth();
        currentUser = user;

        // Render shared shell
        renderTopbar({ user, role });
        renderSidebar({ role, activePage: 'content-schedule' });

        // Wire events
        wireEventListeners();

        // Start realtime listeners
        startListeners();

        console.log('[content-schedule] initialized successfully');
    } catch (err) {
        console.error('[content-schedule] initialize failed:', err);
    }
}

// Cleanup saat navigasi pergi dari halaman
window.addEventListener('unload', () => {
    if (unsubContent) unsubContent();
    if (unsubDuty)    unsubDuty();
});

initialize();
