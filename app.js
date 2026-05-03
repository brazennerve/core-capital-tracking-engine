const STORAGE_KEY = "core-capital-tracker-state";
const THEME_KEY = "core-capital-tracker-theme";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const defaultState = {
  startingCapital: 50000,
  targetCapital: 500000,
  allocationTargets: {
    house: 0,
    car: 0,
    savings: 0,
    expense: 0,
  },
  entries: [],
};

const allocations = [
  { key: "house", label: "House funds", percent: 30 },
  { key: "car", label: "Car funds", percent: 20 },
  { key: "savings", label: "Savings", percent: 30 },
  { key: "expense", label: "Expense", percent: 10 },
];

let state = loadState();

const els = {
  csvInput: document.querySelector("#csvInput"),
  themeOptions: document.querySelectorAll("[data-theme-option]"),
  startingCapital: document.querySelector("#startingCapital"),
  targetCapital: document.querySelector("#targetCapital"),
  entryForm: document.querySelector("#entryForm"),
  entryId: document.querySelector("#entryId"),
  entryDate: document.querySelector("#entryDate"),
  entryType: document.querySelector("#entryType"),
  entryAmount: document.querySelector("#entryAmount"),
  entryNotes: document.querySelector("#entryNotes"),
  saveEntry: document.querySelector("#saveEntry"),
  cancelEdit: document.querySelector("#cancelEdit"),
  ledgerBody: document.querySelector("#ledgerBody"),
  startingCapitalLabel: document.querySelector("#startingCapitalLabel"),
  currentCapitalLabel: document.querySelector("#currentCapitalLabel"),
  totalPnlLabel: document.querySelector("#totalPnlLabel"),
  goalProgressLabel: document.querySelector("#goalProgressLabel"),
  targetCoveredLabel: document.querySelector("#targetCoveredLabel"),
  remainingTargetLabel: document.querySelector("#remainingTargetLabel"),
  daysRequiredLabel: document.querySelector("#daysRequiredLabel"),
  avgDailyPnlLabel: document.querySelector("#avgDailyPnlLabel"),
  equityChart: document.querySelector("#equityChart"),
  targetChart: document.querySelector("#targetChart"),
  equityRange: document.querySelector("#equityRange"),
  targetGap: document.querySelector("#targetGap"),
  goalProgressBar: document.querySelector("#goalProgressBar"),
  entryCount: document.querySelector("#entryCount"),
  allocationCards: document.querySelector("#allocationCards"),
};

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let themePreference = localStorage.getItem(THEME_KEY) || "system";

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { ...defaultState, entries: seedEntries() };
  try {
    const parsed = JSON.parse(stored);
    return {
      ...defaultState,
      ...parsed,
      allocationTargets: { ...defaultState.allocationTargets, ...(parsed.allocationTargets || {}) },
    };
  } catch {
    return { ...defaultState, entries: seedEntries() };
  }
}

function seedEntries() {
  const today = new Date();
  const iso = (daysAgo) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().slice(0, 10);
  };
  return [
    { id: crypto.randomUUID(), date: iso(14), type: "deposit", amount: 10000, notes: "Additional capital" },
    { id: crypto.randomUUID(), date: iso(10), type: "pnl", amount: 1850, notes: "Manual daily P&L" },
    { id: crypto.randomUUID(), date: iso(8), type: "pnl", amount: -900, notes: "Risk contained" },
    { id: crypto.randomUUID(), date: iso(5), type: "pnl", amount: 2450, notes: "Trend day" },
    { id: crypto.randomUUID(), date: iso(2), type: "withdrawal", amount: 3000, notes: "Personal withdrawal" },
    { id: crypto.randomUUID(), date: iso(1), type: "pnl", amount: 1200, notes: "Scalps" },
  ];
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function activeTheme() {
  return themePreference === "system" ? (systemTheme.matches ? "dark" : "light") : themePreference;
}

function applyTheme() {
  document.documentElement.dataset.theme = activeTheme();
  els.themeOptions.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.themeOption === themePreference);
  });
}

function signedAmount(entry) {
  if (entry.type === "withdrawal") return -Math.abs(entry.amount);
  if (entry.type === "deposit") return Math.abs(entry.amount);
  return Number(entry.amount);
}

