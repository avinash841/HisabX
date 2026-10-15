"use strict";

// ===================================
// 1. STORAGE AND INITIAL SETTINGS
// ===================================

const STORAGE_KEYS = {
    expenses: "spendwise_expenses_v1",
    budget: "spendwise_budget_v1"
};

const CATEGORIES = {
    Food: { icon: "🍔", color: "#38bdf8" },
    Travel: { icon: "🚌", color: "#34d399" },
    Education: { icon: "📚", color: "#a78bfa" },
    Shopping: { icon: "🛍️", color: "#fbbf24" },
    Bills: { icon: "💡", color: "#fb7185" },
    Other: { icon: "📦", color: "#94a3b8" }
};

// Small icons used inside the Edit / Delete buttons (fixed text, not user data)
const ICONS = {
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
};

function loadExpenses() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.expenses);

        if (!data) return [];

        const parsed = JSON.parse(data);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(function (expense) {
            return (
                expense &&
                typeof expense.id === "string" &&
                typeof expense.name === "string" &&
                Number.isFinite(expense.amount) &&
                expense.amount > 0 &&
                typeof expense.date === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(expense.date) &&
                Object.prototype.hasOwnProperty.call(
                    CATEGORIES,
                    expense.category
                )
            );
        });
    } catch (error) {
        console.error("Error loading expenses:", error);
        return [];
    }
}

function loadBudget() {
    try {
        const value = localStorage.getItem(STORAGE_KEYS.budget);

        if (value === null) return 10000;

        const amount = Number(value);

        if (
            Number.isFinite(amount) &&
            amount >= 0 &&
            amount <= 100000000
        ) {
            return amount;
        }

        return 10000;
    } catch (error) {
        console.error("Error loading budget:", error);
        return 10000;
    }
}

let expenses = loadExpenses();
let monthlyBudget = loadBudget();
let editingExpenseId = null;
let expenseChart = null;
let chartMode = "daily"; // "daily" or "category"
let navLockUntil = 0;    // pauses scroll-spy right after a nav click


// ===================================
// 2. HTML ELEMENTS
// ===================================

const currentDateElement = document.getElementById("currentDate");

const totalExpensesElement = document.getElementById("totalExpenses");
const monthlyBudgetElement = document.getElementById("monthlyBudget");
const remainingBudgetElement = document.getElementById("remainingBudget");
const transactionCountElement = document.getElementById("transactionCount");

const totalExpensesNoteElement = document.getElementById("totalExpensesNote");
const budgetNoteElement = document.getElementById("budgetNote");
const remainingBudgetNoteElement = document.getElementById("remainingBudgetNote");
const transactionNoteElement = document.getElementById("transactionNote");
const sidebarTipElement = document.getElementById("sidebarTip");

const budgetPercentageElement = document.getElementById("budgetPercentage");
const budgetProgressElement = document.getElementById("budgetProgress");
const budgetSpentTextElement = document.getElementById("budgetSpentText");
const budgetLimitTextElement = document.getElementById("budgetLimitText");
const budgetAlertElement = document.getElementById("budgetAlert");
const budgetStatusElement = document.getElementById("budgetStatus");
const categoryBreakdownElement = document.getElementById("categoryBreakdown");
const transactionListElement = document.getElementById("transactionList");
const transactionSubtitleElement = document.getElementById("transactionSubtitle");
const emptyStateElement = document.getElementById("emptyState");

const chartCanvas = document.getElementById("expenseChart");
const chartEmptyElement = document.getElementById("chartEmpty");
const chartEmptyTextElement = document.getElementById("chartEmptyText");
const chartSubtitleElement = document.getElementById("chartSubtitle");
const chartInsightsElement = document.getElementById("chartInsights");
const chartTabs = document.querySelectorAll(".chart-tab");

const expenseModal = document.getElementById("expenseModal");
const budgetModal = document.getElementById("budgetModal");

const expenseForm = document.getElementById("expenseForm");
const budgetForm = document.getElementById("budgetForm");

const expenseNameInput = document.getElementById("expenseName");
const expenseAmountInput = document.getElementById("expenseAmount");
const expenseCategoryInput = document.getElementById("expenseCategory");
const expenseDateInput = document.getElementById("expenseDate");
const expenseNoteInput = document.getElementById("expenseNote");

const budgetInput = document.getElementById("budgetInput");
const modalTitle = document.getElementById("modalTitle");

