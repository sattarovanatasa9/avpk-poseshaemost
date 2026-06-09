// =====================================================
// Рендеринг страниц приложения
// =====================================================
import * as db from "./db.js";
import { currentUser, roleLabel } from "./auth.js";
import { exportToExcel, exportToPDF } from "./export.js";
import { importFromExcel } from "./import.js";

const content = () => document.getElementById("page-content");

// Безопасное экранирование HTML
function esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Отображение сообщения
export function flash(message, type = "info") {
    const fc = document.getElementById("flash-container");
    const el = document.createElement("div");
    el.className = `alert alert-${type}`;
    el.innerHTML = `${esc(message)} <button class="alert-close">×</button>`;
    el.querySelector(".alert-close").onclick = () => el.remove();
    fc.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

// =====================================================
// СТРАНИЦА: Главная (Dashboard)
// =====================================================
export async function renderDashboard() {
    content().innerHTML = `<div class="loader-inline">Загрузка...</div>`;

    const role = currentUser.role;
    let html = `
        <div class="page-header">
            <h1>Здравствуйте, ${esc(currentUser.fullName)}!</h1>
            <p class="muted">Личный кабинет · ${roleLabel(role)}</p>
        </div>
    `;

    if (role === "admin") {
        const [students, teachers, groups, subjects, grades] = await Promise.all([
            db.getAll("students"), db.getAll("teachers"),
            db.getAll("groups"), db.getAll("subjects"), db.getAll("grades")
        ]);
        const avgScore = grades.length
            ? db.avg(grades.map(g => g.score))
            : 0;

        html += `
            <div class="stats-grid">
                <div class="stat-card stat-blue">
                    <div class="stat-label">Студенты</div>
                    <div class="stat-value">${students.length}</div>
                    <a href="#students" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-purple">
                    <div class="stat-label">Преподаватели</div>
                    <div class="stat-value">${teachers.length}</div>
                    <a href="#teachers" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-green">
                    <div class="stat-label">Группы</div>
                    <div class="stat-value">${groups.length}</div>
                    <a href="#groups" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-orange">
                    <div class="stat-label">Предметы</div>
                    <div class="stat-value">${subjects.length}</div>
                    <a href="#subjects" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-red">
                    <div class="stat-label">Всего оценок</div>
                    <div class="stat-value">${grades.length}</div>
                    <a href="#grades" class="stat-link">Перейти →</a>
                </div>
                <div class="stat-card stat-teal">
                    <div class="stat-label">Средний балл по колледжу</div>
                    <div class="stat-value">${avgScore}</div>
                    <a href="#reports" class="stat-link">Отчёты →</a>
                </div>
            </div>

            <div class="card">
                <h2>Распределение оценок по буквенной шкале</h2>
                ${grades.length === 0
                    ? '<p class="muted">Оценок пока нет. Перейдите в раздел «Оценки», чтобы добавить первые записи.</p>'
                    : '<canvas id="dashChart" height="100"></canvas>'}
            </div>
        `;

        content().innerHTML = html;
        if (grades.length) drawDashChart(grades);

    } else if (role === "teacher") {
        const grades = await db.getWhere("grades", "teacherId", currentUser.uid);
        html += `
            <div class="stats-grid">
                <div class="stat-card stat-blue">
                    <div class="stat-label">Выставлено оценок</div>
                    <div class="stat-value">${grades.length}</div>
                </div>
                <div class="stat-card stat-green">
                    <div class="stat-label">Средний балл</div>
                    <div class="stat-value">${grades.length ? db.avg(grades.map(g => g.score)) : 0}</div>
                </div>
            </div>
            <div class="card">
                <h2>Быстрые действия</h2>
                <div class="quick-actions">
                    <a href="#grades" class="quick-action">
                        <div class="qa-icon">📝</div><div class="qa-text">Выставить оценку</div>
                    </a>
                    <a href="#students" class="quick-action">
                        <div class="qa-icon">👥</div><div class="qa-text">Список студентов</div>
                    </a>
                    <a href="#reports" class="quick-action">
                        <div class="qa-icon">📊</div><div class="qa-text">Отчёты</div>
                    </a>
                </div>
            </div>
        `;
        content().innerHTML = html;

    } else {  // student
        const myGrades = await db.getWhere("grades", "studentEmail", currentUser.email);
        const avgScore = myGrades.length ? db.avg(myGrades.map(g => g.score)) : 0;
        const letter = db.scoreToLetter(avgScore);

        html += `
            <div class="stats-grid">
                <div class="stat-card stat-blue">
                    <div class="stat-label">Всего оценок</div>
                    <div class="stat-value">${myGrades.length}</div>
                </div>
                <div class="stat-card stat-green">
                    <div class="stat-label">Средний балл</div>
                    <div class="stat-value">${avgScore} <span class="grade-badge ${db.gradeClass(avgScore)}">${letter}</span></div>
                </div>
            </div>

            <div class="card">
                <h2>Информация о профиле</h2>
                <div class="profile-grid">
                    <div><strong>ФИО:</strong> ${esc(currentUser.fullName)}</div>
                    <div><strong>Email:</strong> ${esc(currentUser.email)}</div>
                </div>
                <div style="margin-top:16px">
                    <a href="#grades" class="btn btn-primary">Мои оценки</a>
                </div>
            </div>
        `;
        content().innerHTML = html;
    }
}

function drawDashChart(grades) {
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    grades.forEach(g => counts[db.scoreToLetter(g.score)]++);
    new Chart(document.getElementById("dashChart"), {
        type: "bar",
        data: {
            labels: ["A (90-100)", "B (75-89)", "C (60-74)", "D (50-59)", "F (0-49)"],
            datasets: [{
                label: "Количество",
                data: [counts.A, counts.B, counts.C, counts.D, counts.F],
                backgroundColor: ["#16a34a", "#65a30d", "#f59e0b", "#0891b2", "#dc2626"],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}

// =====================================================
// СТРАНИЦА: Группы
// =====================================================
export async function renderGroups() {
    const role = currentUser.role;
    const canEdit = role === "admin";

    const [groups, students] = await Promise.all([
        db.getAll("groups"),
        db.getAll("students")
    ]);

    // Сортировка по курсу, затем по названию
    groups.sort((a, b) => (a.course - b.course) || a.name.localeCompare(b.name));

    let html = `
        <div class="page-header">
            <h1>Учебные группы</h1>
            <p class="muted">Всего групп: ${groups.length}</p>
        </div>
    `;

    if (canEdit) {
        html += `
            <div class="card">
                <h2>Добавить новую группу</h2>
                <form id="form-add-group" class="form-grid">
                    <div class="form-group">
                        <label>Название группы *</label>
                        <input type="text" name="name" required placeholder="ПО-21" maxlength="30">
                    </div>
                    <div class="form-group form-group-wide">
                        <label>Специальность *</label>
                        <input type="text" name="specialty" required placeholder="Программное обеспечение">
                    </div>
                    <div class="form-group">
                        <label>Курс *</label>
                        <select name="course" required>
                            <option value="1">1 курс</option>
                            <option value="2">2 курс</option>
                            <option value="3">3 курс</option>
                            <option value="4">4 курс</option>
                        </select>
                    </div>
                    <div class="form-group form-group-full">
                        <button type="submit" class="btn btn-primary">+ Добавить</button>
                    </div>
                </form>
            </div>
        `;
    }

    html += `<div class="card">`;
    if (groups.length === 0) {
        html += `<p class="muted text-center" style="padding:30px">Групп пока нет. ${canEdit ? "Добавьте первую группу через форму выше." : ""}</p>`;
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>№</th><th>Название</th><th>Специальность</th><th>Курс</th><th>Студентов</th>
                        ${canEdit ? "<th>Действия</th>" : ""}
                    </tr>
                </thead>
                <tbody>
                    ${groups.map((g, i) => {
                        const count = students.filter(s => s.groupId === g.id).length;
                        return `
                            <tr>
                                <td>${i + 1}</td>
                                <td><strong>${esc(g.name)}</strong></td>
                                <td>${esc(g.specialty)}</td>
                                <td><span class="badge">${g.course} курс</span></td>
                                <td><span class="badge badge-info">${count} чел.</span></td>
                                ${canEdit ? `<td><button class="btn btn-sm btn-danger" data-del-group="${g.id}" data-name="${esc(g.name)}">Удалить</button></td>` : ""}
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;

    content().innerHTML = html;

    // Обработчики
    if (canEdit) {
        document.getElementById("form-add-group").onsubmit = async (e) => {
            e.preventDefault();
            const f = e.target;
            try {
                await db.create("groups", {
                    name: f.name.value.trim(),
                    specialty: f.specialty.value.trim(),
                    course: parseInt(f.course.value)
                });
                flash("Группа добавлена", "success");
                renderGroups();
            } catch (err) {
                flash("Ошибка: " + err.message, "danger");
            }
        };

        document.querySelectorAll("[data-del-group]").forEach(btn => {
            btn.onclick = async () => {
                if (!confirm(`Удалить группу "${btn.dataset.name}"?`)) return;
                try {
                    await db.remove("groups", btn.dataset.delGroup);
                    flash("Группа удалена", "success");
                    renderGroups();
                } catch (err) {
                    flash("Ошибка: " + err.message, "danger");
                }
            };
        });
    }
}

// =====================================================
// СТРАНИЦА: Студенты
// =====================================================
export async function renderStudents() {
    const role = currentUser.role;
    const canEdit = role === "admin";

    const [students, groups] = await Promise.all([
        db.getAll("students"),
        db.getAll("groups")
    ]);

    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));

    // Фильтр по группе через URL
    const params = new URLSearchParams(location.hash.split("?")[1] || "");
    const filterGroupId = params.get("group");

    let displayed = students;
    if (filterGroupId) displayed = students.filter(s => s.groupId === filterGroupId);
    displayed.sort((a, b) => a.fullName.localeCompare(b.fullName));

    let html = `
        <div class="page-header">
            <h1>Студенты</h1>
            <p class="muted">Показано записей: ${displayed.length} из ${students.length}</p>
        </div>

        <div class="card">
            <form id="form-filter" class="filter-form">
                <label>Фильтр по группе:</label>
                <select id="filter-group">
                    <option value="">Все группы</option>
                    ${groups.map(g => `<option value="${g.id}" ${g.id === filterGroupId ? "selected" : ""}>${esc(g.name)} — ${esc(g.specialty)}</option>`).join("")}
                </select>
                ${filterGroupId ? '<a href="#students" class="btn btn-sm btn-outline">Сбросить</a>' : ''}
            </form>
        </div>
    `;

    if (canEdit) {
        html += `
            <div class="card import-card">
                <h2>📥 Массовый импорт из Excel</h2>
                <p class="muted" style="margin-bottom:12px">
                    Загрузите файл выгрузки из системы «Контингент» (формат .xls / .xlsx) —
                    программа автоматически создаст все группы и студентов.
                    Дубли пропускаются.
                </p>

                <form id="form-import" class="import-form-extended">
                    <div class="form-group">
                        <label>Файл с данными студентов</label>
                        <input type="file" id="import-file" accept=".xls,.xlsx" required>
                    </div>

                    <div class="form-group import-checkbox">
                        <label>
                            <input type="checkbox" id="import-create-accounts" checked>
                            <span><strong>Создавать учётные записи студентов</strong> в Firebase Auth</span>
                        </label>
                        <p class="muted" style="margin:6px 0 0 26px;font-size:12px">
                            Логин = email из Excel, пароль для всех = <code>Avpk2026!</code>.
                            Firebase ограничивает ~50 регистраций/час — запускайте импорт
                            повторно, программа пропустит уже созданных.
                        </p>
                    </div>

                    <div class="form-group" id="admin-password-group">
                        <label>Ваш пароль (нужен для возврата после создания учёток)</label>
                        <input type="password" id="admin-password" placeholder="••••••••">
                        <p class="muted" style="margin:4px 0 0;font-size:12px">
                            Firebase автоматически переключается на каждого нового пользователя.
                            После импорта программа войдёт обратно под админом.
                        </p>
                    </div>

                    <button type="submit" class="btn btn-primary">Запустить импорт</button>
                </form>
                <div id="import-log" class="import-log" style="display:none"></div>
            </div>
        `;

        html += `
            <div class="card">
                <h2>Добавить нового студента</h2>
                ${groups.length === 0
                    ? '<p class="alert alert-warning">Сначала нужно создать хотя бы одну группу в разделе «Группы».</p>'
                    : `
                <form id="form-add-student" class="form-grid">
                    <div class="form-group form-group-wide">
                        <label>ФИО *</label>
                        <input type="text" name="fullName" required placeholder="Иванов Иван Иванович">
                    </div>
                    <div class="form-group">
                        <label>Группа *</label>
                        <select name="groupId" required>
                            <option value="">— выберите —</option>
                            ${groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Email (для оценок)</label>
                        <input type="email" name="email" placeholder="student@avpk.kz">
                    </div>
                    <div class="form-group">
                        <label>Телефон</label>
                        <input type="tel" name="phone" placeholder="+77001234567">
                    </div>
                    <div class="form-group">
                        <label>Дата рождения</label>
                        <input type="date" name="birthDate">
                    </div>
                    <div class="form-group form-group-full">
                        <button type="submit" class="btn btn-primary">+ Добавить студента</button>
                    </div>
                </form>
                `}
            </div>
        `;
    }

    html += `<div class="card">`;
    if (displayed.length === 0) {
        html += `<p class="muted text-center" style="padding:30px">Студентов не найдено.</p>`;
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>№</th><th>ФИО</th><th>Группа</th><th>Email</th><th>Телефон</th>
                        ${canEdit ? "<th>Действия</th>" : ""}
                    </tr>
                </thead>
                <tbody>
                    ${displayed.map((s, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><strong>${esc(s.fullName)}</strong></td>
                            <td><span class="badge">${esc(groupsById[s.groupId]?.name || "—")}</span></td>
                            <td>${esc(s.email || "—")}</td>
                            <td>${esc(s.phone || "—")}</td>
                            ${canEdit ? `<td><button class="btn btn-sm btn-danger" data-del-student="${s.id}" data-name="${esc(s.fullName)}">Удалить</button></td>` : ""}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;

    content().innerHTML = html;

    // Фильтр по группе
    document.getElementById("filter-group").onchange = (e) => {
        const v = e.target.value;
        location.hash = v ? `students?group=${v}` : "students";
    };

    if (canEdit) {
        document.getElementById("form-add-student").onsubmit = async (e) => {
            e.preventDefault();
            const f = e.target;
            try {
                await db.create("students", {
                    fullName: f.fullName.value.trim(),
                    groupId: f.groupId.value,
                    email: f.email.value.trim(),
                    phone: f.phone.value.trim(),
                    birthDate: f.birthDate.value || null
                });
                flash("Студент добавлен", "success");
                renderStudents();
            } catch (err) {
                flash("Ошибка: " + err.message, "danger");
            }
        };

        document.querySelectorAll("[data-del-student]").forEach(btn => {
            btn.onclick = async () => {
                if (!confirm(`Удалить студента "${btn.dataset.name}"?`)) return;
                try {
                    await db.remove("students", btn.dataset.delStudent);
                    flash("Студент удалён", "success");
                    renderStudents();
                } catch (err) {
                    flash("Ошибка: " + err.message, "danger");
                }
            };
        });

        // === Обработчик импорта из Excel ===
        const formImport = document.getElementById("form-import");
        console.log("Импорт подключен");
        if (formImport) {
            // Показ/скрытие поля пароля админа
            const checkboxAccounts = document.getElementById("import-create-accounts");
            const adminPwdGroup = document.getElementById("admin-password-group");
            checkboxAccounts.onchange = () => {
                adminPwdGroup.style.display = checkboxAccounts.checked ? "" : "none";
            };

            formImport.onsubmit = async (e) => {
                console.log("Кнопка нажата");
                e.preventDefault();
                const fileInput = document.getElementById("import-file");
                const file = fileInput.files[0];
                console.log(file);
                const createAccounts = checkboxAccounts.checked;
                const adminPassword = document.getElementById("admin-password").value;

                if (!file) {
                    flash("Выберите файл", "warning");
                    return;
                }

                if (createAccounts && !adminPassword) {
                    flash("Введите ваш пароль администратора", "warning");
                    return;
                }

                const logEl = document.getElementById("import-log");
                logEl.style.display = "block";
                logEl.innerHTML = "";

                const appendLog = (msg, type = "info") => {
                    const line = document.createElement("div");
                    line.className = "import-log-line import-log-" + type;
                    line.textContent = msg;
                    logEl.appendChild(line);
                    logEl.scrollTop = logEl.scrollHeight;
                };

                const submitBtn = formImport.querySelector("button[type=submit]");
                submitBtn.disabled = true;
                submitBtn.textContent = "Импорт идёт...";

                try {
                    const confirmMsg = createAccounts
                        ? `Будут импортированы студенты из файла "${file.name}" с созданием учётных записей.\n` +
                          `Это может занять до часа. Продолжить?`
                        : `Будут импортированы студенты из файла "${file.name}" (без учёток).\n` +
                          `Продолжить?`;

                    if (!confirm(confirmMsg)) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = "Запустить импорт";
                        return;
                    }

                    const result = await importFromExcel(file, {
                        createAccounts: createAccounts,
                        adminEmail: currentUser.email,
                        adminPassword: adminPassword
                    }, appendLog);

                    let summary = `Создано: ${result.groupsCreated} групп, ${result.studentsCreated} студентов`;
                    if (createAccounts) {
                        summary += `, ${result.accountsCreated} учёток`;
                    }
                    flash(summary, "success");

                    if (!result.rateLimitHit) {
                        setTimeout(() => renderStudents(), 3000);
                    }
                } catch (err) {
                    console.error(err);
                    appendLog("❌ Ошибка: " + err.message, "danger");
                    flash("Ошибка импорта: " + err.message, "danger");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Запустить импорт";
                }
            };
        }
    }
}

// =====================================================
// СТРАНИЦА: Предметы
// =====================================================
export async function renderSubjects() {
    const role = currentUser.role;
    const canEdit = role === "admin";

    const subjects = await db.getAll("subjects");
    subjects.sort((a, b) => a.name.localeCompare(b.name));

    let html = `
        <div class="page-header">
            <h1>Учебные предметы</h1>
            <p class="muted">Всего дисциплин: ${subjects.length}</p>
        </div>
    `;

    if (canEdit) {
        html += `
            <div class="card">
                <h2>Добавить новый предмет</h2>
                <form id="form-add-subject" class="form-grid">
                    <div class="form-group form-group-wide">
                        <label>Название *</label>
                        <input type="text" name="name" required placeholder="Программирование на Python">
                    </div>
                    <div class="form-group">
                        <label>Количество часов</label>
                        <input type="number" name="hours" min="0" placeholder="144">
                    </div>
                    <div class="form-group form-group-full">
                        <label>Описание</label>
                        <textarea name="description" rows="2" placeholder="Краткое описание дисциплины"></textarea>
                    </div>
                    <div class="form-group form-group-full">
                        <button type="submit" class="btn btn-primary">+ Добавить</button>
                    </div>
                </form>
            </div>
        `;
    }

    html += `<div class="card">`;
    if (subjects.length === 0) {
        html += `<p class="muted text-center" style="padding:30px">Предметов пока нет.${canEdit ? " Добавьте первый предмет." : ""}</p>`;
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>№</th><th>Название</th><th>Часов</th><th>Описание</th>
                        ${canEdit ? "<th>Действия</th>" : ""}
                    </tr>
                </thead>
                <tbody>
                    ${subjects.map((s, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><strong>${esc(s.name)}</strong></td>
                            <td>${s.hours || 0}</td>
                            <td>${esc(s.description || "—")}</td>
                            ${canEdit ? `<td><button class="btn btn-sm btn-danger" data-del-subject="${s.id}" data-name="${esc(s.name)}">Удалить</button></td>` : ""}
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;

    content().innerHTML = html;

    if (canEdit) {
        document.getElementById("form-add-subject").onsubmit = async (e) => {
            e.preventDefault();
            const f = e.target;
            try {
                await db.create("subjects", {
                    name: f.name.value.trim(),
                    hours: parseInt(f.hours.value) || 0,
                    description: f.description.value.trim()
                });
                flash("Предмет добавлен", "success");
                renderSubjects();
            } catch (err) {
                flash("Ошибка: " + err.message, "danger");
            }
        };

        document.querySelectorAll("[data-del-subject]").forEach(btn => {
            btn.onclick = async () => {
                if (!confirm(`Удалить предмет "${btn.dataset.name}"?`)) return;
                try {
                    await db.remove("subjects", btn.dataset.delSubject);
                    flash("Предмет удалён", "success");
                    renderSubjects();
                } catch (err) {
                    flash("Ошибка: " + err.message, "danger");
                }
            };
        });
    }
}

// =====================================================
// СТРАНИЦА: Оценки
// =====================================================
export async function renderGrades() {
    const role = currentUser.role;
    const canEdit = role === "admin" || role === "teacher";

    const [grades, students, subjects, groups, users] = await Promise.all([
        db.getAll("grades"),
        db.getAll("students"),
        db.getAll("subjects"),
        db.getAll("groups"),
        db.getAll("users")
    ]);

    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));
    const studentsById = Object.fromEntries(students.map(s => [s.id, s]));
    const subjectsById = Object.fromEntries(subjects.map(s => [s.id, s]));
    const usersByUid = Object.fromEntries(users.map(u => [u.uid, u]));

    // Фильтрация для студента: только его оценки
    let displayed = grades;
    if (role === "student") {
        displayed = grades.filter(g => g.studentEmail === currentUser.email);
    }
    // Сортировка: сначала новые
    displayed.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    let html = `
        <div class="page-header">
            <h1>Оценки</h1>
            <p class="muted">${role === "student" ? "Мои оценки" : `Всего записей: ${displayed.length}`}</p>
        </div>

        <div class="card">
            <h2 style="margin-bottom:10px">Шкала оценок (100-балльная система)</h2>
            <div class="scale-grid">
                <div class="scale-item"><span class="grade-badge grade-A">A</span> 90–100 — Отлично</div>
                <div class="scale-item"><span class="grade-badge grade-B">B</span> 75–89 — Хорошо</div>
                <div class="scale-item"><span class="grade-badge grade-C">C</span> 60–74 — Удовлетворительно</div>
                <div class="scale-item"><span class="grade-badge grade-D">D</span> 50–59 — Зачёт</div>
                <div class="scale-item"><span class="grade-badge grade-F">F</span> 0–49 — Неудовлетворительно</div>
            </div>
        </div>
    `;

    if (canEdit) {
        if (students.length === 0 || subjects.length === 0) {
            html += `
                <div class="card">
                    <div class="alert alert-warning">
                        Чтобы выставлять оценки, нужно добавить минимум одного студента и один предмет.
                        ${students.length === 0 ? '<br>→ <a href="#students">Добавить студентов</a>' : ""}
                        ${subjects.length === 0 ? '<br>→ <a href="#subjects">Добавить предметы</a>' : ""}
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="card">
                    <h2>Выставить оценку</h2>
                    <form id="form-add-grade" class="form-grid">
                        <div class="form-group form-group-wide">
                            <label>Студент *</label>
                            <select name="studentId" required>
                                <option value="">— выберите студента —</option>
                                ${students.sort((a,b) => a.fullName.localeCompare(b.fullName)).map(s =>
                                    `<option value="${s.id}">${esc(s.fullName)} (${esc(groupsById[s.groupId]?.name || "—")})</option>`
                                ).join("")}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Предмет *</label>
                            <select name="subjectId" required>
                                <option value="">— выберите —</option>
                                ${subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Балл (10–100) *</label>
                            <input type="number" name="score" required min="10" max="100" placeholder="85">
                        </div>
                        <div class="form-group">
                            <label>Дата</label>
                            <input type="date" name="date" value="${new Date().toISOString().slice(0,10)}">
                        </div>
                        <div class="form-group">
                            <label>Тип</label>
                            <select name="type">
                                <option value="current">Текущая</option>
                                <option value="midterm">Рубежный контроль</option>
                                <option value="exam">Экзамен</option>
                            </select>
                        </div>
                        <div class="form-group form-group-full">
                            <label>Комментарий</label>
                            <input type="text" name="comment" placeholder="Необязательно">
                        </div>
                        <div class="form-group form-group-full">
                            <button type="submit" class="btn btn-primary">+ Выставить оценку</button>
                        </div>
                    </form>
                </div>
            `;
        }
    }

    html += `<div class="card"><h2>${role === "student" ? "История моих оценок" : "Список оценок"}</h2>`;
    if (displayed.length === 0) {
        html += `<p class="muted text-center" style="padding:30px">Оценок пока нет.</p>`;
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Дата</th>
                        ${role !== "student" ? "<th>Студент</th><th>Группа</th>" : ""}
                        <th>Предмет</th><th>Тип</th><th>Балл</th><th>Оценка</th>
                        <th>Преподаватель</th><th>Комментарий</th>
                        ${canEdit ? "<th></th>" : ""}
                    </tr>
                </thead>
                <tbody>
                    ${displayed.map(g => {
                        const stud = studentsById[g.studentId];
                        const subj = subjectsById[g.subjectId];
                        const teacher = usersByUid[g.teacherId];
                        const typeLabel = { current: "текущая", midterm: "рубежный", exam: "экзамен" }[g.type] || g.type;
                        return `
                            <tr>
                                <td>${esc(g.date)}</td>
                                ${role !== "student" ? `
                                    <td>${esc(stud?.fullName || "—")}</td>
                                    <td><span class="badge">${esc(groupsById[stud?.groupId]?.name || "—")}</span></td>
                                ` : ""}
                                <td>${esc(subj?.name || "—")}</td>
                                <td>${typeLabel}</td>
                                <td><strong>${g.score}</strong></td>
                                <td><span class="grade-badge ${db.gradeClass(g.score)}">${db.scoreToLetter(g.score)}</span></td>
                                <td>${esc(teacher?.fullName || "—")}</td>
                                <td>${esc(g.comment || "")}</td>
                                ${canEdit ? `<td><button class="btn btn-sm btn-danger" data-del-grade="${g.id}">×</button></td>` : ""}
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;

    content().innerHTML = html;

    if (canEdit && students.length > 0 && subjects.length > 0) {
        document.getElementById("form-add-grade").onsubmit = async (e) => {
            e.preventDefault();
            const f = e.target;
            const score = parseInt(f.score.value);
            if (score < 10 || score > 100) {
                flash("Балл должен быть в диапазоне 10–100", "danger");
                return;
            }
            const stud = studentsById[f.studentId.value];
            try {
                await db.create("grades", {
                    studentId: f.studentId.value,
                    studentEmail: stud?.email || "",
                    subjectId: f.subjectId.value,
                    teacherId: currentUser.uid,
                    score: score,
                    date: f.date.value || new Date().toISOString().slice(0,10),
                    type: f.type.value,
                    comment: f.comment.value.trim()
                });
                flash("Оценка выставлена", "success");
                renderGrades();
            } catch (err) {
                flash("Ошибка: " + err.message, "danger");
            }
        };

        document.querySelectorAll("[data-del-grade]").forEach(btn => {
            btn.onclick = async () => {
                if (!confirm("Удалить оценку?")) return;
                try {
                    await db.remove("grades", btn.dataset.delGrade);
                    flash("Оценка удалена", "success");
                    renderGrades();
                } catch (err) {
                    flash("Ошибка: " + err.message, "danger");
                }
            };
        });
    }
}

// =====================================================
// СТРАНИЦА: Отчёты
// =====================================================
export async function renderReports() {
    const [grades, students, subjects, groups] = await Promise.all([
        db.getAll("grades"),
        db.getAll("students"),
        db.getAll("subjects"),
        db.getAll("groups")
    ]);

    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));
    const studentsById = Object.fromEntries(students.map(s => [s.id, s]));
    const subjectsById = Object.fromEntries(subjects.map(s => [s.id, s]));

    if (grades.length === 0) {
        content().innerHTML = `
            <div class="page-header">
                <h1>Отчёты и статистика</h1>
            </div>
            <div class="card">
                <p class="alert alert-info">
                    Оценок пока нет. Отчёты появятся после выставления первых оценок в разделе «Оценки».
                </p>
            </div>
        `;
        return;
    }

    // Средний балл по группам
    const byGroup = groups.map(g => {
        const groupStudents = students.filter(s => s.groupId === g.id);
        const studentIds = new Set(groupStudents.map(s => s.id));
        const groupGrades = grades.filter(gr => studentIds.has(gr.studentId));
        return {
            ...g,
            studentsCount: groupStudents.length,
            gradesCount: groupGrades.length,
            avgScore: groupGrades.length ? db.avg(groupGrades.map(g => g.score)) : 0
        };
    }).sort((a, b) => b.avgScore - a.avgScore);

    // Средний балл по предметам
    const bySubject = subjects.map(s => {
        const subjectGrades = grades.filter(g => g.subjectId === s.id);
        return {
            ...s,
            gradesCount: subjectGrades.length,
            avgScore: subjectGrades.length ? db.avg(subjectGrades.map(g => g.score)) : 0
        };
    }).sort((a, b) => b.avgScore - a.avgScore);

    // Топ-10 студентов
    const topStudents = students.map(s => {
        const studGrades = grades.filter(g => g.studentId === s.id);
        return {
            ...s,
            gradesCount: studGrades.length,
            avgScore: studGrades.length ? db.avg(studGrades.map(g => g.score)) : 0,
            group: groupsById[s.groupId]
        };
    }).filter(s => s.gradesCount > 0)
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);

    let html = `
        <div class="page-header page-header-flex">
            <div>
                <h1>Отчёты и статистика</h1>
                <p class="muted">Аналитика успеваемости студентов</p>
            </div>
            <div class="export-buttons">
                <button id="btn-export-excel" class="btn btn-export btn-excel">
                    <span class="export-icon">📊</span> Экспорт в Excel
                </button>
                <button id="btn-export-pdf" class="btn btn-export btn-pdf">
                    <span class="export-icon">📄</span> Экспорт в PDF
                </button>
            </div>
        </div>

        <div class="card export-info">
            <p class="muted" style="margin:0">
                💡 <strong>Экспорт отчётов:</strong> Excel — для редактирования и работы с данными,
                PDF — готовый документ для печати и подписи.
                Отчёт включает сводку по группам, предметам и рейтинг студентов.
            </p>
        </div>

        <div class="grid-2">
            <div class="card">
                <h2>Распределение оценок</h2>
                <canvas id="distChart" height="200"></canvas>
            </div>
            <div class="card">
                <h2>Средний балл по группам</h2>
                ${byGroup.length === 0 ? '<p class="muted">Нет данных</p>' : '<canvas id="groupChart" height="200"></canvas>'}
            </div>
        </div>

        <div class="card">
            <h2>Успеваемость по группам</h2>
            ${byGroup.length === 0 ? '<p class="muted">Нет данных</p>' : `
            <table class="data-table">
                <thead>
                    <tr><th>Группа</th><th>Специальность</th><th>Студентов</th><th>Оценок</th><th>Средний балл</th></tr>
                </thead>
                <tbody>
                    ${byGroup.map(g => `
                        <tr>
                            <td><strong>${esc(g.name)}</strong></td>
                            <td>${esc(g.specialty)}</td>
                            <td>${g.studentsCount}</td>
                            <td>${g.gradesCount}</td>
                            <td><strong>${g.avgScore}</strong> <span class="grade-badge ${db.gradeClass(g.avgScore)}">${db.scoreToLetter(g.avgScore)}</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            `}
        </div>

        <div class="card">
            <h2>Успеваемость по предметам</h2>
            ${bySubject.length === 0 ? '<p class="muted">Нет данных</p>' : `
            <table class="data-table">
                <thead><tr><th>Предмет</th><th>Оценок</th><th>Средний балл</th></tr></thead>
                <tbody>
                    ${bySubject.map(s => `
                        <tr>
                            <td><strong>${esc(s.name)}</strong></td>
                            <td>${s.gradesCount}</td>
                            <td>${s.gradesCount > 0
                                ? `<strong>${s.avgScore}</strong> <span class="grade-badge ${db.gradeClass(s.avgScore)}">${db.scoreToLetter(s.avgScore)}</span>`
                                : "—"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            `}
        </div>

        <div class="card">
            <h2>🏆 Рейтинг студентов (топ-10)</h2>
            ${topStudents.length === 0 ? '<p class="muted">Нет данных</p>' : `
            <table class="data-table">
                <thead><tr><th>Место</th><th>ФИО</th><th>Группа</th><th>Оценок</th><th>Средний балл</th></tr></thead>
                <tbody>
                    ${topStudents.map((s, i) => `
                        <tr>
                            <td>${i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</td>
                            <td><strong>${esc(s.fullName)}</strong></td>
                            <td><span class="badge">${esc(s.group?.name || "—")}</span></td>
                            <td>${s.gradesCount}</td>
                            <td><strong>${s.avgScore}</strong> <span class="grade-badge ${db.gradeClass(s.avgScore)}">${db.scoreToLetter(s.avgScore)}</span></td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            `}
        </div>
    `;

    content().innerHTML = html;

    // Графики
    const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    grades.forEach(g => counts[db.scoreToLetter(g.score)]++);
    new Chart(document.getElementById("distChart"), {
        type: "doughnut",
        data: {
            labels: ["A (90-100)", "B (75-89)", "C (60-74)", "D (50-59)", "F (0-49)"],
            datasets: [{
                data: [counts.A, counts.B, counts.C, counts.D, counts.F],
                backgroundColor: ["#16a34a", "#65a30d", "#f59e0b", "#0891b2", "#dc2626"],
                borderWidth: 2, borderColor: "#fff"
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } }
        }
    });

    if (byGroup.length > 0) {
        new Chart(document.getElementById("groupChart"), {
            type: "bar",
            data: {
                labels: byGroup.map(g => g.name),
                datasets: [{
                    label: "Средний балл",
                    data: byGroup.map(g => g.avgScore),
                    backgroundColor: "#0d9488", borderRadius: 6
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, max: 100 } }
            }
        });
    }

    // Обработчики кнопок экспорта
    const btnExcel = document.getElementById("btn-export-excel");
    const btnPdf = document.getElementById("btn-export-pdf");

    if (btnExcel) {
        btnExcel.onclick = async () => {
            const originalText = btnExcel.innerHTML;
            btnExcel.disabled = true;
            btnExcel.innerHTML = '<span class="export-icon">⏳</span> Формирование...';
            try {
                await exportToExcel();
                flash("Excel-отчёт успешно загружен", "success");
            } catch (err) {
                console.error(err);
                flash("Ошибка экспорта: " + err.message, "danger");
            } finally {
                btnExcel.disabled = false;
                btnExcel.innerHTML = originalText;
            }
        };
    }

    if (btnPdf) {
        btnPdf.onclick = async () => {
            const originalText = btnPdf.innerHTML;
            btnPdf.disabled = true;
            btnPdf.innerHTML = '<span class="export-icon">⏳</span> Формирование...';
            try {
                await exportToPDF();
                flash("PDF-отчёт успешно загружен", "success");
            } catch (err) {
                console.error(err);
                flash("Ошибка экспорта: " + err.message, "danger");
            } finally {
                btnPdf.disabled = false;
                btnPdf.innerHTML = originalText;
            }
        };
    }
}

// =====================================================
// СТРАНИЦА: Преподаватели (для админа)
// =====================================================
export async function renderTeachers() {
    const users = await db.getAll("users");
    const teachers = users.filter(u => u.role === "teacher");
    teachers.sort((a, b) => a.fullName.localeCompare(b.fullName));

    let html = `
        <div class="page-header">
            <h1>Преподаватели</h1>
            <p class="muted">Всего: ${teachers.length}</p>
        </div>

        <div class="card">
            <p class="muted">
                ℹ️ Преподаватели регистрируются самостоятельно через форму регистрации
                на главной странице, выбрав роль «Преподаватель». Здесь отображается список
                всех зарегистрированных преподавателей.
            </p>
        </div>

        <div class="card">
    `;

    if (teachers.length === 0) {
        html += `<p class="muted text-center" style="padding:30px">Преподаватели ещё не зарегистрированы.</p>`;
    } else {
        html += `
            <table class="data-table">
                <thead><tr><th>№</th><th>ФИО</th><th>Email</th><th>Дата регистрации</th></tr></thead>
                <tbody>
                    ${teachers.map((t, i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td><strong>${esc(t.fullName)}</strong></td>
                            <td>${esc(t.email)}</td>
                            <td>${t.createdAt ? new Date(t.createdAt).toLocaleDateString("ru-RU") : "—"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }
    html += `</div>`;

    content().innerHTML = html;
}