function sortedEntries() {
  return [...state.entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function ledgerRows() {
  let capital = Number(state.startingCapital) || 0;
  return sortedEntries().map((entry) => {
    capital += signedAmount(entry);
    return { ...entry, signed: signedAmount(entry), runningCapital: capital };
  });
}

function currentCapital() {
  const rows = ledgerRows();
  return rows.length ? rows[rows.length - 1].runningCapital : Number(state.startingCapital) || 0;
}

function goalMetrics() {
  const current = currentCapital();
  const target = Number(state.targetCapital) || 0;
  const remaining = Math.max(0, target - current);
  const avgDailyPnl = averageDailyPnl();
  const daysRequired = remaining > 0 && avgDailyPnl > 0 ? Math.ceil(remaining / avgDailyPnl) : 0;
  const progress = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;
  return { current, target, remaining, avgDailyPnl, daysRequired, progress };
}

function averageDailyPnl() {
  const pnlByDay = new Map();
  state.entries.filter((entry) => entry.type === "pnl").forEach((entry) => {
    pnlByDay.set(entry.date, (pnlByDay.get(entry.date) || 0) + Number(entry.amount));
  });
  if (!pnlByDay.size) return 0;
  const total = [...pnlByDay.values()].reduce((sum, amount) => sum + amount, 0);
  return total / pnlByDay.size;
}

function hydrateInputs() {
  els.startingCapital.value = state.startingCapital;
  els.targetCapital.value = state.targetCapital;
  els.entryDate.value = new Date().toISOString().slice(0, 10);
}

function render() {
  const rows = ledgerRows();
  const metrics = goalMetrics();
  const totalPnl = state.entries.filter((entry) => entry.type === "pnl").reduce((sum, entry) => sum + Number(entry.amount), 0);

  els.startingCapitalLabel.textContent = rupees.format(Number(state.startingCapital) || 0);
  els.currentCapitalLabel.textContent = rupees.format(metrics.current);
  els.totalPnlLabel.textContent = rupees.format(totalPnl);
  els.goalProgressLabel.textContent = `${metrics.progress.toFixed(1)}%`;
  els.targetCoveredLabel.textContent = `${metrics.progress.toFixed(1)}%`;
  els.remainingTargetLabel.textContent = rupees.format(metrics.remaining);
  els.daysRequiredLabel.textContent = metrics.remaining === 0 ? "Done" : metrics.daysRequired ? `${metrics.daysRequired} days` : "--";
  els.avgDailyPnlLabel.textContent = rupees.format(metrics.avgDailyPnl);
  els.goalProgressBar.style.width = `${metrics.progress}%`;
  els.targetGap.textContent = metrics.target > metrics.current
    ? `${rupees.format(metrics.target - metrics.current)} to target`
    : "Target reached";
  els.entryCount.textContent = `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`;
  els.equityRange.textContent = rows.length ? `${formatDate(rows[0].date)} to ${formatDate(rows[rows.length - 1].date)}` : "No entries yet";

  renderLedger(rows);
  renderAllocations(metrics);
  drawEquityChart(rows);
  drawTargetChart(rows, metrics);
  saveState();
}

function renderAllocations(metrics) {
  els.allocationCards.innerHTML = allocations.map((item) => {
    const amount = metrics.current * (item.percent / 100);
    const target = Number(state.allocationTargets[item.key]) || 0;
    const remaining = Math.max(0, target - amount);
    const progress = target > 0 ? Math.min(100, (amount / target) * 100) : 0;
    const dailyContribution = metrics.avgDailyPnl * (item.percent / 100);
    const daysRequired = remaining > 0 && dailyContribution > 0 ? Math.ceil(remaining / dailyContribution) : 0;
    const daysText = remaining === 0 && target > 0 ? "Done" : daysRequired ? `${daysRequired} days` : "--";
    return `
      <article class="allocation-card">
        <div class="allocation-card-top">
          <div>
            <span>${item.percent}% of capital</span>
            <h3>${item.label}</h3>
          </div>
          <strong>${rupees.format(amount)}</strong>
        </div>
        <label>
          Target
          <input data-allocation-target="${item.key}" type="number" min="0" step="100" value="${target}" />
        </label>
        <div class="progress-track compact" aria-label="${item.label} target progress">
          <div style="width: ${progress}%"></div>
        </div>
        <div class="allocation-meta">
          <span>${progress.toFixed(1)}% covered</span>
          <span>${rupees.format(remaining)} left</span>
          <span>${daysText}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderLedger(rows) {
  if (!rows.length) {
    els.ledgerBody.innerHTML = `<tr><td class="empty-row" colspan="6">Add a deposit, withdrawal, or daily P&L entry to begin.</td></tr>`;
    return;
  }
  els.ledgerBody.innerHTML = rows.map((entry) => {
    const amountClass = entry.signed >= 0 ? "amount-positive" : "amount-negative";
    return `
      <tr>
        <td>${formatDate(entry.date)}</td>
        <td><span class="type-pill type-${entry.type}">${entry.type}</span></td>
        <td class="${amountClass}">${rupees.format(entry.signed)}</td>
        <td>${rupees.format(entry.runningCapital)}</td>
        <td>${escapeHtml(entry.notes || "")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-button" type="button" data-action="edit" data-id="${entry.id}">Edit</button>
            <button class="icon-button danger" type="button" data-action="delete" data-id="${entry.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function drawEquityChart(rows) {
  const points = [{ date: "Start", value: Number(state.startingCapital) || 0 }, ...rows.map((row) => ({ date: row.date, value: row.runningCapital }))];
  drawLineChart(els.equityChart, points, {
    line: cssVar("--accent"),
    fill: colorWithAlpha(cssVar("--accent"), 0.16),
    formatter: (value) => rupees.format(value),
  });
}

function drawTargetChart(rows, metrics) {
  const actualPnlByDay = new Map();
  rows.filter((row) => row.type === "pnl").forEach((row) => {
    actualPnlByDay.set(row.date, (actualPnlByDay.get(row.date) || 0) + Number(row.amount));
  });
  const actualPoints = [...actualPnlByDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  const targetValue = metrics.avgDailyPnl;
  const targetPoints = actualPoints.map((point) => ({ date: point.date, value: targetValue }));
  drawBarLineChart(els.targetChart, actualPoints, targetPoints);
}

function drawLineChart(canvas, points, options) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const pad = { top: 28, right: 28, bottom: 42, left: 76 };
  drawAxes(ctx, width, height, pad);
  if (!points.length) return;

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const x = (i) => pad.left + (i / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => height - pad.bottom - ((value - min) / spread) * (height - pad.top - pad.bottom);

  ctx.fillStyle = cssVar("--muted");
  ctx.font = "13px system-ui";
  ctx.fillText(options.formatter(max), 14, pad.top + 4);
  ctx.fillText(options.formatter(min), 14, height - pad.bottom + 4);

  ctx.beginPath();
  points.forEach((point, i) => i ? ctx.lineTo(x(i), y(point.value)) : ctx.moveTo(x(i), y(point.value)));
  ctx.lineTo(x(points.length - 1), height - pad.bottom);
  ctx.lineTo(x(0), height - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = options.fill;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, i) => i ? ctx.lineTo(x(i), y(point.value)) : ctx.moveTo(x(i), y(point.value)));
  ctx.strokeStyle = options.line;
  ctx.lineWidth = 3;
  ctx.stroke();

  points.forEach((point, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(point.value), 4, 0, Math.PI * 2);
    ctx.fillStyle = options.line;
    ctx.fill();
  });
}

function drawBarLineChart(canvas, bars, targetPoints) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const pad = { top: 24, right: 28, bottom: 36, left: 76 };
  ctx.clearRect(0, 0, width, height);
  drawAxes(ctx, width, height, pad);
  if (!bars.length) {
    ctx.fillStyle = cssVar("--muted");
    ctx.font = "15px system-ui";
    ctx.fillText("Daily P&L entries will appear here.", pad.left, height / 2);
    return;
  }

  const values = [...bars.map((point) => point.value), ...targetPoints.map((point) => point.value), 0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const xStep = (width - pad.left - pad.right) / bars.length;
  const y = (value) => height - pad.bottom - ((value - min) / spread) * (height - pad.top - pad.bottom);
  const zeroY = y(0);

  bars.forEach((point, index) => {
    const barX = pad.left + index * xStep + xStep * 0.18;
    const barW = Math.max(8, xStep * 0.64);
    ctx.fillStyle = point.value >= 0 ? cssVar("--profit") : cssVar("--loss");
    ctx.fillRect(barX, Math.min(zeroY, y(point.value)), barW, Math.abs(zeroY - y(point.value)));
  });

  ctx.beginPath();
  targetPoints.forEach((point, index) => {
    const cx = pad.left + index * xStep + xStep / 2;
    index ? ctx.lineTo(cx, y(point.value)) : ctx.moveTo(cx, y(point.value));
  });
  ctx.strokeStyle = cssVar("--accent-2");
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = cssVar("--muted");
  ctx.font = "13px system-ui";
  ctx.fillText(rupees.format(max), 14, pad.top + 4);
  ctx.fillText(rupees.format(min), 14, height - pad.bottom + 4);
}

function drawAxes(ctx, width, height, pad) {
  ctx.strokeStyle = cssVar("--line");
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top);
  ctx.lineTo(pad.left, height - pad.bottom);
  ctx.lineTo(width - pad.right, height - pad.bottom);
  ctx.stroke();
  for (let i = 1; i <= 4; i += 1) {
    const y = pad.top + ((height - pad.top - pad.bottom) / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }
}

function upsertEntry(event) {
  event.preventDefault();
  const entry = {
    id: els.entryId.value || crypto.randomUUID(),
    date: els.entryDate.value,
    type: els.entryType.value,
    amount: Number(els.entryAmount.value),
    notes: els.entryNotes.value.trim(),
  };
  if (!entry.date || !Number.isFinite(entry.amount)) return;
  const existingIndex = state.entries.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) state.entries[existingIndex] = entry;
  else state.entries.push(entry);
  resetEntryForm();
  render();
}

function resetEntryForm() {
  els.entryId.value = "";
  els.entryForm.reset();
  els.entryDate.value = new Date().toISOString().slice(0, 10);
  els.entryType.value = "pnl";
  els.saveEntry.textContent = "Add entry";
  els.cancelEdit.hidden = true;
}

function handleLedgerClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const entry = state.entries.find((item) => item.id === button.dataset.id);
  if (!entry) return;
  if (button.dataset.action === "delete") {
    state.entries = state.entries.filter((item) => item.id !== entry.id);
    render();
    return;
  }
  els.entryId.value = entry.id;
  els.entryDate.value = entry.date;
  els.entryType.value = entry.type;
  els.entryAmount.value = entry.amount;
  els.entryNotes.value = entry.notes || "";
  els.saveEntry.textContent = "Update entry";
  els.cancelEdit.hidden = false;
  els.entryAmount.focus();
}

function bindPlannerInput(key, parser = Number) {
  els[key].addEventListener("input", () => {
    state[key] = parser(els[key].value);
    render();
  });
}

function parseCsv(text) {
  const rows = text.trim().split(/\r?\n/).map((line) => parseCsvLine(line));
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().trim());
  const dateIndex = headers.findIndex((header) => ["date", "trade date", "day"].includes(header));
  const pnlIndex = headers.findIndex((header) => ["pnl", "p&l", "profit", "profit/loss", "net pnl", "realized pnl"].includes(header));
  if (dateIndex < 0 || pnlIndex < 0) return [];

  const daily = new Map();
  rows.slice(1).forEach((row) => {
    const date = normalizeDate(row[dateIndex]);
    const amount = Number(String(row[pnlIndex]).replace(/[₹,\s]/g, ""));
    if (!date || !Number.isFinite(amount)) return;
    daily.set(date, (daily.get(date) || 0) + amount);
  });
  return [...daily.entries()].map(([date, amount]) => ({
    id: crypto.randomUUID(),
    date,
    type: "pnl",
    amount,
    notes: "Imported from broker CSV",
  }));
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function normalizeDate(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (parts) {
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return `${year}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (value === "Start") return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function colorWithAlpha(color, alpha) {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const bigint = parseInt(hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex, 16);
    const red = (bigint >> 16) & 255;
    const green = (bigint >> 8) & 255;
    const blue = bigint & 255;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
  return color;
}

["startingCapital", "targetCapital"].forEach((key) => bindPlannerInput(key));

els.themeOptions.forEach((button) => {
  button.addEventListener("click", () => {
    themePreference = button.dataset.themeOption;
    localStorage.setItem(THEME_KEY, themePreference);
    applyTheme();
    render();
  });
});

systemTheme.addEventListener("change", () => {
  if (themePreference !== "system") return;
  applyTheme();
  render();
});

els.entryForm.addEventListener("submit", upsertEntry);
els.cancelEdit.addEventListener("click", resetEntryForm);
els.ledgerBody.addEventListener("click", handleLedgerClick);
els.allocationCards.addEventListener("change", (event) => {
  const input = event.target.closest("input[data-allocation-target]");
  if (!input) return;
  state.allocationTargets[input.dataset.allocationTarget] = Number(input.value) || 0;
  render();
});
els.csvInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const imported = parseCsv(await file.text());
  state.entries.push(...imported);
  event.target.value = "";
  render();
});

applyTheme();
hydrateInputs();
render();
