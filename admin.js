// ---------------------------------------------------------------------
// Admin page: Supabase Auth login + full CRUD for subjects/modules +
// PDF uploads to the "pdfs" storage bucket.
//
// Security note: the RLS policies (set up in the Supabase dashboard)
// are what actually protect writes — anyone can read this file's
// source, but only a logged-in session (checked server-side by
// Supabase) can insert/update/delete.
// ---------------------------------------------------------------------
const SUPABASE_URL = "https://fdqrnhmkcqbmoquialgv.supabase.co";
const SUPABASE_KEY = "sb_publishable_uL-TrR68TD2bk5kdnjKwjA_r60zC85R";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = "pdfs";

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const subjectsList = document.getElementById("subjectsList");
const addSubjectForm = document.getElementById("addSubjectForm");
const addSubjectStatus = document.getElementById("addSubjectStatus");

let subjectsCache = [];

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
async function checkSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    toggleAuthUI(!!session);
    if (session) loadDashboard();
}

function toggleAuthUI(loggedIn) {
    loginSection.style.display = loggedIn ? "none" : "block";
    dashboardSection.style.display = loggedIn ? "block" : "none";
    logoutBtn.style.display = loggedIn ? "inline-block" : "none";
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        loginError.textContent = error.message;
        return;
    }
    toggleAuthUI(true);
    loadDashboard();
});

logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    toggleAuthUI(false);
});

checkSession();

// ---------------------------------------------------------------------
// File upload helper
// Returns the public URL of the uploaded file, or null if no file given.
// ---------------------------------------------------------------------
async function uploadFile(file, folder) {
    if (!file) return null;
    const safeName = file.name.replace(/\s+/g, "_");
    const path = `${folder}/${Date.now()}-${safeName}`;

    const { error } = await supabaseClient.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;

    const { data } = supabaseClient.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

// ---------------------------------------------------------------------
// Load + render dashboard
// ---------------------------------------------------------------------
async function loadDashboard() {
    subjectsList.innerHTML = `<p class="admin-hint">Loading...</p>`;
    const { data, error } = await supabaseClient
        .from("subjects")
        .select("*, modules(*)")
        .order("id", { ascending: true });

    if (error) {
        subjectsList.innerHTML = `<p class="admin-error">Failed to load: ${error.message}</p>`;
        return;
    }

    subjectsCache = data.map(s => ({ ...s, modules: (s.modules || []).sort((a, b) => a.id - b.id) }));
    renderSubjects();
}

function renderSubjects() {
    if (!subjectsCache.length) {
        subjectsList.innerHTML = `<p class="admin-hint">No subjects yet — add one above.</p>`;
        return;
    }

    subjectsList.innerHTML = subjectsCache.map(subject => `
        <div class="subject-row" data-subject-id="${subject.id}">
            <div class="subject-row-head" data-toggle="${subject.id}">
                <b>${subject.icon || "📚"} ${subject.name}${subject.direct ? " (direct)" : ""}</b>
                <div class="subject-row-actions">
                    <button class="admin-btn secondary small" data-edit-subject="${subject.id}">Edit</button>
                    <button class="admin-btn danger small" data-delete-subject="${subject.id}">Delete</button>
                </div>
            </div>
            <div class="subject-row-body" id="subject-body-${subject.id}">
                ${subject.syllabus ? `<p class="admin-hint">📘 Syllabus: <a href="${subject.syllabus}" target="_blank">view</a></p>` : ""}

                ${subject.modules.map(m => renderModuleRow(subject, m)).join("") || `<p class="admin-hint">No modules yet.</p>`}

                <button class="admin-btn secondary small" data-add-module="${subject.id}" style="margin-top:12px;">+ Add Module</button>
                <div id="add-module-form-${subject.id}"></div>
            </div>
        </div>
    `).join("");

    wireSubjectEvents();
}

function renderModuleRow(subject, m) {
    return `
        <div class="module-row" data-module-id="${m.id}">
            <span>📖 ${m.name}</span>
            <span>
                <button class="admin-btn secondary small" data-edit-module="${m.id}" data-subject="${subject.id}">Edit</button>
                <button class="admin-btn danger small" data-delete-module="${m.id}">Delete</button>
            </span>
        </div>
        <div id="edit-module-form-${m.id}"></div>
    `;
}

function wireSubjectEvents() {
    subjectsList.querySelectorAll("[data-toggle]").forEach(head => {
        head.addEventListener("click", (e) => {
            if (e.target.closest("button")) return;
            const id = head.dataset.toggle;
            document.getElementById(`subject-body-${id}`).classList.toggle("open");
        });
    });

    subjectsList.querySelectorAll("[data-delete-subject]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            const id = btn.dataset.deleteSubject;
            if (!confirm("Delete this subject and all its modules? This cannot be undone.")) return;
            await supabaseClient.from("modules").delete().eq("subject_id", id);
            await supabaseClient.from("subjects").delete().eq("id", id);
            loadDashboard();
        });
    });

    subjectsList.querySelectorAll("[data-delete-module]").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("Delete this module?")) return;
            await supabaseClient.from("modules").delete().eq("id", btn.dataset.deleteModule);
            loadDashboard();
        });
    });

    subjectsList.querySelectorAll("[data-edit-subject]").forEach(btn => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); openEditSubjectForm(btn.dataset.editSubject); });
    });

    subjectsList.querySelectorAll("[data-add-module]").forEach(btn => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); openAddModuleForm(btn.dataset.addModule); });
    });

    subjectsList.querySelectorAll("[data-edit-module]").forEach(btn => {
        btn.addEventListener("click", (e) => { e.stopPropagation(); openEditModuleForm(btn.dataset.editModule, btn.dataset.subject); });
    });
}

