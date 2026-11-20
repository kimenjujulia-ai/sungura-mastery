// =====================================================================
// SUNGURA MASTER - app.js
// Order of this file:
//   1. Navigation
//   2. Helpers (dates, money)
//   3. Rabbits
//   4. Breeding
//   5. Finance
//   6. Health
//   7. Tasks and the Today list
//   8. Feed stock
//   9. More (settings, backup, install)
//  10. Start-up (runs last, so everything above already exists)
// =====================================================================


// ===== 1. NAVIGATION =====

const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

// Pages that live under another nav button (so that button stays highlighted)
const NAV_FOR = { feed: "home", reminders: "home" };

function showPage(pageId) {
  const navId = NAV_FOR[pageId] || pageId;

  buttons.forEach(function (b) { b.classList.toggle("active", b.dataset.page === navId); });
  pages.forEach(function (p) { p.classList.toggle("active", p.id === pageId); });

  document.body.dataset.page = pageId;   // tells the CSS which background photo to show
  window.scrollTo(0, 0);
}

buttons.forEach(function (button) {
  button.addEventListener("click", function () { showPage(button.dataset.page); });
});

// Anything with data-goto="pageId" (cards, buttons) also opens that page
document.querySelectorAll("[data-goto]").forEach(function (el) {
  el.addEventListener("click", function () { showPage(el.dataset.goto); });
});

document.body.dataset.page = "home";       // start on the Home photo


// ===== 2. HELPERS =====

// Turns "2026-11-16" into a Date at midnight (local time)
function parseDate(text) {
  return new Date(text + "T00:00:00");
}

// Adds days to a date and returns a new date
function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

// Turns a Date into readable text, e.g. "17 Dec 2026"
function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// How many days from today until a date (negative = already passed)
function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date - today) / 86400000);
}

// Today's date as "YYYY-MM-DD" using local time
// Turns a Date into "YYYY-MM-DD" using local time
function dateToText(d) {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

// Today's date as "YYYY-MM-DD"
function todayText() {
  return dateToText(new Date());
}

// Format a number as 12,500
function formatMoney(number) {
  return number.toLocaleString("en-KE");
}

// Tells other scripts (like cloud sync) that saved data has changed
function dataChanged() {
  document.dispatchEvent(new Event("sungura:changed"));
}

// Safely write text into an element (does nothing if the element is missing)
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}


// ===== 3. RABBITS =====

let rabbits = JSON.parse(localStorage.getItem("rabbits")) || [];

const form = document.getElementById("rabbit-form");
const list = document.getElementById("rabbit-list");

function saveRabbits() {
  localStorage.setItem("rabbits", JSON.stringify(rabbits));
  dataChanged();
}

// Rabbits saved before the profile update have no status, so treat them as Active
function statusOf(rabbit) {
  return rabbit.status || "Active";
}

// Turns a birth date into "9 days", "5 weeks", "7 months" or "1 yr 2 mo"
function ageText(dob) {
  if (!dob) return "";
  const born = new Date(dob + "T00:00:00");
  const days = Math.floor((new Date() - born) / 86400000);
  if (days < 0) return "";
  if (days < 14) return days + (days === 1 ? " day" : " days");
  if (days < 84) return Math.floor(days / 7) + " weeks";
  const months = Math.floor(days / 30.44);
  if (months < 24) return months + " months";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years + " yr" + (rest ? " " + rest + " mo" : "");
}

// The most recent weight entry, or null if there is none
function latestWeight(rabbit) {
  if (!rabbit.weights || rabbit.weights.length === 0) return null;
  return rabbit.weights[rabbit.weights.length - 1];
}

// Fill a dropdown with a first "unknown" option plus a list of rabbits
function fillSelect(select, firstLabel, items) {
  const keep = select.value;       // remember what was chosen
  select.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);

  items.forEach(function (r) {
    const option = document.createElement("option");
    option.value = r.name;
    option.textContent = r.name;
    select.appendChild(option);
  });

  select.value = keep;
}

// Father and Mother dropdowns on the Add Rabbit form
function fillParentSelects() {
  const bucks = rabbits.filter(function (r) { return r.sex.startsWith("Buck"); });
  const does = rabbits.filter(function (r) { return r.sex.startsWith("Doe"); });
  fillSelect(document.getElementById("rabbit-sire"), "Unknown", bucks);
  fillSelect(document.getElementById("rabbit-dam"), "Unknown", does);
}

// Adds one line of small text to a card (skips it if the text is empty)
function addLine(parent, text) {
  if (!text) return;
  const line = document.createElement("small");
  line.className = "rabbit-line";
  line.textContent = text;
  parent.appendChild(line);
}

