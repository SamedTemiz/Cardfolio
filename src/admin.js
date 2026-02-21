import {
    getProjects, addProject, deleteProject, reorderProjects,
    removeImageFromProject, setMainImage,
    getProfile, saveProfile, uploadImages, addImagesToProject
} from "./data.js";
import { supabase } from './supabaseClient.js';
import { checkSession } from "./auth.js";
import { initI18n, translateText as t, getErrorMessage } from "./i18n.js";

// Initialize i18n
initI18n();

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
    const toastEl = document.getElementById("toast");
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.className = `toast show ${type}`;
    setTimeout(() => toastEl.classList.remove("show"), 2500);
}

// ─── Custom Confirm ───────────────────────────────────────────────────────────
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById("modal-overlay");
        const titleEl = document.getElementById("modal-title");
        const msgEl = document.getElementById("modal-message");
        const btnConfirm = document.getElementById("modal-confirm");
        const btnCancel = document.getElementById("modal-cancel");

        titleEl.textContent = title;
        msgEl.textContent = message;
        overlay.classList.add("active");

        const cleanup = (result) => {
            overlay.classList.remove("active");
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
            resolve(result);
        };

        btnConfirm.onclick = () => cleanup(true);
        btnCancel.onclick = () => cleanup(false);
        overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    });
}

// ─── Navigation ───────────────────────────────────────────────────────────────
const navItems = document.querySelectorAll(".admin-nav-item");
const sections = document.querySelectorAll(".admin-section");

navItems.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.section;
        navItems.forEach(b => b.classList.remove("active"));
        sections.forEach(s => s.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`section-${target}`).classList.add("active");
        if (target === "profile") loadProfile();
    });
});

// Initial Section Load
const firstNav = document.querySelector(".admin-nav-item.active");
if (firstNav && firstNav.dataset.section === "profile") {
    loadProfile();
}

// ─── Projects ─────────────────────────────────────────────────────────────────
let selectedProjectId = null;

export async function renderProjects() {
    const projects = await getProjects();
    const list = document.getElementById("project-list");
    const count = document.getElementById("project-count");

    if (projects.length === 1) {
        count.textContent = t("admin.projectCountSingle");
    } else {
        count.textContent = t("admin.projectCount").replace("{n}", projects.length);
    }

    if (projects.length === 0) {
        list.innerHTML = `<div class="empty-state">${t("admin.emptyProjects")}</div>`;
        return;
    }

    list.innerHTML = projects.map((p, index) => {
        let orderBadge = "";

        if (projects.length > 1) {
            if (index === 0) {
                orderBadge = `<span class="stack-badge badge-front">${t("admin.badgeFront")}</span>`;
            } else if (index === projects.length - 1) {
                orderBadge = `<span class="stack-badge badge-back">${t("admin.badgeBack")}</span>`;
            }
        }

        return `
        <div class="project-row ${p.id === selectedProjectId ? "selected" : ""}" data-id="${p.id}" data-index="${index}">
            <div class="drag-handle" title="Drag to reorder">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
            </div>
            ${p.mainImage
                ? `<img class="project-thumb" src="${p.mainImage}" alt="${p.name}" onerror="this.style.display='none'" />`
                : `<div class="project-thumb-placeholder">◻</div>`
            }
            <div class="project-meta">
                <strong>${p.name}</strong>
                <span>${p.description || ""}</span>
                ${orderBadge}
            </div>
            <span class="project-img-count">${p.images?.length || 0} img</span>
            
            <div class="project-actions">
                <button class="btn btn-danger btn-sm btn-delete-proj" data-id="${p.id}" title="Delete project">✕</button>
            </div>
        </div>`;
    }).join("");

    // Row click → open image panel
    list.querySelectorAll(".project-row").forEach(row => {
        row.addEventListener("click", (e) => {
            if (e.target.closest(".btn-delete-proj")) return;
            openImagePanel(row.dataset.id);
        });
    });

    // Delete buttons
    list.querySelectorAll(".btn-delete-proj").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            btn.textContent = "...";
            if (id === selectedProjectId) closeImagePanel();

            const confirmedFound = await showConfirm(t("admin.navProjects"), t("toast.projectDeleted") + "?");
            if (!confirmedFound) {
                btn.textContent = "✕";
                return;
            }

            await deleteProject(id);
            await renderProjects();
            showToast(t("toast.projectDeleted"));
        });
    });

    // ── SortableJS Logic ──
    if (window.Sortable) {
        Sortable.create(list, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;

                if (oldIndex !== newIndex) {
                    await reorderProjects(oldIndex, newIndex);
                    // Re-render instantly to show UI badges adapting
                    await renderProjects();
                }
            }
        });
    }
}

