// =====================================================
// Данные колледжа: преподаватели, предметы, расписание
// Источник: расписание занятий группы 408 ПО
// (специальность 06130100 «Программное обеспечение»),
// 2024-2025 и 2025-2026 учебные годы, АВПК
// =====================================================

// ===== Преподаватели (из расписания) =====
export const SEED_TEACHERS = [
    { id: "t-zhamalov",    fullName: "Жамалов Т.",      login: "zhamalov",    position: "Преподаватель специальных дисциплин" },
    { id: "t-marat",       fullName: "Марат Г.М.",      login: "marat",       position: "Преподаватель специальных дисциплин" },
    { id: "t-saiynov",     fullName: "Сайынов Е.Е.",    login: "saiynov",     position: "Преподаватель специальных дисциплин" },
    { id: "t-rakhmetova",  fullName: "Рахметова С.Т.",  login: "rakhmetova",  position: "Преподаватель физической культуры" },
    { id: "t-nurdulinova", fullName: "Нурдулинова А.А.",login: "nurdulinova", position: "Преподаватель социальных дисциплин" },
    { id: "t-albergenova", fullName: "Албергенова А.Р.",login: "albergenova", position: "Классный руководитель 408 ПО" }
];

// ===== Предметы / модули (из расписания 408 ПО) =====
export const SEED_SUBJECTS = [
    {
        id: "sub-bm01",
        code: "БМ 01",
        name: "Развитие и совершенствование физических качеств",
        hours: 80,
        teacherId: "t-rakhmetova"
    },
    {
        id: "sub-bm04",
        code: "БМ 04",
        name: "Применение основ социальных наук для социализации и адаптации в обществе и в трудовом коллективе",
        hours: 72,
        teacherId: "t-nurdulinova"
    },
    {
        id: "sub-pm11",
        code: "ПМ 11",
        name: "Планирование и управление ресурсами облака и обслуживание облачной инфраструктуры",
        hours: 144,
        teacherId: "t-marat"
    },
    {
        id: "sub-pm12",
        code: "ПМ 12",
        name: "Техническая поддержка и сопровождение автоматизированной информационной системы",
        hours: 216,
        teacherId: "t-zhamalov"
    },
    {
        id: "sub-pm13",
        code: "ПМ 13",
        name: "Обеспечение информационной безопасности организации",
        hours: 108,
        teacherId: "t-saiynov"
    }
];

// ===== Звонки (пары) =====
export const LESSON_TIMES = {
    1: "08:00–09:30",
    2: "09:45–11:15",
    3: "11:25–12:55",
    4: "13:35–15:05",
    5: "15:15–16:45",
    6: "17:00–18:30"
};

// ===== Расписание группы 408 ПО, 2025-2026 уч. год, 2 семестр =====
// day: 1 = понедельник ... 5 = пятница
export const SEED_SCHEDULE = [
    // Понедельник
    { day: 1, lesson: 4, subjectId: "sub-pm12", room: "301" },
    { day: 1, lesson: 5, subjectId: "sub-pm11", room: "208" },
    { day: 1, lesson: 6, subjectId: "sub-pm12", room: "301" },
    // Вторник
    { day: 2, lesson: 3, subjectId: "sub-pm12", room: "301" },
    { day: 2, lesson: 4, subjectId: "sub-bm01", room: "с/з №2" },
    { day: 2, lesson: 5, subjectId: "sub-bm04", room: "401" },
    { day: 2, lesson: 6, subjectId: "sub-pm12", room: "301" },
    // Среда
    { day: 3, lesson: 3, subjectId: "sub-pm11", room: "208" },
    { day: 3, lesson: 4, subjectId: "sub-pm12", room: "301" },
    { day: 3, lesson: 5, subjectId: "sub-pm12", room: "301" },
    { day: 3, lesson: 6, subjectId: "sub-pm13", room: "402" },
    // Четверг
    { day: 4, lesson: 3, subjectId: "sub-pm13", room: "402" },
    { day: 4, lesson: 4, subjectId: "sub-pm12", room: "306" },
    { day: 4, lesson: 5, subjectId: "sub-pm12", room: "301" },
    { day: 4, lesson: 6, subjectId: "sub-pm11", room: "208" },
    // Пятница
    { day: 5, lesson: 3, subjectId: "sub-pm11", room: "208" },
    { day: 5, lesson: 4, subjectId: "sub-pm13", room: "402" },
    { day: 5, lesson: 5, subjectId: "sub-pm12", room: "301" },
    { day: 5, lesson: 6, subjectId: "sub-bm01", room: "с/з №2" }
];

// Классный час (пятница, 12:55–13:35)
export const CLASS_HOUR = {
    day: 5,
    time: "12:55–13:35",
    teacherId: "t-albergenova",
    room: "208",
    name: "Классный час"
};

// Группа, для которой составлено расписание
export const SCHEDULE_GROUP = "408 ПО";

// Специальность «Программное обеспечение» — для неё
// автоматически создаются назначения преподавателей
export const PO_SPECIALTY_PREFIX = "06130100";

// ===== Учётные записи =====
export const SEED_USERS = [
    { login: "admin", password: "admin123", role: "admin", fullName: "Администратор АВПК" }
    // Преподаватели входят со своим логином (см. SEED_TEACHERS), пароль по умолчанию 12345
    // Студенты входят по своему ID (колонка «ID» в списке студентов), пароль по умолчанию 12345
];

export const TEACHER_DEFAULT_PASSWORD = "12345";
export const STUDENT_DEFAULT_PASSWORD = "12345";