function renderRabbits() {
  list.innerHTML = "";

  // Friendly message when there are no rabbits yet
  if (rabbits.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-state";

    const mascot = document.createElement("img");
    mascot.src = "images/mascot.png";
    mascot.className = "empty-mascot";
    mascot.alt = "";
    mascot.addEventListener("error", function () { mascot.remove(); });

    const text = document.createElement("p");
    text.textContent = "No rabbits yet. Add your first one above.";

    empty.append(mascot, text);
    list.appendChild(empty);
  }

  rabbits.forEach(function (rabbit) {
    const li = document.createElement("li");
    li.className = "rabbit-item";

    // Top row: name and status badge
    const status = statusOf(rabbit);
    const top = document.createElement("div");
    top.className = "rabbit-top";

    const title = document.createElement("strong");
    title.textContent = rabbit.name;

    const badge = document.createElement("span");
    badge.className = "badge";
    if (status === "Sold") badge.classList.add("soon");
    if (status === "Deceased") badge.classList.add("overdue");
    badge.textContent = status;

    top.append(title, badge);
    li.appendChild(top);

    // Detail lines (empty ones are skipped)
    addLine(li, [rabbit.breed, rabbit.sex, ageText(rabbit.dob)].filter(Boolean).join(" • "));

    const weight = latestWeight(rabbit);
    addLine(li, [
      rabbit.cage ? "Cage " + rabbit.cage : "",
      weight ? weight.kg + " kg (" + formatDate(parseDate(weight.date)) + ")" : "",
    ].filter(Boolean).join(" • "));

    if (rabbit.sire || rabbit.dam) {
      addLine(li, "Father: " + (rabbit.sire || "unknown") + " • Mother: " + (rabbit.dam || "unknown"));
    }
    if (status === "Sold" && rabbit.salePrice) {
      addLine(li, "Sold for KES " + formatMoney(rabbit.salePrice) +
        (rabbit.soldDate ? " on " + formatDate(parseDate(rabbit.soldDate)) : ""));
    }

    const holdUntil = withdrawalFor(rabbit.name);
    if (holdUntil && status === "Active") {
      addLine(li, "Withdrawal until " + formatDate(holdUntil) + " (do not sell or slaughter)");
    }
    addLine(li, rabbit.notes ? "Note: " + rabbit.notes : "");

    // Buttons: weight, status, delete
    const actions = document.createElement("div");
    actions.className = "item-actions";

    const weightBtn = document.createElement("button");
    weightBtn.textContent = "Weight";
    weightBtn.addEventListener("click", function () {
      const answer = prompt("New weight for " + rabbit.name + " (kg)?");
      if (answer === null || answer.trim() === "") return;

      const kg = Number(answer.replace(",", "."));
      if (!(kg > 0 && kg < 20)) {
        alert("Please enter a weight between 0 and 20 kg.");
        return;
      }

      if (!rabbit.weights) rabbit.weights = [];
      rabbit.weights.push({ date: todayText(), kg: kg });
      saveRabbits();
      renderRabbits();
    });

    const statusSelect = document.createElement("select");
    ["Active", "Sold", "Deceased"].forEach(function (s) {
      const option = document.createElement("option");
      option.value = s;
      option.textContent = s;
      statusSelect.appendChild(option);
    });
    statusSelect.value = status;
    statusSelect.addEventListener("change", function () {
      if (statusSelect.value === "Sold") {
        const safeOn = withdrawalFor(rabbit.name);
        if (safeOn && !confirm(rabbit.name + " is still in a medicine withdrawal period until " +
            formatDate(safeOn) + ".\n\nMark as sold anyway?")) {
          statusSelect.value = status;   // put the dropdown back
          return;
        }

        // Ask for the price so the income lands in Finance
        const price = prompt("Sale price for " + rabbit.name + " in KES?\n\n(Leave empty to mark as sold without recording income.)");
        if (price === null) {            // Cancel means "don't sell"
          statusSelect.value = status;
          return;
        }
        recordSale(rabbit, Number(price.replace(/,/g, "")) || 0, todayText());
        renderFinance();
        renderRabbits();
        return;
      }
      rabbit.status = statusSelect.value;
      saveRabbits();
      renderRabbits();
    });

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "icon-btn";
    del.addEventListener("click", function () {
      if (!confirm("Delete " + rabbit.name + "? This cannot be undone.")) return;
      rabbits = rabbits.filter(function (r) { return r.id !== rabbit.id; });
      saveRabbits();
      renderRabbits();
    });

    // Kits are recorded without a sex until you can tell
    if (rabbit.sex.startsWith("Unsexed")) {
      const sexSelect = document.createElement("select");
      ["Set sex…", "Doe (female)", "Buck (male)"].forEach(function (label, i) {
        const option = document.createElement("option");
        option.value = i === 0 ? "" : label;
        option.textContent = label;
        sexSelect.appendChild(option);
      });
      sexSelect.addEventListener("change", function () {
        if (!sexSelect.value) return;
        rabbit.sex = sexSelect.value;
        saveRabbits();
        renderRabbits();
      });
      actions.appendChild(sexSelect);
    }

    actions.append(weightBtn, statusSelect, del);
    li.appendChild(actions);
    list.appendChild(li);
  });

  // Home card counts only Active rabbits
  setText("total-rabbits", rabbits.filter(function (r) { return statusOf(r) === "Active"; }).length);

  // Keep every dropdown that lists rabbits up to date
  fillBreedingSelects();
  fillParentSelects();
  fillHealthSelects();
  fillSaleSelect();
  renderHealth();
}

// When the form is submitted, add a new rabbit
form.addEventListener("submit", function (event) {
  event.preventDefault();

  const name = document.getElementById("rabbit-name").value.trim();
  if (!name) return;

  // Tags must be unique, because the Breeding page finds rabbits by name
  const taken = rabbits.some(function (r) {
    return r.name.toLowerCase() === name.toLowerCase();
  });
  if (taken) {
    alert("You already have a rabbit called " + name + ". Each tag must be unique.");
    return;
  }

  const rabbit = {
    id: Date.now(),
    name: name,
    breed: document.getElementById("rabbit-breed").value,
    sex: document.getElementById("rabbit-sex").value,
    dob: document.getElementById("rabbit-dob").value,
    cage: document.getElementById("rabbit-cage").value.trim(),
    status: "Active",
    sire: document.getElementById("rabbit-sire").value,
    dam: document.getElementById("rabbit-dam").value,
    notes: document.getElementById("rabbit-notes").value.trim(),
    weights: [],
  };

  const kg = Number(document.getElementById("rabbit-weight").value);
  if (kg > 0) rabbit.weights.push({ date: todayText(), kg: kg });

  rabbits.push(rabbit);
  saveRabbits();
  renderRabbits();
  form.reset();
});


// ===== 4. BREEDING =====

let breedings = JSON.parse(localStorage.getItem("breedings")) || [];

const GESTATION_DAYS = 31;  // average rabbit pregnancy
const NEST_BOX_DAYS = 28;   // days after mating when the nest box should go in
const WEANING_DAYS = 35;    // days after kindling when kits are usually weaned
// These are typical figures. Change them if your vet or local advisor says otherwise.

function saveBreedings() {
  localStorage.setItem("breedings", JSON.stringify(breedings));
  dataChanged();
}

// --- Fill the Doe and Buck dropdowns (Active rabbits only) ---
function fillBreedingSelects() {
  const doeSelect = document.getElementById("breed-doe");
  const buckSelect = document.getElementById("breed-buck");

  const does = rabbits.filter(function (r) {
    return r.sex.startsWith("Doe") && statusOf(r) === "Active";
  });
  const bucks = rabbits.filter(function (r) {
    return r.sex.startsWith("Buck") && statusOf(r) === "Active";
  });

  doeSelect.innerHTML = "";
  buckSelect.innerHTML = '<option value="">Not recorded</option>';

  if (does.length === 0) {
    doeSelect.innerHTML = '<option value="">Add a doe in Rabbits first</option>';
  }

  does.forEach(function (d) {
    const option = document.createElement("option");
    option.value = d.name;
    option.textContent = d.name;
    doeSelect.appendChild(option);
  });

  bucks.forEach(function (b) {
    const option = document.createElement("option");
    option.value = b.name;
    option.textContent = b.name;
    buckSelect.appendChild(option);
  });
}

// --- Inbreeding check ---
function findRabbit(name) {
  return rabbits.find(function (r) { return r.name === name; });
}

// Returns a sentence describing the problem, or "" if no close relation is known
function inbreedingWarning(doeName, buckName) {
  if (!buckName) return "";
  const doe = findRabbit(doeName);
  const buck = findRabbit(buckName);
  if (!doe || !buck) return "";

  if (doe.sire && doe.sire === buck.name) return buck.name + " is the father of " + doe.name + ".";
  if (buck.dam && buck.dam === doe.name) return doe.name + " is the mother of " + buck.name + ".";
  if (doe.sire && doe.sire === buck.sire) return "They share the same father (" + doe.sire + ").";
  if (doe.dam && doe.dam === buck.dam) return "They share the same mother (" + doe.dam + ").";
  return "";
}

