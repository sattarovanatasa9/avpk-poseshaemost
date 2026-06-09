// =====================================================
// Модуль экспорта отчётов в Excel и PDF
// =====================================================
//
// Использует библиотеки, подключаемые через CDN:
// - SheetJS (xlsx) — формирование .xlsx файлов
// - jsPDF + autotable — формирование PDF
//
// Стиль вдохновлён педсоветом АВПК: сводная таблица с итоговой
// строкой, заголовок с указанием периода, фиолетовая палитра.
// =====================================================

import * as db from "./db.js";

// Палитра в стиле педсовета АВПК
const COLORS = {
    headerBg: "6B3FA0",   // фиолетовый (заголовки таблиц)
    headerText: "FFFFFF",
    totalBg: "C6EFCE",    // зелёный (итоговая строка)
    titleBg: "BDD7EE",    // голубой (главный заголовок)
    text: "1F2937"
};

// =====================================================
// СВОДНАЯ ТАБЛИЦА ПО ГРУППАМ
// =====================================================
// Колонки соответствуют образцу педсовета:
// № | Группа | Специальность | Курс | Студентов (начало/конец) |
// Үлгерімі % | Қатысымы % | Білім сапасы % | Средний балл
// =====================================================
function buildGroupsReportRows(groups, students, grades) {
    const rows = [];

    // Заголовок таблицы
    rows.push([
        "№", "Группа", "Специальность", "Курс",
        "Студентов\n(начало)", "Студентов\n(сейчас)",
        "Успеваемость %", "Качество %", "Средний балл",
        "Кол-во\nоценок"
    ]);

    let totalStart = 0, totalEnd = 0, totalGrades = 0;
    const allScores = [];

    groups.forEach((g, i) => {
        const groupStudents = students.filter(s => s.groupId === g.id);
        const studentIds = new Set(groupStudents.map(s => s.id));
        const groupGrades = grades.filter(gr => studentIds.has(gr.studentId));

        // Успеваемость = доля оценок ≥ 50 баллов (т.е. сдали)
        const passed = groupGrades.filter(gr => gr.score >= 50).length;
        const uspevaemost = groupGrades.length
            ? Math.round((passed / groupGrades.length) * 100)
            : 0;

        // Качество знаний = доля оценок ≥ 75 баллов (B и выше)
        const quality = groupGrades.filter(gr => gr.score >= 75).length;
        const kachestvo = groupGrades.length
            ? Math.round((quality / groupGrades.length) * 100)
            : 0;

        const avgScore = groupGrades.length
            ? db.avg(groupGrades.map(gr => gr.score))
            : 0;

        // У нас нет данных "начало/конец" — берём текущее количество
        const studCount = groupStudents.length;

        rows.push([
            i + 1,
            g.name,
            g.specialty,
            g.course + " курс",
            studCount,
            studCount,
            uspevaemost + "%",
            kachestvo + "%",
            avgScore,
            groupGrades.length
        ]);

        totalStart += studCount;
        totalEnd += studCount;
        totalGrades += groupGrades.length;
        allScores.push(...groupGrades.map(gr => gr.score));
    });

    // Итоговая строка
    const totalPassed = allScores.filter(s => s >= 50).length;
    const totalQuality = allScores.filter(s => s >= 75).length;
    rows.push([
        "",
        "ИТОГО АВПК",
        "",
        "",
        totalStart,
        totalEnd,
        allScores.length ? Math.round((totalPassed / allScores.length) * 100) + "%" : "0%",
        allScores.length ? Math.round((totalQuality / allScores.length) * 100) + "%" : "0%",
        allScores.length ? db.avg(allScores) : 0,
        totalGrades
    ]);

    return rows;
}

