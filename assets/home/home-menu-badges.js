// assets/js/home-menu-badges.js
// Menu badge refresh logic for home dashboard
// =====================================================================

import { db } from "./home-firebase.js";
import { 
  collection, query, where, getDocs, getCountFromServer 
} from "./home-firebase.js";
import { getMs, isRecentByFields, normalizeStatus, addMonths } from "./home-utils.js";

let menuBadgeIntervalId = null;

/**
 * Set menu badge count
 * @param {string} key - Badge key
 * @param {number} count - Badge count
 */
export function setMenuBadge(key, count) {
  const nodes = document.querySelectorAll(`[data-menu-badge="${key}"]`);
  if (!nodes.length) return;
  
  const normalized = Number.isFinite(count) ? count : 0;
  const label = normalized > 99 ? "99+" : String(normalized);
  
  nodes.forEach((node) => {
    if (normalized > 0) {
      node.textContent = label;
      node.classList.remove("menu-badge-hidden");
    } else {
      node.textContent = "";
      node.classList.add("menu-badge-hidden");
    }
  });
}

/**
 * Get merged documents from multiple queries
 * @param {Array} queryList - List of queries
 * @param {any} fallbackRef - Fallback collection reference
 * @param {boolean} allowFullScan - Allow full collection scan
 * @returns {Promise<Array>} Merged documents
 */
async function getMergedDocs(queryList, fallbackRef, allowFullScan) {
  const merged = new Map();
  let anySuccess = false;
  
  for (const q of queryList) {
    if (!q) continue;
    try {
      const snap = await getDocs(q);
      anySuccess = true;
      snap.forEach((docSnap) => merged.set(docSnap.id, docSnap));
    } catch (e) {
      console.warn("Menu badge query failed:", e);
    }
  }
  
  if (!anySuccess && allowFullScan && fallbackRef) {
    try {
      const snap = await getDocs(fallbackRef);
      snap.forEach((docSnap) => merged.set(docSnap.id, docSnap));
    } catch (e) {
      console.warn("Menu badge fallback failed:", e);
    }
  }
  
  return Array.from(merged.values());
}

/**
 * Fetch documents by cutoff time
 * @param {string} collectionName - Collection name
 * @param {number} cutoffMs - Cutoff time in milliseconds
 * @param {Object} options - Options object
 * @returns {Promise<Array>} Documents
 */
async function fetchDocsByCutoff(collectionName, cutoffMs, options) {
  if (!db) return [];
  
  const colRef = collection(db, collectionName);
  const filters = options && options.whereFilters ? options.whereFilters : [];
  const cutoffDate = new Date(cutoffMs);
  
  const queries = [
    query(colRef, ...filters, where("createdAtMs", ">=", cutoffMs)),
    query(colRef, ...filters, where("createdAt", ">=", cutoffDate)),
  ];
  
  return await getMergedDocs(queries, colRef, options && options.allowFullScan);
}

/**
 * Fetch documents by status
 * @param {string} collectionName - Collection name
 * @param {Array} statuses - Status array
 * @param {Object} options - Options object
 * @returns {Promise<Array>} Documents
 */
async function fetchDocsByStatus(collectionName, statuses, options) {
  if (!db) return [];
  
  const colRef = collection(db, collectionName);
  const queries = [];
  
  if (Array.isArray(statuses) && statuses.length > 0) {
    queries.push(query(colRef, where("status", "in", statuses)));
  }
  
  return await getMergedDocs(queries, colRef, options && options.allowFullScan);
}

/**
 * Get documents from multiple paths
 * @param {Array} pathList - List of paths
 * @returns {Promise<any>} Documents snapshot
 */
async function getDocsFromPaths(pathList) {
  if (!db) return null;
  
  for (const path of pathList) {
    try {
      const snap = await getDocs(collection(db, ...path));
      return snap;
    } catch (e) {
      console.warn("Menu badge path failed:", path.join("/"), e);
    }
  }
  return null;
}

