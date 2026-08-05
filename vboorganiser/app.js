const API_BASE = "https://app.vbo.co.in";
const state = {
  view: "today",
  goals: [],
  today: { goal_units: [], schedule: [], notes: [], count: 0 },
  schedule: [],
  notes: [],
  selectedTitles: new Set(),
  pendingTitles: new Set(),
  filterSearch: "",
  visibleFilterKeys: [],
  pendingConfirm: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const icons = {
  add: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h10v12H8z"/><path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function showAlert(message, isError = false) {
  const alert = $("#alert");
  alert.textContent = message;
  alert.classList.toggle("danger", isError);
  alert.classList.remove("hidden");
  window.setTimeout(() => alert.classList.add("hidden"), 4500);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Request failed: ${response.status}`);
  }
  return body;
}

function emptyHtml() {
  return $("#emptyTemplate").innerHTML;
}

function keyFor(type, id) {
  return `${type}:${id}`;
}

function itemFilterKey(type, item) {
  if (type === "goal-unit") return keyFor("goal", item.goal_id);
  return keyFor(type, item.id);
}

function matchesFilter(type, item) {
  if (!state.selectedTitles.size) return true;
  return state.selectedTitles.has(itemFilterKey(type, item));
}

function resetFilter() {
  state.selectedTitles.clear();
  state.pendingTitles.clear();
  state.filterSearch = "";
  const search = $("#filterSearch");
  if (search) search.value = "";
  const menu = $("#filterMenu");
  if (menu) menu.classList.add("hidden");
}

function todayDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function parseDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function isOverdue(value) {
  const due = parseDate(value);
  return Boolean(due && due < todayDate());
}

function dayDifference(value) {
  const due = parseDate(value);
  if (!due) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((todayDate() - due) / msPerDay);
}

function highlightClass(value, options = {}) {
  const diff = dayDifference(value);
  if (diff === null) return "";
  if (diff < 0) return options.futureClass || "";
  if (diff === 0) return "due-green";
  if (diff >= 3) return "late-red";
  return "late-yellow";
}

function statsFor(items, dueKey = "due_date") {
  return {
    total: items.length,
    pending: items.length,
    overdue: items.filter((item) => isOverdue(item[dueKey] || item.first_due || item.due_date)).length
  };
}

function goalStats(goals) {
  const pending = goals.filter((goal) => Number(goal.progress_json?.remaining_units || 0) > 0);
  return {
    total: goals.length,
    pending: pending.length,
    overdue: pending.filter((goal) => isOverdue(goal.progress_json?.current_due)).length
  };
}

function recordMeta(items) {
  return `<div class="meta-row">${items.filter(Boolean).map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`;
}

function actionButtons(buttons) {
  return `<div class="action-row">${buttons.join("")}</div>`;
}

function renderActions(type, id, canDelete = true, unitNumber = "") {
  const unit = unitNumber ? ` data-unit="${unitNumber}"` : "";
  const deleteButton = canDelete ? `<button class="delete-btn" data-action="delete" data-type="${type}" data-id="${id}" type="button" aria-label="Delete" title="Delete">${icons.remove}</button>` : "";
  return actionButtons([
    `<button class="edit-btn" data-action="edit" data-type="${type}" data-id="${id}"${unit} type="button" aria-label="Edit" title="Edit">${icons.edit}</button>`,
    `<button class="done-btn" data-action="done" data-type="${type}" data-id="${id}"${unit} type="button" aria-label="Done" title="Done">${icons.check}</button>`,
    deleteButton
  ]);
}

function renderUnitDetails(units = [], currentUnit = null, goalId = "") {
  if (!units.length) return "";
  const rows = units.map((unit) => `
    <div class="unit-row ${unit.status === "completed" ? "done" : ""} ${unit.unit_number === currentUnit ? "current" : ""}">
      <strong>Day ${escapeHtml(unit.unit_number)}: ${escapeHtml(unit.title)}</strong>
      ${recordMeta([unit.status === "completed" ? "Done" : "Pending", unit.due_date && `Due ${unit.due_date}`])}
      ${actionButtons([`<button class="edit-btn" data-action="edit" data-type="goal-unit" data-id="${goalId}" data-unit="${unit.unit_number}" type="button" aria-label="Edit day" title="Edit day">${icons.edit}</button>`])}
    </div>
  `).join("");
  return `<details class="detail-box"><summary>Show all days</summary><div class="unit-list">${rows}</div></details>`;
}

function progressPercent(goal) {
  return Number(goal.progress_json?.completion_percent || 0);
}

function renderGoal(goal) {
  const percent = progressPercent(goal);
  const units = goal.units || goal.goal_json?.units || [];
  const statusClass = highlightClass(goal.progress_json?.current_due, { futureClass: "future-gray" });
  return `
    <article class="record ${statusClass}">
      <div class="record-head">
        <div>
          <h3>${escapeHtml(goal.title)}</h3>
          <p>${escapeHtml(goal.progress_json?.remaining_units || 0)} days pending</p>
        </div>
        <span class="pill">${percent}%</span>
      </div>
      <div class="progress-bar" aria-hidden="true"><span style="width:${percent}%"></span></div>
      ${recordMeta([goal.deadline && `Last due ${goal.deadline}`, `${units.length} days`])}
      ${renderUnitDetails(units, goal.progress_json?.current_unit, goal.id)}
      ${actionButtons([
        `<button class="edit-btn" data-action="edit" data-type="goal" data-id="${goal.id}" type="button" aria-label="Edit" title="Edit">${icons.edit}</button>`,
        `<button class="delete-btn" data-action="delete" data-type="goal" data-id="${goal.id}" type="button" aria-label="Delete" title="Delete">${icons.remove}</button>`
      ])}
    </article>
  `;
}

function renderTodayUnit(unit) {
  const actions = (unit.actions || []).map((action) => `<p>${escapeHtml(action)}</p>`).join("");
  const statusClass = highlightClass(unit.due_date, { futureClass: "future-gray" });
  return `
    <article class="record ${statusClass}">
      <h3>${escapeHtml(unit.goal_title)}: ${escapeHtml(unit.title)}</h3>
      ${actions || "<p>No action details yet.</p>"}
      ${recordMeta([`Day ${unit.unit_number}`, unit.due_date && `Due ${unit.due_date}`, unit.days_late ? `${unit.days_late} day delay` : "On time"])}
      ${renderUnitDetails(unit.all_units || [], unit.unit_number, unit.goal_id)}
      ${renderActions("goal-unit", unit.goal_id, false, unit.unit_number)}
    </article>
  `;
}

function renderScheduleItem(item, includeActions = false) {
  const dueDate = item.first_due || item.due_date;
  const statusClass = highlightClass(dueDate);
  return `
    <article class="record ${statusClass}">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description || "No description added.")}</p>
      ${recordMeta([item.repeat_type, (item.first_due || item.due_date) && `First due ${item.first_due || item.due_date}`, item.days_late ? `${item.days_late} day delay` : ""])}
      ${includeActions ? renderActions("schedule", item.id) : renderActions("schedule", item.id)}
    </article>
  `;
}

function renderNote(note, includeActions = false) {
  const statusClass = highlightClass(note.due_date);
  return `
    <article class="record ${statusClass}">
      <h3>${escapeHtml(note.title)}</h3>
      <p>${escapeHtml(note.note).slice(0, 380)}</p>
      ${recordMeta([note.due_date && `Due ${note.due_date}`])}
      ${includeActions ? renderActions("note", note.id) : renderActions("note", note.id)}
    </article>
  `;
}

function setHtml(selector, html) {
  $(selector).innerHTML = html || emptyHtml();
}

function render() {
  const goals = state.goals.filter((item) => matchesFilter("goal", item));
  const schedule = state.schedule.filter((item) => matchesFilter("schedule", item));
  const notes = state.notes.filter((item) => matchesFilter("note", item));
  const todayGoals = state.today.goal_units.filter((item) => matchesFilter("goal-unit", item));
  const todaySchedule = state.today.schedule.filter((item) => matchesFilter("schedule", item));
  const todayNotes = state.today.notes.filter((item) => matchesFilter("note", item));
  const goalStat = goalStats(state.goals);
  const noteStat = statsFor(state.notes, "due_date");
  const scheduleStat = statsFor(state.schedule, "first_due");
  $("#noteTotal").textContent = noteStat.total;
  $("#notePending").textContent = noteStat.pending;
  $("#noteOverdue").textContent = noteStat.overdue;
  $("#scheduleTotal").textContent = scheduleStat.total;
  $("#schedulePending").textContent = scheduleStat.pending;
  $("#scheduleOverdue").textContent = scheduleStat.overdue;
  $("#goalTotal").textContent = goalStat.total;
  $("#goalPending").textContent = goalStat.pending;
  $("#goalOverdue").textContent = goalStat.overdue;

  setHtml("#goalsList", goals.map(renderGoal).join(""));
  setHtml("#todayGoals", todayGoals.map(renderTodayUnit).join(""));
  setHtml("#todaySchedule", todaySchedule.map((item) => renderScheduleItem(item, true)).join(""));
  setHtml("#todayNotes", todayNotes.map((item) => renderNote(item, true)).join(""));
  setHtml("#scheduleList", schedule.map((item) => renderScheduleItem(item, false)).join(""));
  setHtml("#notesList", notes.map((item) => renderNote(item, false)).join(""));
  renderFilterOptions();
}

function setView(view) {
  resetFilter();
  state.view = view;
  $$(".view").forEach((item) => item.classList.toggle("active", item.id === view));
  $("#viewTitle").textContent = "VBO Organiser";
  $("#homeBtn").classList.toggle("hidden", view === "today");
  $(".filter-wrap").classList.toggle("hidden", view === "today");
  renderFilterOptions();
  window.scrollTo({ top: 0, behavior: "smooth" });
  render();
}

async function loadAll() {
  const [goals, today, schedule, notes] = await Promise.all([
    api("/organiser/goals"),
    api("/organiser/today"),
    api("/organiser/schedule"),
    api("/organiser/notes")
  ]);
  state.goals = goals.items || [];
  state.today = { goal_units: [], schedule: [], notes: [], count: 0, ...today };
  state.schedule = schedule.items || [];
  state.notes = notes.items || [];
  render();
}

function allTitleOptions() {
  const optionGroups = {
    today: [
      ...state.notes.map((item) => ({ key: keyFor("note", item.id), type: "Note", title: item.title })),
      ...state.schedule.map((item) => ({ key: keyFor("schedule", item.id), type: "Schedule", title: item.title })),
      ...state.goals.map((item) => ({ key: keyFor("goal", item.id), type: "Goal", title: item.title }))
    ],
    notes: state.notes.map((item) => ({ key: keyFor("note", item.id), type: "Note", title: item.title })),
    schedule: state.schedule.map((item) => ({ key: keyFor("schedule", item.id), type: "Schedule", title: item.title })),
    goals: state.goals.map((item) => ({ key: keyFor("goal", item.id), type: "Goal", title: item.title }))
  };
  return (optionGroups[state.view] || optionGroups.today).sort((a, b) => a.title.localeCompare(b.title));
}

function renderFilterOptions() {
  const filterOptions = $("#filterOptions");
  if (!filterOptions) return;
  const query = state.filterSearch.trim().toLowerCase();
  const options = allTitleOptions().filter((item) => !query || `${item.type} ${item.title}`.toLowerCase().includes(query));
  state.visibleFilterKeys = options.map((item) => item.key);
  filterOptions.innerHTML = options.length ? options.map((item) => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeHtml(item.key)}" ${state.pendingTitles.has(item.key) ? "checked" : ""}>
      <span>${escapeHtml(item.title)} <small>${escapeHtml(item.type)}</small></span>
    </label>
  `).join("") : `<div class="empty-state">No matching titles.</div>`;
  const count = state.selectedTitles.size;
  $("#filterToggle").textContent = count ? `${count} filter${count > 1 ? "s" : ""} applied` : `Filter ${state.view}`;
}

