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

// Simple About page
function showAbout() {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding: 20px;">
            <h2>About This Hub</h2>
            <p style="margin-top:12px; color:#c1ff; max-width:500px; margin-inline:auto;">
                A central place for 3rd Sem notes, quick revision material, and video links — 
                built to save you from searching WhatsApp and Moodle before exams.
                This page is mainly buil for the 
                Students pursuing Computer Science Engineering @ The National Institute of Engineering.
            </p>
        </div>
    `;
}

function showSubjects() {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    subjects.forEach((subject) => {
        const subjectCard = document.createElement("div");
        subjectCard.className = subject.name.length > 20 ? "subject-card long-name" : "subject-card";
        subjectCard.innerHTML = `
            <div class="subject-icon">${subject.icon.endsWith('.png') || subject.icon.endsWith('.jpg') || subject.icon.endsWith('.svg') ? `<img src="${subject.icon}" alt="${subject.name}" style="width:60px;height:60px;object-fit:contain;">` : subject.icon}</div>
            <div class="subject-name">${subject.name}</div>
        `;
        subjectCard.addEventListener("click", () => {
            if (subject.direct) {
                showDirectResources(subject);
            } else {
                showModules(subject);
            }
        });
        subjectListDiv.appendChild(subjectCard);   // ✅ moved inside
    });
}



function showModules(subject) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "⬅️ Back to Subjects";
    backBtn.addEventListener("click", showSubjects);
    pageHeaderDiv.appendChild(backBtn);

    const heading = document.createElement("h2");
    heading.textContent = subject.name;
    pageHeaderDiv.appendChild(heading);

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

function showResources(module, subject) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "⬅️ Back to Modules";
    backBtn.addEventListener("click", () => {
        showModules(subject);
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

    const ytBox = document.createElement("a");
    ytBox.href = module.youtubeLink;
    ytBox.target = "_blank";
    ytBox.className = "subject-card";
    ytBox.innerHTML = `
        <div class="subject-icon">▶️</div>
        <div class="subject-name">Watch Video</div>
    `;
    subjectListDiv.appendChild(ytBox);
    // Prevent the download button click from also triggering the parent card's link
    document.querySelectorAll(".download-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    });
    // Stop footer button clicks from also opening the PDF (card click)
    document.querySelectorAll(".footer-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    });

    // Share button logic
    document.querySelectorAll(".share-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const link = btn.getAttribute("data-link");
            const fullLink = window.location.origin + "/" + link;

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
    });
}
function showDirectResources(subject) {
    pageHeaderDiv.innerHTML = "";
    subjectListDiv.innerHTML = "";

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = "⬅️ Back to Subjects";
    backBtn.addEventListener("click", showSubjects);
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
    });
}

// Start on the subjects page
showSubjects();
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