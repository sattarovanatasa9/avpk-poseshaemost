// =====================================================
// Рендеринг страниц приложения (аналог Платонус)
// =====================================================
import * as db from "./db.js";
import { currentUser, roleLabel } from "./auth.js";
import { exportToExcel, exportToPDF, exportGroupAnalysis } from "./export.js";
import {
    SEED_SCHEDULE, LESSON_TIMES, CLASS_HOUR, SCHEDULE_GROUP
} from "../data/college-data.js";

const content = () => document.getElementById("page-content");

// Безопасное экранирование HTML
function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Всплывающее сообщение
export function flash(message, type = "info") {
    const fc = document.getElementById("flash-container");
    const el = document.createElement("div");
    el.className = `alert alert-${type}`;
    el.innerHTML = `${esc(message)} <button class="alert-close">×</button>`;
    el.querySelector(".alert-close").onclick = () => el.remove();
    fc.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

const MONTH_NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const DAY_NAMES = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"];

function hashParams() {
    return new URLSearchParams(location.hash.split("?")[1] || "");
}

function subjectLabel(s) {
    return s ? `${s.code} ${s.name}` : "—";
}

// Доступные преподавателю группы/предметы (по назначениям)
function teacherScope() {
    const assignments = db.getAll("assignments").filter(a => a.teacherId === currentUser.uid);
    return {
        assignments,
        groupIds: new Set(assignments.map(a => a.groupId)),
        subjectIds: new Set(assignments.map(a => a.subjectId))
    };
}

// =====================================================
// СТРАНИЦА: Главная
// =====================================================
export function renderDashboard() {
    const role = currentUser.role;
    let html = `
        <div class="page-header">
            <h1>Здравствуйте, ${esc(currentUser.fullName)}!</h1>
            <p class="muted">Личный кабинет · ${roleLabel(role)}</p>
        </div>
    `;

    if (role === "admin") {
        const students = db.getAll("students");
        const teachers = db.getAll("teachers");
        const groups = db.getAll("groups");
        const subjects = db.getAll("subjects");
        const grades = db.getAll("grades");
        const scored = grades.filter(g => !g.absent && g.score !== null);
        const avgScore = scored.length ? db.avg(scored.map(g => g.score)) : 0;

        html += `
            <div class="stats-grid">
                <div class="stat-card stat-blue">
                    <div class="stat-label">Студенты</div>
                    <div class="stat-value">${students.length}</div>
                    <a href="#students" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-green">
                    <div class="stat-label">Группы</div>
                    <div class="stat-value">${groups.length}</div>
                    <a href="#groups" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-purple">
                    <div class="stat-label">Преподаватели</div>
                    <div class="stat-value">${teachers.length}</div>
                    <a href="#teachers" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-orange">
                    <div class="stat-label">Предметы</div>
                    <div class="stat-value">${subjects.length}</div>
                    <a href="#subjects" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-red">
                    <div class="stat-label">Оценок в журнале</div>
                    <div class="stat-value">${scored.length}</div>
                    <a href="#journal" class="stat-link">Журнал →</a>
                </div>
                <div class="stat-card stat-teal">
                    <div class="stat-label">Средний балл</div>
                    <div class="stat-value">${avgScore}</div>
                    <a href="#analysis" class="stat-link">Анализ →</a>
                </div>
            </div>

            <div class="grid-2">
                <div class="card">
                    <h2>Распределение оценок</h2>
                    ${scored.length === 0
                        ? '<p class="muted">Оценок пока нет.</p>'
                        : '<div class="chart-box"><canvas id="dashChart"></canvas></div>'}
                </div>
                <div class="card">
                    <h2>Быстрые действия</h2>
                    <div class="quick-actions">
                        <a href="#journal" class="quick-action"><div class="qa-icon">📔</div><div class="qa-text">Открыть журнал</div></a>
                        <a href="#analysis" class="quick-action"><div class="qa-icon">📊</div><div class="qa-text">Анализ группы</div></a>
                        <a href="#schedule" class="quick-action"><div class="qa-icon">🗓</div><div class="qa-text">Расписание</div></a>
                        <a href="#students" class="quick-action"><div class="qa-icon">👥</div><div class="qa-text">Студенты</div></a>
                    </div>
                </div>
            </div>
        `;
        content().innerHTML = html;
        if (scored.length) drawDistributionChart("dashChart", scored.map(g => g.score), "bar");
        return;
    }

    if (role === "teacher") {
        const { assignments, groupIds } = teacherScope();
        const groupsById = Object.fromEntries(db.getAll("groups").map(g => [g.id, g]));
        const subjectsById = Object.fromEntries(db.getAll("subjects").map(s => [s.id, s]));
        const myGrades = db.getWhere("grades", "teacherId", currentUser.uid)
            .filter(g => !g.absent && g.score !== null);

        const mySubjects = [...new Set(assignments.map(a => a.subjectId))]
            .map(id => subjectsById[id]).filter(Boolean);

        html += `
            <div class="stats-grid">
                <div class="stat-card stat-blue">
                    <div class="stat-label">Моих предметов</div>
                    <div class="stat-value">${mySubjects.length}</div>
                </div>
                <div class="stat-card stat-green">
                    <div class="stat-label">Моих групп</div>
                    <div class="stat-value">${groupIds.size}</div>
                </div>
                <div class="stat-card stat-teal">
                    <div class="stat-label">Выставлено оценок</div>
                    <div class="stat-value">${myGrades.length}</div>
                </div>
                <div class="stat-card stat-orange">
                    <div class="stat-label">Средний балл</div>
                    <div class="stat-value">${myGrades.length ? db.avg(myGrades.map(g => g.score)) : "—"}</div>
                </div>
            </div>

            <div class="card">
                <h2>Мои предметы</h2>
                ${mySubjects.length === 0
                    ? '<p class="muted">Вам ещё не назначены предметы. Обратитесь к администратору.</p>'
                    : `<div class="subject-chips">${mySubjects.map(s => `
                        <a class="subject-chip" href="#journal">
                            <span class="subject-chip-code">${esc(s.code)}</span>
                            <span>${esc(s.name)}</span>
                        </a>`).join("")}</div>`
                }
            </div>

            <div class="card">
                <h2>Быстрые действия</h2>
                <div class="quick-actions">
                    <a href="#journal" class="quick-action"><div class="qa-icon">📔</div><div class="qa-text">Выставить оценки</div></a>
                    <a href="#analysis" class="quick-action"><div class="qa-icon">📊</div><div class="qa-text">Анализ группы</div></a>
                    <a href="#schedule" class="quick-action"><div class="qa-icon">🗓</div><div class="qa-text">Расписание</div></a>
                </div>
            </div>
        `;
        content().innerHTML = html;
        return;
    }

    // === Студент ===
    const student = db.getById("students", currentUser.studentId);
    const group = student ? db.getById("groups", student.groupId) : null;
    const myGrades = db.getWhere("grades", "studentId", currentUser.studentId);
    const scored = myGrades.filter(g => !g.absent && g.score !== null);
    const absents = myGrades.filter(g => g.absent).length;
    const avgScore = scored.length ? db.avg(scored.map(g => g.score)) : 0;

    html += `
        <div class="stats-grid">
            <div class="stat-card stat-blue">
                <div class="stat-label">Всего оценок</div>
                <div class="stat-value">${scored.length}</div>
            </div>
            <div class="stat-card stat-green">
                <div class="stat-label">Средний балл</div>
                <div class="stat-value">${avgScore || "—"} ${scored.length ? `<span class="grade-badge ${db.gradeClass(avgScore)}">${db.scoreToLetter(avgScore)}</span>` : ""}</div>
            </div>
            <div class="stat-card stat-red">
                <div class="stat-label">Пропусков</div>
                <div class="stat-value">${absents}</div>
            </div>
        </div>

        <div class="card">
            <h2>Мой профиль</h2>
            <div class="profile-grid">
                <div><strong>ФИО:</strong> ${esc(currentUser.fullName)}</div>
                <div><strong>Группа:</strong> ${esc(group?.name || "—")} · ${group ? group.course + " курс" : ""}</div>
                <div><strong>Специальность:</strong> ${esc(group?.specialty || "—")}</div>
                <div><strong>Логин:</strong> ${esc(currentUser.login.replace(/^s/, ""))}</div>
            </div>
            <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">
                <a href="#journal" class="btn btn-primary">Мои оценки</a>
                <a href="#transcript" class="btn btn-outline">Транскрипт</a>
            </div>
        </div>
    `;
    content().innerHTML = html;
}

function drawDistributionChart(canvasId, scores, type = "doughnut") {
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    scores.forEach(s => counts[db.scoreToLetter(s)]++);
    new Chart(document.getElementById(canvasId), {
        type,
        data: {
            labels: ["A (90-100)", "B (75-89)", "C (60-74)", "D (50-59)", "F (0-49)"],
            datasets: [{
                label: "Количество",
                data: [counts.A, counts.B, counts.C, counts.D, counts.F],
                backgroundColor: ["#16a34a", "#65a30d", "#f59e0b", "#0891b2", "#dc2626"],
                borderRadius: 6,
                borderWidth: type === "doughnut" ? 2 : 0,
                borderColor: "#fff"
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: type === "doughnut" ? { position: "bottom" } : { display: false } },
            scales: type === "bar" ? { y: { beginAtZero: true, ticks: { precision: 0 } } } : {}
        }
    });
}

// =====================================================
// СТРАНИЦА: Журнал оценок
// =====================================================

// Добавленные вручную пустые колонки-даты (до первой оценки)
const extraJournalDates = {};

export function renderJournal() {
    const role = currentUser.role;

    if (role === "student") return renderStudentGrades();

    const groups = db.getAll("groups");
    const subjects = db.getAll("subjects");
    const students = db.getAll("students");
    const grades = db.getAll("grades");
    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));
    const subjectsById = Object.fromEntries(subjects.map(s => [s.id, s]));

    const params = hashParams();
    const groupId = params.get("group");
    const subjectId = params.get("subject");
    const now = new Date();
    const yearParam = parseInt(params.get("year")) || now.getFullYear();
    const monthParam = params.has("month") ? parseInt(params.get("month")) : now.getMonth();

    // Доступные группы/предметы
    let availableGroups, availableSubjects;
    if (role === "teacher") {
        const scope = teacherScope();
        if (scope.assignments.length === 0) {
            content().innerHTML = `
                <div class="page-header"><h1>Журнал</h1></div>
                <div class="card"><div class="alert alert-warning">
                    <strong>Вам ещё не назначены предметы и группы.</strong>
                    Обратитесь к администратору.
                </div></div>`;
            return;
        }
        availableGroups = db.sortGroups(groups.filter(g => scope.groupIds.has(g.id)));
        // Предметы зависят от выбранной группы
        const subjectIdsForGroup = groupId
            ? new Set(scope.assignments.filter(a => a.groupId === groupId).map(a => a.subjectId))
            : scope.subjectIds;
        availableSubjects = subjects.filter(s => subjectIdsForGroup.has(s.id));
    } else {
        availableGroups = db.sortGroups(groups);
        availableSubjects = [...subjects];
    }

    const selectedGroup = groupId ? groupsById[groupId] : null;
    const selectedSubject = subjectId ? subjectsById[subjectId] : null;

    let html = `
        <div class="page-header">
            <h1>Журнал оценок</h1>
            <p class="muted">${selectedGroup && selectedSubject
                ? `${esc(selectedGroup.name)} · ${esc(subjectLabel(selectedSubject))}`
                : "Выберите группу и предмет"}</p>
        </div>

        <div class="card">
            <div class="journal-controls">
                <div class="form-group">
                    <label>Группа</label>
                    <select id="journal-group">
                        <option value="">— выберите группу —</option>
                        ${availableGroups.map(g => `
                            <option value="${g.id}" ${g.id === groupId ? "selected" : ""}>
                                ${esc(g.name)} — ${esc(g.specialty)}
                            </option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label>Предмет</label>
                    <select id="journal-subject">
                        <option value="">— выберите предмет —</option>
                        ${availableSubjects.map(s => `
                            <option value="${s.id}" ${s.id === subjectId ? "selected" : ""}>
                                ${esc(subjectLabel(s))}
                            </option>`).join("")}
                    </select>
                </div>
            </div>
        </div>
    `;

    if (!selectedGroup || !selectedSubject) {
        html += `<div class="card"><p class="muted text-center" style="padding:30px">
            Выберите группу и предмет, чтобы открыть журнал.
        </p></div>`;
        content().innerHTML = html;
        setupJournalSelectors(yearParam, monthParam);
        return;
    }

    const groupStudents = students
        .filter(s => s.groupId === selectedGroup.id)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

    const studentIds = new Set(groupStudents.map(s => s.id));
    const journalGrades = grades.filter(g =>
        studentIds.has(g.studentId) && g.subjectId === selectedSubject.id);

    // Даты месяца: из оценок + добавленные вручную
    const monthKey = `${selectedGroup.id}|${selectedSubject.id}|${yearParam}-${monthParam}`;
    const datesSet = new Set(extraJournalDates[monthKey] || []);
    journalGrades.forEach(g => {
        if (!g.date) return;
        const d = new Date(g.date);
        if (d.getFullYear() === yearParam && d.getMonth() === monthParam) datesSet.add(g.date);
    });
    const dates = Array.from(datesSet).sort();

    const prevMonth = monthParam === 0 ? 11 : monthParam - 1;
    const prevYear = monthParam === 0 ? yearParam - 1 : yearParam;
    const nextMonth = monthParam === 11 ? 0 : monthParam + 1;
    const nextYear = monthParam === 11 ? yearParam + 1 : yearParam;
    const baseUrl = `#journal?group=${selectedGroup.id}&subject=${selectedSubject.id}`;

    html += `
        <div class="card">
            <div class="journal-month-nav">
                <a href="${baseUrl}&year=${prevYear}&month=${prevMonth}" class="btn btn-sm btn-outline">←</a>
                <strong class="journal-month-title">${MONTH_NAMES[monthParam]} ${yearParam}</strong>
                <a href="${baseUrl}&year=${nextYear}&month=${nextMonth}" class="btn btn-sm btn-outline">→</a>
                <button id="btn-add-date" class="btn btn-sm btn-primary">+ Дата занятия</button>
            </div>
            <div class="legend">
                <span><span class="grade-badge grade-A">A</span> 90–100</span>
                <span><span class="grade-badge grade-B">B</span> 75–89</span>
                <span><span class="grade-badge grade-C">C</span> 60–74</span>
                <span><span class="grade-badge grade-D">D</span> 50–59</span>
                <span><span class="grade-badge grade-F">F</span> 0–49</span>
                <span><span class="grade-badge grade-N">н</span> пропуск</span>
                <span class="muted">Клик по ячейке — выставить оценку (число 10–100, «н» — пропуск, пусто — удалить)</span>
            </div>
        </div>
    `;

    // Таблица журнала
    html += `<div class="card journal-card"><div class="journal-table-wrap"><table class="journal-table">`;
    html += `<thead><tr><th class="journal-th-num">№</th><th class="journal-th-name">ФИО студента</th>`;
    dates.forEach(date => {
        const d = new Date(date);
        html += `<th class="journal-th-date" title="${date}">
            <div class="journal-date-day">${DAY_NAMES[d.getDay()]}</div>
            <div class="journal-date-num">${d.getDate()}</div>
        </th>`;
    });
    html += `<th class="journal-th-avg">Средний</th><th class="journal-th-abs">Проп.</th></tr></thead><tbody>`;

    groupStudents.forEach((s, i) => {
        const studGrades = journalGrades.filter(g => g.studentId === s.id);
        const studScores = studGrades.filter(g => !g.absent && g.score !== null).map(g => g.score);
        const studAvg = studScores.length ? db.avg(studScores) : null;
        const studAbsents = studGrades.filter(g => g.absent).length;

        html += `<tr>
            <td class="journal-td-num">${i + 1}</td>
            <td class="journal-td-name"><strong>${esc(s.fullName)}</strong></td>`;

        dates.forEach(date => {
            const grade = studGrades.find(g => g.date === date);
            let cls = "", text = "";
            if (grade) {
                if (grade.absent) { cls = "grade-N"; text = "н"; }
                else { cls = db.gradeClass(grade.score); text = grade.score; }
            }
            html += `<td class="journal-td-grade ${cls}"
                data-student-id="${s.id}" data-date="${date}"
                ${grade ? `data-grade-id="${grade.id}" data-value="${grade.absent ? "н" : grade.score}"` : ""}>${text}</td>`;
        });

        html += `<td class="journal-td-avg">${studAvg !== null
            ? `<strong>${studAvg}</strong> <span class="grade-badge ${db.gradeClass(studAvg)}">${db.scoreToLetter(studAvg)}</span>`
            : "—"}</td>`;
        html += `<td class="journal-td-abs">${studAbsents || ""}</td></tr>`;
    });

    if (groupStudents.length === 0) {
        html += `<tr><td colspan="${dates.length + 4}" class="muted" style="padding:30px;text-align:center">В этой группе нет студентов</td></tr>`;
    }

    html += `</tbody></table></div></div>`;
    content().innerHTML = html;

    setupJournalSelectors(yearParam, monthParam);

    document.getElementById("btn-add-date").onclick = () => {
        const today = new Date();
        const defaultDate = (yearParam === today.getFullYear() && monthParam === today.getMonth())
            ? today.toISOString().slice(0, 10)
            : `${yearParam}-${String(monthParam + 1).padStart(2, "0")}-15`;
        const dateStr = prompt("Дата занятия (ГГГГ-ММ-ДД):", defaultDate);
        if (!dateStr) return;
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) { flash("Некорректная дата", "danger"); return; }
        if (d.getMonth() !== monthParam || d.getFullYear() !== yearParam) {
            flash("Дата должна быть в выбранном месяце журнала", "warning");
            return;
        }
        if (!extraJournalDates[monthKey]) extraJournalDates[monthKey] = [];
        if (!extraJournalDates[monthKey].includes(dateStr)) extraJournalDates[monthKey].push(dateStr);
        renderJournal();
    };

    document.querySelectorAll(".journal-td-grade").forEach(td => {
        td.onclick = () => editGradeCell(td, selectedGroup, selectedSubject);
    });
}

