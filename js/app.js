// =====================================================
// Главный модуль приложения: вход, роутинг, оболочка
// =====================================================
import { loginUser, logoutUser, restoreSession, currentUser, roleLabel } from "./auth.js";
import * as pages from "./pages.js";

// =====================================================
// Инициализация
// =====================================================
function init() {
    setupLoginForm();
    setupLogout();
    setupSidebar();
    window.addEventListener("hashchange", handleRoute);

    const user = restoreSession();
    document.getElementById("loader").style.display = "none";
    if (user) {
        showApp(user);
    } else {
        showAuth();
    }
}

// =====================================================
// Переключение экранов
// =====================================================
function showAuth() {
    document.getElementById("page-auth").style.display = "block";
    document.getElementById("page-app").style.display = "none";
}

function showApp(user) {
    document.getElementById("page-auth").style.display = "none";
    document.getElementById("page-app").style.display = "flex";

    document.getElementById("user-name").textContent = user.fullName;
    const badge = document.getElementById("user-role-badge");
    badge.textContent = roleLabel(user.role);
    badge.className = `user-role role-${user.role}`;

    // Текущая дата в шапке
    const d = new Date();
    document.getElementById("topbar-date").textContent =
        d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

    // Подпись пункта «Журнал» для студента
    const journalLabel = document.getElementById("nav-journal-label");
    if (journalLabel) journalLabel.textContent = user.role === "student" ? "Мои оценки" : "Журнал";

    // Скрываем недоступные пункты меню
    document.querySelectorAll("#main-nav .nav-link[data-roles]").forEach(link => {
        const allowed = link.dataset.roles.split(",");
        link.style.display = allowed.includes(user.role) ? "" : "none";
    });

    handleRoute();
}

// =====================================================
// Форма входа
// =====================================================
function setupLoginForm() {
    document.getElementById("form-login").onsubmit = (e) => {
        e.preventDefault();
        const errEl = document.getElementById("login-error");
        errEl.style.display = "none";
        try {
            const user = loginUser(
                document.getElementById("login-login").value,
                document.getElementById("login-password").value
            );
            location.hash = "#dashboard";
            showApp(user);
        } catch (err) {
            errEl.textContent = err.message;
            errEl.style.display = "block";
        }
    };
}

function setupLogout() {
    document.getElementById("btn-logout").onclick = () => {
        logoutUser();
        location.hash = "";
        showAuth();
    };
}

// =====================================================
// Боковое меню (мобильная версия)
// =====================================================
function setupSidebar() {
    const toggle = document.getElementById("menu-toggle");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebar-overlay");

    const close = () => {
        sidebar.classList.remove("open");
        overlay.classList.remove("visible");
    };

    toggle.onclick = (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
        overlay.classList.toggle("visible");
    };
    overlay.onclick = close;
    sidebar.addEventListener("click", (e) => {
        if (e.target.closest(".nav-link")) close();
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth > 920) close();
    });
}

// =====================================================
// Роутинг (на основе hash)
// =====================================================
const routes = {
    dashboard:  { handler: pages.renderDashboard,  roles: ["admin", "teacher", "student"] },
    journal:    { handler: pages.renderJournal,    roles: ["admin", "teacher", "student"] },
    schedule:   { handler: pages.renderSchedule,   roles: ["admin", "teacher", "student"] },
    analysis:   { handler: pages.renderAnalysis,   roles: ["admin", "teacher"] },
    students:   { handler: pages.renderStudents,   roles: ["admin", "teacher"] },
    groups:     { handler: pages.renderGroups,     roles: ["admin", "teacher"] },
    subjects:   { handler: pages.renderSubjects,   roles: ["admin", "teacher", "student"] },
    teachers:   { handler: pages.renderTeachers,   roles: ["admin"] },
    transcript: { handler: pages.renderTranscript, roles: ["student"] }
};

async function handleRoute() {
    if (!currentUser) return;

    const hash = (location.hash || "#dashboard").substring(1).split("?")[0] || "dashboard";
    const route = routes[hash];

    document.querySelectorAll("#main-nav .nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.page === hash);
    });

    if (!route || !route.roles.includes(currentUser.role)) {
        document.getElementById("page-content").innerHTML = `
            <div class="card">
                <div class="alert alert-warning">У вас нет прав для доступа к этой странице.</div>
                <a href="#dashboard" class="btn btn-primary">На главную</a>
            </div>
        `;
        return;
    }

    document.getElementById("flash-container").innerHTML = "";
    document.querySelector(".main").scrollTop = 0;

    try {
        await route.handler();
    } catch (err) {
        console.error(err);
        document.getElementById("page-content").innerHTML = `
            <div class="card">
                <div class="alert alert-danger">Ошибка загрузки страницы: ${err.message}</div>
            </div>
        `;
    }
}

// =====================================================
// Запуск
// =====================================================
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