function formJson(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") payload[key] = null;
  });
  return payload;
}

function textToLines(value) {
  return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
}

function linesToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function sectionText(title, lines) {
  const values = Array.isArray(lines) ? lines : [];
  return `${title}\n${values.join("\n")}`.trim();
}

function goalToFeed(goal) {
  const goalJson = goal?.goal_json || {};
  const units = goalJson.units || [];
  const parts = [
    "GOAL",
    goal?.title || goalJson.title || "",
    "",
    "GOAL DEADLINE",
    goalJson.source_deadline || `${units.length} Days`
  ];

  units.forEach((unit) => {
    parts.push(
      "",
      "==================================================",
      `DAY ${unit.unit_number || ""} - ${unit.title || ""}`.trim(),
      sectionText("OBJECTIVE", unit.objective),
      "",
      sectionText("ACTIONS", unit.actions),
      "",
      sectionText("COMPLETION CRITERIA", unit.completion_criteria)
    );
  });

  return parts.join("\n").trim();
}

function findById(items, id) {
  return items.find((item) => String(item.id) === String(id));
}

function findGoalUnit(goalId, unitNumber) {
  const goal = findById(state.goals, goalId);
  const unit = (goal?.units || goal?.goal_json?.units || []).find((item) => String(item.unit_number) === String(unitNumber));
  return { goal, unit };
}

