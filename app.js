// Этапы работы над проектом
const STAGES = ["Бриф", "Дизайн", "Правки", "Сдача"];

// Объект Telegram. Если страница открыта в обычном браузере, initData пустой
const tg = window.Telegram && window.Telegram.WebApp;
const cloud = tg && tg.initData && tg.isVersionAtLeast("6.9") ? tg.CloudStorage : null;
if (tg) {
  tg.ready();   // сообщаем Telegram, что страница загрузилась
  tg.expand();  // раскрываем на весь экран
}

let projects = [];
let saved = {}; // что уже лежит в облаке Telegram: ключ -> текст проекта

const list = document.getElementById("list");
const form = document.getElementById("form");
const monthInput = document.getElementById("month");
const earned = document.getElementById("earned");

// Сегодняшняя дата в формате ГГГГ-ММ-ДД
const today = new Date().toLocaleDateString("sv-SE");
monthInput.value = today.slice(0, 7);

// Загрузка: в Telegram берём из облака (один проект = один ключ), иначе из браузера
async function load() {
  if (!cloud) return JSON.parse(localStorage.getItem("projects")) || [];
  const keys = await new Promise(r => cloud.getKeys((e, k) => r(k || [])));
  const pk = keys.filter(k => k.startsWith("p_"));
  if (!pk.length) return [];
  const vals = await new Promise(r => cloud.getItems(pk, (e, v) => r(v || {})));
  saved = vals;
  return pk.map(k => JSON.parse(vals[k])).sort((a, b) => b.id - a.id);
}

// Сохранение: в облако отправляем только то, что изменилось
function save() {
  if (!cloud) {
    localStorage.setItem("projects", JSON.stringify(projects));
    return;
  }
  const now = {};
  for (const p of projects) now["p_" + p.id] = JSON.stringify(p);
  for (const k in now) if (saved[k] !== now[k]) cloud.setItem(k, now[k]);
  for (const k in saved) if (!(k in now)) cloud.removeItem(k);
  saved = now;
}

// Защита: пользовательский текст не должен превращаться в HTML-код
function esc(text) {
  return text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function render() {
  list.innerHTML = "";

  for (const p of projects) {
    const li = document.createElement("li");
    if (p.paidDate) li.className = "paid";

    const options = STAGES
      .map(s => `<option ${s === p.stage ? "selected" : ""}>${s}</option>`)
      .join("");

    li.innerHTML = `
      <div class="info"><strong>${esc(p.client)}</strong><span>${esc(p.title)}</span></div>
      <span class="money">${p.amount.toLocaleString("ru-RU")} ₽</span>
      <span class="date">${p.deadline ? "до " + p.deadline : ""}</span>
      <select data-id="${p.id}" aria-label="Этап">${options}</select>
      <button data-id="${p.id}" data-act="pay">${p.paidDate ? "Оплачено " + p.paidDate : "Отметить оплату"}</button>
      <button data-id="${p.id}" data-act="del" aria-label="Удалить">✕</button>
    `;
    list.appendChild(li);
  }

  // Сумма оплаченных проектов за выбранный месяц
  const month = monthInput.value;
  const sum = projects
    .filter(p => p.paidDate && p.paidDate.startsWith(month))
    .reduce((total, p) => total + p.amount, 0);
  earned.textContent = sum.toLocaleString("ru-RU");
}

// Добавление проекта
form.addEventListener("submit", e => {
  e.preventDefault();
  const d = new FormData(form);
  projects.unshift({
    id: Date.now(),
    client: d.get("client").trim(),
    title: d.get("work").trim(),
    amount: Number(d.get("amount")),
    deadline: d.get("deadline"),
    stage: STAGES[0],
    paidDate: null,
  });
  form.reset();
  save();
  render();
});

// Кнопки «оплата» и «удалить»
list.addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  const p = projects.find(x => x.id === Number(b.dataset.id));

  if (b.dataset.act === "del" && confirm("Удалить проект?")) {
    projects = projects.filter(x => x !== p);
  }
  if (b.dataset.act === "pay") {
    p.paidDate = p.paidDate ? null : today;
  }
  save();
  render();
});

// Смена этапа
list.addEventListener("change", e => {
  const p = projects.find(x => x.id === Number(e.target.dataset.id));
  p.stage = e.target.value;
  save();
  render();
});

// Смена месяца пересчитывает сумму
monthInput.addEventListener("change", render);

load().then(list => {
  projects = list;
  render();
});
