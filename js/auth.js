// =====================================================
// Локальная авторизация (без сервера)
// Роли: admin / teacher / student
//  - admin: логин admin, пароль admin123
//  - преподаватели: логин из расписания (напр. zhamalov), пароль 12345
//  - студенты: логин = ID студента (напр. 970237), пароль 12345
// =====================================================

import * as db from "./db.js";
import {
    SEED_USERS, TEACHER_DEFAULT_PASSWORD, STUDENT_DEFAULT_PASSWORD
} from "../data/college-data.js";

const SESSION_KEY = "avpk_session";

export let currentUser = null;

// =====================================================
// Вход
// =====================================================
export function loginUser(login, password) {
    login = String(login).trim().toLowerCase();
    const changed = db.getPassword(login);

    // 1. Администратор и служебные пользователи
    const sysUser = SEED_USERS.find(u => u.login === login);
    if (sysUser) {
        const expected = changed || sysUser.password;
        if (password !== expected) throw new Error("Неверный пароль");
        return startSession({
            uid: "u-" + sysUser.login,
            login: sysUser.login,
            fullName: sysUser.fullName,
            role: sysUser.role
        });
    }

    // 2. Преподаватель
    const teacher = db.getAll("teachers").find(t => t.login === login);
    if (teacher) {
        const expected = changed || TEACHER_DEFAULT_PASSWORD;
        if (password !== expected) throw new Error("Неверный пароль");
        return startSession({
            uid: teacher.id,
            login: teacher.login,
            fullName: teacher.fullName,
            role: "teacher"
        });
    }

    // 3. Студент: логин = ID (можно с префиксом s)
    const sid = login.startsWith("s") ? login : "s" + login;
    const student = db.getById("students", sid);
    if (student) {
        const expected = db.getPassword(sid) || STUDENT_DEFAULT_PASSWORD;
        if (password !== expected) throw new Error("Неверный пароль");
        return startSession({
            uid: student.id,
            login: student.id,
            fullName: student.fullName,
            role: "student",
            studentId: student.id,
            groupId: student.groupId
        });
    }

    throw new Error("Пользователь не найден. Проверьте логин.");
}

function startSession(user) {
    currentUser = user;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return user;
}

// =====================================================
// Выход
// =====================================================
export function logoutUser() {
    currentUser = null;
    sessionStorage.removeItem(SESSION_KEY);
}

// =====================================================
// Восстановление сессии при загрузке страницы
// =====================================================
export function restoreSession() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) currentUser = JSON.parse(raw);
    } catch (e) {
        currentUser = null;
    }
    return currentUser;
}

// =====================================================
// Смена пароля текущего пользователя
// =====================================================
export function changePassword(oldPassword, newPassword) {
    if (!currentUser) throw new Error("Вы не авторизованы");
    // проверим старый пароль повторным «входом»
    loginUser(currentUser.login, oldPassword);
    db.setPassword(currentUser.login, newPassword);
}

// =====================================================
// Подписи ролей
// =====================================================
export function roleLabel(role) {
    return {
        admin: "Администратор",
        teacher: "Преподаватель",
        student: "Студент"
    }[role] || role;
}
