// =====================================================
// Модуль массового импорта студентов из Excel
// =====================================================
// Поддерживает формат экспорта системы "Контингент" АВПК.
// При импорте создаются:
//   1) Группа (если ещё нет)
//   2) Запись студента в Firestore
//   3) Учётная запись в Firebase Auth с дефолтным паролем
// =====================================================

import * as db from "./db.js";


// =====================================================
// Парсинг
// =====================================================
function parseCourse(courseStr) {
    if (!courseStr) return 1;
    const match = String(courseStr).match(/(\d+)/);
    return match ? parseInt(match[1]) : 1;
}

function parseSpecialty(str) {
    if (!str) return "";
    const s = String(str).trim();
    return s.replace(/^[A-Za-z0-9]+\s+/, "").trim() || s;
}

function normalizeEmail(email) {
    if (!email) return null;
    return String(email).trim().toLowerCase();
}

function formatFullName(last, first, middle) {
    return [last, first, middle]
        .map(s => (s || "").toString().trim())
        .filter(Boolean)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .join(" ");
}

// =====================================================
// Чтение Excel
// =====================================================
async function readExcelFile(file) {
    if (typeof XLSX === "undefined") {
        await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: "array", cellDates: true });
                const sheetName = wb.SheetNames[0];
                const ws = wb.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsArrayBuffer(file);
    });
}

function extractStudents(rows) {
    const students = [];
    const groupsMap = new Map();

    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length < 50) continue;

        const lastName = (r[3] || "").toString().trim();
        const firstName = (r[4] || "").toString().trim();
        const middleName = (r[5] || "").toString().trim();
        if (!lastName && !firstName) continue;

        const fullName = formatFullName(lastName, firstName, middleName);
        const groupCode = r[41] ? String(r[41]).trim() : "";
        if (!groupCode) continue;

        const courseNum = parseCourse(r[38]);
        const specialty = parseSpecialty(r[48]);

        if (!groupsMap.has(groupCode)) {
            groupsMap.set(groupCode, {
                name: groupCode,
                specialty: specialty || "—",
                course: courseNum
            });
        }

        const phone = r[32] ? String(r[32]).trim() : "";
        const email = normalizeEmail(r[33]);

        let birthDate = null;
        if (r[6]) {
            try {
                const d = r[6] instanceof Date ? r[6] : new Date(r[6]);
                if (!isNaN(d.getTime())) {
                    birthDate = d.toISOString().slice(0, 10);
                }
            } catch (e) { /* skip */ }
        }

        students.push({
            fullName,
            groupName: groupCode,
            email: email,
            phone: phone ? (phone.startsWith("+") ? phone : "+" + phone) : null,
            birthDate
        });
    }

    return {
        students,
        groups: Array.from(groupsMap.values())
    };
}

// =====================================================
// ОСНОВНАЯ ФУНКЦИЯ ИМПОРТА
// =====================================================
// Параметры:
//   file        — File из <input type="file">
//   options     — { createAccounts: bool, adminEmail, adminPassword }
//   onProgress  — callback(message, type)
// =====================================================
export async function importFromExcel(file, options, onProgress) {

    const log = (msg, type = "info") =>
        onProgress && onProgress(msg, type);

    log("📂 Чтение файла...");
    const rows = await readExcelFile(file);

    log(`Прочитано строк: ${rows.length}`);

    log("🔍 Анализ данных...");
    const { students, groups } = extractStudents(rows);

    log(`Найдено студентов: ${students.length}, групп: ${groups.length}`);

    if (students.length === 0) {
        throw new Error("В файле не найдено ни одного студента.");
    }

    // ===== СОЗДАНИЕ ГРУПП =====

    log("📋 Создание групп...");

    const existingGroups = await db.getAll("groups");

    const existingByName = new Map(
        existingGroups.map(g => [g.name, g])
    );

    const createdGroups = new Map();

    existingGroups.forEach(g => {
        createdGroups.set(g.name, g);
    });

    let groupsCreated = 0;

    for (const grp of groups) {

        if (existingByName.has(grp.name))
            continue;

        const id = await db.create(
            "groups",
            grp
        );

        createdGroups.set(grp.name, {
            id,
            ...grp
        });

        groupsCreated++;

        if (groupsCreated % 10 === 0) {
            log(`Создано групп: ${groupsCreated}`);
        }
    }

    log(`✅ Создано групп: ${groupsCreated}`);

    // ===== ПРОВЕРКА ДУБЛЕЙ =====

    log("🔍 Проверка существующих студентов...");

    const existingStudents =
        await db.getAll("students");

    const existingStudentKey = new Set(
        existingStudents.map(
            s => `${s.fullName}__${s.groupId}`
        )
    );

    // ===== ДОБАВЛЕНИЕ СТУДЕНТОВ =====

    let studentsCreated = 0;
    let studentsSkipped = 0;

    log("👥 Импорт студентов...");

    for (let i = 0; i < students.length; i++) {

        const stud = students[i];

        const grp = createdGroups.get(
            stud.groupName
        );

        if (!grp) {
            studentsSkipped++;
            continue;
        }

        const key =
            `${stud.fullName}__${grp.id}`;

        if (existingStudentKey.has(key)) {
            studentsSkipped++;
            continue;
        }

        try {

            await db.create("students", {

                fullName: stud.fullName,

                groupId: grp.id,

                email: stud.email,

                phone: stud.phone,

                birthDate: stud.birthDate

            });

            existingStudentKey.add(key);

            studentsCreated++;

        }
        catch (err) {

            console.error(
                "Ошибка:",
                stud.fullName,
                err
            );

            studentsSkipped++;
        }

        if ((i + 1) % 50 === 0) {

            log(
                `Обработано ${i + 1} из ${students.length}`
            );

        }

    }

    log("");

    log("✅ Импорт завершён", "success");

    log(
        `Групп создано: ${groupsCreated}`,
        "success"
    );

    log(
        `Студентов добавлено: ${studentsCreated}`,
        "success"
    );

    log(
        `Пропущено: ${studentsSkipped}`,
        "success"
    );

    return {

        groupsCreated,

        studentsCreated,

        studentsSkipped

    };

}
// =====================================================
// Вспомогательное
// =====================================================
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Не удалось загрузить " + src));
        document.head.appendChild(s);
    });
}