// Records a kindling. Used by the Breeding page and the Today list.
function markKindled(b) {
  const size = prompt("How many kits were born?");
  if (size === null || size.trim() === "") return;

  const kits = Math.floor(Number(size));
  if (!(kits >= 0 && kits < 30)) {
    alert("Please enter a number between 0 and 29.");
    return;
  }

  b.kindled = true;
  b.litterSize = kits;
  b.kindledDate = todayText();   // needed for the weaning reminder
  saveBreedings();
  renderBreedings();

  if (kits > 0 && confirm("Add the " + kits + " kits to your Rabbits list now?")) {
    addKitsAsRabbits(b);
  }
}

// A tag that nobody is using yet (adds -2, -3 ... if needed)
function uniqueTag(base) {
  let tag = base;
  let n = 2;
  while (rabbits.some(function (r) { return r.name.toLowerCase() === tag.toLowerCase(); })) {
    tag = base + "-" + n;
    n++;
  }
  return tag;
}

// Turns a litter into rabbit records (the sex of newborn kits is unknown)
function addKitsAsRabbits(b) {
  const kits = b.litterSize;
  if (!(kits > 0) || b.kitsAdded) return;

  const dam = findRabbit(b.doe);
  const sire = b.buck ? findRabbit(b.buck) : null;

  const prefix = prompt(
    "Tag prefix for the " + kits + " kits?\n\nThey will be named " + b.doe + "-K1, " + b.doe + "-K2 ... unless you change it.",
    b.doe + "-K"
  );
  if (prefix === null) return;
  const base = prefix.trim() || (b.doe + "-K");

  // Same breed as the mother if the father is the same breed (or unknown), otherwise "Other"
  let breed = "Other";
  if (dam && (!sire || sire.breed === dam.breed)) breed = dam.breed;

  for (let i = 1; i <= kits; i++) {
    rabbits.push({
      id: Date.now() + i,
      name: uniqueTag(base + i),
      breed: breed,
      sex: "Unsexed (kit)",
      dob: b.kindledDate || todayText(),
      cage: dam && dam.cage ? dam.cage : "",
      status: "Active",
      sire: b.buck || "",
      dam: b.doe,
      notes: "Litter of " + b.doe + (b.buck ? " × " + b.buck : ""),
      weights: [],
    });
  }

  b.kitsAdded = true;
  saveRabbits();
  saveBreedings();
  renderRabbits();
  renderBreedings();
  alert(kits + " kits added to your Rabbits list. Set each one's sex when you can tell.");
}

// --- Draw the breeding list ---
function renderBreedings() {
  const listEl = document.getElementById("breeding-list");
  listEl.innerHTML = "";

  let activeCount = 0;
  let dueSoonCount = 0;

  breedings.forEach(function (b) {
    const due = addDays(parseDate(b.matingDate), GESTATION_DAYS);
    const left = daysUntil(due);

    const li = document.createElement("li");
    li.className = "breeding-item";

    const title = document.createElement("strong");
    title.textContent = b.doe + (b.buck ? " × " + b.buck : "");

    const info = document.createElement("small");
    info.textContent =
      "Mated " + formatDate(parseDate(b.matingDate)) +
      " • Due " + formatDate(due);

    const badge = document.createElement("span");
    badge.className = "badge";

    if (b.kindled) {
      badge.classList.add("done");
      badge.textContent = "Kindled • " + b.litterSize + " kits";
    } else {
      activeCount++;
      if (left < 0) {
        badge.classList.add("overdue");
        badge.textContent = "Overdue by " + Math.abs(left) + " days";
      } else if (left <= 7) {
        badge.classList.add("soon");
        badge.textContent = left === 0 ? "Due today!" : left + " days left";
        dueSoonCount++;
      } else {
        badge.textContent = left + " days left";
      }
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";

    if (!b.kindled) {
      const kindleBtn = document.createElement("button");
      kindleBtn.textContent = "Kindled";
      kindleBtn.addEventListener("click", function () { markKindled(b); });
      actions.appendChild(kindleBtn);
    }

    if (b.kindled && b.litterSize > 0 && !b.kitsAdded) {
      const kitsBtn = document.createElement("button");
      kitsBtn.textContent = "Add kits as rabbits";
      kitsBtn.addEventListener("click", function () { addKitsAsRabbits(b); });
      actions.appendChild(kitsBtn);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      breedings = breedings.filter(function (x) { return x.id !== b.id; });
      saveBreedings();
      renderBreedings();
    });
    actions.appendChild(deleteBtn);

    li.append(title, document.createElement("br"), info, document.createElement("br"), badge, actions);
    listEl.appendChild(li);
  });

  // Update the Home cards
  setText("breeding-does", activeCount);
  setText("due-soon", dueSoonCount);
  renderToday();
}

// --- When the breeding form is submitted ---
document.getElementById("breeding-form").addEventListener("submit", function (event) {
  event.preventDefault();

  const doe = document.getElementById("breed-doe").value;
  if (!doe) {
    alert("Please add a doe in the Rabbits page first.");
    return;
  }

  const buck = document.getElementById("breed-buck").value;

  // Warn about close relatives, but let the farmer decide
  const warning = inbreedingWarning(doe, buck);
  if (warning && !confirm("Inbreeding risk: " + warning + "\n\nSave this mating anyway?")) {
    return;
  }

  breedings.push({
    id: Date.now(),
    doe: doe,
    buck: buck,
    matingDate: document.getElementById("breed-date").value,
    kindled: false,
    litterSize: 0,
  });

  saveBreedings();
  renderBreedings();
  this.reset();
});


// ===== 5. FINANCE =====

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];

// The categories that appear for each type
const categories = {
  income: ["Rabbit sale", "Manure / urine sale", "Other income"],
  expense: ["Feed", "Medicine / Vet", "Equipment", "Labour", "Other expense"],
};

const financeForm = document.getElementById("finance-form");
const typeSelect = document.getElementById("fin-type");
const categorySelect = document.getElementById("fin-category");
const txList = document.getElementById("finance-list");

function saveTransactions() {
  localStorage.setItem("transactions", JSON.stringify(transactions));
  dataChanged();
}

// Fill the Category dropdown based on the chosen Type
function fillCategories() {
  const options = categories[typeSelect.value];
  categorySelect.innerHTML = "";

  options.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    categorySelect.appendChild(option);
  });
  updateSaleFields();
}

typeSelect.addEventListener("change", fillCategories);
categorySelect.addEventListener("change", updateSaleFields);

// --- Selling a specific rabbit ---
const saleFields = document.getElementById("sale-fields");
const saleSelect = document.getElementById("fin-rabbit");

