// ---------------------------------------------------------------------
// Supabase setup
//
// The publishable key below is safe to expose in frontend code — it only
// allows what Row Level Security policies permit (currently: public read
// access on subjects/modules, no write access). Never put a "secret" key
// here.
// ---------------------------------------------------------------------
const SUPABASE_URL = "https://fdqrnhmkcqbmoquialgv.supabase.co";
const SUPABASE_KEY = "sb_publishable_uL-TrR68TD2bk5kdnjKwjA_r60zC85R";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// `subjects` used to come from data.js as a hardcoded const array.
// It's now populated at runtime from Supabase, so it starts empty and
// gets filled in by loadSubjectsFromSupabase() before the app renders.
let subjects = [];

// The browser's default scroll restoration tries to guess where you were
// scrolled to and silently jumps there on back/forward — which is exactly
// what causes "back button lands me mid-page" instead of at the top. We
// take full manual control of scroll position instead (see scrollToTop()).
if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
}

const subjectListDiv = document.getElementById("subject-list");
const pageHeaderDiv = document.getElementById("page-header");
// Side menu logic
const menuToggle = document.getElementById("menuToggle");
const closeMenu = document.getElementById("closeMenu");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");
const themeToggle = document.getElementById("themeToggle");
const homeLink = document.getElementById("homeLink");
const aboutLink = document.getElementById("aboutLink");
const studyLink = document.getElementById("studyLink");

// ---------------------------------------------------------------------
// Theme switcher
// Light mode is the default. The selected theme is remembered on this device.
// ---------------------------------------------------------------------
function applyTheme(theme) {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-mode", dark);
    if (themeToggle) {
        themeToggle.textContent = dark ? "☀️" : "🌙";
        themeToggle.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
        themeToggle.title = dark ? "Switch to light mode" : "Switch to dark mode";
    }
}

const savedTheme = localStorage.getItem("resourceHubTheme") || "light";
applyTheme(savedTheme);

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
        localStorage.setItem("resourceHubTheme", nextTheme);
        applyTheme(nextTheme);
    });
}

if (homeLink) {
    homeLink.addEventListener("click", (e) => {
        e.preventDefault();
        showSubjects();
        closeSideMenu();
    });
}

if (aboutLink) {
    aboutLink.addEventListener("click", (e) => {
        e.preventDefault();
        showAbout();
        closeSideMenu();
    });
}

if (studyLink) {
    studyLink.addEventListener("click", (e) => {
        e.preventDefault();
        showMyStudy();
        closeSideMenu();
    });
}

menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("active");
    document.body.classList.add("menu-open");
});

function closeSideMenu() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("active");
    document.body.classList.remove("menu-open");
}
closeMenu.addEventListener("click", closeSideMenu);
overlay.addEventListener("click", closeSideMenu);

// ---------------------------------------------------------------------
// Fetch subjects + modules from Supabase and reshape them into exactly
// the same shape data.js used to provide, so every render function below
// (showSubjects, showModules, showResources, showDirectResources) works
// completely unchanged.
//
// Supabase column names -> old data.js field names:
//   teacher_pdf_url  -> teacherPdf
//   ai_notes_pdf_url -> aiNotesPdf
//   youtube_link     -> youtubeLink
//   file_url         -> file   (used when subject.direct is true)
// ---------------------------------------------------------------------
async function loadSubjectsFromSupabase() {
    const { data, error } = await supabaseClient
        .from("subjects")
        .select("*, modules(*)")
        .order("id", { ascending: true });

    if (error) {
        console.error("Failed to load subjects from Supabase:", error);
        subjectListDiv.innerHTML = `
            <div style="grid-column: 1 / -1; text-align:center; padding: 30px;">
                <p style="color:#5c5578;">Couldn't load resources right now. Please check your connection and try again.</p>
            </div>
        `;
        return [];
    }

    return data.map((row) => ({
        id: row.id,
        name: row.name,
        icon: row.icon || "📚",
        direct: row.direct,
        syllabus: row.syllabus || undefined,
        modules: (row.modules || [])
            .sort((a, b) => a.id - b.id)
            .map((m) =>
                row.direct
                    ? { id: m.id, name: m.name, file: m.file_url }
                    : {
                        id: m.id,
                        name: m.name,
                        teacherPdf: m.teacher_pdf_url,
                        aiNotesPdf: m.ai_notes_pdf_url,
                        youtubeLink: m.youtube_link || ""
                    }
            )
    }));
}


// ---------------------------------------------------------------------
// Study features: progress, bookmarks, personal notes and AI assistant
// Stored locally so these features work without adding new database tables.
// ---------------------------------------------------------------------
const STORAGE_KEYS = {
    progress: "resourceHubProgress",
    bookmarks: "resourceHubBookmarks",
    notes: "resourceHubNotes",
    recent: "resourceHubRecentlyViewed"
};