// =====================================================
// Редактирование ячейки журнала (встроенный ввод)
// =====================================================
function editGradeCell(td, group, subject) {
    if (td.querySelector("input")) return;

    // Преподаватель — только свои назначения
    if (currentUser.role === "teacher") {
        const ok = db.getAll("assignments").some(a =>
            a.teacherId === currentUser.uid && a.subjectId === subject.id && a.groupId === group.id);
        if (!ok) { flash("Вы не назначены на этот предмет в этой группе", "danger"); return; }
    }

    const oldValue = td.dataset.value || "";
    const oldText = td.textContent;
    td.textContent = "";
    const input = document.createElement("input");
    input.className = "journal-cell-input";
    input.value = oldValue;
    input.maxLength = 3;
    td.appendChild(input);
    input.focus();
    input.select();

    let finished = false;
    const cancel = () => {
        if (finished) return;
        finished = true;
        td.textContent = oldText;
    };

    const save = () => {
        if (finished) return;
        finished = true;
        const raw = input.value.trim().toLowerCase();
        const gradeId = td.dataset.gradeId;
        const studentId = td.dataset.studentId;
        const date = td.dataset.date;

        try {
            if (raw === "") {
                if (gradeId) {
                    db.remove("grades", gradeId);
                    flash("Оценка удалена", "success");
                }
                renderJournal();
                return;
            }

            const isAbsent = raw === "н" || raw === "n" || raw === "h";
            let score = null;
            if (!isAbsent) {
                score = parseInt(raw);
                if (isNaN(score) || score < 10 || score > 100) {
                    flash("Введите балл 10–100, «н» для пропуска или пусто для удаления", "danger");
                    td.textContent = oldText;
                    return;
                }
            }

            const data = {
                score: isAbsent ? null : score,
                absent: isAbsent,
                date
            };

            if (gradeId) {
                db.update("grades", gradeId, data);
            } else {
                db.create("grades", {
                    ...data,
                    studentId,
                    subjectId: subject.id,
                    groupId: group.id,
                    teacherId: currentUser.role === "teacher" ? currentUser.uid : (subject.teacherId || currentUser.uid),
                    type: "current",
                    comment: ""
                });
            }
            renderJournal();
        } catch (err) {
            flash("Ошибка: " + err.message, "danger");
            renderJournal();
        }
    };

    input.onkeydown = (e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") cancel();
    };
    input.onblur = save;
}