const monthFilter = document.getElementById("monthFilter");
const categoryFilter = document.getElementById("categoryFilter");
const resetFiltersButton = document.getElementById("resetFilters");

const navLinks = document.querySelectorAll(".nav-link");


// ===================================
// 3. HELPER FUNCTIONS
// ===================================

function todayString() {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function currentMonthString() {
    return todayString().slice(0, 7);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(amount);
}

// Short version used on chart axes, e.g. ₹1.2K
function formatCompactCurrency(amount) {
    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            notation: "compact",
            maximumFractionDigits: 1
        }).format(amount);
    } catch (error) {
        return formatCurrency(amount);
    }
}

function formatDate(dateString) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return "Invalid date";
    }

    const parts = dateString.split("-").map(Number);

    const date = new Date(
        parts[0],
        parts[1] - 1,
        parts[2]
    );

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getMonthExpenses() {
    const month = currentMonthString();

    return expenses.filter(function (expense) {
        return expense.date.startsWith(month);
    });
}

function getDaysInCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// Returns { Food: 0, Travel: 0, ... } with the total for each category
function getCategoryTotals(monthExpenses) {
    const totals = {};

    Object.keys(CATEGORIES).forEach(function (category) {
        totals[category] = 0;
    });

    monthExpenses.forEach(function (expense) {
        totals[expense.category] += expense.amount;
    });

    return totals;
}

// Returns an array with one total for every day of the current month
function getDailyTotals(monthExpenses) {
    const days = getDaysInCurrentMonth();
    const totals = new Array(days).fill(0);

    monthExpenses.forEach(function (expense) {
        const day = Number(expense.date.slice(8, 10));

        if (day >= 1 && day <= days) {
            totals[day - 1] += expense.amount;
        }
    });

    return totals;
}

// "safe", "near" (80% or more used) or "over" (budget exceeded)
function getBudgetState(total) {
    if (monthlyBudget === 0) {
        return total > 0 ? "over" : "safe";
    }

    if (total > monthlyBudget) return "over";
    if (total >= monthlyBudget * 0.8) return "near";

    return "safe";
}

function saveData() {
    try {
        localStorage.setItem(
            STORAGE_KEYS.expenses,
            JSON.stringify(expenses)
        );

        localStorage.setItem(
            STORAGE_KEYS.budget,
            String(monthlyBudget)
        );

        return true;
    } catch (error) {
        console.error("Error saving data:", error);

        alert(
            "Data save nahi hua. Browser storage check karo."
        );

        return false;
    }
}


// ===================================
// 4. INITIALIZE APPLICATION
// ===================================

function initializeDashboard() {
    currentDateElement.textContent =
        new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

    monthFilter.value = currentMonthString();
    expenseDateInput.value = todayString();

    updateChartTabs();
    renderDashboard();
    updateActiveNav();
}


// ===================================
// 5. DASHBOARD SUMMARY
// ===================================

function renderDashboard() {
    const monthExpenses = getMonthExpenses();

    const total = monthExpenses.reduce(
        function (sum, expense) {
            return sum + expense.amount;
        },
        0
    );

    const remaining = monthlyBudget - total;
    const count = monthExpenses.length;

    totalExpensesElement.textContent = formatCurrency(total);
    monthlyBudgetElement.textContent = formatCurrency(monthlyBudget);
    remainingBudgetElement.textContent = formatCurrency(remaining);
    transactionCountElement.textContent = count;

    remainingBudgetElement.classList.toggle("negative", remaining < 0);

    // Small notes under each number (all calculated, nothing hardcoded)
    if (monthlyBudget > 0) {
        totalExpensesNoteElement.textContent =
            Math.round((total / monthlyBudget) * 100) + "% of your budget";

        budgetNoteElement.textContent =
            "About " +
            formatCurrency(monthlyBudget / getDaysInCurrentMonth()) +
            " per day";
    } else {
        totalExpensesNoteElement.textContent = "No budget set";
        budgetNoteElement.textContent = "Set a budget to get started";
    }

    remainingBudgetNoteElement.textContent =
        remaining < 0
            ? "Over budget by " + formatCurrency(Math.abs(remaining))
            : "Money left to spend";

    transactionNoteElement.textContent =
        count > 0
            ? "Average " + formatCurrency(total / count) + " per expense"
            : "No expenses yet";

    renderSidebarTip(remaining);
    renderBudgetProgress(total);
    renderBudgetAlert(total);
    renderCategoryBreakdown(monthExpenses, total);
    renderChart(monthExpenses);
    renderTransactions();
}