function readStore(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
}
function writeStore(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function moduleKey(subject, module) { return `${subject.id || subject.name}::${module.id || module.name}`; }
function resourceKey(subject, module, type) { return `${subject.id || subject.name}::${module.id || module.name}::${type}`; }
function isCompleted(subject, module) { return !!readStore(STORAGE_KEYS.progress, {})[moduleKey(subject, module)]; }
function setCompleted(subject, module, value) {
    const data = readStore(STORAGE_KEYS.progress, {});
    const key = moduleKey(subject, module);
    if (value) data[key] = true; else delete data[key];
    writeStore(STORAGE_KEYS.progress, data);
}
function isBookmarked(subject, module, type) {
    return !!readStore(STORAGE_KEYS.bookmarks, {})[resourceKey(subject, module, type)];
}
function toggleBookmark(subject, module, type) {
    const data = readStore(STORAGE_KEYS.bookmarks, {});
    const key = resourceKey(subject, module, type);
    data[key] ? delete data[key] : data[key] = {
        subjectId: subject.id, subjectName: subject.name,
        moduleId: module.id, moduleName: module.name, type,
        savedAt: Date.now()
    };
    writeStore(STORAGE_KEYS.bookmarks, data);
}
function getNotes(subject, module) {
    return readStore(STORAGE_KEYS.notes, {})[moduleKey(subject, module)] || "";
}
function saveNotes(subject, module, text) {
    const data = readStore(STORAGE_KEYS.notes, {});
    data[moduleKey(subject, module)] = text;
    writeStore(STORAGE_KEYS.notes, data);
}
function recordRecentlyViewed(subject, module) {
    const key = moduleKey(subject, module);
    let items = readStore(STORAGE_KEYS.recent, []);
    items = items.filter(item => item.key !== key);
    items.unshift({
        key,
        subjectId: subject.id,
        subjectName: subject.name,
        moduleId: module.id,
        moduleName: module.name,
        viewedAt: Date.now()
    });
    writeStore(STORAGE_KEYS.recent, items.slice(0, 8));
}

function getRecentlyViewed() {
    return readStore(STORAGE_KEYS.recent, []);
}

function subjectProgress(subject) {
    const modules = subject.modules || [];
    if (!modules.length) return 0;
    return Math.round(modules.filter(m => isCompleted(subject, m)).length / modules.length * 100);
}
function showProgressPill(subject) {
    const pct = subjectProgress(subject);
    return `<div class="progress-mini"><span>${pct}% complete</span><div><i style="width:${pct}%"></i></div></div>`;
}

function showMyStudy(fromHistory) {
    scrollToContentTop();
    removeAIWidget();
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = `
        <section class="study-dashboard">
            <div class="study-dashboard-head">
                <button class="back-btn" id="studyBack">⬅️ Back to Subjects</button>
                <div><h2>My Study</h2><p>Your progress, bookmarks and personal notes are saved on this device.</p></div>
            </div>
            <div class="study-summary" id="studySummary"></div>
            <div class="study-section"><h3>📊 Subject Progress</h3><div id="studyProgressList"></div></div>
            <div class="study-section"><h3>⭐ Bookmarked Resources</h3><div id="bookmarkList"></div></div>
            <div class="study-section"><h3>🕐 Recently Viewed</h3><div id="recentList"></div></div>
            <div class="study-section"><h3>📝 Personal Notes</h3><div id="personalNotesList"></div></div>
        </section>`;
    document.getElementById("studyBack")?.addEventListener("click", () => history.back());

    const allModules = subjects.flatMap(s => (s.modules || []).map(m => ({ s, m })));
    const done = allModules.filter(({ s, m }) => isCompleted(s, m)).length;
    const bookmarks = Object.values(readStore(STORAGE_KEYS.bookmarks, {}));
    const notes = Object.entries(readStore(STORAGE_KEYS.notes, {})).filter(([, v]) => v.trim());
    const recent = getRecentlyViewed();
    document.getElementById("studySummary").innerHTML = `
        <div><strong>${done}</strong><span>Modules completed</span></div>
        <div><strong>${bookmarks.length}</strong><span>Bookmarks</span></div>
        <div><strong>${notes.length}</strong><span>Saved notes</span></div>
        <div><strong>${recent.length}</strong><span>Recently viewed</span></div>`;
    document.getElementById("studyProgressList").innerHTML = subjects.map(s => `
        <div class="study-row"><div><b>${s.name}</b>${showProgressPill(s)}</div><span>${subjectProgress(s)}%</span></div>`).join("");

    const bookmarkList = document.getElementById("bookmarkList");
    bookmarkList.innerHTML = bookmarks.length ? bookmarks.map(b => `
        <button class="bookmark-row" data-subject="${b.subjectId}" data-module="${b.moduleId}" data-type="${b.type}">
            <span>⭐</span><span><b>${b.moduleName}</b><small>${b.subjectName} • ${b.type}</small></span><span>›</span>
        </button>`).join("") : `<p class="empty-state">No bookmarks yet. Open a module and tap ⭐ on a resource.</p>`;
    bookmarkList.querySelectorAll(".bookmark-row").forEach(btn => btn.addEventListener("click", () => {
        const s = subjects.find(x => String(x.id) === btn.dataset.subject);
        const m = s?.modules.find(x => String(x.id) === btn.dataset.module);
        if (s && m) showResources(m, s);
    }));

    const recentList = document.getElementById("recentList");
    recentList.innerHTML = recent.length ? recent.map(item => `
        <button class="bookmark-row" data-subject="${item.subjectId}" data-module="${item.moduleId}">
            <span>🕐</span><span><b>${item.moduleName}</b><small>${item.subjectName} • ${new Date(item.viewedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></span><span>›</span>
        </button>`).join("") : `<p class="empty-state">No modules viewed yet. Open a module and it will appear here.</p>`;
    recentList.querySelectorAll(".bookmark-row").forEach(btn => btn.addEventListener("click", () => {
        const s = subjects.find(x => String(x.id) === btn.dataset.subject);
        const m = s?.modules.find(x => String(x.id) === btn.dataset.module);
        if (s && m) showResources(m, s);
    }));

    const notesList = document.getElementById("personalNotesList");
    notesList.innerHTML = notes.length ? notes.map(([key, text]) => {
        const [sid, mid] = key.split("::");
        const s = subjects.find(x => String(x.id || x.name) === sid);
        const m = s?.modules.find(x => String(x.id || x.name) === mid);
        return `<button class="bookmark-row" data-subject="${s?.id}" data-module="${m?.id}"><span>📝</span><span><b>${m?.name || "Module"}</b><small>${s?.name || "Subject"} • ${text.slice(0, 70)}${text.length > 70 ? '…' : ''}</small></span><span>›</span></button>`;
    }).join("") : `<p class="empty-state">No personal notes yet. Open a module to add one.</p>`;
    notesList.querySelectorAll(".bookmark-row").forEach(btn => btn.addEventListener("click", () => {
        const s = subjects.find(x => String(x.id) === btn.dataset.subject);
        const m = s?.modules.find(x => String(x.id) === btn.dataset.module);
        if (s && m) showResources(m, s);
    }));

    if (!fromHistory) history.pushState({ view: "study" }, "", "#study");
    playViewTransition();
}

async function askAI(question, subject, module) {
    // Supabase's teacher_pdf_url is mapped to teacherPdf
    // inside loadSubjectsFromSupabase().
    const pdfUrl = module.teacherPdf;

    console.log("========== AI REQUEST ==========");
    console.log("Subject:", subject.name);
    console.log("Module:", module.name);
    console.log("Teacher PDF:", pdfUrl);
    console.log("Question:", question);

    if (!pdfUrl) {
        throw new Error("No teacher PDF is attached to this module.");
    }

    const { data, error } = await supabaseClient.functions.invoke(
        "ai-assistant",
        {
            body: {
                question: question,
                subject: subject.name,
                module: module.name,
                module_id: module.id,
                pdf_url: pdfUrl
            }
        }
    );

    console.log("AI DATA:", data);
    console.log("AI ERROR:", error);

    if (error) {
        console.error("AI Function Error:", error);

        // Supabase's client library gives a generic "non-2xx status code"
        // message by default and hides the actual response body. Try to
        // pull the real error/details out of it so it's visible here
        // instead of only in the Supabase dashboard logs.
        let detail = error.message || "AI function failed.";
        try {
            if (error.context && typeof error.context.json === "function") {
                const body = await error.context.json();
                detail = body.details || body.error || detail;
            }
        } catch (_) {
            // response wasn't JSON — fall back to the generic message
        }

        throw new Error(detail);
    }

    if (!data || !data.answer) {
        throw new Error(data?.error || "No answer received from AI.");
    }

    return data.answer;
}

// ---------------------------------------------------------------------
// AI Study Assistant — floating bottom-left chat bubble
//
// Instead of a button buried inside the Study Tools panel opening a
// centered modal, this renders a floating action button fixed to the
// bottom-left of the viewport (only while a module's resources page is
// open), which toggles a small anchored chat panel above it.
// ---------------------------------------------------------------------
// Custom AI Study Assistant icon, as inline SVG so it's crisp at any size
// and uses the exact brand colors instead of a generic emoji. Two color
// variants: white glyph for use on the gradient FAB button, and a
// gradient-fill glyph for use on the light panel header.
const AI_ICON_ON_GRADIENT = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<line x1="50" y1="10" x2="50" y2="24" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
<circle cx="50" cy="6" r="6" fill="#ffffff"/>
<rect x="20" y="24" width="60" height="52" rx="20" fill="#ffffff"/>
<rect x="6" y="40" width="12" height="22" rx="6" fill="#ffffff" fill-opacity=".85"/>
<rect x="82" y="40" width="12" height="22" rx="6" fill="#ffffff" fill-opacity=".85"/>
<circle cx="38" cy="50" r="6" fill="#7c6fe0"/>
<circle cx="62" cy="50" r="6" fill="#7c6fe0"/>
<path d="M32 62 Q50 74 68 62" stroke="#7c6fe0" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`;

const AI_ICON_ON_LIGHT = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="aiIconGradPanel" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="#a89cff"/><stop offset="100%" stop-color="#ffb3d1"/>
</linearGradient></defs>
<line x1="50" y1="10" x2="50" y2="24" stroke="url(#aiIconGradPanel)" stroke-width="5" stroke-linecap="round"/>
<circle cx="50" cy="6" r="6" fill="url(#aiIconGradPanel)"/>
<rect x="20" y="24" width="60" height="52" rx="20" fill="url(#aiIconGradPanel)"/>
<rect x="6" y="40" width="12" height="22" rx="6" fill="url(#aiIconGradPanel)" fill-opacity=".85"/>
<rect x="82" y="40" width="12" height="22" rx="6" fill="url(#aiIconGradPanel)" fill-opacity=".85"/>
<circle cx="38" cy="50" r="6" fill="#ffffff"/>
<circle cx="62" cy="50" r="6" fill="#ffffff"/>
<path d="M32 62 Q50 74 68 62" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
</svg>`;

function removeAIWidget() {
    document.getElementById("aiFab")?.remove();
    document.getElementById("aiPanel")?.remove();
    document.getElementById("aiGreeting")?.remove();
    document.removeEventListener("click", handleAIOutsideClick, true);
}

// Small speech-bubble greeting near the FAB. Shown once per page load
// (resets on refresh) rather than once forever, so it reappears any time
// the site is reloaded but doesn't repeat on every module you browse to
// within the same session.
let aiGreetingShownThisLoad = false;

function maybeShowAIGreeting() {
    if (aiGreetingShownThisLoad) return;

    const bubble = document.createElement("div");
    bubble.id = "aiGreeting";
    bubble.className = "ai-greeting";
    bubble.innerHTML = `
        <button class="ai-greeting-close" type="button" aria-label="Dismiss">✕</button>
        <p>👋 Hi! I'm your AI Study Assistant. Tap here if you need help with this module.</p>
    `;
    document.body.appendChild(bubble);
    requestAnimationFrame(() => bubble.classList.add("show"));

    const dismiss = () => {
        aiGreetingShownThisLoad = true;
        bubble.classList.remove("show");
        setTimeout(() => bubble.remove(), 250);
    };

    bubble.addEventListener("click", (e) => {
        if (e.target.closest(".ai-greeting-close")) {
            dismiss();
        } else {
            dismiss();
            document.getElementById("aiFab")?.click();
        }
    });

    setTimeout(dismiss, 6000);
}

function renderAIFab(module, subject) {
    removeAIWidget();

    const fab = document.createElement("button");
    fab.id = "aiFab";
    fab.className = "ai-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Open AI Study Assistant");
    fab.title = "AI Study Assistant";
    fab.innerHTML = `<span class="ai-fab-icon">${AI_ICON_ON_GRADIENT}</span>`;

    fab.addEventListener("click", () => {
        document.getElementById("aiGreeting")?.remove();
        aiGreetingShownThisLoad = true;
        if (document.getElementById("aiPanel")) {
            closeAIPanel();
        } else {
            openAIPanel(module, subject);
        }
    });

    document.body.appendChild(fab);

    setTimeout(() => maybeShowAIGreeting(), 700);
}

