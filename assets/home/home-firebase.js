// assets/home/home-firebase.js
// Centralized Firebase setup for home dashboard
// =====================================================================

import { auth, db, storage } from "../js/firebase-config.js";
import { 
  collection, addDoc, query, where, getDoc, getDocs, 
  serverTimestamp, onSnapshot, orderBy, doc, deleteDoc, 
  updateDoc, setDoc, getCountFromServer, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Export Firebase instances and functions
export { 
  auth, db, storage,
  collection, addDoc, query, where, getDoc, getDocs,
  serverTimestamp, onSnapshot, orderBy, doc, deleteDoc,
  updateDoc, setDoc, getCountFromServer, limit,
  onAuthStateChanged, signOut 
};

// User state management
let currentUser = null;
let userData = null;

/**
 * Initialize Firebase auth state and get current user
 * @returns {Promise<Object>} Object containing user and user data
 */
export async function initializeAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "index.html";
        return;
      }
      
      currentUser = user;
      
      // Get user data from localStorage
      try {
        userData = JSON.parse(localStorage.getItem("userData"));
      } catch (e) {
        console.warn("Failed to parse userData from localStorage", e);
        userData = null;
      }
      
      // Get user document from Firestore
      try {
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        if (userDocSnap.exists()) {
          const userDocData = userDocSnap.data();
          userData = { ...userData, ...userDocData };
          window.teamMemberDepartment = userDocData.employment?.department || "";
        }
      } catch (e) {
        console.error("Error fetching user document:", e);
      }
      
      resolve({ user, userData });
    });
  });
}

/**
 * Get current user object
 * @returns {Object|null} Current user
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get user data (combined localStorage + Firestore)
 * @returns {Object|null} User data
 */
export function getUserData() {
  return userData;
}

/**
 * Get user's department
 * @returns {string} User's department
 */
export function getUserDepartment() {
  return window.teamMemberDepartment || "";
}

/**
 * Logout function
 */
export async function logoutUser() {
  await signOut(auth);
  localStorage.removeItem("userData");
  window.location.href = "index.html";
}