// =====================================================
// ТАБЛИЦА ПО ПРЕДМЕТАМ
// =====================================================
function buildSubjectsReportRows(subjects, grades) {
    const rows = [];
    rows.push([
        "№", "Предмет", "Часов",
        "Успеваемость %", "Качество %", "Средний балл", "Оценок"
    ]);

    let totalGrades = 0;
    const allScores = [];

    subjects.forEach((s, i) => {
        const subjectGrades = grades.filter(g => g.subjectId === s.id);
        const passed = subjectGrades.filter(g => g.score >= 50).length;
        const quality = subjectGrades.filter(g => g.score >= 75).length;

        rows.push([
            i + 1,
            s.name,
            s.hours || 0,
            subjectGrades.length ? Math.round((passed / subjectGrades.length) * 100) + "%" : "—",
            subjectGrades.length ? Math.round((quality / subjectGrades.length) * 100) + "%" : "—",
            subjectGrades.length ? db.avg(subjectGrades.map(g => g.score)) : "—",
            subjectGrades.length
        ]);

        totalGrades += subjectGrades.length;
        allScores.push(...subjectGrades.map(g => g.score));
    });

    rows.push([
        "",
        "ИТОГО",
        "",
        allScores.length ? Math.round((allScores.filter(s => s >= 50).length / allScores.length) * 100) + "%" : "0%",
        allScores.length ? Math.round((allScores.filter(s => s >= 75).length / allScores.length) * 100) + "%" : "0%",
        allScores.length ? db.avg(allScores) : 0,
        totalGrades
    ]);

    return rows;
}

// =====================================================
// ДЕТАЛЬНАЯ ТАБЛИЦА ПО СТУДЕНТАМ ГРУППЫ
// =====================================================
function buildStudentsReportRows(students, groups, grades) {
    const rows = [];
    rows.push([
        "№", "ФИО", "Группа", "Специальность", "Курс",
        "Кол-во оценок", "Средний балл", "Буква"
    ]);

    const groupsById = Object.fromEntries(groups.map(g => [g.id, g]));

    students.sort((a, b) => a.fullName.localeCompare(b.fullName))
            .forEach((s, i) => {
        const studGrades = grades.filter(g => g.studentId === s.id);
        const avgScore = studGrades.length
            ? db.avg(studGrades.map(g => g.score))
            : 0;
        const grp = groupsById[s.groupId];

        rows.push([
            i + 1,
            s.fullName,
            grp?.name || "—",
            grp?.specialty || "—",
            grp ? grp.course + " курс" : "—",
            studGrades.length,
            studGrades.length ? avgScore : "—",
            studGrades.length ? db.scoreToLetter(avgScore) : "—"
        ]);
    });

    return rows;
}