function setupJournalSelectors(year, month) {
    const sg = document.getElementById("journal-group");
    const ss = document.getElementById("journal-subject");
    const update = () => {
        const g = sg.value, s = ss.value;
        if (g && s) location.hash = `journal?group=${g}&subject=${s}&year=${year}&month=${month}`;
        else if (g) location.hash = `journal?group=${g}&year=${year}&month=${month}`;
        else location.hash = "journal";
    };
    if (sg) sg.onchange = update;
    if (ss) ss.onchange = update;
}

// =====================================================
// СТРАНИЦА: Оценки студента
// =====================================================
function renderStudentGrades() {
    const subjectsById = Object.fromEntries(db.getAll("subjects").map(s => [s.id, s]));
    const teachersById = Object.fromEntries(db.getAll("teachers").map(t => [t.id, t]));
    const myGrades = db.getWhere("grades", "studentId", currentUser.studentId)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    // Группировка по предметам
    const bySubject = {};
    myGrades.forEach(g => {
        if (!bySubject[g.subjectId]) bySubject[g.subjectId] = [];
        bySubject[g.subjectId].push(g);
    });

    let html = `
        <div class="page-header">
            <h1>Мои оценки</h1>
            <p class="muted">${myGrades.length} записей в журнале</p>
        </div>
        <div class="card">
            <div class="legend">
                <span><span class="grade-badge grade-A">A</span> 90–100 — Отлично</span>
                <span><span class="grade-badge grade-B">B</span> 75–89 — Хорошо</span>
                <span><span class="grade-badge grade-C">C</span> 60–74 — Удовл.</span>
                <span><span class="grade-badge grade-D">D</span> 50–59 — Зачёт</span>
                <span><span class="grade-badge grade-F">F</span> 0–49 — Неуд.</span>
                <span><span class="grade-badge grade-N">н</span> Пропуск</span>
            </div>
        </div>
    `;

    if (myGrades.length === 0) {
        html += `<div class="card"><p class="muted text-center" style="padding:30px">У вас пока нет оценок.</p></div>`;
        content().innerHTML = html;
        return;
    }

    Object.entries(bySubject).forEach(([subId, items]) => {
        const sub = subjectsById[subId];
        const scores = items.filter(g => !g.absent && g.score !== null).map(g => g.score);
        const avgScore = scores.length ? db.avg(scores) : null;
        const absents = items.filter(g => g.absent).length;

        html += `
            <div class="card">
                <div class="subject-grades-header">
                    <h2>${esc(subjectLabel(sub))}</h2>
                    <div class="subject-grades-meta">
                        ${avgScore !== null ? `<span>Средний: <strong>${avgScore}</strong> <span class="grade-badge ${db.gradeClass(avgScore)}">${db.scoreToLetter(avgScore)}</span></span>` : ""}
                        ${absents ? `<span class="muted">Пропусков: ${absents}</span>` : ""}
                    </div>
                </div>
                <div class="student-grades-row">
                    ${items.slice().sort((a, b) => (a.date || "").localeCompare(b.date || "")).map(g => `
                        <div class="student-grade-pill ${g.absent ? "grade-N" : db.gradeClass(g.score)}"
                             title="${esc(g.date)} · ${esc(teachersById[g.teacherId]?.fullName || "")}">
                            <div class="sg-score">${g.absent ? "н" : g.score}</div>
                            <div class="sg-date">${new Date(g.date).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}</div>
                        </div>`).join("")}
                </div>
            </div>
        `;
    });

    content().innerHTML = html;
}