function openModal(type) {
  const titles = { goal: "Add Goal", schedule: "Add Schedule", note: "Add Note" };
  const forms = {
    goal: `
      <input type="hidden" name="type" value="goal">
      <label>Title<input name="title" required maxlength="200"></label>
      <label>Goal Feed<textarea name="goal_feed" rows="14" required></textarea></label>
      <button type="submit">Import Goal</button>
    `,
    schedule: `
      <input type="hidden" name="type" value="schedule">
      <label>Title<input name="title" required maxlength="200"></label>
      <label>Description<textarea name="description" rows="5"></textarea></label>
      <div class="form-row">
        <label>Repeat<select name="repeat_type"><option>none</option><option>daily</option><option>weekly</option><option>monthly</option></select></label>
        <label>First Due<input name="first_due" type="date" required></label>
      </div>
      <button type="submit">Add Schedule</button>
    `,
    note: `
      <input type="hidden" name="type" value="note">
      <label>Title<input name="title" required maxlength="200"></label>
      <label>Due Date<input name="due_date" type="date" required></label>
      <label>Note<textarea name="note" rows="10" required></textarea></label>
      <button type="submit">Save Note</button>
    `
  };
  $("#modalTitle").textContent = titles[type];
  $("#modalForm").innerHTML = forms[type];
  $("#modalBackdrop").classList.remove("hidden");
}