// Show "Which rabbit was sold?" only for Income > Rabbit sale
function updateSaleFields() {
  saleFields.hidden = !(typeSelect.value === "income" && categorySelect.value === "Rabbit sale");
}

// List the rabbits that can still be sold
function fillSaleSelect() {
  const keep = saleSelect.value;
  saleSelect.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "No specific rabbit (e.g. several rabbits)";
  saleSelect.appendChild(none);

  rabbits
    .filter(function (r) { return statusOf(r) === "Active"; })
    .forEach(function (r) {
      const option = document.createElement("option");
      option.value = r.id;
      option.textContent = r.name;
      saleSelect.appendChild(option);
    });

  keepChoice(saleSelect, keep);
}

// Marks a rabbit as sold and records the income in Finance (one place does both jobs)
function recordSale(rabbit, amount, dateText, description) {
  rabbit.status = "Sold";
  rabbit.soldDate = dateText;

  if (amount > 0) {
    rabbit.salePrice = amount;
    transactions.push({
      id: Date.now(),
      type: "income",
      category: "Rabbit sale",
      description: description || "Sold: " + rabbit.name,
      amount: amount,
      date: dateText,
      rabbitId: rabbit.id,
    });
    saveTransactions();
  }

  saveRabbits();
}

// Draw the totals and the list
function renderFinance() {
  let income = 0;
  let expenses = 0;

  transactions.forEach(function (t) {
    if (t.type === "income") {
      income += t.amount;
    } else {
      expenses += t.amount;
    }
  });

  const profit = income - expenses;

  setText("fin-income", formatMoney(income));
  setText("fin-expenses", formatMoney(expenses));
  setText("home-income", formatMoney(income));
  setText("home-expenses", formatMoney(expenses));

  // Profit shows on both pages, green if positive, red if negative
  ["fin-profit", "home-profit"].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = formatMoney(profit);
    el.classList.remove("positive", "negative");
    el.classList.add(profit >= 0 ? "positive" : "negative");
  });

  // The list, newest first (slice() copies, so the saved order stays untouched)
  const sorted = transactions.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date) || b.id - a.id;
  });

  txList.innerHTML = "";

  if (sorted.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No transactions yet.";
    txList.appendChild(empty);
    return;
  }

  sorted.forEach(function (t) {
    const li = document.createElement("li");
    li.className = "tx-item";

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = t.category;
    const details = document.createElement("small");
    details.textContent =
      formatDate(parseDate(t.date)) + (t.description ? " • " + t.description : "");
    info.append(title, document.createElement("br"), details);

    const right = document.createElement("div");
    right.className = "tx-right";

    const amount = document.createElement("span");
    amount.className = "tx-amount " + (t.type === "income" ? "in" : "out");
    amount.textContent = (t.type === "income" ? "+" : "−") + formatMoney(t.amount);

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "delete-btn";
    del.addEventListener("click", function () {
      transactions = transactions.filter(function (x) { return x.id !== t.id; });
      saveTransactions();
      renderFinance();

      // If this was the sale of a rabbit, offer to bring the rabbit back
      const sold = t.rabbitId ? rabbits.find(function (r) { return r.id === t.rabbitId; }) : null;
      if (sold && statusOf(sold) === "Sold" &&
          confirm(sold.name + " was marked as sold by this sale.\n\nSet " + sold.name + " back to Active?")) {
        sold.status = "Active";
        delete sold.salePrice;
        delete sold.soldDate;
        saveRabbits();
        renderRabbits();
      }
    });

    right.append(amount, del);
    li.append(info, right);
    txList.appendChild(li);
  });
}

// When the form is submitted, save a new transaction
financeForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const amount = Number(document.getElementById("fin-amount").value);
  if (amount <= 0) {
    alert("Please enter an amount greater than 0.");
    return;
  }

  const dateText = document.getElementById("fin-date").value;
  const description = document.getElementById("fin-desc").value.trim();

  // Did the farmer pick a specific rabbit to sell?
  const soldId = saleFields.hidden ? 0 : Number(saleSelect.value);
  const soldRabbit = soldId ? rabbits.find(function (r) { return r.id === soldId; }) : null;

  if (soldRabbit) {
    const safeOn = withdrawalFor(soldRabbit.name);
    if (safeOn && !confirm(soldRabbit.name + " is still in a medicine withdrawal period until " +
        formatDate(safeOn) + ".\n\nRecord the sale anyway?")) {
      return;
    }
    recordSale(soldRabbit, amount, dateText, description);
  } else {
    transactions.push({
      id: Date.now(),
      type: typeSelect.value,
      category: categorySelect.value,
      description: description,
      amount: amount,
      date: dateText,
    });
    saveTransactions();
  }

  renderFinance();
  renderRabbits();   // a sold rabbit leaves the active lists

  financeForm.reset();
  fillCategories();   // reset puts Type back to Income
  document.getElementById("fin-date").value = todayText();
});


// ===== 6. HEALTH =====

let healthRecords = JSON.parse(localStorage.getItem("healthRecords")) || [];

const ALL_HERD = "__ALL__";   // stored when a record applies to every rabbit

const healthForm = document.getElementById("health-form");
const healthList = document.getElementById("health-list");
const healthFilter = document.getElementById("health-filter");
const healthRabbit = document.getElementById("health-rabbit");

function saveHealth() {
  localStorage.setItem("healthRecords", JSON.stringify(healthRecords));
  dataChanged();
}

function rabbitLabel(name) {
  return name === ALL_HERD ? "Whole herd" : name;
}

// The date a medicine withdrawal period ends, or null if the record has none
function withdrawalEnd(record) {
  const days = Number(record.withdrawalDays) || 0;
  if (days <= 0) return null;
  return addDays(parseDate(record.date), days);
}

// If this rabbit is still in a withdrawal period, returns the end date. Otherwise null.
function withdrawalFor(rabbitName) {
  let latest = null;
  healthRecords.forEach(function (rec) {
    if (rec.rabbit !== rabbitName && rec.rabbit !== ALL_HERD) return;
    const end = withdrawalEnd(rec);
    if (end && daysUntil(end) > 0 && (!latest || end > latest)) latest = end;
  });
  return latest;
}

// A reminder only matters while the rabbit is still on the farm
function reminderMatters(rec) {
  if (rec.rabbit === ALL_HERD) return true;
  const r = findRabbit(rec.rabbit);
  return !!r && statusOf(r) === "Active";
}

// Put a saved choice back into a dropdown, but only if that choice still exists
function keepChoice(select, value) {
  const exists = Array.from(select.options).some(function (o) { return o.value === value; });
  if (exists) select.value = value;
}