function renderSidebarTip(remaining) {
    const daysLeft = getDaysInCurrentMonth() - new Date().getDate() + 1;

    if (monthlyBudget <= 0) {
        sidebarTipElement.textContent =
            "Set a monthly budget to get a daily spending tip.";
    } else if (remaining <= 0) {
        sidebarTipElement.textContent =
            "You have used your whole budget. Try to pause non-essential spending.";
    } else {
        sidebarTipElement.textContent =
            "You can spend about " +
            formatCurrency(remaining / daysLeft) +
            " per day for the rest of this month.";
    }
}


// ===================================
// 6. BUDGET PROGRESS
// ===================================

function renderBudgetProgress(total) {
    let percentage = 0;

    if (monthlyBudget > 0) {
        percentage = (total / monthlyBudget) * 100;
    } else if (total > 0) {
        percentage = 100;
    }

    const state = getBudgetState(total);

    budgetPercentageElement.textContent =
        Math.round(percentage) + "%";

    budgetProgressElement.style.width =
        Math.min(percentage, 100) + "%";

    budgetProgressElement.classList.toggle("over-budget", state === "over");
    budgetProgressElement.classList.toggle("near-budget", state === "near");

    budgetStatusElement.className = "status-chip " + state;
    budgetStatusElement.textContent =
        state === "over" ? "Over budget" :
        state === "near" ? "Close to limit" :
        "On track";

    budgetSpentTextElement.textContent =
        formatCurrency(total) + " spent";

    budgetLimitTextElement.textContent =
        formatCurrency(monthlyBudget) + " limit";
}


// ===================================
// 7. BUDGET ALERT
// ===================================

function showAlert(message, type) {
    budgetAlertElement.textContent = message;
    budgetAlertElement.classList.toggle("danger", type === "danger");
    budgetAlertElement.classList.remove("hidden");
}

function renderBudgetAlert(total) {
    if (monthlyBudget === 0 && total > 0) {
        showAlert(
            "Warning: You have expenses but your budget is zero. Set a monthly budget.",
            "danger"
        );
        return;
    }

    if (monthlyBudget > 0 && total > monthlyBudget) {
        const exceeded = total - monthlyBudget;

        showAlert(
            "Warning: Budget exceeded by " +
            formatCurrency(exceeded) + ".",
            "danger"
        );
        return;
    }

    if (
        monthlyBudget > 0 &&
        total >= monthlyBudget * 0.8
    ) {
        showAlert(
            "Warning: You have used at least 80% of your monthly budget.",
            "warning"
        );
        return;
    }

    budgetAlertElement.classList.add("hidden");
}


// ===================================
// 8. CATEGORY BREAKDOWN
// ===================================
function renderCategoryBreakdown(monthExpenses, total) {
    categoryBreakdownElement.replaceChildren();

    const totals = getCategoryTotals(monthExpenses);

    const usedCategories = Object.keys(totals)
        .filter(function (category) {
            return totals[category] > 0;
        })
        .sort(function (a, b) {
            return totals[b] - totals[a];
        });

    if (usedCategories.length === 0) {
        const message = document.createElement("p");

        message.className = "empty-category";
        message.textContent =
            "Add an expense to see your category breakdown.";

        categoryBreakdownElement.appendChild(message);
        return;
    }

    usedCategories.forEach(function (category) {
        const amount = totals[category];
        const percentage = total > 0
            ? (amount / total) * 100
            : 0;

        const expenseCount = monthExpenses.filter(function (expense) {
            return expense.category === category;
        }).length;

        const row = document.createElement("div");
        row.className = "category-row";

        const icon = document.createElement("div");
        icon.className = "category-icon";
        icon.textContent = CATEGORIES[category].icon;

        const info = document.createElement("div");
        info.className = "category-info";

        const head = document.createElement("div");
        head.className = "category-head";

        const heading = document.createElement("h4");
        heading.textContent = category;

        const amountElement = document.createElement("span");
        amountElement.className = "category-amount";
        amountElement.textContent = formatCurrency(amount);

        head.append(heading, amountElement);

        const track = document.createElement("div");
        track.className = "category-track";

        const bar = document.createElement("div");
        bar.style.width = percentage + "%";
        bar.style.background = CATEGORIES[category].color;

        track.appendChild(bar);

        const meta = document.createElement("span");
        meta.className = "category-meta";
        meta.textContent =
            Math.round(percentage) + "% of spending · " +
            expenseCount + (expenseCount === 1 ? " expense" : " expenses");

        info.append(head, track, meta);
        row.append(icon, info);
        categoryBreakdownElement.appendChild(row);
    });
}