// =====================================================
// СТРАНИЦА: Транскрипт студента
// =====================================================
export function renderTranscript() {
    const student = db.getById("students", currentUser.studentId);
    const group = student ? db.getById("groups", student.groupId) : null;
    const subjects = db.getAll("subjects");
    const myGrades = db.getWhere("grades", "studentId", currentUser.studentId);

    const rows = subjects.map(sub => {
        const items = myGrades.filter(g => g.subjectId === sub.id && !g.absent && g.score !== null);
        const scores = items.map(g => g.score);
        const avgScore = scores.length ? db.avg(scores) : null;
        return { sub, count: scores.length, avgScore };
    }).filter(r => r.count > 0);

    const allScores = myGrades.filter(g => !g.absent && g.score !== null).map(g => g.score);
    const gpa = allScores.length ? db.avg(allScores) : 0;

    content().innerHTML = `
        <div class="page-header">
            <h1>Транскрипт</h1>
            <p class="muted">Итоговая успеваемость по дисциплинам</p>
        </div>

        <div class="card transcript-head">
            <div class="profile-grid">
                <div><strong>ФИО:</strong> ${esc(currentUser.fullName)}</div>
                <div><strong>Группа:</strong> ${esc(group?.name || "—")}, ${group ? group.course + " курс" : ""}</div>
                <div><strong>Специальность:</strong> ${esc(group?.specialty || "—")}</div>
                <div><strong>Средний балл (GPA):</strong> <strong>${gpa}</strong> ${allScores.length ? `<span class="grade-badge ${db.gradeClass(gpa)}">${db.scoreToLetter(gpa)}</span>` : ""}</div>
            </div>
        </div>

        <div class="card">
            <h2>Дисциплины</h2>
            ${rows.length === 0 ? '<p class="muted text-center" style="padding:30px">Оценок пока нет.</p>' : `
            <table class="data-table">
                <thead><tr><th>№</th><th>Код</th><th>Дисциплина / модуль</th><th>Часов</th><th>Оценок</th><th>Итоговый балл</th><th>Оценка</th></tr></thead>
                <tbody>
                    ${rows.map((r, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><span class="badge">${esc(r.sub.code)}</span></td>
                            <td><strong>${esc(r.sub.name)}</strong></td>
                            <td>${r.sub.hours || "—"}</td>
                            <td>${r.count}</td>
                            <td><strong>${r.avgScore}</strong></td>
                            <td><span class="grade-badge ${db.gradeClass(r.avgScore)}">${db.scoreToLetter(r.avgScore)}</span> ${db.letterDescription(db.scoreToLetter(r.avgScore))}</td>
                        </tr>`).join("")}
                </tbody>
            </table>`}
        </div>
    `;
}

// =====================================================
// СТРАНИЦА: Расписание
// =====================================================
export function renderSchedule() {
    const subjectsById = Object.fromEntries(db.getAll("subjects").map(s => [s.id, s]));
    const teachersById = Object.fromEntries(db.getAll("teachers").map(t => [t.id, t]));
    const days = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница"];

    // Все номера пар, встречающиеся в расписании
    const lessons = [...new Set(SEED_SCHEDULE.map(l => l.lesson))].sort();

    let html = `
        <div class="page-header">
            <h1>Расписание занятий</h1>
            <p class="muted">Группа ${esc(SCHEDULE_GROUP)} · 06130100 «Программное обеспечение» · 2025-2026 уч. год, 2 семестр</p>
        </div>

        <div class="card schedule-card">
            <div class="schedule-wrap">
            <table class="schedule-table">
                <thead><tr>
                    <th class="schedule-th-time">№ / Время</th>
                    ${days.map(d => `<th>${d}</th>`).join("")}
                </tr></thead>
                <tbody>
    `;

    lessons.forEach(lesson => {
        html += `<tr>
            <td class="schedule-td-time">
                <div class="schedule-lesson-num">${lesson} пара</div>
                <div class="schedule-lesson-time">${LESSON_TIMES[lesson] || ""}</div>
            </td>`;
        for (let day = 1; day <= 5; day++) {
            const slot = SEED_SCHEDULE.find(l => l.day === day && l.lesson === lesson);
            if (!slot) { html += `<td class="schedule-td-empty">—</td>`; continue; }
            const sub = subjectsById[slot.subjectId];
            const teacher = sub ? teachersById[sub.teacherId] : null;
            const isMine = currentUser.role === "teacher" && sub && sub.teacherId === currentUser.uid;
            html += `<td class="schedule-td-lesson ${isMine ? "schedule-mine" : ""}">
                <div class="schedule-subject"><span class="badge">${esc(sub?.code || "")}</span> ${esc(sub?.name || "")}</div>
                <div class="schedule-meta">${esc(teacher?.fullName || "")} · ауд. ${esc(slot.room)}</div>
            </td>`;
        }
        html += `</tr>`;
    });

    // Классный час
    const curator = teachersById[CLASS_HOUR.teacherId];
    html += `<tr>
        <td class="schedule-td-time">
            <div class="schedule-lesson-num">Кл. час</div>
            <div class="schedule-lesson-time">${CLASS_HOUR.time}</div>
        </td>`;
    for (let day = 1; day <= 5; day++) {
        if (day === CLASS_HOUR.day) {
            html += `<td class="schedule-td-lesson schedule-classhour">
                <div class="schedule-subject">${esc(CLASS_HOUR.name)}</div>
                <div class="schedule-meta">${esc(curator?.fullName || "")} · ауд. ${esc(CLASS_HOUR.room)}</div>
            </td>`;
        } else {
            html += `<td class="schedule-td-empty">—</td>`;
        }
    }
    html += `</tr></tbody></table></div></div>`;

    if (currentUser.role === "teacher") {
        html += `<div class="card"><p class="muted">💡 Ваши занятия выделены цветом.</p></div>`;
    }

    content().innerHTML = html;
}

// =====================================================
// СТРАНИЦА: Анализ успеваемости группы
// =====================================================
export function renderAnalysis() {
    const role = currentUser.role;
    const groups = db.getAll("groups");
    const subjects = db.getAll("subjects");
    const students = db.getAll("students");
    const grades = db.getAll("grades");
    const teachersById = Object.fromEntries(db.getAll("teachers").map(t => [t.id, t]));

    let availableGroups;
    if (role === "teacher") {
        const scope = teacherScope();
        availableGroups = db.sortGroups(groups.filter(g => scope.groupIds.has(g.id)));
    } else {
        availableGroups = db.sortGroups(groups);
    }

    const params = hashParams();
    const groupId = params.get("group");
    const selectedGroup = groupId ? groups.find(g => g.id === groupId) : null;

    let html = `
        <div class="page-header">
            <h1>Анализ успеваемости группы</h1>
            <p class="muted">${selectedGroup
                ? `${esc(selectedGroup.name)} · ${esc(selectedGroup.specialty)} · ${selectedGroup.course} курс`
                : "Выберите группу для построения полного отчёта"}</p>
        </div>

        <div class="card">
            <div class="journal-controls">
                <div class="form-group">
                    <label>Группа</label>
                    <select id="analysis-group">
                        <option value="">— выберите группу —</option>
                        ${availableGroups.map(g => `
                            <option value="${g.id}" ${g.id === groupId ? "selected" : ""}>
                                ${esc(g.name)} — ${esc(g.specialty)}
                            </option>`).join("")}
                    </select>
                </div>
            </div>
        </div>
    `;

    if (!selectedGroup) {
        html += `<div class="card"><p class="muted text-center" style="padding:30px">
            Выберите группу — система построит полный анализ: средний балл, успеваемость,
            качество знаний, посещаемость, динамику по месяцам, разбор по предметам и рейтинг студентов.
        </p></div>`;
        content().innerHTML = html;
        setupAnalysisSelector();
        return;
    }

    // ===== Расчёты =====
    const groupStudents = students
        .filter(s => s.groupId === selectedGroup.id)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
    const studentIds = new Set(groupStudents.map(s => s.id));
    const groupGrades = grades.filter(g => studentIds.has(g.studentId));
    const scoredGrades = groupGrades.filter(g => !g.absent && g.score !== null);
    const scores = scoredGrades.map(g => g.score);
    const absents = groupGrades.filter(g => g.absent).length;

    if (groupGrades.length === 0) {
        html += `<div class="card"><div class="alert alert-info">
            В журнале группы <strong>${esc(selectedGroup.name)}</strong> пока нет оценок.
            Откройте <a href="#journal?group=${selectedGroup.id}">журнал</a> и выставьте оценки —
            анализ построится автоматически.
        </div></div>`;
        content().innerHTML = html;
        setupAnalysisSelector();
        return;
    }

    const avgScore = db.avg(scores);
    const uspevaemost = db.passRate(scores);          // % оценок >= 50
    const kachestvo = db.qualityRate(scores);          // % оценок >= 75
    const poseshaemost = groupGrades.length
        ? Math.round(((groupGrades.length - absents) / groupGrades.length) * 100) : 100;

    // По предметам
    const bySubject = subjects.map(sub => {
        const items = scoredGrades.filter(g => g.subjectId === sub.id);
        const subScores = items.map(g => g.score);
        const subAbsents = groupGrades.filter(g => g.subjectId === sub.id && g.absent).length;
        return {
            sub,
            teacher: teachersById[sub.teacherId],
            count: subScores.length,
            absents: subAbsents,
            avg: subScores.length ? db.avg(subScores) : null,
            pass: db.passRate(subScores),
            quality: db.qualityRate(subScores)
        };
    }).filter(r => r.count > 0 || r.absents > 0);

    // По студентам (рейтинг)
    const byStudent = groupStudents.map(st => {
        const items = scoredGrades.filter(g => g.studentId === st.id);
        const stScores = items.map(g => g.score);
        const stAbsents = groupGrades.filter(g => g.studentId === st.id && g.absent).length;
        return {
            st,
            count: stScores.length,
            absents: stAbsents,
            avg: stScores.length ? db.avg(stScores) : null,
            pass: db.passRate(stScores),
            quality: db.qualityRate(stScores)
        };
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

    // Динамика по месяцам
    const byMonth = {};
    scoredGrades.forEach(g => {
        const key = g.date.slice(0, 7); // ГГГГ-ММ
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(g.score);
    });
    const monthKeys = Object.keys(byMonth).sort();

    // Отстающие
    const struggling = byStudent.filter(r => r.avg !== null && r.avg < 50);
    const excellent = byStudent.filter(r => r.avg !== null && r.avg >= 90);

    html += `
        <div class="stats-grid">
            <div class="stat-card stat-teal">
                <div class="stat-label">Средний балл</div>
                <div class="stat-value">${avgScore} <span class="grade-badge ${db.gradeClass(avgScore)}">${db.scoreToLetter(avgScore)}</span></div>
            </div>
            <div class="stat-card stat-green">
                <div class="stat-label">Успеваемость</div>
                <div class="stat-value">${uspevaemost}%</div>
                <div class="muted" style="font-size:11px">доля оценок ≥ 50</div>
            </div>
            <div class="stat-card stat-purple">
                <div class="stat-label">Качество знаний</div>
                <div class="stat-value">${kachestvo}%</div>
                <div class="muted" style="font-size:11px">доля оценок ≥ 75</div>
            </div>
            <div class="stat-card stat-blue">
                <div class="stat-label">Посещаемость</div>
                <div class="stat-value">${poseshaemost}%</div>
                <div class="muted" style="font-size:11px">${absents} пропусков</div>
            </div>
            <div class="stat-card stat-orange">
                <div class="stat-label">Студентов</div>
                <div class="stat-value">${groupStudents.length}</div>
            </div>
            <div class="stat-card stat-red">
                <div class="stat-label">Оценок в журнале</div>
                <div class="stat-value">${scores.length}</div>
            </div>
        </div>

        <div class="card export-info">
            <div class="page-header-flex" style="margin:0">
                <p class="muted" style="margin:0">📄 Полный отчёт по группе можно выгрузить для печати и педсовета.</p>
                <div class="export-buttons">
                    <button id="btn-export-group" class="btn btn-export btn-excel">📊 Экспорт группы в Excel</button>
                </div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <h2>Распределение оценок</h2>
                <div class="chart-box"><canvas id="anDistChart"></canvas></div>
            </div>
            <div class="card">
                <h2>Динамика среднего балла по месяцам</h2>
                <div class="chart-box"><canvas id="anTrendChart"></canvas></div>
            </div>
        </div>

        <div class="card">
            <h2>Средний балл по предметам</h2>
            <div class="chart-box"><canvas id="anSubjChart"></canvas></div>
        </div>

        <div class="card">
            <h2>Разбор по предметам</h2>
            <table class="data-table">
                <thead><tr>
                    <th>Предмет / модуль</th><th>Преподаватель</th><th>Оценок</th><th>Проп.</th>
                    <th>Средний</th><th>Успев. %</th><th>Качество %</th>
                </tr></thead>
                <tbody>
                    ${bySubject.map(r => `
                        <tr>
                            <td><strong>${esc(r.sub.code)}</strong> ${esc(r.sub.name)}</td>
                            <td>${esc(r.teacher?.fullName || "—")}</td>
                            <td>${r.count}</td>
                            <td>${r.absents || "—"}</td>
                            <td>${r.avg !== null ? `<strong>${r.avg}</strong> <span class="grade-badge ${db.gradeClass(r.avg)}">${db.scoreToLetter(r.avg)}</span>` : "—"}</td>
                            <td>${r.count ? r.pass + "%" : "—"}</td>
                            <td>${r.count ? r.quality + "%" : "—"}</td>
                        </tr>`).join("")}
                </tbody>
            </table>
        </div>

        ${excellent.length || struggling.length ? `
        <div class="grid-2">
            <div class="card">
                <h2>🏆 Отличники (90+)</h2>
                ${excellent.length === 0 ? '<p class="muted">Нет студентов со средним баллом 90+.</p>' : `
                <table class="data-table">
                    <tbody>${excellent.map((r, i) => `
                        <tr>
                            <td>${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                            <td><strong>${esc(r.st.fullName)}</strong></td>
                            <td><strong>${r.avg}</strong> <span class="grade-badge ${db.gradeClass(r.avg)}">${db.scoreToLetter(r.avg)}</span></td>
                        </tr>`).join("")}</tbody>
                </table>`}
            </div>
            <div class="card">
                <h2>⚠️ Требуют внимания (&lt;50)</h2>
                ${struggling.length === 0 ? '<p class="muted">Неуспевающих студентов нет. 👍</p>' : `
                <table class="data-table">
                    <tbody>${struggling.map(r => `
                        <tr>
                            <td><strong>${esc(r.st.fullName)}</strong></td>
                            <td><strong>${r.avg}</strong> <span class="grade-badge grade-F">F</span></td>
                            <td class="muted">${r.absents} проп.</td>
                        </tr>`).join("")}</tbody>
                </table>`}
            </div>
        </div>` : ""}

        <div class="card">
            <h2>Рейтинг студентов группы</h2>
            <table class="data-table">
                <thead><tr>
                    <th>Место</th><th>ФИО</th><th>Оценок</th><th>Пропусков</th>
                    <th>Средний балл</th><th>Успев. %</th><th>Качество %</th>
                </tr></thead>
                <tbody>
                    ${byStudent.map((r, i) => `
                        <tr>
                            <td>${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                            <td><strong>${esc(r.st.fullName)}</strong></td>
                            <td>${r.count}</td>
                            <td>${r.absents || "—"}</td>
                            <td>${r.avg !== null ? `<strong>${r.avg}</strong> <span class="grade-badge ${db.gradeClass(r.avg)}">${db.scoreToLetter(r.avg)}</span>` : "—"}</td>
                            <td>${r.count ? r.pass + "%" : "—"}</td>
                            <td>${r.count ? r.quality + "%" : "—"}</td>
                        </tr>`).join("")}
                </tbody>
            </table>
        </div>
    `;

    content().innerHTML = html;
    setupAnalysisSelector();

    // ===== Графики =====
    drawDistributionChart("anDistChart", scores, "doughnut");

    new Chart(document.getElementById("anTrendChart"), {
        type: "line",
        data: {
            labels: monthKeys.map(k => {
                const [y, m] = k.split("-");
                return MONTH_NAMES[parseInt(m) - 1] + " " + y;
            }),
            datasets: [{
                label: "Средний балл",
                data: monthKeys.map(k => db.avg(byMonth[k])),
                borderColor: "#0d9488",
                backgroundColor: "rgba(13,148,136,0.12)",
                fill: true,
                tension: 0.35,
                pointRadius: 5,
                pointBackgroundColor: "#0d9488"
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { min: 0, max: 100 } }
        }
    });

    new Chart(document.getElementById("anSubjChart"), {
        type: "bar",
        data: {
            labels: bySubject.map(r => r.sub.code),
            datasets: [
                {
                    label: "Средний балл",
                    data: bySubject.map(r => r.avg ?? 0),
                    backgroundColor: "#0d9488",
                    borderRadius: 6
                },
                {
                    label: "Качество знаний %",
                    data: bySubject.map(r => r.quality),
                    backgroundColor: "#7c3aed",
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });

    // ===== Экспорт группы =====
    document.getElementById("btn-export-group").onclick = async () => {
        const btn = document.getElementById("btn-export-group");
        btn.disabled = true;
        btn.textContent = "Формирование...";
        try {
            await exportGroupAnalysis({
                group: selectedGroup,
                summary: { avgScore, uspevaemost, kachestvo, poseshaemost, students: groupStudents.length, gradesCount: scores.length, absents },
                bySubject, byStudent
            });
            flash("Отчёт по группе выгружен", "success");
        } catch (err) {
            console.error(err);
            flash("Ошибка экспорта: " + err.message, "danger");
        } finally {
            btn.disabled = false;
            btn.textContent = "📊 Экспорт группы в Excel";
        }
    };
}

function setupAnalysisSelector() {
    const sel = document.getElementById("analysis-group");
    if (sel) sel.onchange = () => {
        location.hash = sel.value ? `analysis?group=${sel.value}` : "analysis";
    };
}

// =====================================================
// СТРАНИЦА: Студенты
// =====================================================
export function renderStudents() {
    const canEdit = currentUser.role === "admin";
    const students = db.getAll("students");
    const groups = db.getAll("groups");
    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));

    const params = hashParams();
    const filterGroupId = params.get("group");
    const search = (params.get("q") || "").toLowerCase();

    const selectedGroup = filterGroupId ? groupsById[filterGroupId] : null;
    let displayed = students;
    if (selectedGroup) displayed = students.filter(s => s.groupId === selectedGroup.id);
    if (search) displayed = displayed.filter(s => s.fullName.toLowerCase().includes(search));
    displayed.sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));

    let html = `
        <div class="page-header">
            <h1>Студенты</h1>
            <p class="muted">${selectedGroup
                ? `Группа <strong>${esc(selectedGroup.name)}</strong> · ${esc(selectedGroup.specialty)} · ${selectedGroup.course} курс · ${displayed.length} студ.`
                : `Контингент: ${students.length} студентов в ${groups.length} группах`}</p>
        </div>
    `;

    // === Поиск по ФИО ===
    html += `
        <div class="card">
            <div class="search-row">
                <input type="search" id="student-search" placeholder="🔍 Поиск по ФИО по всему колледжу..." value="${esc(params.get("q") || "")}">
                ${selectedGroup ? `<a href="#students" class="btn btn-outline">← Все группы</a>` : ""}
            </div>
        </div>
    `;

    if (!selectedGroup && !search) {
        // Сетка групп по специальностям
        const bySpecialty = {};
        db.sortGroups(groups).forEach(g => {
            const spec = g.specialty || "Без специальности";
            if (!bySpecialty[spec]) bySpecialty[spec] = [];
            bySpecialty[spec].push(g);
        });

        html += `<div class="card"><h2>Выберите группу</h2>`;
        for (const [specName, specGroups] of Object.entries(bySpecialty)) {
            const byCourse = {};
            specGroups.forEach(g => {
                if (!byCourse[g.course]) byCourse[g.course] = [];
                byCourse[g.course].push(g);
            });
            html += `<div class="specialty-section"><h3 class="specialty-title">${esc(specName)}</h3>`;
            for (const courseNum of Object.keys(byCourse).sort()) {
                html += `
                    <div class="course-row">
                        <div class="course-label">${courseNum} курс</div>
                        <div class="group-cards">
                            ${byCourse[courseNum].map(g => {
                                const count = students.filter(s => s.groupId === g.id).length;
                                return `<a href="#students?group=${g.id}" class="group-card">
                                    <div class="group-card-name">${esc(g.name)}</div>
                                    <div class="group-card-count">${count} студ.</div>
                                </a>`;
                            }).join("")}
                        </div>
                    </div>`;
            }
            html += `</div>`;
        }
        html += `</div>`;
    } else {
        // Список студентов (группы или поиска)
        if (canEdit && selectedGroup) {
            html += `
                <div class="card">
                    <h2>Добавить студента в группу ${esc(selectedGroup.name)}</h2>
                    <form id="form-add-student" class="form-grid">
                        <div class="form-group form-group-wide">
                            <label>ФИО *</label>
                            <input type="text" name="fullName" required placeholder="Иванов Иван Иванович">
                        </div>
                        <div class="form-group">
                            <button type="submit" class="btn btn-primary" style="margin-top:26px">+ Добавить</button>
                        </div>
                    </form>
                </div>`;
        }

        html += `<div class="card">`;
        if (displayed.length === 0) {
            html += `<p class="muted text-center" style="padding:30px">Студенты не найдены.</p>`;
        } else {
            html += `
                <table class="data-table">
                    <thead><tr>
                        <th>№</th><th>ФИО</th>${!selectedGroup ? "<th>Группа</th>" : ""}<th>ID (логин)</th><th>Язык</th>
                        ${canEdit ? "<th></th>" : ""}
                    </tr></thead>
                    <tbody>
                        ${displayed.slice(0, 300).map((s, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${esc(s.fullName)}</strong></td>
                                ${!selectedGroup ? `<td><a href="#students?group=${s.groupId}" class="badge badge-info">${esc(groupsById[s.groupId]?.name || "—")}</a></td>` : ""}
                                <td><code>${esc(s.id.replace(/^s/, ""))}</code></td>
                                <td>${esc(s.lang || "—")}</td>
                                ${canEdit ? `<td><button class="btn btn-sm btn-danger" data-del-student="${s.id}" data-name="${esc(s.fullName)}">Удалить</button></td>` : ""}
                            </tr>`).join("")}
                    </tbody>
                </table>
                ${displayed.length > 300 ? `<p class="muted" style="margin-top:10px">Показаны первые 300 из ${displayed.length}. Уточните поиск.</p>` : ""}
            `;
        }
        html += `</div>`;
    }

    content().innerHTML = html;

    // === Обработчики ===
    const searchInput = document.getElementById("student-search");
    if (search && document.activeElement === document.body) {
        // вернуть фокус в поиск после перерисовки
        const len = searchInput.value.length;
        searchInput.focus();
        searchInput.setSelectionRange(len, len);
    }
    let searchTimer;
    searchInput.oninput = () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            const q = searchInput.value.trim();
            const base = selectedGroup ? `students?group=${selectedGroup.id}` : "students";
            location.hash = q ? `${base}${selectedGroup ? "&" : "?"}q=${encodeURIComponent(q)}` : base;
        }, 350);
    };

    if (canEdit && selectedGroup) {
        const form = document.getElementById("form-add-student");
        if (form) form.onsubmit = (e) => {
            e.preventDefault();
            try {
                db.create("students", {
                    fullName: form.fullName.value.trim(),
                    groupId: selectedGroup.id,
                    course: selectedGroup.course,
                    lang: "рус", gender: "м"
                });
                flash("Студент добавлен", "success");
                renderStudents();
            } catch (err) { flash("Ошибка: " + err.message, "danger"); }
        };
    }

    document.querySelectorAll("[data-del-student]").forEach(btn => {
        btn.onclick = () => {
            if (!confirm(`Удалить студента "${btn.dataset.name}"?`)) return;
            db.remove("students", btn.dataset.delStudent);
            flash("Студент удалён", "success");
            renderStudents();
        };
    });
}