// ---------------------------------------------------------------------
// Add Subject
// ---------------------------------------------------------------------
addSubjectForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    addSubjectStatus.textContent = "Saving...";

    const name = document.getElementById("subjectName").value.trim();
    const icon = document.getElementById("subjectIcon").value.trim() || "📚";
    const direct = document.getElementById("subjectDirect").checked;
    const syllabusFile = document.getElementById("subjectSyllabus").files[0];

    try {
        const { data, error } = await supabaseClient
            .from("subjects")
            .insert({ name, icon, direct })
            .select()
            .single();
        if (error) throw error;

        if (syllabusFile) {
            const url = await uploadFile(syllabusFile, `subjects/${data.id}`);
            await supabaseClient.from("subjects").update({ syllabus: url }).eq("id", data.id);
        }

        addSubjectStatus.textContent = "Subject added ✓";
        addSubjectForm.reset();
        setTimeout(() => addSubjectStatus.textContent = "", 2000);
        loadDashboard();
    } catch (err) {
        addSubjectStatus.textContent = "Error: " + err.message;
        addSubjectStatus.className = "admin-error";
    }
});

// ---------------------------------------------------------------------
// Edit Subject (inline form)
// ---------------------------------------------------------------------
function openEditSubjectForm(subjectId) {
    const subject = subjectsCache.find(s => String(s.id) === String(subjectId));
    if (!subject) return;
    document.getElementById(`subject-body-${subjectId}`).classList.add("open");

    const container = document.createElement("div");
    container.className = "inline-form";
    container.innerHTML = `
        <label>Subject Name</label>
        <input type="text" class="edit-subject-name" value="${subject.name}">
        <label>Icon</label>
        <input type="text" class="edit-subject-icon" value="${subject.icon || ""}" maxlength="4">
        <label class="admin-checkbox"><input type="checkbox" class="edit-subject-direct" ${subject.direct ? "checked" : ""}> Direct resource list</label>
        <label>Replace Syllabus PDF (optional)</label>
        <input type="file" class="edit-subject-syllabus" accept="application/pdf">
        <button class="admin-btn primary small" id="save-subject-${subjectId}" style="margin-top:10px;">Save</button>
        <button class="admin-btn secondary small" id="cancel-subject-${subjectId}" style="margin-top:10px;">Cancel</button>
        <p class="admin-status" id="status-subject-${subjectId}"></p>
    `;

    const body = document.getElementById(`subject-body-${subjectId}`);
    body.querySelector(".inline-form")?.remove();
    body.prepend(container);

    container.querySelector(`#cancel-subject-${subjectId}`).addEventListener("click", () => container.remove());
    container.querySelector(`#save-subject-${subjectId}`).addEventListener("click", async () => {
        const status = container.querySelector(`#status-subject-${subjectId}`);
        status.textContent = "Saving...";
        try {
            const updates = {
                name: container.querySelector(".edit-subject-name").value.trim(),
                icon: container.querySelector(".edit-subject-icon").value.trim() || "📚",
                direct: container.querySelector(".edit-subject-direct").checked
            };
            const file = container.querySelector(".edit-subject-syllabus").files[0];
            if (file) updates.syllabus = await uploadFile(file, `subjects/${subjectId}`);

            const { error } = await supabaseClient.from("subjects").update(updates).eq("id", subjectId);
            if (error) throw error;
            loadDashboard();
        } catch (err) {
            status.textContent = "Error: " + err.message;
        }
    });
}