function closeAIPanel() {
    const panel = document.getElementById("aiPanel");
    if (!panel) return;
    panel.classList.remove("open");
    setTimeout(() => panel.remove(), 200);
    document.removeEventListener("click", handleAIOutsideClick, true);
}

function handleAIOutsideClick(e) {
    const panel = document.getElementById("aiPanel");
    const fab = document.getElementById("aiFab");
    if (panel && !panel.contains(e.target) && fab && !fab.contains(e.target)) {
        closeAIPanel();
    }
}

function openAIPanel(module, subject) {
    document.getElementById("aiPanel")?.remove();

    const panel = document.createElement("div");
    panel.id = "aiPanel";
    panel.className = "ai-panel";

    panel.innerHTML = `
        <div class="ai-panel-header">
            <div class="ai-panel-title"><span class="ai-panel-emoji">${AI_ICON_ON_LIGHT}</span> AI Study Assistant</div>
            <button class="ai-panel-close" type="button" aria-label="Close">✕</button>
        </div>
        <p class="ai-panel-subtitle">${subject.name} • ${module.name}</p>

        <div class="ai-actions">
            <button data-action="explain">Explain simply</button>
            <button data-action="summary">Quick summary</button>
            <button data-action="questions">Important questions</button>
        </div>

        <div class="ai-response" id="aiResponse">
            Choose what you want help with, or ask your own question below.
        </div>

        <div class="ai-chat-row">
            <input id="aiInput" placeholder="Ask something about this module...">
            <button id="aiSend">Ask</button>
        </div>

        <small class="ai-note">
            🤖 Answers are generated using the teacher's notes for this module.
        </small>
    `;

    document.body.appendChild(panel);
    requestAnimationFrame(() => panel.classList.add("open"));

    const response = panel.querySelector("#aiResponse");
    const input = panel.querySelector("#aiInput");
    const sendButton = panel.querySelector("#aiSend");

    const pdfUrl = module.teacherPdf;

    if (!pdfUrl) {
        response.innerHTML = `
            <div class="ai-error">
                ❌ No teacher PDF is attached to this module.
                <br><br>
                Add the PDF URL to the <b>teacher_pdf_url</b> column in Supabase.
            </div>
        `;
    }

    const showAIResponse = async (question) => {
        if (!question || !question.trim()) return;

        if (!pdfUrl) {
            response.innerHTML = `
                <div class="ai-error">
                    ❌ This module does not have a teacher PDF.
                </div>
            `;
            return;
        }

        response.innerHTML = `
            <div class="ai-loading">
                🤖 Reading the teacher notes...
                <br><br>
                Thinking about your question...
            </div>
        `;

        sendButton.disabled = true;

        try {
            const answer = await askAI(question, subject, module);
            response.innerHTML = answer;
        } catch (error) {
            console.error("AI Assistant Error:", error);

            response.innerHTML = `
                <div class="ai-error">
                    ❌ AI request failed.
                    <br><br>
                    <small>${error.message || "Unknown error"}</small>
                </div>
            `;
        } finally {
            sendButton.disabled = false;
        }
    };

    panel.querySelectorAll(".ai-actions button").forEach(button => {
        button.addEventListener("click", () => {
            const action = button.dataset.action;
            let question = "";

            if (action === "explain") {
                question = `
Explain "${module.name}" from the teacher's notes for "${subject.name}".

Explain it in very simple, student-friendly language.

Include:
1. Basic idea
2. Important concepts
3. Important definitions
4. Formulas if present
5. Simple examples
6. Important exam points

Only use information from the attached teacher PDF.
                `;
            } else if (action === "summary") {
                question = `
Give me a concise study summary of "${module.name}" using the attached teacher notes.

Include:
- Important concepts
- Definitions
- Formulas
- Key examples
- Important exam points

Do not invent information not present in the PDF.
                `;
            } else if (action === "questions") {
                question = `
Create important exam questions for "${module.name}" using only the attached teacher notes.

Include:
- Short-answer questions
- Long-answer questions
- Important concepts
- Important definitions
- Important problems
- Formula-based questions when applicable

Focus on topics actually present in the teacher PDF.
                `;
            }

            showAIResponse(question);
        });
    });

    const askQuestion = () => {
        const question = input.value.trim();
        if (!question) return;

        input.value = "";
        showAIResponse(question);
    };

    sendButton.addEventListener("click", askQuestion);

    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            askQuestion();
        }
    });

    panel.querySelector(".ai-panel-close").addEventListener("click", closeAIPanel);

    // Defer so the click that opened the panel doesn't immediately close it.
    setTimeout(() => document.addEventListener("click", handleAIOutsideClick, true), 0);
}