// ===================================
// 9. EXPENSE CHART
// ===================================

const TOOLTIP_STYLE = {
    backgroundColor: "rgba(9, 14, 40, 0.96)",
    borderColor: "rgba(129, 140, 248, 0.35)",
    borderWidth: 1,
    titleColor: "#f1f4ff",
    bodyColor: "#c3c9e8",
    padding: 12,
    cornerRadius: 10,
    boxPadding: 4
};

function updateChartTabs() {
    chartTabs.forEach(function (tab) {
        const isActive = tab.dataset.mode === chartMode;

        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-pressed", String(isActive));
    });

    chartSubtitleElement.textContent =
        chartMode === "daily"
            ? "Daily spending this month"
            : "Where your money goes";
}

function showChartMessage(message) {
    chartCanvas.classList.add("hidden");
    chartEmptyTextElement.textContent = message;
    chartEmptyElement.classList.remove("hidden");
}

function addInsight(label, value) {
    const box = document.createElement("div");
    box.className = "insight";

    const labelElement = document.createElement("span");
    labelElement.textContent = label;

    const valueElement = document.createElement("strong");
    valueElement.textContent = value;

    box.append(labelElement, valueElement);
    chartInsightsElement.appendChild(box);
}

function renderChart(monthExpenses) {
    if (!chartCanvas) return;

    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }

    chartInsightsElement.replaceChildren();

    if (monthExpenses.length === 0) {
        showChartMessage("Add an expense to see your analytics.");
        return;
    }

    if (typeof Chart === "undefined") {
        console.warn(
            "Chart.js load nahi hui. Internet connection check karo."
        );
        showChartMessage("Chart could not load. Please check your internet connection.");
        return;
    }

    chartEmptyElement.classList.add("hidden");
    chartCanvas.classList.remove("hidden");

    Chart.defaults.color = "#8a94bf";
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.font.size = 12;

    if (chartMode === "category") {
        drawCategoryChart(monthExpenses);
    } else {
        drawDailyChart(monthExpenses);
    }
}

function drawDailyChart(monthExpenses) {
    const dailyTotals = getDailyTotals(monthExpenses);
    const monthName = new Date().toLocaleDateString("en-IN", { month: "short" });

    const labels = dailyTotals.map(function (value, index) {
        return String(index + 1);
    });

    expenseChart = new Chart(chartCanvas, {
        type: "bar",

data: {
            labels: labels,
            datasets: [{
                label: "Spent",
                data: dailyTotals,
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 22,
                hoverBackgroundColor: "#60a5fa",
                backgroundColor: function (context) {
                    const chart = context.chart;

                    if (!chart.chartArea) return "#8b5cf6";

                    // Blue at the bottom of the bar, purple at the top
                    const gradient = chart.ctx.createLinearGradient(
                        0, chart.chartArea.bottom,
                        0, chart.chartArea.top
                    );

                    gradient.addColorStop(0, "#2f7bff");
                    gradient.addColorStop(1, "#a78bfa");

                    return gradient;
                }
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 700, easing: "easeOutQuart" },
            interaction: { mode: "index", intersect: false },

            plugins: {
                legend: { display: false },

                tooltip: Object.assign({}, TOOLTIP_STYLE, {
                    displayColors: false,
                    callbacks: {
                        title: function (items) {
                            return items[0].label + " " + monthName;
                        },
                        label: function (context) {
                            return formatCurrency(context.raw);
                        }
                    }
                })
            },

            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                },
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: "rgba(129, 140, 248, 0.1)" },
                    ticks: {
                        maxTicksLimit: 5,
                        callback: function (value) {
                            return formatCompactCurrency(value);
                        }
                    }
                }
            }
        }
    });

    // Quick facts under the chart
    const total = dailyTotals.reduce(function (sum, value) {
        return sum + value;
    }, 0);

    const highest = Math.max.apply(null, dailyTotals);
    const highestDay = dailyTotals.indexOf(highest) + 1;

    const activeDays = dailyTotals.filter(function (value) {
        return value > 0;
    }).length;

    addInsight("Highest day", formatCurrency(highest) + " (" + highestDay + " " + monthName + ")");
    addInsight("Daily average", formatCurrency(total / new Date().getDate()));
    addInsight("Days with spending", String(activeDays));
}

