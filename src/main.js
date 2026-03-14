import { gsap } from "gsap";
import { Draggable } from "gsap/all";
import { initI18n, translateText } from "./i18n.js";
import { getProjects, getProfile, getOptimizedImageUrl } from "./data.js";

gsap.registerPlugin(Draggable);

// Initialize Language Engine
initI18n();


// --- Configuration: loaded dynamically via Supabase ---
let projects = [];
let images = [];

const container = document.getElementById("container");
let cards = [];
let scrollSpacer = document.createElement("div");
scrollSpacer.classList.add("scroll-spacer");
let draggableInstances = [];
let isGridMode = sessionStorage.getItem("portfolioViewMode") === "grid";
let isIntroDone = false;

// GSAP MatchMedia Instance
let mm = gsap.matchMedia();

// --- Initialization ---
async function init() {
    setupInteractions();

    // Parse Username from URL
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('uid');
    const username = urlParams.get('user');

    if (!userId) {
        // Hide all personalized UI overlays
        document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = 'none');

        container.innerHTML = `
        <div class="landing-wrapper">
            <div class="landing-glass-card" style="padding: 40px 30px; max-width: 440px;">
                <h1 class="landing-title">${translateText('landing.heroTitle')}</h1>
                <p class="landing-desc" style="margin-bottom: 25px;">${translateText('landing.heroDesc')}</p>
                
                <div class="landing-input-group" style="flex-direction: column; margin-top: 0; gap: 15px;">
                    <input type="text" id="username-search" class="landing-input" placeholder="${translateText('landing.placeholder')}" autocomplete="off" style="font-size: 0.95rem; padding: 15px 20px;" />
                    <button id="btn-search-user" class="landing-btn" style="width: 100%;">${translateText('landing.btnView')}</button>
                    <a href="admin.html" class="landing-btn-brand landing-btn" style="width: 100%; margin-top: 0;">${translateText('landing.btnAdmin')}</a>
                </div>
            </div>
        </div>`;

        // Logic for search button
        const searchUser = () => {
            let val = document.getElementById('username-search').value.trim();
            if (!val) return;

            // 1. If it's a full URL, redirect directly
            if (val.includes('://')) {
                window.location.href = val;
                return;
            }

            // 2. If it contains uid param, use it
            if (val.includes('uid=')) {
                window.location.href = val.startsWith('?') ? val : `?${val}`;
                return;
            }

            const input = document.getElementById('username-search');
            input.style.borderColor = 'var(--danger-color)';
            gsap.to(input, { x: 5, duration: 0.1, repeat: 5, yoyo: true });
        };
        document.getElementById('btn-search-user').addEventListener('click', searchUser);
        document.getElementById('username-search').addEventListener('keydown', e => {
            if (e.key === 'Enter') searchUser();
        });

        // Entrance Animation
        gsap.fromTo('.landing-glass-card',
            { y: 50, opacity: 0 },
            { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.2 }
        );
        gsap.fromTo('.landing-glass-card > *',
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.8, stagger: 0.1, ease: 'power2.out', delay: 0.4 }
        );

        return;
    }

    // Portfolio path: show loading overlay until card images are ready
    const indexProgressOverlay = document.getElementById('indexProgressOverlay');
    if (indexProgressOverlay) {
        indexProgressOverlay.style.display = 'flex';
    }

    // Default to locked if in stack mode (no hasVisited or explicit stack)
    if (!isGridMode) lockScroll(); else unlockScroll();

    // 1. Fetch profile and projects in parallel for performance
    try {
        const profileResponse = await getProfile(username, userId);
        if (profileResponse && profileResponse.id) {
            const projectsResponse = await getProjects(null, profileResponse.id);

            const profile = profileResponse;
            projects = projectsResponse;

            // Update UI with profile data
            const nameEl = document.querySelector('.ui-overlay.top-left');
            const titleEl = document.querySelector('.ui-overlay.top-right');
            const footerNameEl = document.querySelector('.bottom-text-inner span:first-child');

            if (nameEl && profile.name) {
                nameEl.textContent = profile.name.toLocaleUpperCase(window.currentLanguage === 'tr' ? 'tr-TR' : 'en-US');
                nameEl.href = `profile.html?user=${username}&uid=${profile.id}`;
            }
            if (titleEl && profile.title) titleEl.textContent = profile.title.toLocaleUpperCase(window.currentLanguage === 'tr' ? 'tr-TR' : 'en-US');
            if (footerNameEl && profile.name) {
                const upName = profile.name.toLocaleUpperCase(window.currentLanguage === 'tr' ? 'tr-TR' : 'en-US');
                footerNameEl.textContent = `© ${new Date().getFullYear()} ${upName}`;
            }
            if (profile.name) document.title = `Cardfolio | ${profile.name}`;

            if (projects.length === 0) {
                hideIndexProgressOverlay();
                showNoProjectsUI();
                return;
            }

            images = projects.map(p => p.mainImage || (p.images && p.images[0]) || "");

            createCards().then(() => {
                hideIndexProgressOverlay();
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (sessionStorage.getItem("returnFromDetail") === "1") {
                            sessionStorage.removeItem("returnFromDetail");
                            showGridWithoutIntro();
                        } else {
                            setTimeout(animateIntro, 50);
                        }
                    });
                });
            });
            initDraggable();
            setupMatchMedia();

            // Show UI overlays now that content is loaded
            document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = '');
        } else {
            hideIndexProgressOverlay();
            showNotFoundUI(username);
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        hideIndexProgressOverlay();
    }
}