/**
 * Refresh branding schedule badge
 */
async function refreshBrandingScheduleBadge() {
  if (!db) return;
  
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let brandingCount = 0;
  
  try {
    const brandingSnap = await getDocs(collection(db, "branding_content"));
    brandingSnap.forEach((docSnap) => {
      const data = docSnap.data() || {};
      if (data.status === "completed" || data.status === "cancelled") return;
      if (!Array.isArray(data.milestones)) return;
      
      data.milestones.forEach((m) => {
        if (m.status === "completed") return;
        if (!m.deadline) return;
        
        const d = m.deadline.toDate
          ? m.deadline.toDate()
          : new Date(m.deadline);
        
        if (d >= now && d <= weekAhead) brandingCount++;
      });
    });
    
    setMenuBadge("branding-schedule", brandingCount);
  } catch (e) {
    console.warn("Branding badge count failed:", e);
  }
}

/**
 * Start menu badge refresh interval
 */
export function startMenuBadgeRefresh() {
  if (menuBadgeIntervalId) {
    clearInterval(menuBadgeIntervalId);
  }
  
  refreshMenuBadges();
  refreshBrandingScheduleBadge();
  
  menuBadgeIntervalId = setInterval(() => {
    refreshMenuBadges();
    refreshBrandingScheduleBadge();
  }, 60000);
}

/**
 * Stop menu badge refresh interval
 */
export function stopMenuBadgeRefresh() {
  if (menuBadgeIntervalId) {
    clearInterval(menuBadgeIntervalId);
    menuBadgeIntervalId = null;
  }
}

/**
 * Refresh all menu badges
 */