// Add project
document.getElementById("btn-add-project").addEventListener("click", async () => {
    const name = document.getElementById("new-project-name").value.trim();
    const desc = document.getElementById("new-project-desc").value.trim();
    if (!name) {
        document.getElementById("new-project-name").focus();
        return;
    }
    const btn = document.getElementById("btn-add-project");
    btn.disabled = true;
    await addProject(name, desc);
    document.getElementById("new-project-name").value = "";
    document.getElementById("new-project-desc").value = "";
    await renderProjects();
    showToast(t("toast.projectAdded"));
    btn.disabled = false;
});

// Enter key on name input
document.getElementById("new-project-name").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("btn-add-project").click();
});

// ─── Image Panel ──────────────────────────────────────────────────────────────
function openImagePanel(projectId) {
    selectedProjectId = projectId;
    const panel = document.getElementById("image-panel");
    panel.classList.add("visible");
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    renderImageGrid();
    // Highlight selected row
    document.querySelectorAll(".project-row").forEach(r => {
        r.classList.toggle("selected", r.dataset.id === projectId);
    });
}

function closeImagePanel() {
    selectedProjectId = null;
    document.getElementById("image-panel").classList.remove("visible");
    document.querySelectorAll(".project-row").forEach(r => r.classList.remove("selected"));
}

document.getElementById("btn-close-panel").addEventListener("click", closeImagePanel);

async function renderImageGrid() {
    const projects = await getProjects();
    const proj = projects.find(p => p.id === selectedProjectId);
    if (!proj) return;

    document.getElementById("image-panel-title").textContent = `Images — ${proj.name}`;

    const grid = document.getElementById("image-grid");
    const images = proj.images || [];

    if (images.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">No images yet. Upload one above!</div>`;
        return;
    }

    grid.innerHTML = images.map(url => `
        <div class="image-item ${url === proj.mainImage ? "main-image" : ""}" data-url="${url}">
            ${url === proj.mainImage ? `<span class="image-main-badge">Main</span>` : ""}
            <img src="${url}" alt="" onerror="this.parentElement.style.background='#1a1a1e'" />
            <div class="image-item-overlay">
                <button class="btn btn-star ${url === proj.mainImage ? "active" : ""}" data-action="main" title="Set as main">★</button>
                <button class="btn btn-danger" data-action="delete" title="Remove image">✕</button>
            </div>
        </div>
    `).join("");

    grid.querySelectorAll(".image-item").forEach(item => {
        const url = item.dataset.url;

        item.querySelector("[data-action='main']").addEventListener("click", async () => {
            await setMainImage(selectedProjectId, url);
            await renderImageGrid();
            await renderProjects();
            showToast(t("toast.mainImageUpdated"));
        });

        item.querySelector("[data-action='delete']").addEventListener("click", async () => {
            await removeImageFromProject(selectedProjectId, url);
            await renderImageGrid();
            await renderProjects();
            showToast(t("toast.imageRemoved"));
        });
    });
}

// Add images via Supabase Storage
const btnAddImage = document.getElementById("btn-add-image");
btnAddImage.addEventListener("click", async () => {
    const fileInput = document.getElementById("new-image-file");
    const files = fileInput.files;

    if (files.length === 0 || !selectedProjectId) return;

    btnAddImage.disabled = true;
    btnAddImage.textContent = "Uploading...";

    try {
        const publicUrls = await uploadImages(files);
        await addImagesToProject(selectedProjectId, publicUrls);
        fileInput.value = ""; // Clear file picker
        await renderImageGrid();
        await renderProjects();
        const uploadedCount = files.length;
        showToast(t("toast.imagesUploaded").replace("{n}", uploadedCount));
    } catch (e) {
        showToast(getErrorMessage(e.message), "error");
    } finally {
        btnAddImage.disabled = false;
        btnAddImage.textContent = "Upload Image(s)";
    }
});

