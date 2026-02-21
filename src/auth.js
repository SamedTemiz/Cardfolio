import { supabase } from './supabaseClient.js';
import { renderProjects, loadProfile } from './admin.js';
import { translateText as t, getErrorMessage } from './i18n.js';

const authLoader = document.getElementById("auth-loader");
const authOverlay = document.getElementById("auth-overlay");
const adminLayout = document.getElementById("admin-layout");

const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authTitle = document.getElementById("auth-title");
const btnAuthSubmit = document.getElementById("btn-auth-submit");
const btnAuthSwitch = document.getElementById("btn-auth-switch");
const authSwitchText = document.getElementById("auth-switch-text");
const btnLogout = document.getElementById("btn-logout");
const authError = document.getElementById("auth-error");

let isLoginMode = true;

function showAuthError(msg) {
    if (!authError) return;
    authError.textContent = msg;
    authError.style.display = msg ? "block" : "none";
}

// Clear error on input
[authEmail, authPassword].forEach(input => {
    input?.addEventListener("input", () => showAuthError(""));
});

// ─── Initialize Auth State ───
export async function checkSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (session) {
        showApp();
    } else {
        showAuth();
    }

    // Listen to changes (e.g., cross-tab login/logout)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            showApp();
        } else if (event === 'SIGNED_OUT') {
            showAuth();
        }
    });
}

function showApp() {
    if (authLoader) authLoader.style.display = "none";
    if (authOverlay) authOverlay.style.display = "none";
    if (adminLayout) adminLayout.style.display = "flex";
    // Trigger initial data load now that we know who is logged in
    renderProjects();
    loadProfile();
}

function showAuth() {
    if (authLoader) authLoader.style.display = "none";
    if (authOverlay) authOverlay.style.display = "flex";
    if (adminLayout) adminLayout.style.display = "none";
}

// ─── Toggle Login/Register UI ───
btnAuthSwitch.addEventListener("click", () => {
    isLoginMode = !isLoginMode;
    showAuthError(""); // Clear previous errors
    if (isLoginMode) {
        authTitle.textContent = t("admin.authLogin");
        btnAuthSubmit.textContent = t("admin.authLogin");
        authSwitchText.textContent = t("admin.authNoAccount");
        btnAuthSwitch.textContent = t("admin.authRegister");
    } else {
        authTitle.textContent = t("admin.authRegister");
        btnAuthSubmit.textContent = t("admin.authRegister");
        authSwitchText.textContent = t("admin.authAlreadyAccount");
        btnAuthSwitch.textContent = t("admin.authLogin");
    }
});

// ─── Handle Form Submission ───
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    showAuthError(""); // Clear previous errors
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.textContent = "...";

    if (isLoginMode) {
        // LOGIN
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            showAuthError(getErrorMessage(error.message));
        }
    } else {
        // REGISTER
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            showAuthError(getErrorMessage(error.message));
        } else {
            // Success - overlay will disappear
        }
    }

    btnAuthSubmit.disabled = false;
    btnAuthSubmit.textContent = isLoginMode ? "Login" : "Register";
});

// Handled in admin.js