// Fill the "Rabbit" dropdown on the form and the filter above the list
function fillHealthSelects() {
  const keepForm = healthRabbit.value;
  const keepFilter = healthFilter.value;

  // Form: active rabbits, then the whole herd
  healthRabbit.innerHTML = "";
  rabbits
    .filter(function (r) { return statusOf(r) === "Active"; })
    .forEach(function (r) {
      const option = document.createElement("option");
      option.value = r.name;
      option.textContent = r.name;
      healthRabbit.appendChild(option);
    });
  const herd = document.createElement("option");
  herd.value = ALL_HERD;
  herd.textContent = "Whole herd (all rabbits)";
  healthRabbit.appendChild(herd);
  keepChoice(healthRabbit, keepForm);

  // Filter: everything, each rabbit (any status), or herd-wide records
  healthFilter.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = "All records";
  healthFilter.appendChild(all);
  rabbits.forEach(function (r) {
    const option = document.createElement("option");
    option.value = r.name;
    option.textContent = r.name;
    healthFilter.appendChild(option);
  });
  const herdOnly = document.createElement("option");
  herdOnly.value = ALL_HERD;
  herdOnly.textContent = "Whole herd records";
  healthFilter.appendChild(herdOnly);
  keepChoice(healthFilter, keepFilter);
}

// Draw the list, and update the two Home cards
function renderHealth() {
  // Home cards
  let dueCount = 0;
  healthRecords.forEach(function (rec) {
    if (rec.nextDue && !rec.nextDone && reminderMatters(rec) &&
        daysUntil(parseDate(rec.nextDue)) <= 7) {
      dueCount++;
    }
  });
  const holdCount = rabbits.filter(function (r) {
    return statusOf(r) === "Active" && withdrawalFor(r.name);
  }).length;
  setText("health-due", dueCount);
  setText("in-withdrawal", holdCount);
  renderToday();

  // Which records to show
  const filter = healthFilter.value;
  const shown = healthRecords
    .filter(function (rec) {
      if (!filter) return true;
      if (filter === ALL_HERD) return rec.rabbit === ALL_HERD;
      return rec.rabbit === filter || rec.rabbit === ALL_HERD;
    })
    .sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id - a.id;
    });

  healthList.innerHTML = "";

  if (shown.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No health records yet.";
    healthList.appendChild(empty);
    return;
  }

  shown.forEach(function (rec) {
    // Reuses the rabbit card styling
    const li = document.createElement("li");
    li.className = "rabbit-item health-item";

    const top = document.createElement("div");
    top.className = "rabbit-top";

    const title = document.createElement("strong");
    title.textContent = rec.title;

    const typeBadge = document.createElement("span");
    typeBadge.className = "badge";
    typeBadge.textContent = rec.type;

    top.append(title, typeBadge);
    li.appendChild(top);

    addLine(li, rabbitLabel(rec.rabbit) + " • " + formatDate(parseDate(rec.date)));
    if (rec.cost > 0) addLine(li, "Cost: KES " + formatMoney(rec.cost));
    if (rec.notes) addLine(li, "Note: " + rec.notes);

    // Status badges: next due and withdrawal
    const badges = document.createElement("div");
    badges.className = "badge-row";

    if (rec.nextDue) {
      const dueBadge = document.createElement("span");
      dueBadge.className = "badge";

      if (rec.nextDone) {
        dueBadge.classList.add("done");
        dueBadge.textContent = "Follow-up done";
      } else {
        const left = daysUntil(parseDate(rec.nextDue));
        let phrase;
        if (left < 0) {
          dueBadge.classList.add("overdue");
          phrase = "overdue by " + Math.abs(left) + (Math.abs(left) === 1 ? " day" : " days");
        } else if (left === 0) {
          dueBadge.classList.add("soon");
          phrase = "due today";
        } else if (left <= 7) {
          dueBadge.classList.add("soon");
          phrase = "in " + left + (left === 1 ? " day" : " days");
        } else {
          phrase = "in " + left + " days";
        }
        dueBadge.textContent = "Next: " + formatDate(parseDate(rec.nextDue)) + " (" + phrase + ")";
      }
      badges.appendChild(dueBadge);
    }

    const end = withdrawalEnd(rec);
    if (end && daysUntil(end) > 0) {
      const holdBadge = document.createElement("span");
      holdBadge.className = "badge soon";
      holdBadge.textContent = "Withdrawal until " + formatDate(end);
      badges.appendChild(holdBadge);
    }

    if (badges.children.length > 0) li.appendChild(badges);

    // Buttons
    const actions = document.createElement("div");
    actions.className = "item-actions";

    if (rec.nextDue && !rec.nextDone) {
      const doneBtn = document.createElement("button");
      doneBtn.textContent = "Done";
      doneBtn.addEventListener("click", function () {
        rec.nextDone = true;
        saveHealth();
        renderHealth();
      });
      actions.appendChild(doneBtn);
    }

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", function () {
      const warn = rec.txId ? "\n\nThe expense saved in Finance will be removed too." : "";
      if (!confirm("Delete this health record?" + warn)) return;

      healthRecords = healthRecords.filter(function (x) { return x.id !== rec.id; });

      if (rec.txId) {
        transactions = transactions.filter(function (t) { return t.id !== rec.txId; });
        saveTransactions();
        renderFinance();
      }

      saveHealth();
      renderHealth();
    });
    actions.appendChild(del);

    li.appendChild(actions);
    healthList.appendChild(li);
  });
}

healthFilter.addEventListener("change", renderHealth);

// When the form is submitted, save a new record
healthForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const rabbitName = healthRabbit.value;
  const title = document.getElementById("health-title").value.trim();
  const date = document.getElementById("health-date").value;
  const next = document.getElementById("health-next").value;

  if (!rabbitName || !title || !date) {
    alert("Please choose a rabbit, say what was done, and pick a date.");
    return;
  }
  if (next && next < date) {
    alert("The next due date can't be before the date it was given.");
    return;
  }

  const cost = Math.max(0, Number(document.getElementById("health-cost").value) || 0);

  const record = {
    id: Date.now(),
    rabbit: rabbitName,
    type: document.getElementById("health-type").value,
    title: title,
    date: date,
    nextDue: next,
    nextDone: false,
    withdrawalDays: Math.max(0, Math.floor(Number(document.getElementById("health-withdrawal").value) || 0)),
    notes: document.getElementById("health-notes").value.trim(),
    cost: cost,
    txId: null,
  };

  // A cost becomes a Medicine / Vet expense in Finance
  if (cost > 0) {
    const txId = Date.now();
    transactions.push({
      id: txId,
      type: "expense",
      category: "Medicine / Vet",
      description: title + " (" + rabbitLabel(rabbitName) + ")",
      amount: cost,
      date: date,
    });
    record.txId = txId;
    saveTransactions();
    renderFinance();
  }

  healthRecords.push(record);
  saveHealth();
  renderHealth();

  healthForm.reset();
  document.getElementById("health-date").value = todayText();
});


// ===== 7. TASKS AND THE TODAY LIST =====

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

const taskForm = document.getElementById("task-form");
const todayList = document.getElementById("today-list");

