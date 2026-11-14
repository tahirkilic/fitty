import { APP_VERSION, SHELL_CACHE } from "./domain/app-version.js";
import { Training } from "./application/training.js";
import { CleverFitMigration } from "./application/clever-fit-migration.js";
import { parseCleverFit } from "./infrastructure/clever-fit.js";
import { sessionDay } from "./domain/clever-fit.js";
import {
  LocalRepository,
  encodeBackup,
  decodeBackup,
} from "./infrastructure/storage.js";
import { ViewModel } from "./presentation/view-model.js";
import { BrowserAppUpdates } from "./infrastructure/app-updates.js";
import { AppUpdateViewModel } from "./presentation/app-update-view-model.js";

const clock = { now: () => Date.now(), iso: () => new Date().toISOString() };
const root = document.getElementById("app");
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const date = (value) => {
  const day = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`
    : "Unknown date";
};
const results = (set, kind) =>
  kind === "cardio" || kind === "isometric"
    ? `${set.durationSeconds === null || set.durationSeconds === undefined ? "—" : minutes(set.durationSeconds)} min`
    : `${set.weight ?? "—"} kg × ${set.reps ?? "—"}`;
const minutes = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
let vm,
  app,
  migration,
  updates,
  offlineReady = false;
try {
  app = new Training(new LocalRepository(localStorage), clock, () =>
    crypto.randomUUID(),
  );
  vm = new ViewModel(app, clock);
  migration = new CleverFitMigration(app);
} catch (error) {
  root.innerHTML = `<main class="splash"><h1>Unable to open your data</h1><p>${escape(error.message)}</p><p>Existing storage has been kept. Do not clear website data. Export the raw data below for recovery.</p><button id="recover">Download recovery file</button></main>`;
  document.getElementById("recover").onclick = () =>
    download(
      localStorage.getItem("fitty.fitness.v1") || "{}",
      "fitty-recovery.json",
    );
}
const button = (text, action, arg = "", cls = "") =>
  `<button class="${cls}" data-action="${action}" data-arg="${escape(arg)}">${text}</button>`;
function download(content, name) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function exportData() {
  download(
    encodeBackup(vm.data, clock.iso()),
    `fitty-backup-${clock.iso().slice(0, 10)}.json`,
  );
}
function heading(title, description, action = "") {
  return `<div class="intro"><div><p class="eyebrow muted">YOUR TRAINING NOTEBOOK</p><h1 style="margin-top:9px">${title}</h1><p class="muted">${description}</p></div>${action}</div>`;
}
function home() {
  const d = vm.data,
    next = vm.next;
  return (
    heading(
      "A little stronger.<br>Every session.",
      "Your plans, your pace. Pick up where you left off.",
    ) +
    `<div class="grid"><div><section class="card hero"><div><p class="eyebrow">${d.active ? "WORKOUT IN PROGRESS" : "UP NEXT IN YOUR ROTATION"}</p><h2>${escape(d.active?.name || next?.name || "Make room for progress.")}</h2><p class="muted">${d.active ? "Your work is saved on this device." : next ? `${next.items.length} exercises · ${next.rest}s rest · At your own pace` : "Build your first plan to get started."}</p></div><div style="margin-top:30px">${d.active ? button("Resume workout ↗", "resume", "", "primary") : next ? button("Start workout ↗", "start", next.id, "primary") : button("Create your first plan ↗", "new-plan", "", "primary")}</div></section><section class="card"><div class="row between"><h3>Your rotation</h3>${button("Manage", "tab", "plans", "small ghost")}</div>${
      d.rotation.length
        ? d.rotation
            .map((id, index) => {
              const p = d.plans.find((p) => p.id === id);
              return `<div class="list-row"><span class="num">${String(index + 1).padStart(2, "0")}</span><div class="grow"><strong>${escape(p.name)}</strong><p class="muted">${p.items.length} exercises</p></div>${index === d.next ? '<span class="badge">Next visit</span>' : ""}</div>`;
            })
            .join("")
        : '<p class="empty">Your plans will appear here in visit order.</p>'
    }</section></div><div><div class="two"><section class="card"><p class="eyebrow muted">SESSIONS</p><p class="stat">${d.sessions.length}</p><p class="muted">All time</p></section><section class="card"><p class="eyebrow muted">PLANS</p><p class="stat">${d.plans.filter((p) => !p.archived).length}</p><p class="muted">Ready to train</p></section></div><section class="card"><p class="eyebrow muted">LAST TIME HERE</p>${
      d.sessions.length
        ? `<h3 style="margin-top:18px">${escape([...d.sessions].sort((a, b) => sessionDay(a).localeCompare(sessionDay(b))).at(-1).name)}</h3><p class="muted" style="margin:8px 0 20px">${date(sessionDay([...d.sessions].sort((a, b) => sessionDay(a).localeCompare(sessionDay(b))).at(-1)))} · ${[
            ...d.sessions,
          ]
            .sort((a, b) => sessionDay(a).localeCompare(sessionDay(b)))
            .at(-1)
            .items.reduce(
              (n, i) => n + i.sets.filter((s) => s.done).length,
              0,
            )} sets completed</p>${button("View training history →", "tab", "history", "ghost")}`
        : '<p class="empty">The first session is the start of your story.</p>'
    }</section><p class="muted" style="padding:0 10px">↳ Built for the gym. Saved on this device.<br>Export a backup regularly to keep your progress safe.</p><p class="muted app-version" aria-label="App version">Fitty · Version ${APP_VERSION}</p></div></div>`
  );
}
function catalog() {
  return (
    heading(
      "Your equipment.",
      "One record per machine. Shared across all your plans.",
      button("+ Add exercise", "exercise", "", "dark"),
    ) +
    `<section class="card">${vm.data.exercises.map((e) => `<div class="list-row"><span class="num">${escape(e.number || "↗")}</span><div class="grow"><h3>${escape(e.name)}</h3>${e.archived ? '<p class="muted">Archived</p>' : ""}</div>${button("Edit", "exercise", e.id, "small ghost")}</div>`).join("") || '<p class="empty">Add your first exercise or machine. Give similar machines different numbers.</p>'}</section>`
  );
}
function plans() {
  const d = vm.data;
  return (
    heading(
      "A plan for each visit.",
      "Rotate in visit order, with room to adapt on the day.",
      button("+ New plan", "new-plan", "", "dark"),
    ) +
    d.plans
      .filter((p) => !p.archived)
      .map(
        (p) =>
          `<section class="card"><div class="row between"><div><span class="eyebrow muted">${p.rest}s REST · VERSION ${p.version}</span><h2 style="margin-top:8px">${escape(p.name)}</h2></div>${button("Start ↗", "start", p.id, "primary")}</div><p class="muted" style="margin:14px 0">${p.items.map((i) => escape(i.name)).join(" · ") || "No exercises yet"}</p><div class="row wrap">${button("Edit plan", "edit-plan", p.id, "ghost")}${button("Duplicate", "duplicate", p.id, "ghost")}${button("Archive", "archive-plan", p.id, "ghost")}</div></section>`,
      )
      .join("") +
    `<section class="card"><h3>Rotation order</h3><p class="muted" style="margin:8px 0">Completed visits advance the rotation. Discarded visits do not.</p>${d.rotation.map((id) => `<div class="list-row"><div class="grow">${escape(d.plans.find((p) => p.id === id).name)}</div>${button("↑", "rotation-up", id, "small ghost")}${button("Remove", "rotation-remove", id, "small ghost")}</div>`).join("")}<label for="rotation-add">Add a plan to the rotation</label><select id="rotation-add" data-action="rotation-add"><option value="">Choose a plan…</option>${d.plans
      .filter((p) => !p.archived && !d.rotation.includes(p.id))
      .map((p) => `<option value="${p.id}">${escape(p.name)}</option>`)
      .join("")}</select></section>`
  );
}
function setRows(item, editor = false) {
  const timed = item.kind === "cardio" || item.kind === "isometric";
  return (
    `<div class="set-grid header"><span>SET</span><span>${timed ? "SECONDS" : "KG"}</span><span>${timed ? "" : "REPS"}</span><span>${editor ? "" : "DONE"}</span><span></span></div>` +
    item.sets
      .map((set, index) => {
        const field = editor ? "plan" : "actual";
        const input = (key, type, value, step, label) =>
          `<input aria-label="${escape(item.name)} set ${index + 1} ${label}" type="number" inputmode="${type}" min="0" step="${step}" value="${value ?? ""}" data-field="${field}" data-id="${item.id}" data-index="${index}" data-key="${key}">`;
        const measurements = timed
          ? input(
              "durationSeconds",
              "numeric",
              set.durationSeconds,
              1,
              "duration seconds",
            ) + "<span></span>"
          : input("weight", "decimal", set.weight, 0.1, "weight") +
            input("reps", "numeric", set.reps, 1, "repetitions");
        const action = editor
          ? "<span></span>"
          : button(
              set.done ? "✓" : "○",
              "complete",
              `${item.id}|${index}`,
              set.done ? "done" : "ghost",
            );
        const previous = !editor
          ? `<p class="muted" style="font-size:11px;margin:5px 0 0 32px">Target ${results(set.target, item.kind)} · ${set.previous ? `Previous: ${date(set.previous)}` : "Plan defaults"}</p>`
          : "";
        return `<div class="set-grid ${set.done ? "done-row" : ""}"><span class="muted">${index + 1}</span>${measurements}${action}${button("×", editor ? "plan-remove-set" : "remove-set", `${item.id}|${index}`, "ghost")}</div>${previous}`;
      })
      .join("")
  );
}
function workout() {
  const s = vm.data.active;
  if (!s)
    return (
      heading("Ready when you are.", "Start a plan to begin logging.") +
      button("Choose a plan", "tab", "plans", "dark")
    );
  return (
    heading(
      escape(s.name),
      "Session changes stay here until you approve plan updates.",
      button("Finish", "review", "", "dark"),
    ) +
    `<div class="timer row between"><div><span class="eyebrow">REST TIMER</span><br><strong id="rest-value">${minutes(vm.rest)}</strong></div><div class="row">${button("Restart", "timer", "restart", "ghost")}${button("Skip", "timer", "skip", "ghost")}</div></div>` +
    s.items
      .map(
        (item, index) =>
          `<details class="card workout-exercise" id="item-${item.id}" data-exercise-id="${escape(item.id)}" ${vm.isExerciseOpen(item.id) ? "open" : ""}><summary class="row exercise-head"><span class="num">${String(index + 1).padStart(2, "0")}</span><div class="grow"><h3>${escape(item.name)}</h3><p class="muted">Machine ${escape(item.number || "—")} ${item.skipped ? "· Skipped today" : ""}</p><p class="muted">${item.sets.filter((set) => set.done).length} of ${item.sets.length} sets completed</p></div><span class="exercise-chevron" aria-hidden="true"></span></summary><div class="exercise-body">${setRows(item)}<div class="row wrap" style="margin-top:18px">${button(item.skipped ? "Return" : "Skip", "skip", item.id, "ghost")}${button("+ Set", "add-set", item.id, "ghost")}${button("↑", "move-up", item.id, "ghost")}${button("Defer ↓", "defer", item.id, "ghost")}${button("Remove", "remove-exercise", item.id, "ghost")}</div></div></details>`,
      )
      .join("") +
    `<section class="card"><label for="session-add">Add an exercise for today</label><select id="session-add" data-action="session-add"><option value="">Choose a machine…</option>${exerciseOptions()}</select></section><div class="row between">${button("Discard workout", "discard", "", "danger")}${button("Review & finish →", "review", "", "dark")}</div>`
  );
}
function exerciseOptions() {
  return vm.data.exercises
    .filter((e) => !e.archived)
    .map(
      (e) =>
        `<option value="${e.id}">${escape(e.name)} ${e.number ? "· #" + escape(e.number) : ""}</option>`,
    )
    .join("");
}
function historySets(item) {
  const timed = item.kind === "cardio" || item.kind === "isometric";
  return `<table class="history-sets"><caption class="sr">${escape(item.name)} set results</caption><thead><tr><th scope="col">Set</th>${timed ? '<th scope="col">Duration</th>' : '<th scope="col">Weight</th><th scope="col">Reps</th>'}<th scope="col">Status</th></tr></thead><tbody>${item.sets
    .map(
      (set, index) =>
        `<tr><th scope="row">${index + 1}</th>${timed ? `<td>${set.durationSeconds == null ? "—" : minutes(set.durationSeconds) + " min"}</td>` : `<td>${set.weight == null ? "—" : escape(set.weight) + " kg"}</td><td>${escape(set.reps ?? "—")}</td>`}<td class="${set.done ? "history-completed" : "history-unfinished"}">${set.done ? "✓ Completed" : "Unfinished"}</td></tr>`,
    )
    .join("")}</tbody></table>`;
}
function historyExercise(item) {
  return `<section class="history-exercise"><h3>${escape(item.name)}${item.number ? ` · #${escape(item.number)}` : ""}</h3>${item.skipped ? '<p class="history-unfinished">Skipped</p>' : ""}${historySets(item)}</section>`;
}
function history() {
  return (
    heading(
      "The work adds up.",
      "Your history stays as it was, even when your plans change.",
    ) +
    vm.data.sessions
      .slice()
      .sort((a, b) => sessionDay(b).localeCompare(sessionDay(a)))
      .map(
        (s) =>
          `<details class="card"><summary>${escape(s.name)} <span class="muted">· ${date(sessionDay(s))}</span></summary><p class="muted" style="margin:15px 0">${s.importSource ? "Imported from Clever Fit · Original time unknown · " : ""}${s.items.reduce((n, i) => n + i.sets.filter((x) => x.done).length, 0)} recorded sets</p>${s.items.map(historyExercise).join("")}</details>`,
      )
      .join("") +
    (!vm.data.sessions.length
      ? '<section class="card empty">Your finished workouts will appear here.</section>'
      : "")
  );
}
function backup() {
  return (
    heading(
      "Keep your progress.",
      "A simple file. Your complete training notebook.",
    ) +
    `<section class="card"><h2>Export a backup</h2><p class="muted" style="margin:12px 0 20px">Includes machines, plans, rotation, history, and your current workout. Save to Files on your iPhone. You can upload this JSON file to ChatGPT for analysis.</p>${button("Download JSON backup ↗", "export", "", "dark")}</section><section class="card"><h2>Restore from a backup</h2><p class="muted" style="margin:12px 0">Restoring replaces all data on this device. A preview and confirmation appear before anything changes.</p><label for="import-file">Choose a JSON backup</label><input type="file" id="import-file" accept="application/json,.json"></section><section class="card"><h2>Import from Clever Fit</h2><p class="muted" style="margin:12px 0">Adds exercises, both plans and historical workouts without replacing your existing data. Review mappings before importing; repeated imports are safe. Works offline.</p><label for="clever-file">Choose Clever Fit workout JSON</label><input type="file" id="clever-file" accept="application/json,.json"></section><section class="card"><h3>Use on your iPhone</h3><p class="muted" style="margin-top:12px">Open this address in Safari, sign in if asked, then tap Share → Add to Home Screen. Open once while online and wait for “Offline ready” above. Your next visits can be offline. Keep this same address: data belongs to this device and website.</p><p class="muted" style="margin-top:12px">Updates are checked when you open the app, return to it, or reconnect. When “Update available” appears, tap Reload when ready. Saved workouts are preserved; finish or cancel open editors first. Export before clearing Safari data or changing devices. Rest timers recalculate when you reopen; lock-screen alerts are not provided.</p></section>`
  );
}
function planModal() {
  const p = vm.editor;
  return `<h2>${p.id ? "Edit plan" : "Create a plan"}</h2><label for="plan-name">Plan name</label><input id="plan-name" value="${escape(p.name)}" data-field="plan-name" placeholder="e.g. Upper body A"><label for="plan-rest">Rest between sets (seconds, 0 to disable)</label><input id="plan-rest" type="number" min="0" step="1" value="${p.rest}" data-field="plan-rest">${p.items.map((i, index) => `<section class="card" style="margin-top:18px"><div class="row between"><h3>${escape(i.name)}</h3><div class="row">${button("↑", "plan-up", i.id, "small ghost")}${button("×", "plan-remove", i.id, "small ghost")}</div></div>${setRows(i, true)}<div style="margin-top:12px">${button("+ Set", "plan-add-set", i.id, "ghost")}</div></section>`).join("")}<label for="plan-add">Add an exercise</label><select id="plan-add" data-action="plan-add"><option value="">Choose a machine…</option>${exerciseOptions()}</select>${!vm.data.exercises.some((e) => !e.archived) ? '<p class="muted">Add machines in Exercises first.</p>' : ""}<footer class="row between">${button("Cancel", "close", "", "ghost")}${button("Save plan", "save-plan", "", "dark")}</footer>`;
}
let exerciseEditor = null;
function modal() {
  if (vm.editor) return planModal();
  if (exerciseEditor) {
    const e = exerciseEditor;
    return `<h2>${e.id ? "Edit machine" : "Add an exercise"}</h2><label>Name<input id="exercise-name" value="${escape(e.name)}" placeholder="e.g. Chest press"></label><label>Machine number<input id="exercise-number" value="${escape(e.number)}" placeholder="e.g. 12"></label><footer class="row wrap">${button("Cancel", "close", "", "ghost")}${e.id ? button("Archive", "archive-exercise", e.id, "ghost") : ""}${button("Save machine", "save-exercise", "", "dark")}</footer>`;
  }
  if (vm.review) {
    const s = vm.data.active,
      p = vm.data.plans.find((p) => p.id === s.planId),
      changes = app.changes();
    const unfinished = s.items.reduce(
      (n, i) => n + i.sets.filter((x) => !x.done).length,
      0,
    );
    return `<h2>Finish your visit</h2><p>${unfinished ? `${unfinished} unfinished sets will stay marked unfinished. Exercises with no completed sets are marked skipped.` : "All sets complete. A good day’s work."}</p><div class="rule"></div><h3>Optional plan updates</h3><p class="muted" style="margin-top:8px">Actual results and skips never update targets automatically. Select only the changes you want to keep.</p>${p.version !== s.planVersion ? '<p class="message error">Your source plan has changed. Finish with no updates to keep its newer version.</p>' : changes.map((c) => `<label class="check"><input type="checkbox" name="plan-change" value="${c.key}"><div><strong>${escape(c.label)}</strong><p>Before: ${escape(c.before)}</p><p>After: ${escape(c.after)}</p></div></label>`).join("") || '<p class="empty">No prescription changes to apply.</p>'}<footer class="row between">${button("Keep training", "close", "", "ghost")}${button("Save finished workout", "finish", "", "dark")}</footer>`;
  }
  if (vm.cleverSource) {
    const preview = migration.preview(vm.cleverSource, vm.cleverChoices);
    return `<h2>Import Clever Fit training</h2><p>${preview.totalSessions} workouts · ${preview.exerciseOccurrences} exercise occurrences · ${preview.sets} sets</p><p class="muted">${preview.newSessions} new sessions, ${preview.duplicates} already imported. ${preview.newCatalog} new exercise/device records and ${preview.newPlans} new plans.</p><p class="muted">Machine numbers and original rest durations are not available in the file. Rest defaults to 90 seconds in editable new plans. Exercise occurrences remain separate.</p><h3>Training plans</h3>${preview.plans
      .map(
        (p) =>
          `<label>${escape(p.name)} ${p.existingId ? "(already imported)" : p.nameConflict ? "(existing name: create separate Clever Fit plan)" : ""}<select data-field="clever-reference" data-name="${escape(p.name)}">${p.sessions
            .map(
              (s) =>
                `<option value="${escape(s.key)}" ${s.key === p.referenceKey ? "selected" : ""}>${date(s.date)}${s.key === p.referenceKey ? " · latest/reference" : ""}</option>`,
            )
            .join("")}</select></label>`,
      )
      .join(
        "",
      )}<h3>Exercise and machine matching</h3><p class="muted">Exact unique existing names may be reused. Spelling variants, such as Signature / Slignature, are never merged without your selection. The second Butterfly occurrence is a separate identity.</p>${preview.identities
      .map(
        (e) =>
          `<label>${escape(e.label)} · ${escape(e.type)}<select data-field="clever-mapping" data-key="${escape(e.key)}"><option value="new" ${e.mapping === "new" ? "selected" : ""}>Create a new record</option>${vm.data.exercises
            .filter(
              (machine) =>
                !machine.archived && (machine.kind || "strength") === e.type,
            )
            .map(
              (machine) =>
                `<option value="${escape(machine.id)}" ${machine.id === e.mapping ? "selected" : ""}>${escape(machine.name)} ${machine.number ? "· #" + escape(machine.number) : ""}</option>`,
            )
            .join("")}</select></label>`,
      )
      .join(
        "",
      )}<footer class="stack">${button("Export current data first", "export", "", "ghost")}${button("Import exercises, 2 plans and history", "confirm-clever", "", "dark")}${button("Cancel", "close", "", "ghost")}</footer>`;
  }
  if (vm.importData) {
    const d = vm.importData;
    return `<h2>Replace this device’s data?</h2><p>Backup contains ${d.exercises.length} machines, ${d.plans.length} plans, ${d.sessions.length} finished workouts, and ${d.active ? "an active workout" : "no active workout"}.</p><p style="margin-top:14px">All current data will be replaced. Export your current notebook before continuing.</p><footer class="stack">${button("Export current data first", "export", "", "ghost")}${button("Replace all data", "confirm-import", "", "danger")}${button("Cancel", "close", "", "ghost")}</footer>`;
  }
  return "";
}
function renderUpdateStatus() {
  if (!updates) return;
  offlineReady = updates.offlineReady;
  const status = document.getElementById("offline-state");
  if (status)
    status.textContent = offlineReady ? "Offline ready" : "Local notebook";
  const region = document.getElementById("app-updates");
  if (!region) return;
  region.innerHTML = `${updates.available ? `<div class="message update-banner"><div><strong>Update available</strong><p>Your saved workout will be kept. Reload when you are ready.</p></div><button class="dark" data-action="reload-update" ${updates.applying ? "disabled" : ""}>${updates.applying ? "Updating…" : "Reload"}</button></div>` : ""}${updates.error ? `<div class="message error"><p>${escape(updates.error)}</p>${button("Retry update check", "check-update", "", "ghost")}</div>` : ""}`;
}
function render() {
  if (!vm) return;
  const content = { home, plans, exercises: catalog, workout, history, backup };
  const m = modal();
  root.innerHTML = `<main class="shell"><header class="top"><div class="brand"><span>ƒ</span>Fitty<span style="background:transparent;font-size:12px;font-weight:400;letter-spacing:0">/ training</span></div><span class="status"><span class="dot"></span><span id="offline-state">${offlineReady ? "Offline ready" : "Local notebook"}</span></span></header><div id="app-updates" aria-live="polite"></div>${vm.error ? `<div role="alert" class="message error">${escape(vm.error)}</div>` : ""}${vm.notice ? `<div role="status" class="message">${escape(vm.notice)}</div>` : ""}${content[vm.tab]()}</main><nav aria-label="Main navigation" class="nav">${[
    ["home", "Home"],
    ["plans", "Plans"],
    ["exercises", "Exercises"],
    ["workout", "Workout"],
    ["history", "History"],
    ["backup", "Backup"],
  ]
    .map(([id, name]) => button(name, "tab", id, vm.tab === id ? "active" : ""))
    .join(
      "",
    )}</nav>${m ? `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="Edit and review">${vm.error ? `<p role="alert" class="message error">${escape(vm.error)}</p>` : ""}${m}</section></div>` : ""}`;
  renderUpdateStatus();
}
const actions = {
  tab: (id) => {
    vm.tab = id;
    vm.notice = "";
  },
  "new-plan": () => vm.editPlan(),
  "edit-plan": (id) => vm.editPlan(id),
  exercise: (id) => {
    exerciseEditor = id
      ? { ...vm.data.exercises.find((e) => e.id === id) }
      : { name: "", number: "" };
  },
  close: () => {
    vm.editor = null;
    exerciseEditor = null;
    vm.review = false;
    vm.importData = null;
    vm.cleverSource = null;
    vm.cleverChoices = { mappings: {}, references: {} };
  },
  "save-exercise": () => {
    const name = document.getElementById("exercise-name").value.trim();
    if (!name) throw new Error("Enter an exercise name.");
    app.exercise(
      {
        name,
        number: document.getElementById("exercise-number").value,
      },
      exerciseEditor.id,
    );
    exerciseEditor = null;
  },
  "archive-exercise": (id) => {
    app.archiveExercise(id);
    exerciseEditor = null;
  },
  "save-plan": () => {
    const p = vm.editor;
    if (!p.name.trim()) throw new Error("Give your plan a name.");
    app.plan({ name: p.name.trim(), rest: p.rest, items: p.items }, p.id);
    vm.editor = null;
  },
  "plan-add": (id) => {
    if (id) vm.editor.items.push(app.makeItem(id));
  },
  "plan-remove": (id) => {
    const item = vm.editor.items.find((i) => i.id === id);
    if (
      confirm(
        `Remove “${item.name}” from this plan? Changes apply when you save the plan.`,
      )
    )
      vm.editor.items = vm.editor.items.filter((i) => i.id !== id);
  },
  "plan-up": (id) => {
    const a = vm.editor.items,
      n = a.findIndex((i) => i.id === id);
    if (n > 0) a.splice(n - 1, 0, a.splice(n, 1)[0]);
  },
  "plan-add-set": (id) =>
    vm.editor.items
      .find((i) => i.id === id)
      .sets.push(
        structuredClone(vm.editor.items.find((i) => i.id === id).sets.at(-1)),
      ),
  "plan-remove-set": (arg) => {
    const [id, n] = arg.split("|");
    const i = vm.editor.items.find((i) => i.id === id);
    if (
      i.sets.length > 1 &&
      confirm(
        `Delete set ${+n + 1} from “${i.name}” in this plan? Changes apply when you save the plan.`,
      )
    )
      i.sets.splice(+n, 1);
  },
  duplicate: (id) => app.duplicate(id),
  "archive-plan": (id) => app.archivePlan(id),
  "rotation-up": (id) => {
    const ids = [...vm.data.rotation],
      i = ids.indexOf(id);
    if (i > 0) ids.splice(i - 1, 0, ids.splice(i, 1)[0]);
    app.rotation(ids);
  },
  "rotation-remove": (id) =>
    app.rotation(vm.data.rotation.filter((i) => i !== id)),
  "rotation-add": (id) => {
    if (id) app.rotation([...vm.data.rotation, id]);
  },
  start: (id) => {
    app.start(id);
    vm.tab = "workout";
  },
  resume: () => {
    vm.tab = "workout";
  },
  complete: (arg) => {
    const [id, index] = arg.split("|");
    app.complete(id, +index);
  },
  "add-set": (id) => app.addSet(id),
  "remove-set": (arg) => {
    const [id, index] = arg.split("|");
    const item = vm.data.active.items.find((i) => i.id === id);
    if (
      confirm(`Delete set ${+index + 1} from “${item.name}” for this workout?`)
    )
      app.removeSet(id, +index);
  },
  skip: (id) => app.skip(id),
  "move-up": (id) => app.move(id, -1),
  defer: (id) => app.move(id, vm.data.active.items.length),
  "session-add": (id) => {
    if (id) app.addExercise(id);
  },
  "remove-exercise": (id) => {
    const item = vm.data.active.items.find((i) => i.id === id);
    if (confirm(`Remove “${item.name}” and its sets from this workout?`))
      app.removeExercise(id);
  },
  timer: (action) => app.timer(action),
  review: () => {
    vm.review = true;
  },
  finish: () => {
    const selected = [
      ...document.querySelectorAll('[name="plan-change"]:checked'),
    ].map((i) => i.value);
    app.finish(selected);
    vm.review = false;
    vm.tab = "history";
    vm.notice = "Workout saved. Your next plan is ready.";
  },
  discard: () => {
    if (
      confirm(
        "Discard this active workout? Its recorded sets will be lost. Your rotation will not advance.",
      )
    ) {
      app.discard();
      vm.tab = "home";
    }
  },
  export: exportData,
  "confirm-clever": () => {
    const imported = migration.import(vm.cleverSource, vm.cleverChoices);
    vm.cleverSource = null;
    vm.cleverChoices = { mappings: {}, references: {} };
    vm.tab = "plans";
    vm.notice = `Clever Fit imported: ${imported.exercises} machines, ${imported.plans} plans, ${imported.sessions} workouts and ${imported.sets} sets. ${imported.skippedSessions} existing sessions skipped.`;
  },
  "confirm-import": () => {
    app.restore(vm.importData);
    vm.importData = null;
    vm.tab = "home";
    vm.notice = "Backup restored successfully.";
  },
};
root.addEventListener(
  "toggle",
  (event) => {
    const card = event.target;
    if (
      !vm ||
      !root.contains(card) ||
      !card.matches("details[data-exercise-id]")
    )
      return;
    vm.setExerciseOpen(card.dataset.exerciseId, card.open);
  },
  true,
);
root.addEventListener("click", (event) => {
  const el = event.target.closest("button[data-action]");
  if (!el || !vm) return;
  if (el.dataset.action === "check-update") {
    void updates?.check();
    return;
  }
  if (el.dataset.action === "reload-update") {
    document.activeElement?.blur();
    if (modal() || vm.error) {
      updates.error =
        "Finish or cancel the open editor and resolve any save errors before reloading.";
      renderUpdateStatus();
      return;
    }
    void updates?.apply();
    return;
  }
  vm.run(() => actions[el.dataset.action]?.(el.dataset.arg));
  render();
});
root.addEventListener("change", async (event) => {
  const el = event.target;
  if (!vm) return;
  if (el.id === "clever-file") {
    try {
      const file = el.files[0];
      if (!file) return;
      if (file.size > 10000000)
        throw new Error("Clever Fit file is too large (10 MB limit).");
      vm.cleverSource = parseCleverFit(await file.text());
      vm.cleverChoices = { mappings: {}, references: {} };
      migration.preview(vm.cleverSource, vm.cleverChoices);
      vm.error = "";
    } catch (error) {
      vm.cleverSource = null;
      vm.error = error.message;
    }
    render();
    return;
  }
  if (el.id === "import-file") {
    try {
      const file = el.files[0];
      if (!file) return;
      if (file.size > 10000000)
        throw new Error("Backup is too large (10 MB limit).");
      vm.importData = decodeBackup(await file.text());
      vm.error = "";
    } catch (e) {
      vm.error = e.message;
    }
    render();
    return;
  }
  vm.run(() => {
    if (el.tagName === "SELECT" && el.dataset.action) {
      actions[el.dataset.action](el.value);
      return;
    }
    const f = el.dataset.field;
    if (!f) return;
    const id = el.dataset.id,
      n = +el.dataset.index,
      key = el.dataset.key;
    const numeric = () => {
      if (el.value.trim() === "" || !el.checkValidity())
        throw new Error(
          "Enter a valid non-negative number. Repetitions must be whole numbers.",
        );
      return Number(el.value);
    };
    if (f === "clever-mapping")
      vm.cleverChoices.mappings[el.dataset.key] = el.value;
    else if (f === "clever-reference")
      vm.cleverChoices.references[el.dataset.name] = el.value;
    else if (f === "plan-name") vm.editor.name = el.value;
    else if (f === "plan-rest") vm.editor.rest = numeric();
    else if (f === "plan")
      vm.editor.items.find((i) => i.id === id).sets[n][key] =
        el.value.trim() === "" ? null : numeric();
    else if (f === "actual")
      app.set(id, n, { [key]: el.value.trim() === "" ? null : numeric() });
  });
  if ((el.tagName === "SELECT" && el.dataset.action) || vm.error) render();
});
if (vm) {
  render();
  setInterval(() => {
    if (vm.data.active) {
      const r = document.getElementById("rest-value");
      if (r) r.textContent = minutes(vm.rest);
    }
  }, 1000);
  if ("serviceWorker" in navigator) {
    updates = new AppUpdateViewModel(
      new BrowserAppUpdates(
        navigator.serviceWorker,
        window,
        document,
        caches,
        SHELL_CACHE,
      ),
      () => window.location.reload(),
    );
    void updates.start(renderUpdateStatus);
  }
}