function addBookmarkButton(card, subject, module, type) {
    const footer = card.querySelector(".resource-footer");
    if (!footer) return;
    const btn = document.createElement("button"); btn.className = "footer-btn bookmark-btn"; btn.title = "Bookmark"; btn.textContent = isBookmarked(subject, module, type) ? "⭐" : "☆";
    btn.addEventListener("click", e => { e.stopPropagation(); toggleBookmark(subject, module, type); btn.textContent = isBookmarked(subject, module, type) ? "⭐" : "☆"; });
    footer.appendChild(btn);
}

// ---------------------------------------------------------------------
// Scroll + transition helpers
//
// Every navigation — a forward tap on a card, OR the phone's back button
// — should land at the very top of the page (right below the hero) and
// fade the new content in smoothly, instead of keeping whatever scroll
// position the previous screen happened to be at.
// ---------------------------------------------------------------------
function scrollToTop() {
    window.scrollTo(0, 0);
}

// Scrolls to the top of <main>, skipping the hero header — used for every
// "inner" view so drilling into modules/resources doesn't re-show the
// full hero each time. Only "Back to Subjects" (showSubjects) uses the
// plain scrollToTop() above.
function scrollToContentTop() {
    const main = document.querySelector("main");
    if (!main) { scrollToTop(); return; }
    const top = main.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top);
}

