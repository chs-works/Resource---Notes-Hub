const subjects = [
    {
        name: "Academic Info",
        icon: "icons/academic.png",
        direct: true,
        modules: [
            { name: "Class Timetable", file: "pdfs/academic/timetable.pdf" },
            { name: "Academic Calendar", file: "pdfs/academic/calender.pdf" }
        ]
    },
    {
        name: "Applied Mathematics-III",
        icon: "icons/maths.png",
        syllabus: "pdfs/subject1/syllabusmaths.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject1/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject1/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject1/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject1/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject1/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject1/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject1/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject1/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject1/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject1/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    },
    {
        name: "OOPS with JAVA",
        icon: "icons/Java.png",
        syllabus: "pdfs/subject2/syllabusoop.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject2/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject2/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject2/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject2/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject2/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject2/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject2/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject2/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject2/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject2/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    },
    {
        name: "Data Structures",
        icon: "icons/folder.png",
        syllabus: "pdfs/subject3/syllabusdsa.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject3/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject3/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject3/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject3/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject3/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject3/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject3/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject3/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject3/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject3/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    },
    {
        name: "Collaborative Development and Devops",
        icon: "icons/devops.png",
        syllabus: "pdfs/subject4/syllabuscdd.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject4/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject4/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject4/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject4/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject4/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject4/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject4/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject4/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject4/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject4/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    },
    {
        name: "DDCO",
        icon: "icons/ddco.png",
        syllabus: "pdfs/subject5/syllabusddco.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject5/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject5/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject5/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject5/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject5/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    },
    {
        name: "Data Analytics & Visualization",
        icon: "icons/monitor.png",
        syllabus: "pdfs/subject6/syllabusdav.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject6/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject6/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject6/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject6/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject6/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject6/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject6/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject6/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject6/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject6/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    },
    {
        name: "IDT - II",
        icon: "icons/idt.png",
        syllabus: "pdfs/subject5/syllabus.pdf",
        modules: [
            { name: "Module 1", teacherPdf: "pdfs/subject5/mod1-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod1-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 2", teacherPdf: "pdfs/subject5/mod2-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod2-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 3", teacherPdf: "pdfs/subject5/mod3-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod3-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 4", teacherPdf: "pdfs/subject5/mod4-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod4-ai-notes.pdf", youtubeLink: "" },
            { name: "Module 5", teacherPdf: "pdfs/subject5/mod5-teacher.pdf", aiNotesPdf: "pdfs/subject5/mod5-ai-notes.pdf", youtubeLink: "" }
        ]
    }
];