const REPEAT_LABELS = { none: "", daily: "Every day", weekly: "Every week", monthly: "Every month" };
const KIND_LABELS = { task: "Task", breeding: "Breeding", health: "Health", feed: "Feed" };

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  dataChanged();
}

// The next date for a repeating task. If it is overdue, count from today.
function nextDueDate(task) {
  const today = parseDate(todayText());
  let base = parseDate(task.due);
  if (base < today) base = today;

  if (task.repeat === "daily") return dateToText(addDays(base, 1));
  if (task.repeat === "weekly") return dateToText(addDays(base, 7));

  // Monthly: same day next month (or the last day if that month is shorter)
  const day = base.getDate();
  const next = new Date(base.getFullYear(), base.getMonth() + 1, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return dateToText(next);
}

function completeTask(task) {
  if (task.repeat === "none") {
    tasks = tasks.filter(function (t) { return t.id !== task.id; });
  } else {
    task.due = nextDueDate(task);
    task.lastDone = todayText();
  }
  saveTasks();
  renderToday();
}

function deleteTask(task) {
  const extra = task.repeat !== "none" ? "\n\nIt repeats, so it will stop coming back." : "";
  if (!confirm("Delete \"" + task.title + "\"?" + extra)) return;
  tasks = tasks.filter(function (t) { return t.id !== task.id; });
  saveTasks();
  renderToday();
}

// Everything that needs attention: your own tasks plus automatic reminders
function buildReminders() {
  const items = [];

  // 1. Your own tasks
  tasks.forEach(function (t) {
    items.push({
      date: t.due,
      kind: "task",
      title: t.title,
      sub: REPEAT_LABELS[t.repeat] || "",
      onDone: function () { completeTask(t); },
      onDelete: function () { deleteTask(t); },
    });
  });

  // 2. Breeding: kindling, nest box, weaning
  breedings.forEach(function (b) {
    const doe = findRabbit(b.doe);
    if (!doe || statusOf(doe) !== "Active") return;   // skip if the doe is gone

    if (b.kindled) {
      if (b.kindledDate && !b.weaned) {
        const weanDate = addDays(parseDate(b.kindledDate), WEANING_DAYS);
        if (daysUntil(weanDate) <= 3) {
          items.push({
            date: dateToText(weanDate),
            kind: "breeding",
            title: "Wean the kits of " + b.doe,
            sub: b.litterSize + " kits, born " + formatDate(parseDate(b.kindledDate)),
            onDone: function () { b.weaned = true; saveBreedings(); renderBreedings(); },
          });
        }
      }
      return;
    }

    const mated = parseDate(b.matingDate);
    const dueDate = addDays(mated, GESTATION_DAYS);
    const nestDate = addDays(mated, NEST_BOX_DAYS);

    if (daysUntil(dueDate) <= 7) {
      items.push({
        date: dateToText(dueDate),
        kind: "breeding",
        title: b.doe + " is due to kindle",
        sub: "Mated " + formatDate(mated),
        onDone: function () { markKindled(b); },
      });
    }

    if (!b.nestBoxDone && daysUntil(nestDate) <= 3 && daysUntil(dueDate) >= 0) {
      items.push({
        date: dateToText(nestDate),
        kind: "breeding",
        title: "Put a nest box in for " + b.doe,
        sub: "Kindling expected " + formatDate(dueDate),
        onDone: function () { b.nestBoxDone = true; saveBreedings(); renderBreedings(); },
      });
    }
  });

  // 3. Health follow-ups
  healthRecords.forEach(function (rec) {
    if (rec.nextDue && !rec.nextDone && reminderMatters(rec) &&
        daysUntil(parseDate(rec.nextDue)) <= 7) {
      items.push({
        date: rec.nextDue,
        kind: "health",
        title: rec.title + " (" + rabbitLabel(rec.rabbit) + ")",
        sub: rec.type + " follow-up",
        onDone: function () { rec.nextDone = true; saveHealth(); renderHealth(); },
      });
    }
  });

  // 4. Feed running low
  feeds.forEach(function (f) {
    const daysLeft = feedDaysLeft(f);
    if (daysLeft === null || daysLeft > 3) return;
    items.push({
      date: dateToText(addDays(parseDate(todayText()), daysLeft)),
      kind: "feed",
      title: "Restock " + f.name,
      sub: feedNow(f) <= 0
        ? "Out of stock"
        : "About " + daysLeft + (daysLeft === 1 ? " day" : " days") + " of feed left",
      onDone: function () { restockFeed(f); },
    });
  });

  return items;
}

// "3 days overdue", "Today", "Tomorrow" or a date
function whenText(left, date) {
  if (left < 0) return Math.abs(left) + (Math.abs(left) === 1 ? " day" : " days") + " overdue";
  if (left === 0) return "Today";
  if (left === 1) return "Tomorrow";
  return formatDate(parseDate(date));
}

// The one-line alert on the Home page
function updateAlertBanner(items, overdueCount, todayCount) {
  const banner = document.getElementById("alert-banner");
  if (!banner) return;

  const sorted = items.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  const urgent = sorted.filter(function (it) { return it.left <= 0; });
  const next = sorted.find(function (it) { return it.left > 0; });

  let state, title, sub;

  if (urgent.length > 0) {
    state = overdueCount > 0 ? "overdue" : "due";
    title = overdueCount > 0
      ? overdueCount + " overdue" + (todayCount > 0 ? ", " + todayCount + " today" : "")
      : todayCount + (todayCount === 1 ? " thing" : " things") + " to do today";
    sub = urgent[0].title + (urgent.length > 1 ? " and " + (urgent.length - 1) + " more" : "");
  } else {
    state = "calm";
    title = "All caught up";
    sub = next
      ? "Next: " + next.title + " (" + (next.left === 1 ? "tomorrow" : formatDate(parseDate(next.date))) + ")"
      : "Nothing coming up";
  }

  banner.classList.remove("calm", "due", "overdue");
  banner.classList.add(state);
  setText("alert-count", urgent.length);
  setText("alert-title", title);
  setText("alert-sub", sub);
}

function renderToday() {
  if (!todayList) return;   // the Reminders page isn't in the HTML yet

  const items = buildReminders();
  items.forEach(function (it) { it.left = daysUntil(parseDate(it.date)); });

  const overdueCount = items.filter(function (it) { return it.left < 0; }).length;
  const todayCount = items.filter(function (it) { return it.left === 0; }).length;

  updateAlertBanner(items, overdueCount, todayCount);

  const groups = [
    { label: "Overdue",   match: function (l) { return l < 0; } },
    { label: "Today",     match: function (l) { return l === 0; } },
    { label: "Coming up", match: function (l) { return l > 0 && l <= 7; } },
    { label: "Later",     match: function (l) { return l > 7; } },
  ];

  todayList.innerHTML = "";

  groups.forEach(function (g) {
    const inGroup = items
      .filter(function (it) { return g.match(it.left); })
      .sort(function (a, b) { return a.date.localeCompare(b.date); });

    if (inGroup.length === 0) return;

    const heading = document.createElement("li");
    heading.className = "task-group";
    heading.textContent = g.label;
    todayList.appendChild(heading);

    inGroup.forEach(function (it) {
      const li = document.createElement("li");
      li.className = "task-item";
      if (it.left < 0) li.classList.add("is-overdue");

      li.classList.add("kind-" + it.kind);

      const text = document.createElement("div");
      text.className = "task-text";
      const kind = document.createElement("span");
      kind.className = "task-kind";
      kind.textContent = KIND_LABELS[it.kind] || "";
      const title = document.createElement("strong");
      title.textContent = it.title;
      const sub = document.createElement("small");
      sub.textContent = whenText(it.left, it.date) + (it.sub ? " • " + it.sub : "");
      text.append(kind, title, sub);

      const actions = document.createElement("div");
      actions.className = "task-actions";

      const doneBtn = document.createElement("button");
      doneBtn.className = "check-btn";
      doneBtn.textContent = "✓";
      doneBtn.title = "Mark done";
      doneBtn.addEventListener("click", it.onDone);
      actions.appendChild(doneBtn);

      if (it.onDelete) {
        const delBtn = document.createElement("button");
        delBtn.className = "icon-btn";
        delBtn.textContent = "Delete";
        delBtn.title = "Delete task";
        delBtn.addEventListener("click", it.onDelete);
        actions.appendChild(delBtn);
      }

      li.append(text, actions);
      todayList.appendChild(li);
    });
  });

  if (todayList.children.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "You're all caught up.";
    todayList.appendChild(empty);
  }
}

// Add a task
if (taskForm) {
  taskForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title = document.getElementById("task-title").value.trim();
    const due = document.getElementById("task-date").value;
    if (!title || !due) return;

    tasks.push({
      id: Date.now(),
      title: title,
      due: due,
      repeat: document.getElementById("task-repeat").value,
      lastDone: "",
    });

    saveTasks();
    renderToday();

    taskForm.reset();
    document.getElementById("task-date").value = todayText();

    const box = document.querySelector(".add-task");
    if (box) box.open = false;   // fold the form away again
  });
}