function playViewTransition() {
    subjectListDiv.classList.remove("view-fade");
    // Force a reflow so the animation restarts even when navigating
    // between two views that don't change the class name meaningfully
    // (e.g. module -> module).
    void subjectListDiv.offsetWidth;
    subjectListDiv.classList.add("view-fade");
}

// ---------------------------------------------------------------------
// History / back-button handling
//
// The app is a single HTML page that just swaps innerHTML around, so by
// default the phone's back button has nothing to "go back" to and closes
// the whole app. To fix this, every navigation function pushes a history
// entry describing what's on screen. When the back button fires a
// popstate event, we read that state and re-render the right view instead
// of letting the browser close the page.
//
// Each nav function takes an optional `fromHistory` flag - true means
// "I'm being called because of a back/forward action, don't push a new
// history entry" (avoids double-pushing / broken forward navigation).
// ---------------------------------------------------------------------

window.addEventListener("popstate", (e) => {
    const state = e.state;

    if (!state || state.view === "subjects") {
        showSubjects(true);
        return;
    }

    if (state.view === "about") {
        showAbout(true);
        return;
    }

    if (state.view === "study") {
        showMyStudy(true);
        return;
    }

    if (state.view === "modules") {
        const subject = subjects.find((s) => s.name === state.subjectName);
        if (subject) showModules(subject, true);
        else showSubjects(true);
        return;
    }

    if (state.view === "resources") {
        const subject = subjects.find((s) => s.name === state.subjectName);
        const module = subject && subject.modules.find((m) => m.name === state.moduleName);
        if (subject && module) showResources(module, subject, true);
        else showSubjects(true);
        return;
    }

    if (state.view === "direct") {
        const subject = subjects.find((s) => s.name === state.subjectName);
        if (subject) showDirectResources(subject, true);
        else showSubjects(true);
        return;
    }

    showSubjects(true);
});