// =====================================================
// ЭКСПОРТ В EXCEL (XLSX)
// =====================================================
export async function exportToExcel() {
    // Динамически загружаем SheetJS из CDN
    if (typeof XLSX === "undefined") {
        await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
    }

    const [groups, students, subjects, grades] = await Promise.all([
        db.getAll("groups"),
        db.getAll("students"),
        db.getAll("subjects"),
        db.getAll("grades")
    ]);

    const wb = XLSX.utils.book_new();
    const period = getCurrentPeriod();

    // === Лист 1: Сводка по группам ===
    const groupRows = [
        ["Актюбинский высший политехнический колледж"],
        ["Итоги " + period],
        [""],
        ["Отчёт по успеваемости — Сводка по группам"],
        [""],
        ...buildGroupsReportRows(groups, students, grades)
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(groupRows);

    // Ширина колонок
    ws1["!cols"] = [
        { wch: 5 }, { wch: 12 }, { wch: 28 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }
    ];
    // Объединить ячейки заголовков
    ws1["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } }
    ];
    styleSheet(ws1, groupRows.length, 10);
    XLSX.utils.book_append_sheet(wb, ws1, "Сводка по группам");

    // === Лист 2: По предметам ===
    const subjRows = [
        ["Актюбинский высший политехнический колледж"],
        ["Итоги " + period],
        [""],
        ["Отчёт по успеваемости — По предметам"],
        [""],
        ...buildSubjectsReportRows(subjects, grades)
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(subjRows);
    ws2["!cols"] = [
        { wch: 5 }, { wch: 32 }, { wch: 10 },
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 12 }
    ];
    ws2["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } }
    ];
    styleSheet(ws2, subjRows.length, 7);
    XLSX.utils.book_append_sheet(wb, ws2, "По предметам");

    // === Лист 3: По студентам ===
    const studRows = [
        ["Актюбинский высший политехнический колледж"],
        ["Итоги " + period],
        [""],
        ["Отчёт по успеваемости — По студентам"],
        [""],
        ...buildStudentsReportRows(students, groups, grades)
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(studRows);
    ws3["!cols"] = [
        { wch: 5 }, { wch: 32 }, { wch: 12 }, { wch: 28 },
        { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 8 }
    ];
    ws3["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } }
    ];
    styleSheet(ws3, studRows.length, 8);
    XLSX.utils.book_append_sheet(wb, ws3, "По студентам");

    // Скачиваем
    const filename = `Отчёт_АВПК_${formatDateForFile()}.xlsx`;
    XLSX.writeFile(wb, filename);
}

// Применение стилей к листу (заголовок, шапка таблицы, итоговая строка)
function styleSheet(ws, totalRows, totalCols) {
    if (!ws["!ref"]) return;
    // SheetJS Community Edition не поддерживает запись стилей в XLSX,
    // но мы оставляем структуру корректной. Профессиональное оформление
    // открывается в Excel и применяется ручным форматированием при
    // необходимости. Цветовая разметка делается в PDF-версии.
}

// =====================================================
// ЭКСПОРТ В PDF
// =====================================================
export async function exportToPDF() {
    // Загружаем jsPDF и плагин autoTable
    if (typeof window.jspdf === "undefined") {
        await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js");
    }

    const [groups, students, subjects, grades] = await Promise.all([
        db.getAll("groups"),
        db.getAll("students"),
        db.getAll("subjects"),
        db.getAll("grades")
    ]);

    const { jsPDF } = window.jspdf;
    // Создаём документ A4, альбомная ориентация (как в педсовете)
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Подключаем шрифт с поддержкой кириллицы
    await ensureCyrillicFont(doc);

    const period = getCurrentPeriod();
    const margin = 14;
    let yOffset = margin;

    // ===== Титульная страница =====
    drawTitlePage(doc, period);

    // ===== Страница 1: Сводка по группам =====
    doc.addPage();
    drawPageHeader(doc, "Сводка по группам", period);

    const groupRows = buildGroupsReportRows(groups, students, grades);
    drawTable(doc, groupRows, 35, true);

    // ===== Страница 2: По предметам =====
    doc.addPage();
    drawPageHeader(doc, "По предметам", period);
    const subjRows = buildSubjectsReportRows(subjects, grades);
    drawTable(doc, subjRows, 35, true);

    // ===== Страница 3: По студентам =====
    if (students.length > 0) {
        doc.addPage();
        drawPageHeader(doc, "Рейтинг студентов", period);
        const studRows = buildStudentsReportRows(students, groups, grades);
        drawTable(doc, studRows, 35, false);
    }

    // Подвал на всех страницах кроме первой
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(doc, i, totalPages);
    }

    doc.save(`Отчёт_АВПК_${formatDateForFile()}.pdf`);
}

// =====================================================
// Рисование PDF
// =====================================================
function drawTitlePage(doc, period) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Голубой блок с заголовком (как в педсовете)
    doc.setFillColor(0xBD, 0xD7, 0xEE);
    doc.rect(pageW / 2 - 95, pageH / 2 - 30, 190, 30, "F");

    // Текст заголовка
    doc.setFont("PTSans", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text("Итоги " + period, pageW / 2, pageH / 2 - 10, { align: "center" });

    // Название колледжа сверху
    doc.setFont("PTSans", "bold");
    doc.setFontSize(16);
    doc.setTextColor(0x6B, 0x3F, 0xA0);
    doc.text("АКТЮБИНСКИЙ ВЫСШИЙ", pageW / 2, 40, { align: "center" });
    doc.text("ПОЛИТЕХНИЧЕСКИЙ КОЛЛЕДЖ", pageW / 2, 50, { align: "center" });

    // Под заголовком — название отчёта
    doc.setFont("PTSans", "normal");
    doc.setFontSize(14);
    doc.setTextColor(0x33, 0x33, 0x33);
    doc.text("Отчёт по успеваемости студентов", pageW / 2, pageH / 2 + 15, { align: "center" });

    // Дата создания внизу
    doc.setFontSize(11);
    doc.setTextColor(0x77, 0x77, 0x77);
    doc.text(
        "Сформировано: " + new Date().toLocaleDateString("ru-RU"),
        pageW / 2,
        pageH - 20,
        { align: "center" }
    );
}

function drawPageHeader(doc, sectionName, period) {
    const pageW = doc.internal.pageSize.getWidth();

    // Голубая плашка-заголовок
    doc.setFillColor(0xBD, 0xD7, 0xEE);
    doc.rect(pageW / 2 - 80, 8, 160, 14, "F");

    doc.setFont("PTSans", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Итоги " + period, pageW / 2, 17, { align: "center" });

    // Подзаголовок
    doc.setFont("PTSans", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0x6B, 0x3F, 0xA0);
    doc.text(sectionName, pageW / 2, 30, { align: "center" });
}

function drawTable(doc, rows, startY, hasTotalRow) {
    // Используем autoTable
    const head = [rows[0]];
    const body = rows.slice(1);

    // Стили для итоговой строки (последней)
    const totalRowIndex = hasTotalRow ? body.length - 1 : -1;

    doc.autoTable({
        head: head,
        body: body,
        startY: startY,
        styles: {
            font: "PTSans",
            fontSize: 9,
            cellPadding: 2,
            textColor: [31, 41, 55],
            lineColor: [200, 200, 200],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [107, 63, 160],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            fontSize: 9
        },
        bodyStyles: {
            valign: "middle"
        },
        alternateRowStyles: {
            fillColor: [248, 245, 252]
        },
        // Итоговая строка — зелёный фон, жирный шрифт (как в педсовете)
        didParseCell: (data) => {
            if (data.row.index === totalRowIndex && data.section === "body") {
                data.cell.styles.fillColor = [198, 239, 206];
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.textColor = [0, 97, 0];
            }
        },
        margin: { left: 10, right: 10 }
    });
}

function drawFooter(doc, currentPage, totalPages) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFont("PTSans", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0x88, 0x88, 0x88);
    doc.text(
        "АВПК · Учёт успеваемости",
        10,
        pageH - 7
    );
    doc.text(
        `Стр. ${currentPage - 1} из ${totalPages - 1}`,
        pageW - 10,
        pageH - 7,
        { align: "right" }
    );
}

// =====================================================
// Кириллический шрифт для PDF
// =====================================================
let fontLoaded = false;
async function ensureCyrillicFont(doc) {
    if (!fontLoaded) {
        // PT Sans Regular из Google Fonts (поддерживает кириллицу)
        const fontUrl = "https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79D0KExQ.ttf";
        const fontUrlBold = "https://fonts.gstatic.com/s/ptsans/v17/jizfRExUiTo99u79B_mh0OOtLR8a8w.ttf";

        try {
            const [normalBase64, boldBase64] = await Promise.all([
                fetchAsBase64(fontUrl),
                fetchAsBase64(fontUrlBold)
            ]);
            doc.addFileToVFS("PTSans-Regular.ttf", normalBase64);
            doc.addFont("PTSans-Regular.ttf", "PTSans", "normal");
            doc.addFileToVFS("PTSans-Bold.ttf", boldBase64);
            doc.addFont("PTSans-Bold.ttf", "PTSans", "bold");
            fontLoaded = true;
        } catch (e) {
            console.warn("Не удалось загрузить шрифт PT Sans, используется стандартный:", e);
        }
    }
    doc.setFont("PTSans", "normal");
}

async function fetchAsBase64(url) {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// =====================================================
// Вспомогательные функции
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

function getCurrentPeriod() {
    // Определяем учебный год и семестр по текущей дате
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    let academicYear;
    let semester;

    if (month >= 9) {
        // Сентябрь-декабрь — I семестр
        academicYear = `${year}-${year + 1}`;
        semester = "I";
    } else if (month <= 1) {
        // Январь — конец I семестра
        academicYear = `${year - 1}-${year}`;
        semester = "I";
    } else {
        // Февраль-июнь — II семестр
        academicYear = `${year - 1}-${year}`;
        semester = "II";
    }

    return `${academicYear} учебного года · ${semester} семестр`;
}

function formatDateForFile() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
