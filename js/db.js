// =====================================================
// Модуль работы с Firestore
// =====================================================
import {
    collection, doc, addDoc, getDocs, getDoc,
    updateDoc, deleteDoc, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase-config.js";

// =====================================================
// Универсальные функции
// =====================================================

/**
 * Получить все документы коллекции.
 */
export async function getAll(collectionName) {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Получить документ по ID.
 */
export async function getById(collectionName, id) {
    const snap = await getDoc(doc(db, collectionName, id));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Добавить новую запись.
 */
export async function create(collectionName, data) {
    const ref = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date().toISOString()
    });
    return ref.id;
}

/**
 * Обновить существующую запись.
 */
export async function update(collectionName, id, data) {
    await updateDoc(doc(db, collectionName, id), data);
}

/**
 * Удалить запись.
 */
export async function remove(collectionName, id) {
    await deleteDoc(doc(db, collectionName, id));
}

/**
 * Получить документы по условию (поле = значение).
 */
export async function getWhere(collectionName, field, value) {
    const q = query(collection(db, collectionName), where(field, "==", value));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// =====================================================
// СИСТЕМА ОЦЕНОК (100-балльная)
// =====================================================

/**
 * Преобразование числового балла в буквенную оценку.
 * Шкала колледжей Казахстана.
 */
export function scoreToLetter(score) {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 50) return "D";
    return "F";
}

/**
 * Описание буквенной оценки.
 */
export function letterDescription(letter) {
    return {
        "A": "Отлично",
        "B": "Хорошо",
        "C": "Удовлетворительно",
        "D": "Зачёт",
        "F": "Неудовлетворительно"
    }[letter] || "";
}

/**
 * Класс CSS для бейджа с оценкой.
 */
export function gradeClass(score) {
    return "grade-" + scoreToLetter(score);
}

/**
 * Округление среднего балла до 1 знака.
 */
export function avg(numbers) {
    if (!numbers.length) return 0;
    const sum = numbers.reduce((a, b) => a + b, 0);
    return Math.round((sum / numbers.length) * 10) / 10;
}