// Simple About page
function showAbout(fromHistory) {
    scrollToContentTop();
    removeAIWidget();
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = `
        <section class="about-card">
            <button class="back-btn about-back" id="aboutBackBtn" type="button">⬅️ Back to Subjects</button>
            <div class="about-icon">📚</div>
            <h2>About Resource Hub</h2>
            <p>
                Resource Hub is a simple central place for 3rd Semester notes,
                revision material, syllabi, and useful video links. It is designed
                to make study resources easy to find without searching through
                WhatsApp or Moodle before exams.
            </p>
            <p>
                Built for students pursuing Computer Science Engineering at
                The National Institute of Engineering.
            </p>
            <div class="about-features">
                <div>📖<span>Notes & Modules</span></div>
                <div>⚡<span>Quick Revision</span></div>
                <div>▶️<span>Learning Videos</span></div>
            </div>
        </section>
    `;

    const aboutBackBtn = document.getElementById("aboutBackBtn");
    if (aboutBackBtn) {
        aboutBackBtn.addEventListener("click", () => history.back());
    }

    if (!fromHistory) {
        history.pushState({ view: "about" }, "", "#about");
    }
    playViewTransition();
}

// Reusable: prevents footer button clicks (download/share) from also triggering
// the parent card's "open PDF" click, and wires up the actual share logic.
function bindResourceCardFooter(card, shareLink) {
    card.querySelectorAll(".footer-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    });

    const shareBtn = card.querySelector(".share-btn");
    if (shareBtn) {
        shareBtn.addEventListener("click", () => {
            const fullLink = new URL(shareLink, window.location.href).href;

            if (navigator.share) {
                navigator.share({
                    title: "Check out this resource",
                    url: fullLink
                });
            } else {
                navigator.clipboard.writeText(fullLink);
                alert("Link copied! You can paste and send it.");
            }
        });
    }
}

function showSubjects(fromHistory) {
    scrollToTop();
    removeAIWidget();
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "subjects" }, "", "#subjects");
    }

    subjects.forEach((subject) => {
        const subjectCard = document.createElement("div");
        subjectCard.className = subject.name.length > 20 ? "subject-card long-name" : "subject-card";
        const icon = subject.icon || "📚";
        const isImage = typeof icon === "string" && (icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.svg') || icon.endsWith('.webp'));
        subjectCard.innerHTML = `
            <div class="subject-icon${isImage ? " has-image-icon" : ""}">${isImage ? `<img src="${icon}" alt="${subject.name}">` : icon}</div>
            <div class="subject-name">${subject.name}</div>
            ${subject.direct ? "" : showProgressPill(subject)}
        `;
        subjectCard.addEventListener("click", () => {
            if (subject.direct) {
                showDirectResources(subject);
            } else {
                showModules(subject);
            }
        });
        subjectListDiv.appendChild(subjectCard);
    });
    playViewTransition();
}