// ===== 8. FEED STOCK =====

let feeds = JSON.parse(localStorage.getItem("feeds")) || [];

const feedForm = document.getElementById("feed-form");
const feedList = document.getElementById("feed-list");

function saveFeeds() {
  localStorage.setItem("feeds", JSON.stringify(feeds));
  dataChanged();
}

// Show 14.5 instead of 14.500000001
function formatQty(n) {
  return (Math.round(n * 10) / 10).toLocaleString("en-KE");
}

// How much is left now: the last count minus daily use since then
function feedNow(f) {
  const daysSince = Math.max(0, -daysUntil(parseDate(f.asOf)));
  return Math.max(0, f.stock - f.perDay * daysSince);
}

// Whole days of feed left, or null if no daily use has been set
function feedDaysLeft(f) {
  if (!(f.perDay > 0)) return null;
  return Math.floor(feedNow(f) / f.perDay);
}

// Reads a number typed into a prompt. Returns null for Cancel or empty, NaN for nonsense.
function askNumber(message, defaultValue) {
  const answer = prompt(message, defaultValue === undefined ? "" : String(defaultValue));
  if (answer === null || answer.trim() === "") return null;
  return Number(answer.replace(/,/g, ""));
}

// Add stock (and optionally record what it cost in Finance)
function restockFeed(f) {
  const qty = askNumber("How much " + f.name + " did you add? (" + f.unit + ")");
  if (qty === null) return;
  if (!(qty > 0)) { alert("Please enter a number greater than 0."); return; }

  const costAnswer = prompt(
    "What did it cost in KES?\n\n(Leave empty to skip recording an expense. Cancel stops the restock.)"
  );
  if (costAnswer === null) return;
  const cost = Number(costAnswer.replace(/,/g, "")) || 0;

  f.stock = feedNow(f) + qty;
  f.asOf = todayText();

  if (cost > 0) {
    transactions.push({
      id: Date.now(),
      type: "expense",
      category: "Feed",
      description: "Restock: " + f.name + " (" + formatQty(qty) + " " + f.unit + ")",
      amount: cost,
      date: todayText(),
    });
    saveTransactions();
    renderFinance();
  }

  saveFeeds();
  renderFeed();
}

// Correct the stock after you've counted what is really there
function countFeed(f) {
  const n = askNumber("How much " + f.name + " is in stock right now? (" + f.unit + ")", formatQty(feedNow(f)));
  if (n === null) return;
  if (!(n >= 0)) { alert("Please enter a number (0 or more)."); return; }
  f.stock = n;
  f.asOf = todayText();
  saveFeeds();
  renderFeed();
}

function setFeedUse(f) {
  const n = askNumber("How much " + f.name + " do you use per day? (" + f.unit + ")", f.perDay);
  if (n === null) return;
  if (!(n >= 0)) { alert("Please enter a number (0 or more)."); return; }

  // Keep today's amount, then change the speed it goes down
  f.stock = feedNow(f);
  f.asOf = todayText();
  f.perDay = n;
  saveFeeds();
  renderFeed();
}