function drawCategoryChart(monthExpenses) {
    const totals = getCategoryTotals(monthExpenses);

    const used = Object.keys(totals)
        .filter(function (category) {
            return totals[category] > 0;
        })
        .sort(function (a, b) {
            return totals[b] - totals[a];
        });

    const values = used.map(function (category) {
        return totals[category];
    });

    const colors = used.map(function (category) {
        return CATEGORIES[category].color;
    });

    const grandTotal = values.reduce(function (sum, value) {
        return sum + value;
    }, 0);

    // Writes the total in the middle of the doughnut
    const centerTextPlugin = {
        id: "centerText",

        afterDraw: function (chart) {
            const meta = chart.getDatasetMeta(0);

            if (!meta.data.length) return;

            const x = meta.data[0].x;
            const y = meta.data[0].y;
            const ctx = chart.ctx;

            ctx.save();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillStyle = "#8a94bf";
            ctx.font = "600 12px 'DM Sans', sans-serif";
            ctx.fillText("Total spent", x, y - 14);

            ctx.fillStyle = "#f1f4ff";
            ctx.font = "800 22px 'Manrope', sans-serif";
            ctx.fillText(formatCompactCurrency(grandTotal), x, y + 10);

            ctx.restore();
        }
    };

    expenseChart = new Chart(chartCanvas, {
        type: "doughnut",

        data: {
            labels: used,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderColor: "#0e1535",
                borderWidth: 3,
                borderRadius: 8,
                hoverOffset: 10
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",
            animation: { duration: 700, easing: "easeOutQuart" },

            plugins: {
                legend: {
                    position: "bottom",

                    labels: {
                        usePointStyle: true,
                        pointStyle: "circle",
                        boxWidth: 8,
                        padding: 16
                    }
                },

                tooltip: Object.assign({}, TOOLTIP_STYLE, {
                    callbacks: {
                        label: function (context) {
                            const percent = Math.round((context.raw / grandTotal) * 100);

                            return context.label + ": " +
                                formatCurrency(context.raw) +
                                " (" + percent + "%)";
                        }
                    }
                })
            }
        },

        plugins: [centerTextPlugin]
    });

    // Quick facts under the chart
    addInsight("Top category", CATEGORIES[used[0]].icon + " " + used[0]);
    addInsight("Top share", Math.round((values[0] / grandTotal) * 100) + "%");
    addInsight("Categories used", String(used.length));
}


// ===================================
// 10. TRANSACTION LIST
// ===================================