function showModules(subject, fromHistory) {
    scrollToContentTop();
    removeAIWidget();
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "modules", subjectName: subject.name }, "", "#modules");
    }

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "⬅️ Back to Subjects";
    backBtn.addEventListener("click", () => {
        history.back();
    });
    pageHeaderDiv.appendChild(backBtn);

    const heading = document.createElement("h2");
    heading.textContent = subject.name;
    pageHeaderDiv.appendChild(heading);

    // Syllabus box — full-width rectangle, opens directly like Timetable/Calendar
    // (not styled like a module card, and click does NOT go to showResources)
    if (subject.syllabus) {
        const syllabusBox = document.createElement("div");
        syllabusBox.className = "resource-card syllabus-card";
        syllabusBox.innerHTML = `
            <div class="resource-main">
                <div class="subject-icon">📘</div>
                <div class="subject-name">Syllabus</div>
            </div>
            <div class="resource-footer">
                <a href="${subject.syllabus}" download class="footer-btn" title="Download">⬇️</a>
                <button class="footer-btn share-btn" title="Share" data-link="${subject.syllabus}">📤</button>
            </div>
        `;
        syllabusBox.addEventListener("click", () => {
            window.open(subject.syllabus, "_blank");
        });
        subjectListDiv.appendChild(syllabusBox);
        bindResourceCardFooter(syllabusBox, subject.syllabus);
    }

    subject.modules.forEach((module) => {
        const moduleCard = document.createElement("div");
        moduleCard.className = "subject-card";
        moduleCard.innerHTML = `
            <div class="subject-icon">📖</div>
            <div class="subject-name">${module.name}</div>
            <label class="complete-check" title="Mark module complete" onclick="event.stopPropagation()">
                <input type="checkbox" ${isCompleted(subject, module) ? "checked" : ""}> <span>${isCompleted(subject, module) ? "Completed" : "Mark complete"}</span>
            </label>
        `;
        moduleCard.addEventListener("click", () => { showResources(module, subject); });
        moduleCard.querySelector("input").addEventListener("change", (e) => {
            setCompleted(subject, module, e.target.checked);
            showModules(subject, true);
        });
        subjectListDiv.appendChild(moduleCard);
    });
    playViewTransition();
}

function showResources(module, subject, fromHistory) {
    scrollToContentTop();
    pageHeaderDiv.innerHTML = "";

    if (!fromHistory) recordRecentlyViewed(subject, module);
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "resources", subjectName: subject.name, moduleName: module.name }, "", "#resources");
    }

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "⬅️ Back to Modules";
    backBtn.addEventListener("click", () => {
        history.back();
    });
    pageHeaderDiv.appendChild(backBtn);

    const heading = document.createElement("h2");
    heading.textContent = module.name;
    pageHeaderDiv.appendChild(heading);

    // Teacher's PDF box
    const teacherBox = document.createElement("div");
    teacherBox.className = "resource-card teacher-notes-card";
    teacherBox.innerHTML = `
    <div class="resource-main">
        <div class="subject-icon">📄</div>
        <div class="subject-name">Teacher's Notes</div>
    </div>
    <div class="resource-footer">
        <a href="${module.teacherPdf}" download class="footer-btn" title="Download">⬇️</a>
        <button class="footer-btn share-btn" title="Share" data-link="${module.teacherPdf}">📤</button>
    </div>
`;
    teacherBox.addEventListener("click", () => {
        window.open(module.teacherPdf, "_blank");
    });
    subjectListDiv.appendChild(teacherBox);
    bindResourceCardFooter(teacherBox, module.teacherPdf);

    const aiBox = document.createElement("div");
    aiBox.className = "resource-card quick-revision-card";
    if (module.aiNotesPdf) {
        aiBox.innerHTML = `
    <div class="resource-main">
        <div class="subject-icon">⚡</div>
        <div class="subject-name">Quick Revision Notes</div>
    </div>
    <div class="resource-footer">
        <a href="${module.aiNotesPdf}" download class="footer-btn" title="Download">⬇️</a>
        <button class="footer-btn share-btn" title="Share" data-link="${module.aiNotesPdf}">📤</button>
    </div>
`;
        aiBox.addEventListener("click", () => {
            window.open(module.aiNotesPdf, "_blank");
        });
        subjectListDiv.appendChild(aiBox);
        bindResourceCardFooter(aiBox, module.aiNotesPdf);
    } else {
        aiBox.classList.add("resource-disabled");
        aiBox.innerHTML = `
    <div class="resource-main">
        <div class="subject-icon">⚡</div>
        <div class="subject-name">Quick Revision Notes (not added)</div>
    </div>
`;
        subjectListDiv.appendChild(aiBox);
    }

    const ytBox = document.createElement("a");
    ytBox.className = "subject-card";
    if (module.youtubeLink) {
        ytBox.href = module.youtubeLink;
        ytBox.target = "_blank";
        ytBox.innerHTML = `
        <div class="subject-icon">▶️</div>
        <div class="subject-name">Watch Video</div>
    `;
    } else {
        ytBox.href = "#";
        ytBox.classList.add("resource-disabled");
        ytBox.addEventListener("click", e => e.preventDefault());
        ytBox.innerHTML = `
        <div class="subject-icon">▶️</div>
        <div class="subject-name">Watch Video (not added)</div>
    `;
    }
    subjectListDiv.appendChild(ytBox);

    // Study tools panel
    const tools = document.createElement("div");
    tools.className = "study-tools";
    tools.innerHTML = `
        <div class="study-tool-head"><div><h3>Study Tools</h3><p>${isCompleted(subject, module) ? "Module completed ✓" : "Mark this module complete when you're done."}</p></div><label class="complete-toggle"><input type="checkbox" ${isCompleted(subject, module) ? "checked" : ""}> Completed</label></div>
        <p class="ai-hint-inline">🤖 Tap the chat bubble in the bottom-left corner to ask the AI Study Assistant about this module.</p>
        <div class="notes-box"><h4>📝 My Personal Notes</h4><textarea id="personalNote" placeholder="Write your own formulas, reminders or important points..."></textarea><button id="savePersonalNote">Save Note</button><span id="noteSaved"></span></div>`;
    subjectListDiv.appendChild(tools);
    tools.querySelector(".complete-toggle input").addEventListener("change", e => { setCompleted(subject, module, e.target.checked); showResources(module, subject, true); });
    tools.querySelector("#personalNote").value = getNotes(subject, module);
    tools.querySelector("#savePersonalNote").addEventListener("click", () => { saveNotes(subject, module, tools.querySelector("#personalNote").value); tools.querySelector("#noteSaved").textContent = "Saved ✓"; setTimeout(() => tools.querySelector("#noteSaved").textContent = "", 1500); });

    addBookmarkButton(teacherBox, subject, module, "Teacher's Notes");
    addBookmarkButton(aiBox, subject, module, "Quick Revision Notes");
    // video bookmark is represented by the card itself; add a simple local bookmark below the link
    if (module.youtubeLink) {
        const videoBookmark = document.createElement("button"); videoBookmark.className = "video-bookmark"; videoBookmark.textContent = isBookmarked(subject, module, "Video") ? "⭐ Saved" : "☆ Save Video";
        videoBookmark.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); toggleBookmark(subject, module, "Video"); videoBookmark.textContent = isBookmarked(subject, module, "Video") ? "⭐ Saved" : "☆ Save Video"; });
        ytBox.appendChild(videoBookmark);
    }

    // Floating AI Study Assistant bubble (bottom-left) for this module.
    renderAIFab(module, subject);
    playViewTransition();
}