function hideIndexProgressOverlay() {
    const overlay = document.getElementById('indexProgressOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.remove();
    }, 400);
}

function showNotFoundUI(username) {
    document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = 'none');
    container.innerHTML = `
    <div class="landing-wrapper">
        <div class="not-found-card" style="max-width: 360px; width: 100%; padding: 60px 30px; background: rgba(20, 20, 22, 0.98); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; text-align: center; display: flex; flex-direction: column; align-items: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
            <svg style="width: 140px; height: 140px; margin-bottom: 25px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0; line-height: 1.4; letter-spacing: -0.3px;">
                ${translateText('landing.notFound')} <strong style="font-size: 1.35rem;">${username || 'USER'}</strong>
            </h2>
            <a href="index.html" class="landing-btn-outline landing-btn" style="margin-top: 30px; font-size: 0.95rem; border-radius: 8px; padding: 12px 24px; min-width: 200px; font-weight: 600;">
                ${translateText('landing.searchAgain')}
            </a>
        </div>
    </div>`;
    gsap.fromTo('.not-found-card', { scale: 0.95, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 });
}

function showNoProjectsUI() {
    document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = 'none');
    container.innerHTML = `
    <div class="landing-wrapper">
        <div class="not-found-card" style="max-width: 360px; width: 100%; padding: 60px 30px; background: rgba(20, 20, 22, 0.98); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; text-align: center; display: flex; flex-direction: column; align-items: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
            <div class="empty-icon-container" style="width: 100px; height: 100px; background: rgba(255,211,105,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 25px;">
                <svg style="width: 50px; height: 50px; color: var(--accent-secondary);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" style="opacity: 0.4"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1" style="opacity: 0.4"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1" style="opacity: 0.4"></rect>
                    <path d="M3 14h7v7H3z" style="opacity: 0.1"></path>
                    <line x1="6.5" y1="14.5" x2="6.5" y2="20.5" stroke-dasharray="2 2"></line>
                    <line x1="3.5" y1="17.5" x2="9.5" y2="17.5" stroke-dasharray="2 2"></line>
                </svg>
            </div>
            <h2 style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0; line-height: 1.4; letter-spacing: -0.3px;">
                ${translateText('landing.noProjects')}
            </h2>
            <p style="color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-top: 12px; line-height: 1.5; max-width: 240px;">
                ${translateText('landing.noProjectsDesc')}
            </p>
            <a href="index.html" class="landing-btn-outline landing-btn" style="margin-top: 30px; font-size: 0.95rem; border-radius: 8px; padding: 12px 24px; min-width: 200px; font-weight: 600;">
                ${translateText('landing.searchAgain')}
            </a>
        </div>
    </div>`;
    gsap.fromTo('.not-found-card', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 });
}