function openEditModal(type, id, unitNumber = "") {
  const titles = { goal: "Edit Goal", "goal-unit": "Edit Day", schedule: "Edit Schedule", note: "Edit Note" };
  let formHtml = "";

  if (type === "goal") {
    const goal = findById(state.goals, id);
    formHtml = `
      <input type="hidden" name="mode" value="edit">
      <input type="hidden" name="type" value="goal">
      <input type="hidden" name="id" value="${escapeHtml(id)}">
      <label>Title<input name="title" required maxlength="200" value="${escapeHtml(goal?.title || "")}"></label>
      <label>Goal Feed<textarea name="goal_feed" rows="14">${escapeHtml(goalToFeed(goal))}</textarea></label>
      <button type="submit">Update Goal</button>
    `;
  }

  if (type === "goal-unit") {
    const { unit } = findGoalUnit(id, unitNumber);
    formHtml = `
      <input type="hidden" name="mode" value="edit">
      <input type="hidden" name="type" value="goal-unit">
      <input type="hidden" name="id" value="${escapeHtml(id)}">
      <input type="hidden" name="unit" value="${escapeHtml(unitNumber)}">
      <label>Title<input name="title" required maxlength="200" value="${escapeHtml(unit?.title || "")}"></label>
      <label>Objective<textarea name="objective" rows="4">${escapeHtml(linesToText(unit?.objective))}</textarea></label>
      <label>Actions<textarea name="actions" rows="8">${escapeHtml(linesToText(unit?.actions))}</textarea></label>
      <label>Completion Criteria<textarea name="completion_criteria" rows="5">${escapeHtml(linesToText(unit?.completion_criteria))}</textarea></label>
      <button type="submit">Update Day</button>
    `;
  }

  if (type === "schedule") {
    const item = findById(state.schedule, id) || findById(state.today.schedule, id);
    formHtml = `
      <input type="hidden" name="mode" value="edit">
      <input type="hidden" name="type" value="schedule">
      <input type="hidden" name="id" value="${escapeHtml(id)}">
      <label>Title<input name="title" required maxlength="200" value="${escapeHtml(item?.title || "")}"></label>
      <label>Description<textarea name="description" rows="5">${escapeHtml(item?.description || "")}</textarea></label>
      <div class="form-row">
        <label>Repeat<select name="repeat_type">
          ${["none", "daily", "weekly", "monthly"].map((option) => `<option ${item?.repeat_type === option ? "selected" : ""}>${option}</option>`).join("")}
        </select></label>
        <label>First Due<input name="first_due" type="date" required value="${escapeHtml(item?.first_due || item?.due_date || "")}"></label>
      </div>
      <button type="submit">Update Schedule</button>
    `;
  }

  if (type === "note") {
    const item = findById(state.notes, id) || findById(state.today.notes, id);
    formHtml = `
      <input type="hidden" name="mode" value="edit">
      <input type="hidden" name="type" value="note">
      <input type="hidden" name="id" value="${escapeHtml(id)}">
      <label>Title<input name="title" required maxlength="200" value="${escapeHtml(item?.title || "")}"></label>
      <label>Due Date<input name="due_date" type="date" required value="${escapeHtml(item?.due_date || "")}"></label>
      <label>Note<textarea name="note" rows="10" required>${escapeHtml(item?.note || "")}</textarea></label>
      <button type="submit">Update Note</button>
    `;
  }

  $("#modalTitle").textContent = titles[type] || "Edit";
  $("#modalForm").innerHTML = formHtml;
  $("#modalBackdrop").classList.remove("hidden");
}

