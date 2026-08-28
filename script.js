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

const subjectListDiv = document.getElementById("subject-list");
const pageHeaderDiv = document.getElementById("page-header");
// Side menu logic
const menuToggle = document.getElementById("menuToggle");
const closeMenu = document.getElementById("closeMenu");
const sideMenu = document.getElementById("sideMenu");
const overlay = document.getElementById("overlay");

menuToggle.addEventListener("click", () => {
    sideMenu.classList.add("open");
    overlay.classList.add("active");
});

function closeSideMenu() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("active");
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
        name: row.name,
        icon: row.icon,
        direct: row.direct,
        syllabus: row.syllabus || undefined,
        modules: (row.modules || [])
            .sort((a, b) => a.id - b.id)
            .map((m) =>
                row.direct
                    ? { name: m.name, file: m.file_url }
                    : {
                        name: m.name,
                        teacherPdf: m.teacher_pdf_url,
                        aiNotesPdf: m.ai_notes_pdf_url,
                        youtubeLink: m.youtube_link || ""
                    }
            )
    }));
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
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 20px;">
            <h2>About This Hub</h2>
            <p style="margin-top:12px; color:#5c5578; max-width:500px; margin-inline:auto;">
                A central place for 3rd Sem notes, quick revision material, and video links — 
                built to save you from searching WhatsApp and Moodle before exams.
                This page is mainly built for the 
                Students pursuing Computer Science Engineering @ The National Institute of Engineering.
            </p>
        </div>
    `;

    if (!fromHistory) {
        history.pushState({ view: "about" }, "");
    }
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

// Safely renders a subject's icon. Falls back to a plain folder emoji
// instead of crashing when icon is missing/null (e.g. a row added via
// bulk SQL that didn't set an icon yet) — one incomplete row should never
// take down the whole subjects list.
function renderSubjectIcon(subject) {
    const icon = subject.icon || "";
    const isImage = icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.svg');
    if (isImage) {
        return `<img src="${icon}" alt="${subject.name}" style="width:60px;height:60px;object-fit:contain;">`;
    }
    return icon || "📁";
}

function showSubjects(fromHistory) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "subjects" }, "");
    }

    subjects.forEach((subject) => {
        const subjectCard = document.createElement("div");
        subjectCard.className = subject.name.length > 20 ? "subject-card long-name" : "subject-card";
        subjectCard.innerHTML = `
            <div class="subject-icon">${renderSubjectIcon(subject)}</div>
            <div class="subject-name">${subject.name}</div>
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
}

function showModules(subject, fromHistory) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "modules", subjectName: subject.name }, "");
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
        `;
        moduleCard.addEventListener("click", () => {
            showResources(module, subject);
        });
        subjectListDiv.appendChild(moduleCard);
    });
}

function showResources(module, subject, fromHistory) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "resources", subjectName: subject.name, moduleName: module.name }, "");
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
    teacherBox.className = "resource-card";
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
    aiBox.className = "resource-card";
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

    const ytBox = document.createElement("a");
    ytBox.href = module.youtubeLink;
    ytBox.target = "_blank";
    ytBox.className = "subject-card";
    ytBox.innerHTML = `
        <div class="subject-icon">▶️</div>
        <div class="subject-name">Watch Video</div>
    `;
    subjectListDiv.appendChild(ytBox);
}

function showDirectResources(subject, fromHistory) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    if (!fromHistory) {
        history.pushState({ view: "direct", subjectName: subject.name }, "");
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

    history.replaceState({ view: "subjects" }, "");
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