function createCards() {
    const loadPromises = [];

    projects.forEach((proj, index) => {
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user');
        const uid = urlParams.get('uid');

        const rawUrl = proj.mainImage || (proj.images && proj.images[0]) || "";
        const card = document.createElement("a");
        card.href = `project-detail.html?user=${username}&id=${proj.id}&uid=${uid || ''}`;
        card.className = "card";
        card.dataset.rawUrl = rawUrl;
        card.setAttribute("data-hover-text", translateText("card.viewProject"));

        gsap.set(card, {
            left: "50%",
            top: "50%",
            xPercent: -50,
            yPercent: -50,
            rotation: (Math.random() - 0.5) * 10,
            opacity: 0,
            y: -window.innerHeight - 500,
            zIndex: projects.length - index
        });

        if (!rawUrl) {
            loadPromises.push(Promise.resolve());
        } else {
            const optimizedUrl = getOptimizedImageUrl(rawUrl, { width: 600, quality: 75, format: 'webp' });
            const img = new Image();
            const p = new Promise((resolve) => {
                img.onload = () => {
                    card.style.backgroundImage = `url("${optimizedUrl}")`;
                    card.removeAttribute('data-raw-url');
                    if (typeof img.decode === 'function') {
                        img.decode().then(resolve).catch(() => resolve());
                    } else {
                        resolve();
                    }
                };
                img.onerror = () => {
                    card.style.backgroundImage = `url("${rawUrl}")`;
                    card.removeAttribute('data-raw-url');
                    resolve();
                };
                img.src = optimizedUrl;
            });
            loadPromises.push(p);
        }

        container.appendChild(card);
        cards.push(card);
    });

    return Promise.all(loadPromises);
}

function animateIntro() {
    gsap.fromTo(cards,
        {
            opacity: 0,
            y: -window.innerHeight - 200,
        },
        {
            opacity: 1,
            y: 0,
            rotation: () => (Math.random() - 0.5) * 10,
            duration: 0.8,
            stagger: {
                each: 0.25,
                from: "end"
            },
            ease: "power2.out",
            onComplete: () => {
                isIntroDone = true;
                if (isGridMode) toGrid(); else toStack();

                const hint = document.getElementById("dragHint");
                if (hint && !isGridMode) {
                    gsap.to(hint, { opacity: 1, duration: 0.5, delay: 0.5 });
                }
            }
        });
}

function showGridWithoutIntro() {
    gsap.set(cards, { opacity: 1, y: 0, x: 0, rotation: 0, xPercent: -50, yPercent: -50 });
    isIntroDone = true;
    toGrid();
}

function dismissDragHint() {
    const hint = document.getElementById("dragHint");
    if (hint) {
        gsap.to(hint, { opacity: 0, duration: 0.5 });
        setTimeout(() => hint.remove(), 500);
    }
}

function initDraggable() {
    draggableInstances = Draggable.create(".card", {
        type: "x,y",
        edgeResistance: 0.65,
        bounds: null,
        zIndexBoost: true,
        onDragStart: function () {
            dismissDragHint();
        },
        onDrag: function () {
            this.velocityX = this.x - (this.lastX || this.x);
            this.velocityY = this.y - (this.lastY || this.y);
            this.lastX = this.x;
            this.lastY = this.y;
        },
        onClick: function () {
            window.location.href = this.target.href;
        },
        onDragEnd: function () {
            const velocityX = this.velocityX || 0;
            const velocityY = this.velocityY || 0;
            const target = this.target;
            const maxVelocity = 60;
            const clampedX = Math.max(-maxVelocity, Math.min(maxVelocity, velocityX));
            const clampedY = Math.max(-maxVelocity, Math.min(maxVelocity, velocityY));

            gsap.to(target, {
                x: this.x + clampedX * 15,
                y: this.y + clampedY * 15,
                duration: 0.8,
                ease: "power2.out",
                overwrite: "auto",
                onComplete: () => checkBounds(target)
            });

            this.lastX = undefined;
            this.lastY = undefined;
        }
    });
}

