// =====================================================
// Локальная база данных (localStorage)
// Все данные хранятся в браузере, без сервера.
// При первом запуске база заполняется:
//   - студентами из «Контингента» (2331 чел., 103 группы)
//   - преподавателями и предметами из расписания 408 ПО
//   - демонстрационными оценками за 2 семестр 2025-2026
// =====================================================

import { SEED_GROUPS, SEED_STUDENTS } from "../data/students-data.js";
import {
    SEED_TEACHERS, SEED_SUBJECTS, SEED_SCHEDULE,
    SCHEDULE_GROUP, PO_SPECIALTY_PREFIX
} from "../data/college-data.js";

const DB_KEY = "avpk_db_v1";
const DB_VERSION = 1;

let cache = null;

// =====================================================
// Загрузка / сохранение
// =====================================================
function load() {
    if (cache) return cache;
    try {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.version === DB_VERSION) {
                cache = parsed;
                return cache;
            }
        }
    } catch (e) {
        console.warn("База повреждена, пересоздаём", e);
    }
    cache = seed();
    persist();
    return cache;
}

function persist() {
    localStorage.setItem(DB_KEY, JSON.stringify(cache));
}

// Полный сброс к исходным данным
export function resetDatabase() {
    localStorage.removeItem(DB_KEY);
    cache = null;
    load();
}

// =====================================================
// Первичное заполнение
// =====================================================
function seed() {
    const groups = SEED_GROUPS.map(g => ({
        id: "g-" + g.name.replace(/\s+/g, "_"),
        name: g.name,
        course: g.course,
        specialty: g.specialty,
        qualification: g.qual
    }));
    const groupByName = Object.fromEntries(groups.map(g => [g.name, g]));

    const students = SEED_STUDENTS.map(s => ({
        id: s.id,
        fullName: s.fullName,
        groupId: groupByName[s.group] ? groupByName[s.group].id : null,
        course: s.course,
        lang: s.lang,
        gender: s.gender
    })).filter(s => s.groupId);

    const teachers = SEED_TEACHERS.map(t => ({ ...t }));
    const subjects = SEED_SUBJECTS.map(s => ({ ...s }));

    // Назначения: предметы расписания закрепляются за всеми группами
    // специальности «Программное обеспечение» (06130100)
    const assignments = [];
    const poGroups = groups.filter(g => (g.specialty || "").startsWith(PO_SPECIALTY_PREFIX));
    poGroups.forEach(g => {
        subjects.forEach(sub => {
            assignments.push({
                id: `a-${g.id}-${sub.id}`,
                teacherId: sub.teacherId,
                subjectId: sub.id,
                groupId: g.id
            });
        });
    });

    // Демонстрационные оценки для группы из расписания (408 ПО)
    const grades = seedDemoGrades(groupByName[SCHEDULE_GROUP], students, subjects);

    return {
        version: DB_VERSION,
        groups, students, teachers, subjects, assignments, grades,
        users: [],          // дополнительные пользователи (регистрируются админом)
        passwords: {},      // изменённые пароли: { login: password }
        counters: { grade: grades.length + 1 }
    };
}

