// =====================================================
// КОНФИГУРАЦИЯ FIREBASE
// =====================================================
// Проект: uspevaemost-9021b
// АВПК - Учёт успеваемости студентов
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Ваша конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAe6FuUgUMmaKzr3JsAJpmn3kqHzRIZsMo",
    authDomain: "uspevaemost-9021b.firebaseapp.com",
    projectId: "uspevaemost-9021b",
    storageBucket: "uspevaemost-9021b.firebasestorage.app",
    messagingSenderId: "663586343826",
    appId: "1:663586343826:web:7d9c1169fdb4c6bf84cf4b",
    measurementId: "G-B49CGCSPJR"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
