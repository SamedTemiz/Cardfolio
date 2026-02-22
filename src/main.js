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
let isIntroDone = false;

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

        container.innerHTML = `
        <div class="landing-wrapper">
            <div class="landing-glass-card" style="padding: 40px 30px;">
                <h1 class="landing-title">${translateText('landing.heroTitle')}</h1>
                <p class="landing-desc">${translateText('landing.heroDesc')}</p>
                
                <div class="landing-input-group" style="flex-direction: column; margin-top: 20px; gap: 15px;">
                    <input type="text" id="username-search" class="landing-input" placeholder="${translateText('landing.placeholder')}" autocomplete="off" style="text-align: center; font-size: 1.05rem;" />
                    <button id="btn-search-user" class="landing-btn" style="width: 100%;">${translateText('landing.btnView')}</button>
                    <a href="admin.html" class="landing-btn-outline landing-btn" style="width: 100%; margin-top: 0;">${translateText('landing.btnAdmin')}</a>
                </div>
            </div>
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

    // Default to locked if in stack mode (no hasVisited or explicit stack)
    if (!isGridMode) lockScroll(); else unlockScroll();

    projects = await getProjects(username);

    if (projects.length === 0) {
        // Hide all personalized UI overlays
        document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = 'none');

        container.innerHTML = `
        <div class="landing-wrapper">
            <div class="not-found-card" style="max-width: 360px; width: 100%; padding: 60px 30px; background: rgba(20, 20, 22, 0.98); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; text-align: center; display: flex; flex-direction: column; align-items: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
                <svg style="width: 140px; height: 140px; margin-bottom: 25px; color: white;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="8" y1="12" x2="16" y2="12"></line>
                </svg>
                <h2 style="font-size: 1.25rem; font-weight: 700; color: white; margin: 0; line-height: 1.4; letter-spacing: -0.3px;">
                    ${translateText('landing.notFound')} <strong style="font-size: 1.35rem;">${username}</strong>
                </h2>
                <a href="index.html" class="landing-btn-outline landing-btn" style="margin-top: 30px; font-size: 0.95rem; border-radius: 8px; padding: 12px 24px; min-width: 200px; font-weight: 600;">
                    ${translateText('landing.searchAgain')}
                </a>
            </div>
        </div>`;

        gsap.fromTo('.not-found-card', 
            { scale: 0.95, opacity: 0 }, 
            { scale: 1, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.2 }
        );
        return;
    }

    // Fetch and populate Profile data
    const profile = await getProfile(username);
    if (profile) {
        const nameEl = document.querySelector('.ui-overlay.top-left');
        const titleEl = document.querySelector('.ui-overlay.top-right');
        const footerNameEl = document.querySelector('.bottom-text-inner span:first-child');

        if (nameEl && profile.name) {
            nameEl.textContent = profile.name.toUpperCase();
            nameEl.href = `profile.html?user=${username}`;
        }
        if (titleEl && profile.title) titleEl.textContent = profile.title.toUpperCase();
        if (footerNameEl && profile.name) footerNameEl.textContent = `© ${new Date().getFullYear()} ${profile.name.toUpperCase()}`;
    }

    images = projects.map(p => p.mainImage || (p.images && p.images[0]) || "");

    createCards();
    initDraggable();
    setupMatchMedia();

    // Show UI overlays now that content is loaded
    document.querySelectorAll('.ui-overlay, .bottom-area, .drag-hint').forEach(el => el.style.display = '');

    // Play the full intro on every load to ensure WOW effect
    setTimeout(animateIntro, 100);
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
            rotation: (Math.random() - 0.5) * 10,
            opacity: 0,
            // Start the cards further out on the Y axis for a drop-in effect on first visit
            y: -window.innerHeight - 500,
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
                isIntroDone = true;
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
        // Run logic immediately to establish state ONLY if intro is done
        if (isIntroDone) {
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
        if (isIntroDone) {
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

    const isMobile = window.innerWidth <= 768;
    // On mobile, use a much tighter margin so if the card is dragged ~75% out it snaps back
    const margin = isMobile ? -50 : 100;

    // Check if the center of the card is outside the 'allowed' box
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