function setupMatchMedia() {
    mm.add("(min-width: 769px)", () => {
        if (isIntroDone) {
            if (isGridMode) toGridDesktop(); else toStackDesktop();
        }
    });

    mm.add("(max-width: 768px)", () => {
        if (isIntroDone) {
            if (isGridMode) toGridMobile(); else toStackMobile();
        }
        return () => {
            if (scrollSpacer.parentNode) scrollSpacer.parentNode.removeChild(scrollSpacer);
            container.classList.remove("scroll-mode");
            draggableInstances.forEach(d => d.enable());
        };
    });
}

function checkBounds(card) {
    const rect = card.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const isMobile = window.innerWidth <= 768;
    const margin = isMobile ? -50 : 100;
    const isOut = centerX < -margin || centerX > viewportWidth + margin || centerY < -margin || centerY > viewportHeight + margin;

    if (isOut) {
        let targetX = 0, targetY = 0, targetRot = (Math.random() - 0.5) * 10, targetScale = 1;
        if (isGridMode) {
            targetX = parseFloat(card.dataset.gridX) || 0;
            targetY = parseFloat(card.dataset.gridY) || 0;
            targetRot = 0;
            targetScale = parseFloat(card.dataset.gridScale) || 1;
        } else {
            targetScale = isMobile ? 0.55 : 1;
            if (isMobile) targetY = -30;
        }
        gsap.to(card, { x: targetX, y: targetY, xPercent: -50, yPercent: -50, rotation: targetRot, scale: targetScale, duration: 1.2, ease: "elastic.out(1, 0.75)", overwrite: "auto" });
    }
}

function setupInteractions() {
    const resetBtn = document.getElementById("drag-reset-btn");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            if (isGridMode) toStack(); else toGrid();
        });
    }
}

function toGrid() {
    isGridMode = true;
    sessionStorage.setItem("portfolioViewMode", "grid");
    dismissDragHint();
    const iconGrid = document.getElementById('icon-grid'), iconStack = document.getElementById('icon-stack');
    if (iconGrid) iconGrid.style.display = 'none';
    if (iconStack) iconStack.style.display = 'block';
    unlockScroll();
    if (window.innerWidth <= 768) toGridMobile(); else toGridDesktop();
}

function toStack() {
    isGridMode = false;
    sessionStorage.setItem("portfolioViewMode", "stack");
    const iconGrid = document.getElementById('icon-grid'), iconStack = document.getElementById('icon-stack');
    if (iconGrid) iconGrid.style.display = 'block';
    if (iconStack) iconStack.style.display = 'none';
    lockScroll();
    if (window.innerWidth <= 768) toStackMobile(); else toStackDesktop();
}

function toGridDesktop() {
    const totalCards = cards.length;
    const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    let columns = 4;
    if (viewportWidth < 1200) columns = 3;
    if (viewportWidth < 900) columns = 2;
    columns = Math.min(columns, totalCards);
    const rows = Math.ceil(totalCards / columns);
    const padding = 60, gap = 20;
    const usableWidth = viewportWidth - (padding * 2);
    const widthBasedScale = (usableWidth - (gap * (columns - 1))) / columns / 300;
    const usableHeight = viewportHeight - (padding * 2);
    const heightBasedScale = (usableHeight - (gap * (rows - 1))) / rows / 400;
    const cardScale = Math.min(1, widthBasedScale, heightBasedScale), cardW = 300 * cardScale, cardHeight = 400 * cardScale;

    if (scrollSpacer.parentNode) scrollSpacer.parentNode.removeChild(scrollSpacer);
    container.classList.remove("scroll-mode");
    draggableInstances.forEach(d => d.enable());
    gsap.set(cards, { top: "50%", left: "50%", marginTop: 0 });

    const totalGridH = (cardHeight * rows) + (gap * (rows - 1));
    const startY = -totalGridH / 2 + cardHeight / 2;

    cards.forEach((card, i) => {
        const col = i % columns, row = Math.floor(i / columns);
        let itemsInThisRow = columns;
        if (row === rows - 1 && totalCards % columns !== 0) itemsInThisRow = totalCards % columns;
        const rowWidth = (cardW * itemsInThisRow) + (gap * (itemsInThisRow - 1));
        const startX = -rowWidth / 2 + cardW / 2;
        const xPos = startX + (col * (cardW + gap)), yPos = startY + (row * (cardHeight + gap));
        card.dataset.gridX = xPos; card.dataset.gridY = yPos; card.dataset.gridScale = cardScale;
        gsap.to(card, { x: xPos, y: yPos, xPercent: -50, yPercent: -50, rotation: 0, scale: cardScale, zIndex: projects.length - i, duration: 0.8, ease: "power3.inOut" });
    });
}