function renderFeed() {
  // Home card: the feed that runs out first
  let lowest = null;
  feeds.forEach(function (f) {
    const d = feedDaysLeft(f);
    if (d !== null && (lowest === null || d < lowest.days)) lowest = { days: d, name: f.name };
  });

  setText("feed-days", lowest ? lowest.days + (lowest.days === 1 ? " day" : " days") : "–");
  setText("feed-sub", lowest
    ? lowest.name + " runs out first"
    : (feeds.length ? "Set daily use to track it" : "Tap to add your feed"));
  const daysEl = document.getElementById("feed-days");
  if (daysEl) daysEl.classList.toggle("negative", !!lowest && lowest.days <= 3);

  renderToday();   // low feed shows up in the Today list

  if (!feedList) return;
  feedList.innerHTML = "";

  if (feeds.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No feed added yet.";
    feedList.appendChild(empty);
    return;
  }

  feeds.forEach(function (f) {
    const li = document.createElement("li");
    li.className = "rabbit-item feed-item";

    const now = feedNow(f);
    const daysLeft = feedDaysLeft(f);

    const top = document.createElement("div");
    top.className = "rabbit-top";
    const title = document.createElement("strong");
    title.textContent = f.name;

    const badge = document.createElement("span");
    badge.className = "badge";
    if (daysLeft === null) {
      badge.classList.add("done");
      badge.textContent = "No daily use set";
    } else if (now <= 0) {
      badge.classList.add("overdue");
      badge.textContent = "Out of stock";
    } else if (daysLeft <= 3) {
      badge.classList.add("overdue");
      badge.textContent = "Low • " + daysLeft + (daysLeft === 1 ? " day" : " days");
    } else if (daysLeft <= 7) {
      badge.classList.add("soon");
      badge.textContent = daysLeft + " days left";
    } else {
      badge.textContent = daysLeft + " days left";
    }
    top.append(title, badge);
    li.appendChild(top);

    addLine(li, "Stock: " + formatQty(now) + " " + f.unit + " • Uses " + formatQty(f.perDay) + " " + f.unit + "/day");
    if (daysLeft !== null && now > 0) {
      addLine(li, "Runs out about " + formatDate(addDays(parseDate(todayText()), daysLeft)));
    }

    const actions = document.createElement("div");
    actions.className = "item-actions";

    const restockBtn = document.createElement("button");
    restockBtn.textContent = "Restock";
    restockBtn.addEventListener("click", function () { restockFeed(f); });

    const countBtn = document.createElement("button");
    countBtn.textContent = "Count";
    countBtn.addEventListener("click", function () { countFeed(f); });

    const useBtn = document.createElement("button");
    useBtn.textContent = "Daily use";
    useBtn.addEventListener("click", function () { setFeedUse(f); });

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "icon-btn";
    del.addEventListener("click", function () {
      if (!confirm("Delete " + f.name + " from your feed list?")) return;
      feeds = feeds.filter(function (x) { return x.id !== f.id; });
      saveFeeds();
      renderFeed();
    });

    actions.append(restockBtn, countBtn, useBtn, del);
    li.appendChild(actions);
    feedList.appendChild(li);
  });
}

if (feedForm) {
  feedForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("feed-name").value.trim();
    const stock = Number(document.getElementById("feed-stock").value);
    const perDay = Number(document.getElementById("feed-perday").value) || 0;

    if (!name || !(stock >= 0) || !(perDay >= 0)) {
      alert("Please enter a name and the amount you have now.");
      return;
    }

    feeds.push({
      id: Date.now(),
      name: name,
      unit: document.getElementById("feed-unit").value,
      stock: stock,
      perDay: perDay,
      asOf: todayText(),
    });

    saveFeeds();
    renderFeed();
    feedForm.reset();
  });
}


// ===== 9. MORE (settings, backup, install) =====

const appTitle = document.getElementById("app-title");
const farmNameInput = document.getElementById("farm-name");

// Show the saved farm name everywhere it appears
function loadFarmName() {
  const name = localStorage.getItem("farmName") || "";
  farmNameInput.value = name;
  if (appTitle) appTitle.textContent = (name || "Sungura Master");   // hidden bar, harmless
  setText("brand-name", name || "Sungura Master");
  setText("hero-sub", name || "Here's how your farm looks today.");
}

// Redraw everything (used after restoring or deleting data)
function refreshAll() {
  renderRabbits();      // this also refills the Breeding dropdowns
  renderBreedings();
  renderFinance();
  renderFeed();
  loadFarmName();
}

// --- Save the farm name ---
document.getElementById("settings-form").addEventListener("submit", function (event) {
  event.preventDefault();
  localStorage.setItem("farmName", farmNameInput.value.trim());
  dataChanged();
  loadFarmName();
  alert("Saved!");
});

// Everything the app knows, as one object (used by backup files and cloud sync)
function buildBackup() {
  return {
    app: "sungura-master",
    exportedOn: new Date().toISOString(),
    farmName: localStorage.getItem("farmName") || "",
    rabbits: rabbits,
    breedings: breedings,
    transactions: transactions,
    healthRecords: healthRecords,
    tasks: tasks,
    feeds: feeds,
  };
}

// Replace everything in the app with a backup object
function applyBackup(data) {
  rabbits = data.rabbits || [];
  breedings = data.breedings || [];
  transactions = data.transactions || [];
  healthRecords = data.healthRecords || [];
  tasks = data.tasks || [];
  feeds = data.feeds || [];
  localStorage.setItem("farmName", data.farmName || "");

  saveRabbits();
  saveBreedings();
  saveTransactions();
  saveHealth();
  saveTasks();
  saveFeeds();
  refreshAll();
}

// --- Download a backup file ---
document.getElementById("export-btn").addEventListener("click", function () {
  const backup = buildBackup();

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "sungura-backup-" + todayText() + ".json";
  link.click();

  URL.revokeObjectURL(url);
});

// --- Restore from a backup file ---
document.getElementById("import-file").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);

      if (data.app !== "sungura-master") {
        throw new Error("Not a Sungura backup");
      }
      if (!confirm("This will replace your current data. Continue?")) return;

      applyBackup(data);
      alert("Backup restored!");
    } catch (error) {
      alert("That file isn't a valid Sungura backup.");
    }
  };

  reader.readAsText(file);
  event.target.value = ""; // lets you pick the same file again later
});

// --- Delete everything ---
document.getElementById("reset-btn").addEventListener("click", function () {
  if (!confirm("Delete ALL rabbits, breedings, health records, tasks, feed and transactions? This cannot be undone.\n\nIf cloud sync is on, the cloud copy is deleted too.")) return;

  rabbits = [];
  breedings = [];
  transactions = [];
  healthRecords = [];
  tasks = [];
  feeds = [];
  localStorage.removeItem("farmName");

  saveRabbits();
  saveBreedings();
  saveTransactions();
  saveHealth();
  saveTasks();
  saveFeeds();
  refreshAll();
});

// --- Install button (only appears when the browser allows installing) ---
let installPrompt = null;
const installCard = document.getElementById("install-card");

window.addEventListener("beforeinstallprompt", function (event) {
  event.preventDefault();   // stop the browser's own mini-prompt
  installPrompt = event;    // keep it so our button can trigger it
  installCard.hidden = false;
});

document.getElementById("install-btn").addEventListener("click", function () {
  if (!installPrompt) return;
  installPrompt.prompt();
  installPrompt.userChoice.then(function () {
    installPrompt = null;
    installCard.hidden = true;
  });
});

window.addEventListener("appinstalled", function () {
  installCard.hidden = true;
});


// Reopening the app (maybe on a new day): refresh dates, days left and reminders
document.addEventListener("visibilitychange", function () {
  if (!document.hidden) refreshAll();
});

// Lets sync.js read and replace the app's data
window.Sungura = { buildBackup: buildBackup, applyBackup: applyBackup };


// ===== 10. START-UP: runs once when the page loads =====
// This is last on purpose: every function and variable above already exists.

fillCategories();
document.getElementById("fin-date").value = todayText();
document.getElementById("health-date").value = todayText();
if (document.getElementById("task-date")) document.getElementById("task-date").value = todayText();
refreshAll();   // draws rabbits, breedings, health, finances and the farm name


// ===== PWA: register the service worker =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("sw.js");
  });
}