// =====================================================
// Модуль массового импорта студентов из Excel
// =====================================================
import * as db from "./db.js";
import { auth } from "./firebase-config.js";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db as firestore } from "./firebase-config.js";

export const DEFAULT_STUDENT_PASSWORD = "Avpk2026!";

// =====================================================
// Парсинг данных
// =====================================================
function parseCourse(s) {
    if (!s) return 1;
    const m = String(s).match(/(\d+)/);
    return m ? parseInt(m[1]) : 1;
}

function parseSpecialty(s) {
    if (!s) return "";
    return String(s).trim().replace(/^[A-Za-z0-9]+\s+/, "").trim() || String(s).trim();
}

function normalizeEmail(e) {
    if (!e) return null;
    return String(e).trim().toLowerCase();
}

function formatName(last, first, middle) {
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
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
                resolve(rows);
            } catch (err) { reject(err); }
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

        const last = (r[3] || "").toString().trim();
        const first = (r[4] || "").toString().trim();
        const middle = (r[5] || "").toString().trim();
        if (!last && !first) continue;

        const fullName = formatName(last, first, middle);
        const groupCode = r[41] ? String(r[41]).trim() : "";
        if (!groupCode) continue;

        const course = parseCourse(r[38]);
        const specialty = parseSpecialty(r[48]);

        if (!groupsMap.has(groupCode)) {
            groupsMap.set(groupCode, { name: groupCode, specialty: specialty || "—", course });
        }

        const phone = r[32] ? String(r[32]).trim() : "";
        const email = normalizeEmail(r[33]);

        let birthDate = null;
        if (r[6]) {
            try {
                const d = r[6] instanceof Date ? r[6] : new Date(r[6]);
                if (!isNaN(d.getTime())) birthDate = d.toISOString().slice(0, 10);
            } catch (e) {}
        }

        students.push({
            fullName,
            groupName: groupCode,
            email,
            phone: phone ? (phone.startsWith("+") ? phone : "+" + phone) : null,
            birthDate
        });
    }

    return { students, groups: Array.from(groupsMap.values()) };
}

// =====================================================
// ОСНОВНАЯ ФУНКЦИЯ
// =====================================================
export async function importFromExcel(file, options, onProgress) {
    const log = (msg, type = "info") => onProgress && onProgress(msg, type);
    const createAccounts = options && options.createAccounts === true;

    log("📂 Чтение файла...");
    const rows = await readExcelFile(file);
    log(`Прочитано строк: ${rows.length}`);

    log("🔍 Анализ данных...");
    const { students, groups } = extractStudents(rows);
    log(`Найдено студентов: ${students.length}, групп: ${groups.length}`);

    if (students.length === 0) {
        throw new Error("В файле не найдено ни одного студента.");
    }

    // === Шаг 1: Создание групп ===
    log("📋 Создание групп в базе данных...");
    const existingGroups = await db.getAll("groups");
    const existingByName = new Map(existingGroups.map(g => [g.name, g]));
    const createdGroups = new Map(existingByName);

    let groupsCreated = 0;
    for (const grp of groups) {
        if (existingByName.has(grp.name)) continue;
        const id = await db.create("groups", grp);
        createdGroups.set(grp.name, { id, ...grp });
        groupsCreated++;
        if (groupsCreated % 10 === 0) log(`  Создано групп: ${groupsCreated}`);
    }
    log(`✅ Групп создано: ${groupsCreated}, уже было: ${groups.length - groupsCreated}`);

    // === Шаг 2: Импорт студентов ===
    log("🔍 Проверка дублей студентов...");
    const existingStudents = await db.getAll("students");
    const existingKey = new Set(existingStudents.map(s => `${s.fullName}__${s.groupId}`));

    let existingEmails = new Set();
    if (createAccounts) {
        const existingUsers = await db.getAll("users");
        existingEmails = new Set(existingUsers.map(u => normalizeEmail(u.email)).filter(Boolean));
    }

    log("👥 Импорт студентов...");
    if (createAccounts) {
        log(`🔑 Пароль для всех студентов: ${DEFAULT_STUDENT_PASSWORD}`);
    }

    let studentsCreated = 0;
    let studentsSkipped = 0;
    let accountsCreated = 0;
    let accountsFailed = 0;
    let rateLimitHit = false;

    for (let idx = 0; idx < students.length; idx++) {
        if (rateLimitHit) break;

        const stud = students[idx];
        const grp = createdGroups.get(stud.groupName);
        if (!grp) { studentsSkipped++; continue; }

        const key = `${stud.fullName}__${grp.id}`;
        if (!existingKey.has(key)) {
            try {
                await db.create("students", {
                    fullName: stud.fullName,
                    groupId: grp.id,
                    email: stud.email,
                    phone: stud.phone,
                    birthDate: stud.birthDate
                });
                existingKey.add(key);
                studentsCreated++;
            } catch (err) {
                console.error("Студент:", stud.fullName, err);
                studentsSkipped++;
                continue;
            }
        }

        if (createAccounts && stud.email && !existingEmails.has(stud.email)) {
            try {
                const cred = await createUserWithEmailAndPassword(auth, stud.email, DEFAULT_STUDENT_PASSWORD);
                await setDoc(doc(firestore, "users", cred.user.uid), {
                    uid: cred.user.uid,
                    email: stud.email,
                    fullName: stud.fullName,
                    role: "student",
                    createdAt: new Date().toISOString()
                });
                existingEmails.add(stud.email);
                accountsCreated++;
            } catch (err) {
                if (err.code === "auth/email-already-in-use") {
                    existingEmails.add(stud.email);
                } else if (err.code === "auth/too-many-requests" || err.code === "auth/quota-exceeded") {
                    log(`⚠️ Достигнут лимит Firebase. Создано учёток: ${accountsCreated}.`, "warning");
                    rateLimitHit = true;
                    break;
                } else {
                    accountsFailed++;
                }
            }
        }

        if ((idx + 1) % 25 === 0) {
            log(`  Обработано: ${idx + 1} из ${students.length} | студентов +${studentsCreated} | учёток +${accountsCreated}`);
        }
    }

    log("");
    log(`✅ ИТОГО:`, "success");
    log(`   Группы: создано ${groupsCreated}`, "success");
    log(`   Студенты в БД: добавлено ${studentsCreated}, пропущено ${studentsSkipped}`, "success");
    if (createAccounts) {
        log(`   Учётные записи: создано ${accountsCreated}, ошибок ${accountsFailed}`, "success");
    }

    // Возврат админа после массовой регистрации
    if (createAccounts && accountsCreated > 0 && options.adminEmail && options.adminPassword) {
        log("🔄 Возврат в учётную запись администратора...");
        try {
            await signInWithEmailAndPassword(auth, options.adminEmail, options.adminPassword);
            log("✅ Готово!", "success");
        } catch (err) {
            log("⚠️ Не удалось вернуться в учётку админа. Войдите вручную.", "warning");
            await signOut(auth);
        }
    }

    return { groupsCreated, studentsCreated, studentsSkipped, accountsCreated, accountsFailed, rateLimitHit };
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Не удалось загрузить " + src));
        document.head.appendChild(s);
    });
}
