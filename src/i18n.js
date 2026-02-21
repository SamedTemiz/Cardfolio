// Dictionary for all translatable strings
export const translations = {
    en: {
        "nav.portfolio": "PORTFOLIO",
        "nav.name": "YUNUS EMRE TEMIZ",
        "nav.title": "GRAPHIC DESIGN STUDENT",
        "nav.back": "← BACK TO PORTFOLIO",

        "index.dragToExplore": "DRAG TO EXPLORE",
        "index.gridView": "GRID VIEW",
        "index.stackView": "STACK VIEW",
        "index.footerRights": "© 2026 YUNUS EMRE TEMIZ",
        "index.footerIntern": "AVAILABLE FOR INTERNSHIPS",

        "card.viewProject": "VIEW",

        "profile.tagline": "High School Student & Creative Developer",
        "profile.aboutTitle": "ABOUT ME",
        "profile.aboutText": "Hello! I'm a high school student with a deep passion for digital creativity. I bridge the gap between design and code, creating interactive experiences that live on the web. Currently looking for internship opportunities where I can learn, grow, and contribute my skills in front-end development.",
        "profile.skillsTitle": "SKILLS",
        "profile.contactTitle": "CONTACT",
        "profile.getInTouch": "GET IN TOUCH",

        "gallery.title1": "NEON CYBERPUNK",
        "gallery.desc1": "2026 - LEAD DESIGNER"
    },
    tr: {
        "nav.portfolio": "PORTFOLYO",
        "nav.name": "YUNUS EMRE TEMİZ",
        "nav.title": "GRAFİK TASARIM ÖĞRENCİSİ",
        "nav.back": "← PORTFOLYOYA DÖN",

        "index.dragToExplore": "KEŞFETMEK İÇİN SÜRÜKLE",
        "index.gridView": "IZGARA GÖRÜNÜMÜ",
        "index.stackView": "KÜME GÖRÜNÜMÜ",
        "index.footerRights": "© 2026 YUNUS EMRE TEMİZ",
        "index.footerIntern": "STAJ İÇİN MÜSAİT",

        "card.viewProject": "İNCELE",

        "profile.tagline": "Lise Öğrencisi ve Etkileşim Geliştiricisi",
        "profile.aboutTitle": "HAKKIMDA",
        "profile.aboutText": "Merhaba! Dijital yaratıcılığa derin bir tutku duyan bir lise öğrencisiyim. Tasarım ve yazılım arasındaki o köprüyü kuruyor, web üzerinde yaşayan etkileşimli deneyimler yaratıyorum. Şu anda front-end (ön yüz) geliştirme becerilerimi katabileceğim, öğrenip büyüyebileceğim staj fırsatları arıyorum.",
        "profile.skillsTitle": "YETENEKLER",
        "profile.contactTitle": "İLETİŞİM",
        "profile.getInTouch": "BANA ULAŞIN",

        "gallery.title1": "SİBER PUNK NEON",
        "gallery.desc1": "2026 - BAŞ TASARIMCI"
    }
};

// Global language state
let currentLanguage = 'en';

export function initI18n() {
    // Detect browser language
    const browserLang = navigator.language || navigator.userLanguage;

    // Default to TR if browser is Turkish, else EN
    if (browserLang.toLowerCase().includes('tr')) {
        currentLanguage = 'tr';
    } else {
        currentLanguage = 'en';
    }

    // Assign to window for global access if needed in inline scripts
    window.currentLanguage = currentLanguage;
    window.t = translateText;

    // Apply translations on load
    applyTranslations();

    console.log(`i18n Initialized. Detected Browser Lang: ${browserLang}. Active Interface: ${currentLanguage.toUpperCase()}`);
}

// Function to fetch a specific translated string by key
export function translateText(key) {
    const activeDict = translations[currentLanguage] || translations['en'];
    return activeDict[key] || key; // Return the key itself as fallback if translation is missing
}

// Main DOM parser
export function applyTranslations() {
    const elements = document.querySelectorAll('[data-i18n]');

    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');

        // Handle specific attribute replacements (like placeholders, tooltips, or special dataset vars)
        if (el.hasAttribute('data-i18n-target')) {
            const targetAttr = el.getAttribute('data-i18n-target');
            el.setAttribute(targetAttr, translateText(key));
        } else {
            // Standard Text Node Replacement
            el.innerText = translateText(key);
        }
    });

    // Fire a custom event so other scripts (like GSAP or hover effects) can update their bindings if they cache text
    window.dispatchEvent(new Event('i18n-updated'));
}
