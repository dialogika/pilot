// assets/js/home-announcements.js
// Announcement handling for home dashboard
// =====================================================================

import { db, getUserDepartment } from "./home-firebase.js";
import { collection, query, where, onSnapshot } from "./home-firebase.js";
import { formatDateID, stripHtml } from "./home-utils.js";

let announcementBannerUnsubscribe = null;

// Type color mapping
const typeColor = {
  info: "#0d6efd",
  update: "#108a00",
  warning: "#f1ac15",
  urgent: "#e7181b",
};

/**
 * Listen to announcements and update UI
 * @param {HTMLElement} section - Section element
 * @param {HTMLElement} container - Container element
 * @param {Function} openDetailModal - Function to open detail modal
 */
export function listenToHomeAnnouncements(section, container, openDetailModal) {
  if (!section || !container) return;
  
  // Clear previous listener
  if (announcementBannerUnsubscribe) {
    announcementBannerUnsubscribe();
    announcementBannerUnsubscribe = null;
  }
  
  const q = query(
    collection(db, "announcements"),
    where("active", "==", true)
  );
  
  announcementBannerUnsubscribe = onSnapshot(q, (snapshot) => {
    const userDept = getUserDepartment().toLowerCase().trim();
    let items = [];
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const targetName = (data.target_department_name || "")
        .toLowerCase()
        .trim();
      
      // Show if no target or target matches user's department
      if (!targetName || targetName === userDept) {
        items.push({ id: docSnap.id, ...data });
      }
    });
    
    if (items.length === 0) {
      section.style.display = "none";
      container.innerHTML = "";
      return;
    }
    
    // Sort: pinned first, then by creation date
    items.sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      const at = a.created_at?.toDate
        ? a.created_at.toDate().getTime()
        : 0;
      const bt = b.created_at?.toDate
        ? b.created_at.toDate().getTime()
        : 0;
      return bt - at;
    });
    
    // Display only first 5 items
    items = items.slice(0, 5);
    
    section.style.display = "block";
    container.innerHTML = "";
    
    items.forEach((announcement) => {
      const color = typeColor[announcement.type || "info"] || "#0d6efd";
      const fullText = stripHtml(announcement.content || "");
      const isLong = fullText.length > 140;
      const preview = isLong ? fullText.slice(0, 140) + "..." : fullText;
      const dateLabel = announcement.created_at?.toDate
        ? formatDateID(announcement.created_at.toDate())
        : "-";
      const targetLabel = announcement.target_department_name || "All Employees";
      
      const div = document.createElement("div");
      div.className = "p-3 rounded-3 bg-white shadow-sm d-flex justify-content-between align-items-start";
      div.style.borderLeft = "5px solid " + color;
      div.style.cursor = "pointer";
      
      div.innerHTML = `
        <div style="min-width:0; overflow-wrap:anywhere; word-break:break-all;">
          <div class="fw-bold small">
            ${announcement.pinned ? '<i class="bi bi-pin-angle-fill text-primary me-1"></i>' : ""}
            ${announcement.title || "Untitled"}
          </div>
          <div class="text-muted small mb-1">${preview}</div>
          <div class="d-flex flex-wrap align-items-center gap-2 text-muted" style="font-size:11px;">
            <span><i class="bi bi-calendar-event me-1"></i>${dateLabel}</span>
            <span><i class="bi bi-people me-1"></i>${targetLabel}</span>
          </div>
        </div>
        ${isLong ? '<span class="text-primary small fw-semibold flex-shrink-0 ms-2">Lihat detail</span>' : ""}
      `;
      
      div.addEventListener("click", () => {
        if (openDetailModal) {
          openDetailModal(announcement, color);
        }
      });
      
      container.appendChild(div);
    });
  }, (error) => {
    console.error("Failed to load announcements for home:", error);
  });
}

/**
 * Open announcement detail modal
 * @param {Object} announcement - Announcement data
 * @param {string} color - Announcement color
 */
export function openAnnouncementDetailModal(announcement, color) {
  const modalEl = document.getElementById("announcementDetailModal");
  if (!modalEl) return;
  
  const badgeEl = document.getElementById("announcementDetailBadge");
  const titleEl = document.getElementById("announcementDetailTitle");
  const targetEl = document.getElementById("announcementDetailTarget");
  const dateEl = document.getElementById("announcementDetailDate");
  const contentEl = document.getElementById("announcementDetailContent");
  
  const type = announcement.type || "info";
  badgeEl.textContent = type.toUpperCase();
  badgeEl.style.backgroundColor = color;
  badgeEl.style.color = "#fff";
  
  titleEl.textContent = announcement.title || "Untitled";
  targetEl.textContent = announcement.target_department_name || "All Employees";
  dateEl.textContent = announcement.created_at?.toDate
    ? formatDateID(announcement.created_at.toDate())
    : "-";
  contentEl.innerHTML = announcement.content || "<span class='text-muted'>No content.</span>";
  
  // Show modal
  const modal = window.bootstrap?.Modal?.getOrCreateInstance(modalEl);
  if (modal) modal.show();
}

/**
 * Clean up announcement resources
 */
export function cleanupAnnouncements() {
  if (announcementBannerUnsubscribe) {
    announcementBannerUnsubscribe();
    announcementBannerUnsubscribe = null;
  }
}