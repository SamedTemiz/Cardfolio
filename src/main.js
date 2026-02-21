import { gsap } from "gsap";
import { Draggable } from "gsap/all";
import { initI18n, translateText } from "./i18n.js";

gsap.registerPlugin(Draggable);

// Initialize Language Engine
initI18n();

console.log("GSAP Draggable Portfolio Initialized");

// --- Configuration ---
const images = [
    "https://images.unsplash.com/photo-1542398553-61b6c7f42d07?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1621609764180-2ca554a9d6f2?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1635805737707-575885ab0820?q=80&w=600&auto=format&fit=crop"
];

const container = document.getElementById("container");
let cards = [];
let scrollSpacer = document.createElement("div");
scrollSpacer.classList.add("scroll-spacer");
let draggableInstances = [];
let isGridMode = false;

// GSAP MatchMedia Instance
let mm = gsap.matchMedia();

// --- Initialization ---
function init() {
    createCards();
    initDraggable();
    setupInteractions();
    setupMatchMedia();

    // Intro Animation
    setTimeout(animateIntro, 100);
}

function createCards() {
    images.forEach((url, index) => {
        const card = document.createElement("a");
        card.href = "project-detail.html";
        card.className = "card";
        card.style.backgroundImage = `url(${url})`;
        // Pass translated text down for the CSS pseudo-element to pick up via `content: attr(data-hover-text)`
        card.setAttribute("data-hover-text", translateText("card.viewProject"));

        // Initial setup applies universally
        gsap.set(card, {
            left: "50%",
            top: "50%",
            xPercent: -50,
            yPercent: -50,
            rotation: 0,
            opacity: 0,
            zIndex: index + 1
        });

        container.appendChild(card);
        cards.push(card);
    });
}

function animateIntro() {
    gsap.to(cards, {
        opacity: 1,
        rotation: () => (Math.random() - 0.5) * 10,
        duration: 1.2,
        stagger: {
            each: 0.1,
            from: "end"
        },
        ease: "elastic.out(1, 0.75)",
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
            window.location.href = 'project-detail.html';
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
        // Run logic immediately to establish state
        if (isGridMode) {
            toGridDesktop();
        } else {
            toStackDesktop();
        }

        // Return cleanup function if needed
        return () => {
            // Undo any desktop specific inline styles if necessary
        };
    });

    // Mobile Setup
    mm.add("(max-width: 768px)", (context) => {
        if (isGridMode) {
            toGridMobile();
        } else {
            toStackMobile();
        }

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
    dismissDragHint(); // User switched view — also dismiss the hint
    const iconGrid = document.getElementById('icon-grid');
    const iconStack = document.getElementById('icon-stack');
    if (iconGrid) iconGrid.style.display = 'none';
    if (iconStack) iconStack.style.display = 'block';

    if (window.innerWidth <= 768) {
        toGridMobile();
    } else {
        toGridDesktop();
    }
}

function toStack() {
    isGridMode = false;
    const iconGrid = document.getElementById('icon-grid');
    const iconStack = document.getElementById('icon-stack');
    if (iconGrid) iconGrid.style.display = 'block';
    if (iconStack) iconStack.style.display = 'none';

    if (window.innerWidth <= 768) {
        toStackMobile();
    } else {
        toStackDesktop();
    }
}


function toGridDesktop() {
    const totalCards = cards.length;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let columns = 3;
    if (viewportWidth < 1000) columns = 2;
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

    const totalGridW = (cardW * columns) + (gap * (columns - 1));
    const totalGridH = (cardHeight * rows) + (gap * (rows - 1));
    const startX = -totalGridW / 2 + cardW / 2;
    const startY = -totalGridH / 2 + cardHeight / 2;

    cards.forEach((card, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);

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
            zIndex: i + 1,
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
    container.classList.add("scroll-mode");
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
            zIndex: i + 1,
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
            zIndex: i + 1,
            duration: 0.8,
            ease: "power3.inOut"
        });
    });
}

function toStackMobile() {
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
            scale: 0.55,
            zIndex: i + 1,
            duration: 0.8,
            ease: "power3.inOut"
        });
    });
}


init();