function showDirectResources(subject, fromHistory) {
    scrollToContentTop();
    removeAIWidget();
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "direct", subjectName: subject.name }, "", "#direct");
    }

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "⬅️ Back to Subjects";
    backBtn.addEventListener("click", () => {
        history.back();
    });
    pageHeaderDiv.appendChild(backBtn);

    const heading = document.createElement("h2");
    heading.textContent = subject.name;
    pageHeaderDiv.appendChild(heading);

    subject.modules.forEach((item) => {
        const box = document.createElement("div");
        box.className = "resource-card";
        box.innerHTML = `
        <div class="resource-main">
            <div class="subject-icon">📄</div>
            <div class="subject-name">${item.name}</div>
        </div>
        <div class="resource-footer">
            <a href="${item.file}" download class="footer-btn" title="Download">⬇️</a>
            <button class="footer-btn share-btn" title="Share" data-link="${item.file}">📤</button>
        </div>
        `;
        box.addEventListener("click", () => {
            window.open(item.file, "_blank");
        });
        subjectListDiv.appendChild(box);
        bindResourceCardFooter(box, item.file);
    });
    playViewTransition();
}

// ---------------------------------------------------------------------
// App startup
//
// Show a loading message, fetch live data from Supabase, then render.
// Replaces the old "history.replaceState(...); showSubjects(true);"
// pair that used to run immediately against the hardcoded data.js array.
// ---------------------------------------------------------------------
async function init() {
    subjectListDiv.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 40px; color:#5c5578;">
            Loading resources...
        </div>
    `;

    subjects = await loadSubjectsFromSupabase();

    history.replaceState({ view: "subjects" }, "", "#subjects");
    showSubjects(true);
}
init();

// Make tap animation reliable on mobile devices
document.addEventListener("touchstart", function () { }, { passive: true });

function addTapAnimation(selector) {
    document.querySelectorAll(selector).forEach((el) => {
        el.addEventListener("touchstart", () => {
            el.classList.add("tapped");
        }, { passive: true });

        el.addEventListener("touchend", () => {
            setTimeout(() => el.classList.remove("tapped"), 150);
        });
    });
}

// Re-run this every time new cards are added to the page
const observer = new MutationObserver(() => {
    addTapAnimation(".subject-card");
    addTapAnimation(".back-btn");
});
observer.observe(subjectListDiv, { childList: true });
observer.observe(pageHeaderDiv, { childList: true });