function closeModal() {
  $("#modalBackdrop").classList.add("hidden");
  $("#modalForm").innerHTML = "";
}

async function readGoalPrompt() {
  const response = await fetch("prompt.txt", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load goal prompt.");
  }
  return response.text();
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.style.position = "fixed";
  helper.style.opacity = "0";
  document.body.appendChild(helper);
  helper.select();
  document.execCommand("copy");
  helper.remove();
}

async function openGoalPromptModal() {
  $("#modalTitle").textContent = "Goal prompt";
  $("#modalForm").innerHTML = `
    <div class="prompt-tools">
      <button id="copyPromptBtn" class="prompt-btn" type="button" title="Copy prompt">${icons.copy}</button>
    </div>
    <label>Prompt<textarea id="promptText" class="prompt-textarea" rows="20">Loading prompt...</textarea></label>
  `;
  $("#modalBackdrop").classList.remove("hidden");
  try {
    $("#promptText").value = await readGoalPrompt();
  } catch (error) {
    $("#promptText").value = error.message;
  }
}

function openPromptGuideModal() {
  $("#modalTitle").textContent = "Goal prompt guide";
  $("#modalForm").innerHTML = `
    <ol class="guide-list">
      <li>Copy prompt.</li>
      <li>Paste in any AI chat bot like ChatGPT, Grok or DeepSeek, and add your goal in bottom.</li>
      <li>Give additional info if chat bot asks.</li>
      <li>Copy chat bot output and paste in new goal created in VBO Organiser.</li>
    </ol>
  `;
  $("#modalBackdrop").classList.remove("hidden");
}

function confirmAction(title, text) {
  $("#confirmTitle").textContent = title;
  $("#confirmText").textContent = text;
  $("#confirmBackdrop").classList.remove("hidden");
  return new Promise((resolve) => {
    state.pendingConfirm = resolve;
  });
}

function closeConfirm(result) {
  $("#confirmBackdrop").classList.add("hidden");
  if (state.pendingConfirm) {
    state.pendingConfirm(result);
    state.pendingConfirm = null;
  }
}