// ─── Header Hooks ─────────────────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async () => {
    const isConfirmed = await showConfirm(t("admin.logout"), t("admin.logoutConfirm"));
    if (isConfirmed) {
        await supabase.auth.signOut();
    }
});

// ─── Profile ──────────────────────────────────────────────────────────────────
let currentSkills = [];

export async function loadProfile() {
    const p = await getProfile();
    document.getElementById("prof-name").value = p.name || "";
    document.getElementById("prof-title").value = p.title || "";
    document.getElementById("prof-tagline").value = p.tagline || "";
    document.getElementById("prof-about").value = p.about || "";
    document.getElementById("prof-email").value = p.email || "";

    // Set Avatar Preview
    const avatarPreview = document.getElementById("prof-pic-preview");
    if (avatarPreview) {
        avatarPreview.src = p.avatar_url || "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
    }

    // Adjust Back To Site link
    const backBtn = document.getElementById('btn-back-to-site');
    if (backBtn && p.username) {
        backBtn.href = `index.html?user=${p.username}`;
    }

    currentSkills = [...(p.skills || [])];
    renderSkillTags();
}

function renderSkillTags() {
    const container = document.getElementById("skills-tags");
    if (currentSkills.length === 0) {
        container.innerHTML = `<span style="font-size:12px;color:var(--muted)">No skills added.</span>`;
        return;
    }
    container.innerHTML = currentSkills.map((s, i) => `
        <span class="skill-tag">
            ${s}
            <button data-idx="${i}" title="Remove">×</button>
        </span>
    `).join("");

    container.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
            currentSkills.splice(parseInt(btn.dataset.idx), 1);
            renderSkillTags();
        });
    });
}

document.getElementById("btn-add-skill").addEventListener("click", () => {
    const input = document.getElementById("new-skill");
    const val = input.value.trim();
    if (val && !currentSkills.includes(val)) {
        currentSkills.push(val);
        renderSkillTags();
    }
    input.value = "";
});

document.getElementById("new-skill").addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("btn-add-skill").click();
});

// Live Profile Picture Preview
const profPicFile = document.getElementById("prof-pic-file");
const profPicPreview = document.getElementById("prof-pic-preview");
if (profPicFile && profPicPreview) {
    profPicFile.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            profPicPreview.src = URL.createObjectURL(file);
        }
    });
}

const btnSaveProfile = document.getElementById("btn-save-profile");
btnSaveProfile.addEventListener("click", async () => {
    btnSaveProfile.disabled = true;
    btnSaveProfile.textContent = "Saving...";

    try {
        const fileInput = document.getElementById("prof-pic-file");
        let avatarUrl = undefined;
        // Optionally upload new avatar
        if (fileInput.files.length > 0) {
            const urls = await uploadImages([fileInput.files[0]]);
            avatarUrl = urls[0];
        }

        const updates = {
            name: document.getElementById("prof-name").value,
            title: document.getElementById("prof-title").value,
            tagline: document.getElementById("prof-tagline").value,
            about: document.getElementById("prof-about").value,
            email: document.getElementById("prof-email").value,
            skills: currentSkills,
        };

        if (avatarUrl) {
            updates.avatar_url = avatarUrl;
        }

        try {
            await saveProfile(updates);
            showToast(t("toast.profileSaved"));
        } catch (err) {
            showToast(getErrorMessage(err.message), "error");
        }

        if (avatarUrl) {
            const avatarPreview = document.getElementById("prof-pic-preview");
            if (avatarPreview) avatarPreview.src = avatarUrl;
            fileInput.value = ""; // Clear file
        }
    } catch (err) {
        showToast(getErrorMessage(err.message), "error");
    } finally {
        btnSaveProfile.disabled = false;
        btnSaveProfile.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save
        `;
    }
});

// ─── Init ─────────────────────────────────────────────────────────────────────
checkSession();
