import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Determine the path to index.html based on this script's URL
const indexPath = new URL('../../index.html', import.meta.url).href;

// 1. Fast path check: if there is no userData in localStorage, redirect immediately
const localUserData = localStorage.getItem('userData');
if (!localUserData) {
    window.location.href = indexPath;
}

// 2. Async Firebase Check: wait for the host page to initialize Firebase
let checkAttempts = 0;
const checkFirebase = () => {
    if (getApps().length > 0) {
        const app = getApp();
        const auth = getAuth(app);
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                // Token expired or invalid, clear localStorage and redirect
                localStorage.removeItem('userData');
                window.location.href = indexPath;
            }
        });
    } else if (checkAttempts < 50) {
        checkAttempts++;
        setTimeout(checkFirebase, 100);
    }
};

checkFirebase();