export async function refreshMenuBadges() {
  if (!db) return;
  
  const cutoffMs = Date.now() - 5 * 24 * 60 * 60 * 1000;
  
  try {
    // Candidate internship badge
    const candidateDocs = await fetchDocsByCutoff(
      "interns_screening",
      cutoffMs,
      { allowFullScan: false }
    );
    setMenuBadge(
      "candidate-internship",
      candidateDocs.filter((ds) => isRecentByFields(ds.data() || {}, cutoffMs)).length
    );
    
    // Operational expenses badge
    const expenseDocs = await fetchDocsByCutoff(
      "operational_expenses",
      cutoffMs,
      {
        whereFilters: [where("status", "in", ["requested", "reviewing"])],
        allowFullScan: false,
      }
    );
    const expenseCount = expenseDocs.filter((ds) => {
      const data = ds.data() || {};
      const status = normalizeStatus(data.status);
      return (
        (status === "requested" || status === "reviewing") &&
        isRecentByFields(data, cutoffMs)
      );
    }).length;
    setMenuBadge("operational-expenses", expenseCount);
    
    // Invoice badge
    const invoiceDocs = await fetchDocsByCutoff("invoices", cutoffMs, {
      allowFullScan: false,
    });
    const invoiceCount = invoiceDocs.filter((ds) => {
      const data = ds.data() || {};
      if (!isRecentByFields(data, cutoffMs)) return false;
      const paidAtMs = getMs(
        data.paidAtMs || data.paid_at_ms || data.paidAt || data.paid_at
      );
      const paidAmount = Number(data.paidAmount || data.paid_amount || 0);
      return (paidAtMs != null && paidAtMs > 0) || paidAmount > 0;
    }).length;
    setMenuBadge("create-invoice", invoiceCount);
    
    // Class available badge
    const classAvailableDocs = await fetchDocsByCutoff(
      "class_availability",
      cutoffMs,
      { allowFullScan: false }
    );
    setMenuBadge(
      "class-available",
      classAvailableDocs.filter((ds) => isRecentByFields(ds.data() || {}, cutoffMs)).length
    );
    
    // Mailing list badge
    const mailingDocs = await fetchDocsByCutoff(
      "subscription_email",
      cutoffMs,
      { allowFullScan: false }
    );
    setMenuBadge(
      "mailing-list",
      mailingDocs.filter((ds) => isRecentByFields(ds.data() || {}, cutoffMs)).length
    );
    
    // Permit/Reimburse badge
    const permitDocs = await fetchDocsByStatus(
      "permits",
      ["pending", "Pending"],
      { allowFullScan: false }
    );
    const reimburseDocs = await fetchDocsByStatus(
      "reimburse",
      ["pending", "Pending"],
      { allowFullScan: false }
    );
    setMenuBadge(
      "permit-reimburse",
      permitDocs.length + reimburseDocs.length
    );
    
    // Referral badge
    const referralSnap = await getDocsFromPaths([
      ["settings", "referrals"],
      ["referrals"],
      ["settings_referrals"],
    ]);
    
    if (referralSnap) {
      let referralCount = 0;
      const nowMs = Date.now();
      
      referralSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const createdAtMs = getMs(
          data.createdAtMs ||
          data.created_at_ms ||
          data.createdAt ||
          data.created_at
        );
        
        if (createdAtMs == null) return;
        
        const monthsValid = Number(data.monthsValid ?? data.months_valid ?? 0);
        const expiresAt = addMonths(new Date(createdAtMs), monthsValid).getTime();
        
        if (nowMs > expiresAt) referralCount++;
      });
      
      setMenuBadge("referral-kelas", referralCount);
    } else {
      setMenuBadge("referral-kelas", 0);
    }
    
    // Class management badge
    const classAvailabilityAll = await fetchDocsByStatus(
      "class_availability",
      ["Stall", "Soon", "Running", "Graduate"],
      { allowFullScan: false }
    );
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();
    let classManagementCount = 0;
    let classCheckupCount = 0;
    
    classAvailabilityAll.forEach((ds) => {
      const data = ds.data() || {};
      const status = normalizeStatus(data.status);
      const startMs = getMs(
        data.start_date ||
        data.startDate ||
        data.start_at ||
        data.startAt
      );
      
      // Stall or overdue "soon" classes
      if (status === "stall") {
        classManagementCount++;
      } else if (status === "soon" && startMs != null && startMs < todayMs) {
        classManagementCount++;
      }
      
      // Checkup needed
      const meetingDone = Number(data.meeting_done ?? data.meetingDone ?? 0);
      const meetingTotal = Number(data.meeting_total ?? data.meetingTotal ?? 0);
      const salaryExpenseId = data.salaryExpenseId || data.salary_expense_id || "";
      
      const isRunningDone = status === "running" &&
        meetingTotal > 0 &&
        meetingDone >= meetingTotal;
      
      const isGraduatePending = status === "graduate" && !String(salaryExpenseId).trim();
      
      if (isRunningDone || isGraduatePending) {
        classCheckupCount++;
      }
    });
    
    setMenuBadge("class-checkup", classCheckupCount);
    
    // Class planning badge
    let classPlanningCount = 0;
    try {
      const planningSnap = await getDocs(collection(db, "class_planning"));
      planningSnap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const dateVal = data.date;
        const timeVal = data.time;
        const dateEmpty = !String(dateVal || "").trim();
        const timeEmpty = !String(timeVal || "").trim();
        if (dateEmpty || timeEmpty) classPlanningCount++;
      });
    } catch (e) {
      console.warn("Menu badge class planning failed:", e);
    }
    
    setMenuBadge("class-planning", classPlanningCount);
    setMenuBadge(
      "class-management",
      classManagementCount + classCheckupCount + classPlanningCount
    );
    
    // Branding schedule badge (already called separately, but refresh here too)
    refreshBrandingScheduleBadge();
  } catch (e) {
    console.error("Failed to refresh menu badges:", e);
  }
}

/**
 * Clean up menu badge resources
 */
export function cleanupMenuBadges() {
  stopMenuBadgeRefresh();
}