function toGridMobile() {
    const totalCards = cards.length;
    const rows = totalCards, gap = 40, cardScale = 0.65, cardHeight = 400 * cardScale;
    draggableInstances.forEach(d => d.disable());
    container.classList.add("grid-scroll-active");
    document.documentElement.classList.add("grid-scroll-body");
    document.body.classList.add("grid-scroll-body");
    if (!scrollSpacer.parentNode) container.appendChild(scrollSpacer);
    gsap.set(cards, { top: 0, left: "50%", marginTop: 0 });
    const topStart = 100, totalHeight = topStart + (rows * (cardHeight + gap)) + 250;
    scrollSpacer.style.height = `${totalHeight}px`; scrollSpacer.style.width = "1px";

    cards.forEach((card, i) => {
        const xPos = 0, yPos = topStart + (i * (cardHeight + gap));
        card.dataset.gridX = xPos; card.dataset.gridY = yPos; card.dataset.gridScale = cardScale;
        gsap.to(card, { x: xPos, y: yPos, xPercent: -50, yPercent: 0, rotation: 0, scale: cardScale, zIndex: projects.length - i, duration: 0.6, ease: "power3.inOut" });
    });
}

function toStackDesktop() {
    if (scrollSpacer.parentNode) scrollSpacer.parentNode.removeChild(scrollSpacer);
    container.classList.remove("scroll-mode");
    draggableInstances.forEach(d => d.enable());
    gsap.set(cards, { top: "50%", left: "50%", marginTop: 0 });
    cards.forEach((card, i) => {
        gsap.to(card, { x: 0, y: 0, xPercent: -50, yPercent: -50, rotation: (Math.random() - 0.5) * 10, scale: 1, zIndex: projects.length - i, duration: 0.8, ease: "power3.inOut" });
    });
}

function toStackMobile() {
    if (scrollSpacer.parentNode) scrollSpacer.parentNode.removeChild(scrollSpacer);
    container.classList.remove("grid-scroll-active");
    document.documentElement.classList.remove("grid-scroll-body");
    document.body.classList.remove("grid-scroll-body");
    draggableInstances.forEach(d => d.enable());
    gsap.set(cards, { top: "50%", left: "50%", marginTop: 0 });
    cards.forEach((card, i) => {
        gsap.to(card, { x: 0, y: window.innerWidth <= 768 ? -30 : 0, xPercent: -50, yPercent: -50, rotation: (Math.random() - 0.5) * 10, scale: 0.55, zIndex: projects.length - i, duration: 0.8, ease: "power3.inOut" });
    });
}

function lockScroll() {
    document.documentElement.classList.add('is-stack');
    document.body.classList.add('is-stack');
    document.getElementById('app').classList.add('is-stack');
    document.getElementById('container').classList.add('is-stack');
}

function unlockScroll() {
    document.documentElement.classList.remove('is-stack');
    document.body.classList.remove('is-stack');
    document.getElementById('app').classList.remove('is-stack');
    document.getElementById('container').classList.remove('is-stack');
    if (window.innerWidth > 768 || !isGridMode) {
        document.documentElement.classList.remove("grid-scroll-body");
        document.body.classList.remove("grid-scroll-body");
        container.classList.remove("grid-scroll-active");
    }
}

init();