// ---------------------------------------------------------------------
// Add Module
// ---------------------------------------------------------------------
function openAddModuleForm(subjectId) {
    const subject = subjectsCache.find(s => String(s.id) === String(subjectId));
    if (!subject) return;
    const holder = document.getElementById(`add-module-form-${subjectId}`);

    holder.innerHTML = `
        <div class="inline-form">
            <label>Module Name</label>
            <input type="text" class="new-module-name">
            ${subject.direct ? `
                <label>File (PDF)</label>
                <input type="file" class="new-module-file" accept="application/pdf">
            ` : `
                <label>Teacher's Notes PDF</label>
                <input type="file" class="new-module-teacher" accept="application/pdf">
                <label>Quick Revision Notes PDF</label>
                <input type="file" class="new-module-ai" accept="application/pdf">
                <label>YouTube Link</label>
                <input type="url" class="new-module-youtube" placeholder="https://youtube.com/...">
            `}
            <button class="admin-btn primary small" id="save-new-module-${subjectId}" style="margin-top:10px;">Save Module</button>
            <button class="admin-btn secondary small" id="cancel-new-module-${subjectId}" style="margin-top:10px;">Cancel</button>
            <p class="admin-status" id="status-new-module-${subjectId}"></p>
        </div>
    `;

    holder.querySelector(`#cancel-new-module-${subjectId}`).addEventListener("click", () => holder.innerHTML = "");
    holder.querySelector(`#save-new-module-${subjectId}`).addEventListener("click", async () => {
        const status = holder.querySelector(`#status-new-module-${subjectId}`);
        status.textContent = "Saving...";
        try {
            const name = holder.querySelector(".new-module-name").value.trim();
            if (!name) { status.textContent = "Name is required."; return; }

            const { data: mod, error } = await supabaseClient
                .from("modules")
                .insert({ subject_id: subjectId, name })
                .select()
                .single();
            if (error) throw error;

            const updates = {};
            if (subject.direct) {
                const file = holder.querySelector(".new-module-file").files[0];
                if (file) updates.file_url = await uploadFile(file, `modules/${mod.id}`);
            } else {
                const teacherFile = holder.querySelector(".new-module-teacher").files[0];
                const aiFile = holder.querySelector(".new-module-ai").files[0];
                const youtube = holder.querySelector(".new-module-youtube").value.trim();
                if (teacherFile) updates.teacher_pdf_url = await uploadFile(teacherFile, `modules/${mod.id}`);
                if (aiFile) updates.ai_notes_pdf_url = await uploadFile(aiFile, `modules/${mod.id}`);
                if (youtube) updates.youtube_link = youtube;
            }

            if (Object.keys(updates).length) {
                await supabaseClient.from("modules").update(updates).eq("id", mod.id);
            }

            loadDashboard();
        } catch (err) {
            status.textContent = "Error: " + err.message;
        }
    });
}

// ---------------------------------------------------------------------
// Edit Module
// ---------------------------------------------------------------------
function openEditModuleForm(moduleId, subjectId) {
    const subject = subjectsCache.find(s => String(s.id) === String(subjectId));
    const mod = subject?.modules.find(m => String(m.id) === String(moduleId));
    if (!subject || !mod) return;

    const holder = document.getElementById(`edit-module-form-${moduleId}`);
    holder.innerHTML = `
        <div class="inline-form">
            <label>Module Name</label>
            <input type="text" class="edit-module-name" value="${mod.name}">
            ${subject.direct ? `
                <label>Replace File (PDF)</label>
                <input type="file" class="edit-module-file" accept="application/pdf">
                ${mod.file_url ? `<p class="admin-hint">Current: <a href="${mod.file_url}" target="_blank">view</a></p>` : ""}
            ` : `
                <label>Replace Teacher's Notes PDF</label>
                <input type="file" class="edit-module-teacher" accept="application/pdf">
                ${mod.teacher_pdf_url ? `<p class="admin-hint">Current: <a href="${mod.teacher_pdf_url}" target="_blank">view</a></p>` : ""}
                <label>Replace Quick Revision Notes PDF</label>
                <input type="file" class="edit-module-ai" accept="application/pdf">
                ${mod.ai_notes_pdf_url ? `<p class="admin-hint">Current: <a href="${mod.ai_notes_pdf_url}" target="_blank">view</a></p>` : ""}
                <label>YouTube Link</label>
                <input type="url" class="edit-module-youtube" value="${mod.youtube_link || ""}">
            `}
            <button class="admin-btn primary small" id="save-edit-module-${moduleId}" style="margin-top:10px;">Save</button>
            <button class="admin-btn secondary small" id="cancel-edit-module-${moduleId}" style="margin-top:10px;">Cancel</button>
            <p class="admin-status" id="status-edit-module-${moduleId}"></p>
        </div>
    `;

    holder.querySelector(`#cancel-edit-module-${moduleId}`).addEventListener("click", () => holder.innerHTML = "");
    holder.querySelector(`#save-edit-module-${moduleId}`).addEventListener("click", async () => {
        const status = holder.querySelector(`#status-edit-module-${moduleId}`);
        status.textContent = "Saving...";
        try {
            const updates = { name: holder.querySelector(".edit-module-name").value.trim() };

            if (subject.direct) {
                const file = holder.querySelector(".edit-module-file").files[0];
                if (file) updates.file_url = await uploadFile(file, `modules/${moduleId}`);
            } else {
                const teacherFile = holder.querySelector(".edit-module-teacher").files[0];
                const aiFile = holder.querySelector(".edit-module-ai").files[0];
                if (teacherFile) updates.teacher_pdf_url = await uploadFile(teacherFile, `modules/${moduleId}`);
                if (aiFile) updates.ai_notes_pdf_url = await uploadFile(aiFile, `modules/${moduleId}`);
                updates.youtube_link = holder.querySelector(".edit-module-youtube").value.trim();
            }

            const { error } = await supabaseClient.from("modules").update(updates).eq("id", moduleId);
            if (error) throw error;
            loadDashboard();
        } catch (err) {
            status.textContent = "Error: " + err.message;
        }
    });
}