async function submitModal(event) {
  event.preventDefault();
  const form = event.target;
  const payload = formJson(form);
  const type = payload.type;
  const mode = payload.mode || "create";
  const id = payload.id;
  const unit = payload.unit;
  delete payload.mode;
  delete payload.type;
  delete payload.id;
  delete payload.unit;
  const paths = { goal: "/organiser/goals", schedule: "/organiser/schedule", note: "/organiser/notes" };
  try {
    if (mode === "edit") {
      if (type === "goal-unit") {
        payload.objective = textToLines(payload.objective);
        payload.actions = textToLines(payload.actions);
        payload.completion_criteria = textToLines(payload.completion_criteria);
        await api(`/organiser/goals/${id}/units/${unit}`, { method: "PUT", body: JSON.stringify(payload) });
      } else if (type === "goal") {
        await api(`/organiser/goals/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api(`${paths[type]}/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
    } else {
      await api(paths[type], { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    await loadAll();
    showAlert(mode === "edit" ? "Updated." : "Saved.");
  } catch (error) {
    showAlert(error.message, true);
  }
}

async function handleRecordAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, type, id, unit } = button.dataset;
  if (action === "edit") {
    openEditModal(type, id, unit);
    return;
  }
  const pathMap = {
    "goal-unit": `/organiser/goals/${id}/units/${unit}/done`,
    schedule: `/organiser/schedule/${id}/done`,
    note: `/organiser/notes/${id}/done`,
    goal: `/organiser/goals/${id}`
  };
  const deletePathMap = {
    goal: `/organiser/goals/${id}`,
    schedule: `/organiser/schedule/${id}`,
    note: `/organiser/notes/${id}`
  };
  try {
    if (action === "done") {
      const confirmed = await confirmAction("Mark as done?", "Are you sure its done?");
      if (!confirmed) return;
      await api(pathMap[type], { method: "PUT" });
    }
    if (action === "delete") {
      const confirmed = await confirmAction("Delete this item?", "Are you sure to remove this point ?");
      if (!confirmed) return;
      await api(deletePathMap[type], { method: "DELETE" });
    }
    await loadAll();
  } catch (error) {
    showAlert(error.message, true);
  }
}

function defaultCreateType() {
  if (state.view === "schedule") return "schedule";
  if (state.view === "notes") return "note";
  return "goal";
}

function wireEvents() {
  $$("[data-view-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewJump)));
  $$("[data-create]").forEach((button) => button.addEventListener("click", () => openModal(button.dataset.create)));
  $("#goalPromptBtn").addEventListener("click", openGoalPromptModal);
  $("#promptGuideBtn").addEventListener("click", openPromptGuideModal);
  $("#homeBtn").addEventListener("click", () => setView("today"));
  $("#closeModal").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "modalBackdrop") closeModal();
  });
  $("#confirmYes").addEventListener("click", () => closeConfirm(true));
  $("#confirmNo").addEventListener("click", () => closeConfirm(false));
  $("#confirmBackdrop").addEventListener("click", (event) => {
    if (event.target.id === "confirmBackdrop") closeConfirm(false);
  });
  $("#modalForm").addEventListener("submit", submitModal);
  $("#modalForm").addEventListener("click", async (event) => {
    if (event.target.closest("#copyPromptBtn")) {
      await copyText($("#promptText").value);
      showAlert("Prompt copied.");
    }
  });
  $(".workspace").addEventListener("click", handleRecordAction);
  $("#filterToggle").addEventListener("click", () => {
    state.pendingTitles = new Set(state.selectedTitles);
    state.filterSearch = "";
    $("#filterSearch").value = "";
    renderFilterOptions();
    $("#filterMenu").classList.toggle("hidden");
    $("#filterSearch").focus();
  });
  $("#filterSearch").addEventListener("input", (event) => {
    state.filterSearch = event.target.value;
    renderFilterOptions();
  });
  $("#filterOptions").addEventListener("change", (event) => {
    const checkbox = event.target.closest("input[type='checkbox']");
    if (!checkbox) return;
    if (checkbox.checked) {
      state.pendingTitles.add(checkbox.value);
    } else {
      state.pendingTitles.delete(checkbox.value);
    }
  });
  $("#applyFilter").addEventListener("click", () => {
    state.selectedTitles = new Set(state.pendingTitles);
    $("#filterMenu").classList.add("hidden");
    render();
  });
  $("#selectAllFilter").addEventListener("click", () => {
    state.visibleFilterKeys.forEach((key) => state.pendingTitles.add(key));
    renderFilterOptions();
  });
  $("#clearFilter").addEventListener("click", () => {
    resetFilter();
    render();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter-wrap")) {
      $("#filterMenu").classList.add("hidden");
    }
  });
}

wireEvents();
loadAll().catch((error) => showAlert(error.message, true));