// Детерминированный генератор псевдослучайных чисел
function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Оценки 2 семестра 2025-2026 (январь–июнь 2026) по дням расписания
function seedDemoGrades(group, students, subjects) {
    if (!group) return [];
    const rnd = mulberry32(20260408);
    const groupStudents = students.filter(s => s.groupId === group.id);
    const grades = [];
    let n = 1;

    // Уникальные дни недели для каждого предмета из расписания
    const subjectDays = {};
    SEED_SCHEDULE.forEach(l => {
        if (!subjectDays[l.subjectId]) subjectDays[l.subjectId] = new Set();
        subjectDays[l.subjectId].add(l.day);
    });

    // «Сила» студента — базовый уровень 55..95
    const strength = {};
    groupStudents.forEach(s => { strength[s.id] = 55 + Math.floor(rnd() * 41); });

    const semStart = new Date(2026, 0, 12);  // 12 января 2026
    const semEnd = new Date(2026, 5, 5);     // 5 июня 2026

    subjects.forEach(sub => {
        const days = subjectDays[sub.id] ? [...subjectDays[sub.id]] : [1];
        // Берём один учебный день в неделю на предмет, чтобы журнал был обозримым
        const lessonDay = days[0];
        for (let d = new Date(semStart); d <= semEnd; d.setDate(d.getDate() + 1)) {
            if (d.getDay() !== lessonDay) continue;
            // примерно каждое 2-е занятие — с оценками
            if (rnd() < 0.45) continue;
            const dateStr = d.toISOString().slice(0, 10);
            groupStudents.forEach(st => {
                const r = rnd();
                if (r < 0.18) return;          // нет оценки в этот день
                if (r < 0.24) {
                    // пропуск занятия
                    grades.push({
                        id: "gr-seed-" + n++,
                        studentId: st.id, subjectId: sub.id, groupId: group.id,
                        teacherId: sub.teacherId, date: dateStr,
                        score: null, absent: true, type: "current", comment: ""
                    });
                    return;
                }
                let score = strength[st.id] + Math.floor(rnd() * 21) - 10;
                score = Math.max(30, Math.min(100, score));
                grades.push({
                    id: "gr-seed-" + n++,
                    studentId: st.id, subjectId: sub.id, groupId: group.id,
                    teacherId: sub.teacherId, date: dateStr,
                    score, absent: false, type: "current", comment: ""
                });
            });
        }
    });

    return grades;
}

// =====================================================
// CRUD API
// =====================================================
export function getAll(collectionName) {
    return [...load()[collectionName] || []];
}

export function getById(collectionName, id) {
    return (load()[collectionName] || []).find(x => x.id === id) || null;
}

export function getWhere(collectionName, field, value) {
    return (load()[collectionName] || []).filter(x => x[field] === value);
}

export function create(collectionName, data) {
    const db = load();
    if (!db[collectionName]) db[collectionName] = [];
    const id = data.id || (collectionName.slice(0, 2) + "-" + Date.now() + "-" + Math.floor(Math.random() * 10000));
    const record = { ...data, id, createdAt: new Date().toISOString() };
    db[collectionName].push(record);
    persist();
    return id;
}

export function update(collectionName, id, data) {
    const db = load();
    const idx = (db[collectionName] || []).findIndex(x => x.id === id);
    if (idx === -1) throw new Error("Запись не найдена");
    db[collectionName][idx] = { ...db[collectionName][idx], ...data };
    persist();
}

export function remove(collectionName, id) {
    const db = load();
    db[collectionName] = (db[collectionName] || []).filter(x => x.id !== id);
    persist();
}

// Пароли (изменённые)
export function getPassword(login) {
    return load().passwords[login] || null;
}
export function setPassword(login, password) {
    load().passwords[login] = password;
    persist();
}

// =====================================================
// СИСТЕМА ОЦЕНОК (100-балльная, шкала колледжей РК)
// =====================================================
export function scoreToLetter(score) {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
}

export function letterDescription(letter) {
    return {
        "A": "Отлично",
        "B": "Хорошо",
        "C": "Удовлетворительно",
        "D": "Зачёт",
        "F": "Неудовлетворительно"
    }[letter] || "";
}

export function gradeClass(score) {
    return "grade-" + scoreToLetter(score);
}

export function avg(numbers) {
    if (!numbers.length) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return Math.round((sum / numbers.length) * 10) / 10;
}

// Успеваемость: доля оценок >= 50
export function passRate(scores) {
    if (!scores.length) return 0;
    return Math.round((scores.filter(s => s >= 50).length / scores.length) * 100);
}

// Качество знаний: доля оценок >= 75
export function qualityRate(scores) {
    if (!scores.length) return 0;
    return Math.round((scores.filter(s => s >= 75).length / scores.length) * 100);
}

// Сортировка групп: специальность → курс → название
export function sortGroups(groups) {
    return [...groups].sort((a, b) => {
        const specCmp = (a.specialty || "").localeCompare(b.specialty || "", "ru");
        if (specCmp !== 0) return specCmp;
        if (a.course !== b.course) return a.course - b.course;
        return (a.name || "").localeCompare(b.name || "", "ru", { numeric: true });
    });
}