function renderTransactions() {
    transactionListElement.replaceChildren();

    const selectedMonth = monthFilter.value;
    const selectedCategory = categoryFilter.value;

    const filtered = expenses
        .filter(function (expense) {
            const matchesMonth =
                !selectedMonth ||
                expense.date.startsWith(selectedMonth);

            const matchesCategory =
                selectedCategory === "All" ||
                expense.category === selectedCategory;

            return matchesMonth && matchesCategory;
        })
        .sort(function (a, b) {
            return b.date.localeCompare(a.date) ||
                b.id.localeCompare(a.id);
        });

    emptyStateElement.classList.toggle(
        "hidden",
        filtered.length > 0
    );

    // Subtitle shows how many expenses match and their total
    const filteredTotal = filtered.reduce(function (sum, expense) {
        return sum + expense.amount;
    }, 0);

    transactionSubtitleElement.textContent =
        filtered.length === 0
            ? "No expenses match your filters"
            : filtered.length + (filtered.length === 1 ? " expense" : " expenses") +
            "_ " + formatCurrency(filteredTotal);

            // Show the Reset button only when filters are changed
    const filtersChanged =
      selectedMonth !== currentMonthString() ||
        selectedCategory !== "All";

    resetFiltersButton.classList.toggle("hidden", !filtersChanged);

    filtered.forEach(function (expense) {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");
        nameCell.className = "cell-name";

        const name = document.createElement("span");
        name.className = "expense-name";
        name.textContent = expense.name;

        nameCell.appendChild(name);

        if (expense.note) {
            const note = document.createElement("span");

            note.className = "expense-note";
            note.textContent = expense.note;

            nameCell.appendChild(note);
        }

        const categoryCell = document.createElement("td");
        categoryCell.className = "cell-category";

        const categoryColor = CATEGORIES[expense.category].color;

        const categoryPill = document.createElement("span");
        categoryPill.className = "category-pill";
        categoryPill.style.color = categoryColor;
        categoryPill.style.background = categoryColor + "1f";

        const dot = document.createElement("span");
        dot.className = "dot";
        dot.style.background = categoryColor;

        categoryPill.append(dot, document.createTextNode(expense.category));
        categoryCell.appendChild(categoryPill);

        const dateCell = document.createElement("td");
        dateCell.className = "cell-date";
        dateCell.textContent = formatDate(expense.date);

        const amountCell = document.createElement("td");
        amountCell.className = "cell-amount amount-cell";
        amountCell.textContent = formatCurrency(expense.amount);

        const actionCell = document.createElement("td");
        actionCell.className = "cell-actions";

        const buttons = document.createElement("div");
        buttons.className = "action-buttons";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "action-btn";
        editButton.innerHTML = ICONS.edit + "<span>Edit</span>";
        editButton.setAttribute("aria-label", "Edit " + expense.name);

        editButton.addEventListener("click", function () {
            openEditModal(expense.id);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "action-btn delete";
        deleteButton.innerHTML = ICONS.trash + "<span>Delete</span>";
        deleteButton.setAttribute("aria-label", "Delete " + expense.name);

        deleteButton.addEventListener("click", function () {
            deleteExpense(expense.id);
        });

        buttons.append(editButton, deleteButton);
        actionCell.appendChild(buttons);

        row.append(
            nameCell,
            categoryCell,
            dateCell,
            amountCell,
            actionCell
        );

        transactionListElement.appendChild(row);
    });
}


// ===================================
// 11. MODAL HELPERS
// ===================================

function showModal(modal) {
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
}

function hideModal(modal) {
    modal.classList.add("hidden");

    const noModalOpen =
        expenseModal.classList.contains("hidden") &&
        budgetModal.classList.contains("hidden");

    if (noModalOpen) {
        document.body.classList.remove("modal-open");
    }
}

function closeExpenseModal() {
    hideModal(expenseModal);
    expenseForm.reset();
    editingExpenseId = null;
}

function closeBudgetModal() {
    hideModal(budgetModal);
}


// ===================================
// 12. ADD EXPENSE MODAL
// ===================================

function openAddModal() {
    editingExpenseId = null;

    expenseForm.reset();
    expenseDateInput.value = todayString();

    modalTitle.textContent = "Add New Expense";
    showModal(expenseModal);

    expenseNameInput.focus();
}


// ===================================
// 13. EDIT EXPENSE MODAL
// ===================================

function openEditModal(id) {
    const expense = expenses.find(function (item) {
        return item.id === id;
    });

    if (!expense) return;

    editingExpenseId = id;

    expenseNameInput.value = expense.name;
    expenseAmountInput.value = expense.amount;
    expenseCategoryInput.value = expense.category;
    expenseDateInput.value = expense.date;
    expenseNoteInput.value = expense.note || "";

    modalTitle.textContent = "Edit Expense";
    showModal(expenseModal);

    expenseNameInput.focus();
}


// ===================================
// 14. SAVE EXPENSE
// ===================================

expenseForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = expenseNameInput.value.trim();
    const amount = Number(expenseAmountInput.value);
    const category = expenseCategoryInput.value;
    const date = expenseDateInput.value;
    const note = expenseNoteInput.value.trim();

    if (!name) {
        alert("Please enter an expense name.");
        return;
    }

    if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 100000000
    ) {
        alert("Please enter a valid amount.");
        return;
    }

    if (!Object.prototype.hasOwnProperty.call(CATEGORIES, category)) {
        alert("Please select a valid category.");
        return;
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        alert("Please select a valid date.");
        return;
    }

    const expenseData = {
        name: name,
        amount: amount,
        category: category,
        date: date,
        note: note
    };

    const previousExpenses = expenses.map(function (expense) {
        return { ...expense };
    });

    if (editingExpenseId !== null) {
        const index = expenses.findIndex(function (expense) {
            return expense.id === editingExpenseId;
        });

        if (index === -1) {
            alert("Expense not found.");
            return;
        }

        expenses[index] = {
            ...expenses[index],
            ...expenseData
        };
    } else {
        // Compatible with browsers that do not support randomUUID()
        const newId =
            Date.now().toString() + "-" +
            Math.random().toString(16).slice(2);

        expenses.push({
            id: newId,
            ...expenseData
        });
    }

    if (!saveData()) {
        expenses = previousExpenses;
        return;
    }

    closeExpenseModal();
    renderDashboard();
});


