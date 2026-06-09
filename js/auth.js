// =====================================================
// Модуль авторизации
// =====================================================
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { auth, db } from "./firebase-config.js";

// Текущий пользователь (полный профиль из Firestore)
export let currentUser = null;

/**
 * Регистрация нового пользователя.
 * Создаёт запись в Firebase Auth и профиль в Firestore.
 */
export async function registerUser(email, password, fullName, role) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const userId = cred.user.uid;

    // Сохраняем профиль пользователя в Firestore
    const userProfile = {
        uid: userId,
        email: email,
        fullName: fullName,
        role: role,
        createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, "users", userId), userProfile);

    return userProfile;
}

/**
 * Вход существующего пользователя.
 */
export async function loginUser(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

/**
 * Выход из системы.
 */
export async function logoutUser() {
    await signOut(auth);
    currentUser = null;
}

/**
 * Загрузить профиль пользователя из Firestore.
 */
export async function loadUserProfile(uid) {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
        currentUser = snap.data();
        return currentUser;
    }
    return null;
}

/**
 * Подписка на изменение состояния авторизации.
 */
export function onAuthChange(callback) {
    onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            await loadUserProfile(firebaseUser.uid);
            callback(currentUser);
        } else {
            currentUser = null;
            callback(null);
        }
    });
}

/**
 * Перевод роли в русское название.
 */
export function roleLabel(role) {
    return {
        admin: "Администратор",
        teacher: "Преподаватель",
        student: "Студент"
    }[role] || role;
}

/**
 * Перевод ошибок Firebase в читаемые сообщения.
 */
export function formatAuthError(error) {
    const code = error.code || "";
    const messages = {
        "auth/email-already-in-use": "Пользователь с таким email уже зарегистрирован",
        "auth/invalid-email":        "Некорректный формат email",
        "auth/weak-password":        "Пароль слишком слабый (минимум 6 символов)",
        "auth/user-not-found":       "Пользователь не найден",
        "auth/wrong-password":       "Неверный пароль",
        "auth/invalid-credential":   "Неверный email или пароль",
        "auth/too-many-requests":    "Слишком много попыток. Подождите несколько минут.",
        "auth/network-request-failed": "Нет соединения с сервером"
    };
    return messages[code] || error.message || "Произошла ошибка";
}