// =====================================================
// СТРАНИЦА: Группы
// =====================================================
export function renderGroups() {
    const canEdit = currentUser.role === "admin";
    const groups = db.getAll("groups");
    const students = db.getAll("students");
    const grades = db.getAll("grades");
    const groupsSorted = db.sortGroups(groups);

    // Средний балл по группам (для колонки)
    const studentsByGroup = {};
    students.forEach(s => {
        if (!studentsByGroup[s.groupId]) studentsByGroup[s.groupId] = new Set();
        studentsByGroup[s.groupId].add(s.id);
    });

    let html = `
        <div class="page-header">
            <h1>Учебные группы</h1>
            <p class="muted">Всего групп: ${groups.length}</p>
        </div>
    `;

    if (canEdit) {
        html += `
            <div class="card">
                <h2>Добавить группу</h2>
                <form id="form-add-group" class="form-grid">
                    <div class="form-group">
                        <label>Название *</label>
                        <input type="text" name="name" required placeholder="409 ПО" maxlength="30">
                    </div>
                    <div class="form-group form-group-wide">
                        <label>Специальность *</label>
                        <input type="text" name="specialty" required placeholder="06130100 Программное обеспечение">
                    </div>
                    <div class="form-group">
                        <label>Курс *</label>
                        <select name="course" required>
                            <option value="1">1 курс</option><option value="2">2 курс</option>
                            <option value="3">3 курс</option><option value="4">4 курс</option>
                        </select>
                    </div>
                    <div class="form-group form-group-full">
                        <button type="submit" class="btn btn-primary">+ Добавить</button>
                    </div>
                </form>
            </div>`;
    }

    html += `
        <div class="card">
            <table class="data-table">
                <thead><tr>
                    <th>№</th><th>Группа</th><th>Специальность</th><th>Курс</th><th>Студентов</th><th>Ср. балл</th><th></th>
                </tr></thead>
                <tbody>
                    ${groupsSorted.map((g, i) => {
                        const ids = studentsByGroup[g.id] || new Set();
                        const groupScores = grades
                            .filter(gr => ids.has(gr.studentId) && !gr.absent && gr.score !== null)
                            .map(gr => gr.score);
                        const avgScore = groupScores.length ? db.avg(groupScores) : null;
                        return `<tr>
                            <td>${i + 1}</td>
                            <td><strong>${esc(g.name)}</strong></td>
                            <td>${esc(g.specialty)}</td>
                            <td><span class="badge">${g.course} курс</span></td>
                            <td><a href="#students?group=${g.id}" class="badge badge-info">${ids.size} чел.</a></td>
                            <td>${avgScore !== null ? `<strong>${avgScore}</strong> <span class="grade-badge ${db.gradeClass(avgScore)}">${db.scoreToLetter(avgScore)}</span>` : "—"}</td>
                            <td style="white-space:nowrap">
                                <a href="#analysis?group=${g.id}" class="btn btn-sm btn-outline">Анализ</a>
                                ${canEdit ? `<button class="btn btn-sm btn-danger" data-del-group="${g.id}" data-name="${esc(g.name)}">×</button>` : ""}
                            </td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
        </div>`;

    content().innerHTML = html;

    if (canEdit) {
        document.getElementById("form-add-group").onsubmit = (e) => {
            e.preventDefault();
            const f = e.target;
            try {
                db.create("groups", {
                    name: f.name.value.trim(),
                    specialty: f.specialty.value.trim(),
                    course: parseInt(f.course.value)
                });
                flash("Группа добавлена", "success");
                renderGroups();
            } catch (err) { flash("Ошибка: " + err.message, "danger"); }
        };

        document.querySelectorAll("[data-del-group]").forEach(btn => {
            btn.onclick = () => {
                if (!confirm(`Удалить группу "${btn.dataset.name}"?`)) return;
                db.remove("groups", btn.dataset.delGroup);
                flash("Группа удалена", "success");
                renderGroups();
            };
        });
    }
}

// =====================================================
// СТРАНИЦА: Предметы
// =====================================================
export function renderSubjects() {
    const canEdit = currentUser.role === "admin";
    const subjects = db.getAll("subjects");
    const teachersById = Object.fromEntries(db.getAll("teachers").map(t => [t.id, t]));
    const grades = db.getAll("grades");

    let html = `
        <div class="page-header">
            <h1>Предметы и модули</h1>
            <p class="muted">Дисциплины из рабочего учебного плана · ${subjects.length} шт.</p>
        </div>
    `;

    if (canEdit) {
        html += `
            <div class="card">
                <h2>Добавить предмет</h2>
                <form id="form-add-subject" class="form-grid">
                    <div class="form-group">
                        <label>Код *</label>
                        <input type="text" name="code" required placeholder="ПМ 14" maxlength="10">
                    </div>
                    <div class="form-group form-group-wide">
                        <label>Название *</label>
                        <input type="text" name="name" required placeholder="Разработка веб-приложений">
                    </div>
                    <div class="form-group">
                        <label>Часов</label>
                        <input type="number" name="hours" min="0" placeholder="144">
                    </div>
                    <div class="form-group">
                        <label>Преподаватель</label>
                        <select name="teacherId">
                            <option value="">— не назначен —</option>
                            ${db.getAll("teachers").map(t => `<option value="${t.id}">${esc(t.fullName)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group form-group-full">
                        <button type="submit" class="btn btn-primary">+ Добавить</button>
                    </div>
                </form>
            </div>`;
    }

    html += `
        <div class="card">
            <table class="data-table">
                <thead><tr>
                    <th>Код</th><th>Название модуля / дисциплины</th><th>Часов</th><th>Преподаватель</th><th>Оценок</th>
                    ${canEdit ? "<th></th>" : ""}
                </tr></thead>
                <tbody>
                    ${subjects.map(s => {
                        const count = grades.filter(g => g.subjectId === s.id && !g.absent).length;
                        return `<tr>
                            <td><span class="badge">${esc(s.code || "—")}</span></td>
                            <td><strong>${esc(s.name)}</strong></td>
                            <td>${s.hours || "—"}</td>
                            <td>${esc(teachersById[s.teacherId]?.fullName || "—")}</td>
                            <td>${count}</td>
                            ${canEdit ? `<td><button class="btn btn-sm btn-danger" data-del-subject="${s.id}" data-name="${esc(s.name)}">Удалить</button></td>` : ""}
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>
        </div>`;

    content().innerHTML = html;

    if (canEdit) {
        document.getElementById("form-add-subject").onsubmit = (e) => {
            e.preventDefault();
            const f = e.target;
            try {
                db.create("subjects", {
                    code: f.code.value.trim(),
                    name: f.name.value.trim(),
                    hours: parseInt(f.hours.value) || 0,
                    teacherId: f.teacherId.value || null
                });
                flash("Предмет добавлен", "success");
                renderSubjects();
            } catch (err) { flash("Ошибка: " + err.message, "danger"); }
        };

        document.querySelectorAll("[data-del-subject]").forEach(btn => {
            btn.onclick = () => {
                if (!confirm(`Удалить предмет "${btn.dataset.name}"?`)) return;
                db.remove("subjects", btn.dataset.delSubject);
                flash("Предмет удалён", "success");
                renderSubjects();
            };
        });
    }
}

// =====================================================
// СТРАНИЦА: Преподаватели (админ)
// =====================================================
export function renderTeachers() {
    const teachers = db.getAll("teachers")
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
    const subjects = db.getAll("subjects");
    const groups = db.getAll("groups");
    const assignments = db.getAll("assignments");
    const subjectsById = Object.fromEntries(subjects.map(s => [s.id, s]));
    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));
    const groupsSorted = db.sortGroups(groups);

    let html = `
        <div class="page-header">
            <h1>Преподаватели</h1>
            <p class="muted">Всего: ${teachers.length} · Назначений: ${assignments.length}</p>
        </div>

        <div class="card">
            <h2>Назначить предмет и группу</h2>
            <form id="form-add-assignment" class="form-grid">
                <div class="form-group">
                    <label>Преподаватель *</label>
                    <select name="teacherId" required>
                        <option value="">— выберите —</option>
                        ${teachers.map(t => `<option value="${t.id}">${esc(t.fullName)}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label>Предмет *</label>
                    <select name="subjectId" required>
                        <option value="">— выберите —</option>
                        ${subjects.map(s => `<option value="${s.id}">${esc(subjectLabel(s))}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group">
                    <label>Группа *</label>
                    <select name="groupId" required>
                        <option value="">— выберите —</option>
                        ${groupsSorted.map(g => `<option value="${g.id}">${esc(g.name)} — ${esc(g.specialty)}</option>`).join("")}
                    </select>
                </div>
                <div class="form-group form-group-full">
                    <button type="submit" class="btn btn-primary">+ Назначить</button>
                </div>
            </form>
        </div>

        <div class="card">
            <h2>Преподаватели и их нагрузка</h2>
            ${teachers.map((t, i) => {
                const myAssignments = assignments.filter(a => a.teacherId === t.id);
                const bySubject = {};
                myAssignments.forEach(a => {
                    if (!bySubject[a.subjectId]) bySubject[a.subjectId] = [];
                    bySubject[a.subjectId].push(a);
                });
                return `
                    <div class="teacher-card">
                        <div class="teacher-card-header">
                            <div>
                                <strong>${i + 1}. ${esc(t.fullName)}</strong>
                                <span class="muted" style="margin-left:8px">${esc(t.position || "")}</span>
                                <span class="muted" style="margin-left:8px">логин: <code>${esc(t.login)}</code></span>
                            </div>
                            <span class="badge">${myAssignments.length} назнач.</span>
                        </div>
                        ${myAssignments.length === 0
                            ? '<p class="muted" style="margin:10px 0 0;font-size:13px">Назначений нет</p>'
                            : `<div class="assignments-list">
                                ${Object.entries(bySubject).map(([subId, items]) => {
                                    const sub = subjectsById[subId];
                                    return `<div class="assignment-block">
                                        <div class="assignment-subject">📚 ${esc(subjectLabel(sub))}</div>
                                        <div class="assignment-groups">
                                            ${items.map(a => {
                                                const grp = groupsById[a.groupId];
                                                return `<span class="assignment-group-tag">
                                                    ${esc(grp?.name || "—")}
                                                    <button class="assignment-remove" data-del-assignment="${a.id}" title="Удалить">×</button>
                                                </span>`;
                                            }).join("")}
                                        </div>
                                    </div>`;
                                }).join("")}
                            </div>`}
                    </div>`;
            }).join("")}
        </div>
    `;

    content().innerHTML = html;

    document.getElementById("form-add-assignment").onsubmit = (e) => {
        e.preventDefault();
        const f = e.target;
        const teacherId = f.teacherId.value, subjectId = f.subjectId.value, groupId = f.groupId.value;
        const exists = assignments.some(a =>
            a.teacherId === teacherId && a.subjectId === subjectId && a.groupId === groupId);
        if (exists) { flash("Такое назначение уже существует", "warning"); return; }
        db.create("assignments", { teacherId, subjectId, groupId });
        flash("Назначение добавлено", "success");
        renderTeachers();
    };

    document.querySelectorAll("[data-del-assignment]").forEach(btn => {
        btn.onclick = () => {
            if (!confirm("Удалить назначение?")) return;
            db.remove("assignments", btn.dataset.delAssignment);
            flash("Назначение удалено", "success");
            renderTeachers();
        };
    });
}
