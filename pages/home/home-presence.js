// assets/js/home-presence.js
// User presence and online tracking for home dashboard
// =====================================================================

import { db, getCurrentUser } from "./home-firebase.js";
import { collection, doc, setDoc, serverTimestamp, onSnapshot } from "./home-firebase.js";

let presenceIntervalId = null;
let userPresenceUnsubscribe = null;

/**
 * Start presence tracking for current user
 */
export function startPresenceTracking() {
  try {
    updateOwnPresence();
    
    // Clear existing interval if any
    if (presenceIntervalId) {
      clearInterval(presenceIntervalId);
    }
    
    // Update presence every minute
    presenceIntervalId = setInterval(updateOwnPresence, 60000);
    
    // Update when user becomes visible again
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        updateOwnPresence();
      }
    });
  } catch (e) {
    console.error("Failed to start presence tracking", e);
  }
}

/**
 * Stop presence tracking
 */
export function stopPresenceTracking() {
  if (presenceIntervalId) {
    clearInterval(presenceIntervalId);
    presenceIntervalId = null;
  }
  if (userPresenceUnsubscribe) {
    userPresenceUnsubscribe();
    userPresenceUnsubscribe = null;
  }
}

/**
 * Update current user's presence in Firestore
 */
export async function updateOwnPresence() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  
  try {
    const localData = JSON.parse(localStorage.getItem("userData") || "null");
    const uid = currentUser.uid;
    const name = (localData && localData.name) || currentUser.displayName || currentUser.email || "User";
    const photo = (localData && localData.photo) || currentUser.photoURL || "";
    
    const ref = doc(db, "user_presence", uid);
    await setDoc(
      ref,
      {
        user_id: uid,
        name: name,
        photo: photo,
        last_active_at: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.error("Failed to update presence", e);
  }
}

/**
 * Listen to online users and update UI
 * @param {HTMLElement} container - Container element for online users
 * @param {HTMLElement} badge - Badge element showing active count
 */
export function listenToOnlineUsers(container, badge) {
  if (!container || !badge) return;
  
  // Clear previous listener
  if (userPresenceUnsubscribe) {
    userPresenceUnsubscribe();
    userPresenceUnsubscribe = null;
  }
  
  try {
    const colRef = collection(db, "user_presence");
    const currentUser = getCurrentUser();
    const currentUid = currentUser ? currentUser.uid : null;
    
    userPresenceUnsubscribe = onSnapshot(colRef, (snapshot) => {
      const now = new Date();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const oneHourMs = 60 * 60 * 1000;
      
      const users = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        const ts = data.last_active_at;
        let lastActive = null;
        
        if (ts && typeof ts.toDate === "function") {
          lastActive = ts.toDate();
        }
        
        if (!lastActive) return;
        if (lastActive < startOfDay) return;
        
        const diff = now.getTime() - lastActive.getTime();
        const isActive = diff <= oneHourMs;
        
        users.push({
          uid: docSnap.id,
          name: data.name || "",
          photo: data.photo || "",
          lastActive,
          isActive,
        });
      });
      
      // Sort by most recent activity
      users.sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
      
      // Separate current user from others
      let me = null;
      const others = [];
      users.forEach((u) => {
        if (currentUid && u.uid === currentUid) {
          me = u;
        } else {
          others.push(u);
        }
      });
      
      // Order: current user first, then others
      const ordered = [];
      if (me) ordered.push(me);
      ordered.push(...others);
      
      // Update active count badge
      const activeCount = users.filter((u) => u.isActive).length;
      badge.innerText = activeCount + " Active";
      
      // Update container
      container.innerHTML = "";
      ordered.forEach((u) => {
        const ringStyle = u.isActive
          ? "background:#0B2B6A;"
          : "background:transparent;";
        
        const src = u.photo && u.photo.trim()
          ? u.photo
          : "https://i.pravatar.cc/150?u=" + encodeURIComponent(u.uid || u.name || "");
        
        const statusDot = u.isActive
          ? '<div class="online-status-dot"></div>'
          : "";
        
        const title = u.name || "";
        
        const div = document.createElement("div");
        div.className = "avatar-wrapper";
        div.title = title;
        div.style.cursor = "pointer";
        
        // Note: userProfileModal logic should be handled by parent component
        div.innerHTML = `
          <div class="avatar-ring" style="${ringStyle}"></div>
          <div class="avatar-mask">
            <img src="${src}" alt="${title}" class="avatar-img">
          </div>
          ${statusDot}
        `;
        
        container.appendChild(div);
      });
    }, (error) => {
      console.error("Failed to listen to online users:", error);
    });
  } catch (e) {
    console.error("Failed to listen to online users", e);
  }
}

/**
 * Clean up presence resources
 */
export function cleanupPresence() {
  stopPresenceTracking();
}