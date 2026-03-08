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
const authError = document.getElementById("auth-error");
const authFooterContainer = document.getElementById("auth-footer-container");
const btnForgotPassword = document.getElementById("btn-forgot-password");

const authResetForm = document.getElementById("auth-reset-form");
const authResetEmail = document.getElementById("auth-reset-email");
const authResetError = document.getElementById("auth-reset-error");
const btnAuthResetSubmit = document.getElementById("btn-auth-reset-submit");
const btnBackToLogin = document.getElementById("btn-back-to-login");

const authNewPasswordForm = document.getElementById("auth-new-password-form");
const authNewPassword = document.getElementById("auth-new-password");
const authConfirmPassword = document.getElementById("auth-confirm-password");
const authNewPasswordError = document.getElementById("auth-new-password-error");
const btnAuthNewPasswordSubmit = document.getElementById("btn-auth-new-password-submit");

const btnLogout = document.getElementById("btn-logout");

let currentAuthMode = "login"; // login, register, reset, update_password

function showAuthError(msg, errorEl = authError) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.style.display = msg ? "block" : "none";
}

function showTempToast(msg, type = "success") {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Clear error on input
[authEmail, authPassword, authResetEmail, authNewPassword, authConfirmPassword].forEach(input => {
    input?.addEventListener("input", () => {
        showAuthError("", authError);
        showAuthError("", authResetError);
        showAuthError("", authNewPasswordError);
    });
});

// ─── Password Visibility Toggle ───
document.querySelectorAll('.btn-eye').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const wrapper = btn.closest('.password-wrapper');
        const input = wrapper.querySelector('.auth-input');
        const eyeIcon = btn.querySelector('.eye-icon');
        const eyeOffIcon = btn.querySelector('.eye-off-icon');

        if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.style.display = 'none';
            eyeOffIcon.style.display = 'block';
        } else {
            input.type = 'password';
            eyeIcon.style.display = 'block';
            eyeOffIcon.style.display = 'none';
        }
    });
});

// ─── Initialize Auth State ───
export async function checkSession() {
    // Supabase redirects with a hash for password recovery
    const hash = window.location.hash || "";
    const isRecovery = hash.includes("type=recovery");

    if (isRecovery) {
        showAuth();
        switchAuthMode("update_password");
        // Clear the hash to prevent it from re-triggering this branch on refresh
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
    } else {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (session) {
            showApp();
        } else {
            showAuth();
        }
    }

    // Listen to changes (e.g., cross-tab login/logout)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            showAuth();
            switchAuthMode("update_password");
        } else if (event === 'SIGNED_IN') {
            // Prevent SIGNED_IN from hiding the reset password form
            if (currentAuthMode !== "update_password") {
                showApp();
            }
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

// ─── Toggle Auth Modes ───
export function switchAuthMode(mode) {
    currentAuthMode = mode;
    showAuthError("", authError);
    showAuthError("", authResetError);
    showAuthError("", authNewPasswordError);

    authForm.style.display = "none";
    if (authFooterContainer) authFooterContainer.style.display = "none";
    authResetForm.style.display = "none";
    authNewPasswordForm.style.display = "none";

    if (mode === "login" || mode === "register") {
        authForm.style.display = "block";
        if (authFooterContainer) authFooterContainer.style.display = "block";

        if (mode === "login") {
            authTitle.textContent = t("admin.authLogin");
            btnAuthSubmit.textContent = t("admin.authLogin");
            authSwitchText.textContent = t("admin.authNoAccount");
            btnAuthSwitch.textContent = t("admin.authRegister");
            if (btnForgotPassword) btnForgotPassword.style.display = "inline-block";
        } else {
            authTitle.textContent = t("admin.authRegister");
            btnAuthSubmit.textContent = t("admin.authRegister");
            authSwitchText.textContent = t("admin.authAlreadyAccount");
            btnAuthSwitch.textContent = t("admin.authLogin");
            if (btnForgotPassword) btnForgotPassword.style.display = "none";
        }
    } else if (mode === "reset") {
        authResetForm.style.display = "block";
        authTitle.textContent = t("admin.authResetPasswordTitle");
    } else if (mode === "update_password") {
        authNewPasswordForm.style.display = "block";
        authTitle.textContent = t("admin.authNewPasswordTitle");
    }
}

btnAuthSwitch?.addEventListener("click", () => {
    switchAuthMode(currentAuthMode === "login" ? "register" : "login");
});

btnForgotPassword?.addEventListener("click", (e) => {
    e.preventDefault();
    switchAuthMode("reset");
});

btnBackToLogin?.addEventListener("click", () => {
    switchAuthMode("login");
});

// ─── Handle Form Submission ───
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = authEmail.value.trim();
    const password = authPassword.value;

    showAuthError(""); // Clear previous errors
    btnAuthSubmit.disabled = true;
    btnAuthSubmit.textContent = "...";

    if (currentAuthMode === "login") {
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
    btnAuthSubmit.textContent = currentAuthMode === "login" ? t("admin.authLogin") : t("admin.authRegister");
});

// ─── Handle Forgot Password ───
authResetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = authResetEmail.value.trim();
    showAuthError("", authResetError);
    btnAuthResetSubmit.disabled = true;
    btnAuthResetSubmit.textContent = "...";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/admin.html'
    });

    btnAuthResetSubmit.disabled = false;
    btnAuthResetSubmit.textContent = t("admin.authResetPasswordBtn");

    if (error) {
        showAuthError(getErrorMessage(error.message), authResetError);
    } else {
        showTempToast(t("toast.passwordResetEmailSent"), "success");
        switchAuthMode("login");
    }
});

// ─── Handle Set New Password ───
authNewPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = authNewPassword.value;
    const confirmPassword = authConfirmPassword.value;

    showAuthError("", authNewPasswordError);

    if (newPassword !== confirmPassword) {
        showAuthError(t("error.passwordsDoNotMatch"), authNewPasswordError);
        return;
    }

    btnAuthNewPasswordSubmit.disabled = true;
    btnAuthNewPasswordSubmit.textContent = "...";

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    btnAuthNewPasswordSubmit.disabled = false;
    btnAuthNewPasswordSubmit.textContent = t("admin.authNewPasswordBtn");

    if (error) {
        showAuthError(getErrorMessage(error.message), authNewPasswordError);
    } else {
        showTempToast(t("toast.passwordUpdated"), "success");
        authNewPassword.value = '';
        authConfirmPassword.value = '';
        showApp();
    }
});

// Handled in admin.js
