// =====================================================
// Главный модуль приложения
// =====================================================
import {
    registerUser, loginUser, logoutUser,
    onAuthChange, currentUser, roleLabel, formatAuthError
} from "./auth.js";

import * as pages from "./pages.js";

// =====================================================
// Инициализация
// =====================================================
function init() {
    setupAuthForms();
    setupAuthTabs();
    setupLogout();
    setupRouting();
    setupMobileMenu();

    // Реагируем на изменение состояния авторизации
    onAuthChange((user) => {
        const loader = document.getElementById("loader");
        if (loader) loader.style.display = "none";

        if (user) {
            showApp(user);
        } else {
            showAuth();
        }
    });
}

// =====================================================
// Мобильное меню-бургер
// =====================================================
function setupMobileMenu() {
    const toggle = document.getElementById("menu-toggle");
    const nav = document.getElementById("main-nav");
    if (!toggle || !nav) return;

    // Открытие/закрытие по клику на бургер
    toggle.onclick = (e) => {
        e.stopPropagation();
        nav.classList.toggle("open");
    };

    // Закрыть меню при клике на пункт навигации
    nav.addEventListener("click", (e) => {
        if (e.target.classList.contains("nav-link")) {
            nav.classList.remove("open");
        }
    });

    // Закрыть меню при клике вне его
    document.addEventListener("click", (e) => {
        if (!nav.contains(e.target) && !toggle.contains(e.target)) {
            nav.classList.remove("open");
        }
    });

    // Закрыть меню при смене ориентации/размера
    window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
            nav.classList.remove("open");
        }
    });
}

// =====================================================
// Управление видимостью страниц
// =====================================================
function showAuth() {
    document.getElementById("page-auth").style.display = "block";
    document.getElementById("page-app").style.display = "none";
}

function showApp(user) {
    document.getElementById("page-auth").style.display = "none";
    document.getElementById("page-app").style.display = "block";

    // Обновляем верхнюю панель
    document.getElementById("user-name").textContent = user.fullName;
    const badge = document.getElementById("user-role-badge");
    badge.textContent = roleLabel(user.role);
    badge.className = `user-role role-${user.role}`;

    // Скрываем разделы, недоступные для роли
    document.querySelectorAll("#main-nav .nav-link[data-roles]").forEach(link => {
        const allowedRoles = link.dataset.roles.split(",");
        link.style.display = allowedRoles.includes(user.role) ? "" : "none";
    });

    // Запускаем роутинг
    handleRoute();
}

// =====================================================
// Формы входа и регистрации
// =====================================================
function setupAuthTabs() {
    document.querySelectorAll(".auth-tab").forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const isLogin = tab.dataset.tab === "login";
            document.getElementById("form-login").style.display = isLogin ? "" : "none";
            document.getElementById("form-register").style.display = isLogin ? "none" : "";
            document.getElementById("login-error").style.display = "none";
            document.getElementById("register-error").style.display = "none";
        };
    });
}

function setupAuthForms() {
    // Вход
    document.getElementById("form-login").onsubmit = async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("login-error");
        errEl.style.display = "none";
        try {
            await loginUser(
                document.getElementById("login-email").value.trim(),
                document.getElementById("login-password").value
            );
            // onAuthChange сам обработает переход
        } catch (err) {
            errEl.textContent = formatAuthError(err);
            errEl.style.display = "block";
        }
    };

    // Регистрация
    document.getElementById("form-register").onsubmit = async (e) => {
        e.preventDefault();
        const errEl = document.getElementById("register-error");
        errEl.style.display = "none";
        try {
            await registerUser(
                document.getElementById("reg-email").value.trim(),
                document.getElementById("reg-password").value,
                document.getElementById("reg-name").value.trim(),
                document.getElementById("reg-role").value
            );
            // onAuthChange сам обработает переход
        } catch (err) {
            errEl.textContent = formatAuthError(err);
            errEl.style.display = "block";
        }
    };
}

// =====================================================
// Выход из системы
// =====================================================
function setupLogout() {
    document.getElementById("btn-logout").onclick = async () => {
        await logoutUser();
        location.hash = "";
    };
}

// =====================================================
// Роутинг (на основе hash)
// =====================================================
function setupRouting() {
    window.addEventListener("hashchange", handleRoute);
}

const routes = {
    dashboard: { handler: pages.renderDashboard, roles: ["admin", "teacher", "student"] },
    students:  { handler: pages.renderStudents,  roles: ["admin", "teacher"] },
    groups:    { handler: pages.renderGroups,    roles: ["admin", "teacher"] },
    subjects:  { handler: pages.renderSubjects,  roles: ["admin", "teacher", "student"] },
    teachers:  { handler: pages.renderTeachers,  roles: ["admin"] },
    grades:    { handler: pages.renderGrades,    roles: ["admin", "teacher", "student"] },
    reports:   { handler: pages.renderReports,   roles: ["admin", "teacher"] }
};

async function handleRoute() {
    if (!currentUser) return;

    const hash = (location.hash || "#dashboard").substring(1).split("?")[0] || "dashboard";
    const route = routes[hash];

    // Подсветить активный пункт меню
    document.querySelectorAll("#main-nav .nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.page === hash);
    });

    // Проверка доступа
    if (!route || !route.roles.includes(currentUser.role)) {
        document.getElementById("page-content").innerHTML = `
            <div class="card">
                <div class="alert alert-warning">У вас нет прав для доступа к этой странице.</div>
                <a href="#dashboard" class="btn btn-primary">На главную</a>
            </div>
        `;
        return;
    }

    // Очищаем flash-сообщения и контент
    document.getElementById("flash-container").innerHTML = "";

    try {
        await route.handler();
    } catch (err) {
        console.error(err);
        document.getElementById("page-content").innerHTML = `
            <div class="card">
                <div class="alert alert-danger">
                    Ошибка загрузки страницы: ${err.message}
                </div>
            </div>
        `;
    }
}

// =====================================================
// Запуск приложения
// =====================================================
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