// ===================================
// 15. DELETE EXPENSE
// ===================================

function deleteExpense(id) {
    const expense = expenses.find(function (item) {
        return item.id === id;
    });

    if (!expense) return;

    const confirmed = confirm(
        'Delete "' + expense.name + '" expense?'
    );

    if (!confirmed) return;

    const previousExpenses = expenses;

    expenses = expenses.filter(function (item) {
        return item.id !== id;
    });

    if (!saveData()) {
        expenses = previousExpenses;
        return;
    }

    renderDashboard();
}


// ===================================
// 16. BUDGET MODAL
// ===================================

function openBudgetModal() {
    budgetInput.value = monthlyBudget;
    showModal(budgetModal);

    budgetInput.focus();
}

budgetForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const newBudget = Number(budgetInput.value);

    if (
        !Number.isFinite(newBudget) ||
        newBudget < 0 ||
        newBudget > 100000000
    ) {
        alert("Please enter a valid budget.");
        return;
    }

    const previousBudget = monthlyBudget;
    monthlyBudget = newBudget;

    if (!saveData()) {
        monthlyBudget = previousBudget;
        return;
    }

    closeBudgetModal();
    renderDashboard();
});


// ===================================
// 17. NAVIGATION (sidebar active state)
// ===================================

function setActiveNav(id) {
    navLinks.forEach(function (link) {
        const isActive = link.dataset.target === id;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

// Highlights the sidebar link of the section you are looking at
function updateActiveNav() {
    let current = "dashboard";

    ["budget", "analytics", "transactions"].forEach(function (id) {
        const section = document.getElementById(id);

        if (
            section &&
            section.getBoundingClientRect().top <= window.innerHeight * 0.4
        ) {
            current = id;
        }
    });

    setActiveNav(current);
}

navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
        event.preventDefault();

        const id = link.dataset.target;

        setActiveNav(id);
        navLockUntil = Date.now() + 1000;

        if (id === "dashboard") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
            document.getElementById(id).scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});

window.addEventListener("scroll", function () {
    if (Date.now() < navLockUntil) return;

    updateActiveNav();
}, { passive: true });


// ===================================
// 18. EVENT LISTENERS
// ===================================

// Expense modal
document.getElementById("openExpenseModal")
    .addEventListener("click", openAddModal);

document.getElementById("closeExpenseModal")
    .addEventListener("click", closeExpenseModal);

document.getElementById("cancelExpense")
    .addEventListener("click", closeExpenseModal);

// Budget modal
document.getElementById("editBudgetBtn")
    .addEventListener("click", openBudgetModal);

document.getElementById("closeBudgetModal")
    .addEventListener("click", closeBudgetModal);

document.getElementById("cancelBudget")
    .addEventListener("click", closeBudgetModal);

// Click on the dark area outside a modal closes it
expenseModal.addEventListener("click", function (event) {
    if (event.target === expenseModal) closeExpenseModal();
});

budgetModal.addEventListener("click", function (event) {
    if (event.target === budgetModal) closeBudgetModal();
});
// Escape key closes any open modal
document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;

    if (!expenseModal.classList.contains("hidden")) closeExpenseModal();
    if (!budgetModal.classList.contains("hidden")) closeBudgetModal();
});

// Filters
monthFilter.addEventListener("input", renderTransactions);
monthFilter.addEventListener("change", renderTransactions);
categoryFilter.addEventListener("change", renderTransactions);

resetFiltersButton.addEventListener("click", function () {
    monthFilter.value = currentMonthString();
    categoryFilter.value = "All";

    renderTransactions();
});

// Chart tabs (Daily / Category)
chartTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
        chartMode = tab.dataset.mode;

        updateChartTabs();
        renderChart(getMonthExpenses());
    });
});


// ===================================
// 19. START THE APP
// ===================================

initializeDashboard();