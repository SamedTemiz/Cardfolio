import { gsap } from "gsap";
import { Draggable } from "gsap/all";
import { initI18n, translateText } from "./i18n.js";
import { getProjects, getProfile } from "./data.js";

gsap.registerPlugin(Draggable);

// Initialize Language Engine
initI18n();

console.log("GSAP Draggable Cardfolio Initialized");

// --- Configuration: loaded dynamically via Supabase ---
let projects = [];
let images = [];

const container = document.getElementById("container");
let cards = [];
let scrollSpacer = document.createElement("div");
scrollSpacer.classList.add("scroll-spacer");
let draggableInstances = [];
let isGridMode = sessionStorage.getItem("portfolioViewMode") === "grid";
const hasVisited = sessionStorage.getItem("portfolioVisited") === "true";

// GSAP MatchMedia Instance
let mm = gsap.matchMedia();

// --- Initialization ---
async function init() {
    setupInteractions();

    // Parse Username from URL
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('user');

    if (!username) {
        // Hide all personalized UI overlays
        document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = 'none');

        container.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; color:var(--text2); font-family:sans-serif; flex-direction:column; gap:15px;">
            <h2 style="color:var(--text1); font-size:24px; font-weight:700; letter-spacing:0.05em; margin-bottom:10px;">${translateText('landing.title')}</h2>
            <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
                <input type="text" id="username-search" placeholder="${translateText('landing.placeholder')}" style="padding:12px 16px; border-radius:8px; border:none; background:#1a1a1e; color:var(--text1); outline:none; font-family:inherit; min-width:250px;" />
                <button id="btn-search-user" class="btn btn-primary" style="padding:12px 24px; font-weight:700;">${translateText('landing.btnView')}</button>
            </div>
            <a href="admin.html" style="color:var(--accent); text-decoration:none; margin-top:20px; font-size:14px; font-weight:600;">${translateText('landing.btnAdmin')}</a>
        </div>`;

        // Logic for search button
        const searchUser = () => {
            const val = document.getElementById('username-search').value.trim();
            if (val) window.location.href = `?user=${val}`;
        };
        document.getElementById('btn-search-user').addEventListener('click', searchUser);
        document.getElementById('username-search').addEventListener('keydown', e => {
            if (e.key === 'Enter') searchUser();
        });

        return;
    }

    // Default to locked if in stack mode (no hasVisited or explicit stack)
    if (!isGridMode) lockScroll(); else unlockScroll();

    projects = await getProjects(username);

    if (projects.length === 0) {
        // Hide all personalized UI overlays
        document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = 'none');

        container.innerHTML = `<div style="display:flex; height:100vh; align-items:center; justify-content:center; color:var(--text2); font-family:sans-serif; flex-direction:column; gap:15px;">
            <p>${translateText('landing.notFound')} <strong>${username}</strong>.</p>
            <a href="index.html" style="color:var(--accent); text-decoration:none; margin-top:10px; font-weight:600;">${translateText('landing.searchAgain')}</a>
        </div>`;
        return;
    }

    // Fetch and populate Profile data
    const profile = await getProfile(username);
    if (profile) {
        const nameEl = document.querySelector('.ui-overlay.top-left');
        const titleEl = document.querySelector('.ui-overlay.top-right');
        const footerNameEl = document.querySelector('.bottom-text-inner span:first-child');
        const footerInternEl = document.querySelector('.bottom-text-inner span:last-child');

        if (nameEl && profile.name) {
            nameEl.textContent = profile.name.toUpperCase();
            nameEl.href = `profile.html?user=${username}`;
        }
        if (titleEl && profile.title) titleEl.textContent = profile.title.toUpperCase();
        if (footerNameEl && profile.name) footerNameEl.textContent = `© ${new Date().getFullYear()} ${profile.name.toUpperCase()}`;
        if (footerInternEl && profile.tagline) footerInternEl.textContent = profile.tagline.toUpperCase();
    }

    images = projects.map(p => p.mainImage || (p.images && p.images[0]) || "");

    createCards();
    initDraggable();
    setupMatchMedia();

    if (!hasVisited) {
        sessionStorage.setItem("portfolioVisited", "true");
        // Play the full intro
        setTimeout(animateIntro, 100);
    } else {
        // Fast resume: immediately calculate layout, then quickly fade in
        if (isGridMode) toGrid(); else toStack();
        gsap.to(cards, { opacity: 1, duration: 0.6, delay: 0.1 });
    }
}

function createCards() {
    projects.forEach((proj, index) => {
        const urlParams = new URLSearchParams(window.location.search);
        const username = urlParams.get('user');

        const url = proj.mainImage || (proj.images && proj.images[0]) || "";
        const card = document.createElement("a");
        card.href = `project-detail.html?user=${username}&id=${proj.id}`;
        card.className = "card";
        card.style.backgroundImage = `url(${url})`;
        // Pass translated text down for the CSS pseudo-element to pick up via `content: attr(data-hover-text)`
        card.setAttribute("data-hover-text", translateText("card.viewProject"));

        // Reversed logic: Index 0 (first in admin list) gets the HIGHEST z-index
        // so it appears visibly in front of everything else.
        gsap.set(card, {
            left: "50%",
            top: "50%",
            xPercent: -50,
            yPercent: -50,
            rotation: hasVisited ? (Math.random() - 0.5) * 10 : 0,
            opacity: 0,
            // Start the cards further out on the Y axis for a drop-in effect on first visit
            y: hasVisited ? 0 : -window.innerHeight - 500,
            zIndex: projects.length - index
        });

        container.appendChild(card);
        cards.push(card);
    });
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
            duration: 0.8, // Daha hızlı ve tok bir düşüş
            stagger: {
                each: 0.25, // Çok tatlı bir üst üste binme süresi
                from: "end"
            },
            ease: "power2.out",
            onComplete: () => {
                // Force layout update after intro based on current state
                if (isGridMode) toGrid(); else toStack();

                // Show drag hint if in stack mode
                const hint = document.getElementById("dragHint");
                if (hint && !isGridMode) {
                    gsap.to(hint, { opacity: 1, duration: 0.5, delay: 0.5 });
                }
            }
        });
}

// Dismiss the drag hint on first user interaction
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
        bounds: null, // Allow throwing out
        zIndexBoost: true,

        onDragStart: function () {
            // No scale animation here to preserve layout scale
            dismissDragHint();
        },

        onDrag: function () {
            this.velocityX = this.x - (this.lastX || this.x);
            this.velocityY = this.y - (this.lastY || this.y);
            this.lastX = this.x;
            this.lastY = this.y;
        },

        onClick: function () {
            // Navigate to detail page on simple click (not drag)
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
    // Desktop Setup
    mm.add("(min-width: 769px)", (context) => {
        // Run logic immediately to establish state ONLY if returning
        if (hasVisited) {
            if (isGridMode) {
                toGridDesktop();
            } else {
                toStackDesktop();
            }
        }
        // If it's a first visit, the animateIntro function's onComplete handles the initial layout call.
        // Return cleanup function if needed
        return () => {
            // Undo any desktop specific inline styles if necessary
        };
    });

    // Mobile Setup
    mm.add("(max-width: 768px)", (context) => {
        if (hasVisited) {
            if (isGridMode) {
                toGridMobile();
            } else {
                toStackMobile();
            }
        }
        // If it's a first visit, the animateIntro function's onComplete handles the initial layout call.

        return () => {
            // Clean up mobile scroll spacer logic when returning to desktop
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

    const margin = 100;
    const isOut =
        centerX < -margin ||
        centerX > viewportWidth + margin ||
        centerY < -margin ||
        centerY > viewportHeight + margin;

    if (isOut) {
        let targetX = 0;
        let targetY = 0;
        let targetRot = (Math.random() - 0.5) * 10;
        let targetScale = 1;

        if (isGridMode) {
            targetX = parseFloat(card.dataset.gridX) || 0;
            targetY = parseFloat(card.dataset.gridY) || 0;
            targetRot = 0;
            targetScale = parseFloat(card.dataset.gridScale) || 1;
        } else {
            const isMobile = window.innerWidth <= 768;
            targetScale = isMobile ? 0.55 : 1;
            if (isMobile) targetY = -30;
        }

        gsap.to(card, {
            x: targetX,
            y: targetY,
            xPercent: -50,
            yPercent: -50,
            rotation: targetRot,
            scale: targetScale,
            duration: 1.2,
            ease: "elastic.out(1, 0.75)",
            overwrite: "auto"
        });
    }
}

function setupInteractions() {
    const resetBtn = document.getElementById("drag-reset-btn");
    if (!resetBtn) return;

    resetBtn.addEventListener("click", () => {
        if (isGridMode) {
            toStack();
        } else {
            toGrid();
        }
    });
}

// Route to correct layout function based on window size
function toGrid() {
    isGridMode = true;
    sessionStorage.setItem("portfolioViewMode", "grid");
    dismissDragHint(); // User switched view — also dismiss the hint
    const iconGrid = document.getElementById('icon-grid');
    const iconStack = document.getElementById('icon-stack');
    if (iconGrid) iconGrid.style.display = 'none';
    if (iconStack) iconStack.style.display = 'block';

    if (window.innerWidth <= 768) {
        unlockScroll();
        toGridMobile();
    } else {
        unlockScroll();
        toGridDesktop();
    }
}

function toStack() {
    isGridMode = false;
    sessionStorage.setItem("portfolioViewMode", "stack");
    const iconGrid = document.getElementById('icon-grid');
    const iconStack = document.getElementById('icon-stack');
    if (iconGrid) iconGrid.style.display = 'block';
    if (iconStack) iconStack.style.display = 'none';

    if (window.innerWidth <= 768) {
        lockScroll();
        toStackMobile();
    } else {
        lockScroll();
        toStackDesktop();
    }
}


function toGridDesktop() {
    const totalCards = cards.length;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let columns = 4;
    if (viewportWidth < 1200) columns = 3;
    if (viewportWidth < 900) columns = 2;
    columns = Math.min(columns, totalCards);
    const rows = Math.ceil(totalCards / columns);

    const padding = 60;
    const gap = 20;

    const usableWidth = viewportWidth - (padding * 2);
    const widthBasedScale = (usableWidth - (gap * (columns - 1))) / columns / 300;
    const usableHeight = viewportHeight - (padding * 2);
    const heightBasedScale = (usableHeight - (gap * (rows - 1))) / rows / 400;

    const cardScale = Math.min(1, widthBasedScale, heightBasedScale);
    const cardW = 300 * cardScale;
    const cardHeight = 400 * cardScale;

    // Reset container and draggables for Desktop
    if (scrollSpacer.parentNode) scrollSpacer.parentNode.removeChild(scrollSpacer);
    container.classList.remove("scroll-mode");
    draggableInstances.forEach(d => d.enable());
    gsap.set(cards, { top: "50%", left: "50%", marginTop: 0 });

    const totalGridH = (cardHeight * rows) + (gap * (rows - 1));
    const startY = -totalGridH / 2 + cardHeight / 2;

    cards.forEach((card, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);

        // Find how many items are in the current row to center it
        let itemsInThisRow = columns;
        if (row === rows - 1 && totalCards % columns !== 0) {
            itemsInThisRow = totalCards % columns;
        }
        const rowWidth = (cardW * itemsInThisRow) + (gap * (itemsInThisRow - 1));
        const startX = -rowWidth / 2 + cardW / 2;

        const xPos = startX + (col * (cardW + gap));
        const yPos = startY + (row * (cardHeight + gap));

        card.dataset.gridX = xPos;
        card.dataset.gridY = yPos;
        card.dataset.gridScale = cardScale;

        gsap.to(card, {
            x: xPos,
            y: yPos,
            xPercent: -50,
            yPercent: -50,
            rotation: 0,
            scale: cardScale,
            zIndex: projects.length - i,
            duration: 0.8,
            ease: "power3.inOut"
        });
    });
}

function toGridMobile() {
    const totalCards = cards.length;
    let columns = 1;
    const rows = totalCards;

    const gap = 40;
    const cardScale = 0.65;
    const cardHeight = 400 * cardScale;

    // Setup Mobile Scroll Container
    draggableInstances.forEach(d => d.disable());
    container.classList.add("grid-scroll-active");
    document.documentElement.classList.add("grid-scroll-body");
    document.body.classList.add("grid-scroll-body");

    if (!scrollSpacer.parentNode) {
        container.appendChild(scrollSpacer);
    }

    // Top relative layout 
    gsap.set(cards, { top: 0, left: "50%", marginTop: 0 });

    const topStart = 100;
    const totalHeight = topStart + (rows * (cardHeight + gap)) + 250;

    scrollSpacer.style.height = `${totalHeight}px`;
    scrollSpacer.style.width = "1px";

    cards.forEach((card, i) => {
        const xPos = 0;
        const yPos = topStart + (i * (cardHeight + gap));

        card.dataset.gridX = xPos;
        card.dataset.gridY = yPos;
        card.dataset.gridScale = cardScale;

        gsap.to(card, {
            x: xPos,
            y: yPos,
            xPercent: -50,
            yPercent: 0, // Top relative
            rotation: 0,
            scale: cardScale,
            zIndex: projects.length - i,
            duration: 0.6,
            ease: "power3.inOut"
        });
    });
}


function toStackDesktop() {
    if (scrollSpacer.parentNode) scrollSpacer.parentNode.removeChild(scrollSpacer);
    container.classList.remove("scroll-mode");
    draggableInstances.forEach(d => d.enable());

    gsap.set(cards, { top: "50%", left: "50%", marginTop: 0 });

    cards.forEach((card, i) => {
        gsap.to(card, {
            x: 0,
            y: 0,
            xPercent: -50,
            yPercent: -50,
            rotation: (Math.random() - 0.5) * 10,
            scale: 1,
            zIndex: projects.length - i,
            duration: 0.8,
            ease: "power3.inOut"
        });
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
        gsap.to(card, {
            x: 0,
            y: window.innerWidth <= 768 ? -30 : 0, // Slight upward adjust for bottom UI elements
            xPercent: -50,
            yPercent: -50,
            rotation: (Math.random() - 0.5) * 10,
            scale: 0.55,
            zIndex: projects.length - i,
            duration: 0.8,
            ease: "power3.inOut"
        });
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

    // Also clear grid scroll overrides if we are switching away
    if (window.innerWidth > 768 || !isGridMode) {
        document.documentElement.classList.remove("grid-scroll-body");
        document.body.classList.remove("grid-scroll-body");
        container.classList.remove("grid-scroll-active");
    }
}

init();
