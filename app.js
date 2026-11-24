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
//   9. Hutch view (cages in rows and columns)
//  10. Herd report
//  11. More (settings, backup, install)
//  12. Start-up (runs last, so everything above already exists)
// =====================================================================


// ===== 1. NAVIGATION =====

const buttons = document.querySelectorAll(".bottom-nav button");
const pages = document.querySelectorAll(".page");

// Pages that live under another nav button (so that button stays highlighted)
const NAV_FOR = { feed: "home", reminders: "home", report: "rabbits" };

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
function daysToText(days) {
  if (days < 14) return days + (days === 1 ? " day" : " days");
  if (days < 84) return Math.floor(days / 7) + " weeks";
  const months = Math.floor(days / 30.44);
  if (months < 24) return months + " months";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return years + " yr" + (rest ? " " + rest + " mo" : "");
}

function ageText(dob) {
  if (!dob) return "";
  const days = Math.floor((new Date() - new Date(dob + "T00:00:00")) / 86400000);
  if (days < 0) return "";
  return daysToText(days);
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

// Ask for a new weight and save it (used by the rabbit card and the cage pop-up)
function addWeight(rabbit) {
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
    weightBtn.addEventListener("click", function () { addWeight(rabbit); });

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
  renderHutch();
  fillCageSelect();
  refreshSheet();
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

  const box = document.getElementById("rabbit-box");
  if (box) box.open = false;   // fold the form away again
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
  renderHutch();
  refreshSheet();
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
  renderHutch();
  refreshSheet();

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

    const box = document.getElementById("task-box");
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


// ===== 9. HUTCH VIEW (cages in rows and columns) =====

let hutch = JSON.parse(localStorage.getItem("hutch")) || { cols: 5, rows: 3 };

const hutchGrid = document.getElementById("hutch-grid");
const hutchPanel = document.getElementById("hutch-panel");
const listPanel = document.getElementById("list-panel");
const sheet = document.getElementById("cage-dialog");
let sheetState = null;   // what the pop-up shows: { kind: "cage", id } or { kind: "rabbit", name }

function saveHutch() {
  localStorage.setItem("hutch", JSON.stringify(hutch));
  dataChanged();
}

// Cage names: a letter for the row (A is the top row) and a number for the column (1 is on the left)
function makeCageIds(cols, rows) {
  const ids = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c <= cols; c++) ids.push(String.fromCharCode(65 + r) + c);
  }
  return ids;
}

function cageIds() {
  return makeCageIds(hutch.cols, hutch.rows);
}

// "a 3", "A-3" and "a3" all mean cage A3
function normalizeCage(text) {
  return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Active rabbits grouped by cage. Rabbits whose cage isn't on the grid go in "unplaced".
function rabbitsByCage() {
  const valid = new Set(cageIds());
  const map = {};
  const unplaced = [];

  rabbits.forEach(function (r) {
    if (statusOf(r) !== "Active") return;
    const id = normalizeCage(r.cage);
    if (valid.has(id)) {
      (map[id] = map[id] || []).push(r);
    } else {
      unplaced.push(r);
    }
  });

  return { map: map, unplaced: unplaced };
}

function sexKind(r) {
  if (r.sex.startsWith("Buck")) return "buck";
  if (r.sex.startsWith("Doe")) return "doe";
  return "kit";
}

function daysPhrase(left) {
  if (left < 0) return "overdue by " + Math.abs(left) + (Math.abs(left) === 1 ? " day" : " days");
  if (left === 0) return "today";
  return "in " + left + (left === 1 ? " day" : " days");
}

// Small words on a cage: "Due" (kindling within a week) and "Hold" (medicine withdrawal)
function cageFlags(here) {
  const flags = [];

  const due = here.some(function (r) {
    return breedings.some(function (b) {
      return b.doe === r.name && !b.kindled &&
        daysUntil(addDays(parseDate(b.matingDate), GESTATION_DAYS)) <= 7;
    });
  });
  if (due) flags.push("Due");

  if (here.some(function (r) { return withdrawalFor(r.name); })) flags.push("Hold");
  return flags;
}

function occupancyLabel(id, map) {
  const n = (map[id] || []).length;
  if (n === 0) return id + " (empty)";
  return id + " (" + n + (n === 1 ? " rabbit)" : " rabbits)");
}

// Fill a dropdown with every cage, showing how many rabbits are in each
function fillCageOptions(select, firstLabel, map) {
  select.innerHTML = "";
  const first = document.createElement("option");
  first.value = "";
  first.textContent = firstLabel;
  select.appendChild(first);

  cageIds().forEach(function (id) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = occupancyLabel(id, map);
    select.appendChild(option);
  });
}

// The Cage dropdown on the Add Rabbit form
function fillCageSelect() {
  const select = document.getElementById("rabbit-cage");
  if (!select || select.tagName === "INPUT") return;   // an old text box: leave it alone
  const keep = select.value;
  fillCageOptions(select, "No cage yet", rabbitsByCage().map);
  keepChoice(select, keep);
}

function moveRabbit(rabbit, cage) {
  rabbit.cage = cage;
  saveRabbits();
  renderRabbits();   // this redraws the hutch and the pop-up too
}

// ----- Drawing the hutch -----
function renderHutch() {
  if (!hutchGrid) return;

  const found = rabbitsByCage();
  hutchGrid.style.setProperty("--cols", hutch.cols);
  hutchGrid.innerHTML = "";

  cageIds().forEach(function (id) {
    const here = found.map[id] || [];

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cage " + (here.length ? "occupied" : "empty");

    const label = document.createElement("span");
    label.className = "cage-label";
    label.textContent = id;
    cell.appendChild(label);

    if (here.length === 0) {
      const none = document.createElement("span");
      none.className = "cage-more";
      none.textContent = "Empty";
      cell.appendChild(none);
    } else {
      // The cage takes the colour of its main resident: a doe beats a buck beats kits
      const kinds = here.map(sexKind);
      cell.classList.add("has-" + (kinds.indexOf("doe") !== -1 ? "doe" : kinds.indexOf("buck") !== -1 ? "buck" : "kit"));

      const name = document.createElement("span");
      name.className = "cage-name";
      name.textContent = here[0].name;
      cell.appendChild(name);

      if (here.length > 1) {
        const more = document.createElement("span");
        more.className = "cage-more";
        more.textContent = "+" + (here.length - 1) + " more";
        cell.appendChild(more);
      }

      const flags = cageFlags(here);
      if (flags.length) {
        const row = document.createElement("span");
        row.className = "cage-flags";
        flags.forEach(function (f) {
          const flag = document.createElement("span");
          flag.className = "cage-flag" + (f === "Hold" ? " hold" : "");
          flag.textContent = f;
          row.appendChild(flag);
        });
        cell.appendChild(row);
      }
    }

    cell.addEventListener("click", function () { openSheet({ kind: "cage", id: id }); });
    hutchGrid.appendChild(cell);
  });

  // Rabbits that aren't in any cage on the grid (older records, or a smaller layout)
  const box = document.getElementById("unplaced");
  const ul = document.getElementById("unplaced-list");
  if (box && ul) {
    box.hidden = found.unplaced.length === 0;
    ul.innerHTML = "";

    found.unplaced.forEach(function (r) {
      const li = document.createElement("li");
      li.className = "rabbit-item unplaced-item";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = r.name;
      const sub = document.createElement("small");
      sub.className = "rabbit-line";
      sub.textContent = r.sex + (r.cage ? " \u2022 old cage note: " + r.cage : "");
      info.append(name, sub);

      const place = document.createElement("select");
      fillCageOptions(place, "Place in a cage...", found.map);
      place.addEventListener("change", function () {
        if (place.value) moveRabbit(r, place.value);
      });

      const details = document.createElement("button");
      details.type = "button";
      details.textContent = "Details";
      details.addEventListener("click", function () { openSheet({ kind: "rabbit", name: r.name }); });

      const controls = document.createElement("div");
      controls.className = "unplaced-controls";
      controls.append(place, details);

      li.append(info, controls);
      ul.appendChild(li);
    });
  }

  // Keep the layout form in step with the saved layout
  const colsInput = document.getElementById("hutch-cols");
  const rowsInput = document.getElementById("hutch-rows");
  if (colsInput) colsInput.value = hutch.cols;
  if (rowsInput) rowsInput.value = hutch.rows;
}

// ----- The pop-up that shows a cage (or one rabbit) in detail -----
function detailRow(parent, label, value) {
  if (!value) return;
  const row = document.createElement("div");
  row.className = "detail-row";
  const l = document.createElement("span");
  l.className = "detail-label";
  l.textContent = label;
  const v = document.createElement("span");
  v.className = "detail-value";
  v.textContent = value;
  row.append(l, v);
  parent.appendChild(row);
}

function rabbitDetailCard(r) {
  const card = document.createElement("div");
  card.className = "detail-card";

  const head = document.createElement("div");
  head.className = "detail-head";
  const name = document.createElement("strong");
  name.textContent = r.name;
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = r.sex;
  head.append(name, badge);
  card.appendChild(head);

  detailRow(card, "Breed", r.breed);
  detailRow(card, "Age", r.dob ? ageText(r.dob) + " (born " + formatDate(parseDate(r.dob)) + ")" : "Birth date not recorded");
  detailRow(card, "Cage", normalizeCage(r.cage) ? r.cage : "Not in a cage");

  const w = latestWeight(r);
  if (w) {
    let text = w.kg + " kg on " + formatDate(parseDate(w.date));
    if (r.weights.length > 1) {
      const prev = r.weights[r.weights.length - 2];
      const diff = Math.round((w.kg - prev.kg) * 100) / 100;
      text += " (" + (diff >= 0 ? "+" : "") + diff + " kg since " + formatDate(parseDate(prev.date)) + ")";
    }
    detailRow(card, "Weight", text);
  }

  if (r.sire || r.dam) {
    detailRow(card, "Parents", "Father " + (r.sire || "unknown") + ", mother " + (r.dam || "unknown"));
  }

  // Breeding: a doe's pregnancy or last litter, a buck's number of matings
  if (r.sex.startsWith("Doe")) {
    const pregnant = breedings.find(function (b) { return b.doe === r.name && !b.kindled; });
    if (pregnant) {
      const due = addDays(parseDate(pregnant.matingDate), GESTATION_DAYS);
      detailRow(card, "Pregnancy", "Mated " + formatDate(parseDate(pregnant.matingDate)) +
        (pregnant.buck ? " with " + pregnant.buck : "") + ", due " + formatDate(due) +
        " (" + daysPhrase(daysUntil(due)) + ")");
    } else {
      const litters = breedings
        .filter(function (b) { return b.doe === r.name && b.kindled && b.kindledDate; })
        .sort(function (a, b) { return b.kindledDate.localeCompare(a.kindledDate); });
      if (litters.length) {
        detailRow(card, "Last litter", litters[0].litterSize + " kits, born " + formatDate(parseDate(litters[0].kindledDate)));
      }
    }
  } else if (r.sex.startsWith("Buck")) {
    const matings = breedings.filter(function (b) { return b.buck === r.name; }).length;
    if (matings) detailRow(card, "Matings", matings + " recorded");
  }

  // Health
  const records = healthRecords
    .filter(function (h) { return h.rabbit === r.name || h.rabbit === ALL_HERD; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });
  if (records.length) {
    detailRow(card, "Last health record", records[0].title + " (" + records[0].type.toLowerCase() + ", " + formatDate(parseDate(records[0].date)) + ")");
  }
  const upcoming = records
    .filter(function (h) { return h.nextDue && !h.nextDone; })
    .sort(function (a, b) { return a.nextDue.localeCompare(b.nextDue); })[0];
  if (upcoming) {
    detailRow(card, "Next health task", upcoming.title + " on " + formatDate(parseDate(upcoming.nextDue)) +
      " (" + daysPhrase(daysUntil(parseDate(upcoming.nextDue))) + ")");
  }
  const hold = withdrawalFor(r.name);
  if (hold) detailRow(card, "Withdrawal", "Do not sell or slaughter until " + formatDate(hold));

  detailRow(card, "Notes", r.notes);

  // Actions
  const actions = document.createElement("div");
  actions.className = "item-actions";

  const weightBtn = document.createElement("button");
  weightBtn.type = "button";
  weightBtn.textContent = "Weight";
  weightBtn.addEventListener("click", function () { addWeight(r); });

  const moveSelect = document.createElement("select");
  fillCageOptions(moveSelect, "Move to...", rabbitsByCage().map);
  const none = document.createElement("option");
  none.value = "__none__";
  none.textContent = "Not in a cage";
  moveSelect.appendChild(none);
  moveSelect.addEventListener("change", function () {
    if (!moveSelect.value) return;
    moveRabbit(r, moveSelect.value === "__none__" ? "" : moveSelect.value);
  });

  const healthBtn = document.createElement("button");
  healthBtn.type = "button";
  healthBtn.textContent = "Add health record";
  healthBtn.addEventListener("click", function () { goToHealth(r); });

  actions.append(weightBtn, moveSelect, healthBtn);
  card.appendChild(actions);
  return card;
}

function renderSheet() {
  if (!sheetState) return;
  const body = document.getElementById("sheet-body");
  const title = document.getElementById("sheet-title");
  if (!body || !title) return;

  let list;
  let cageId = "";

  if (sheetState.kind === "cage") {
    cageId = sheetState.id;
    list = rabbitsByCage().map[cageId] || [];
    title.textContent = "Cage " + cageId + (list.length ? " \u2022 " + list.length + (list.length === 1 ? " rabbit" : " rabbits") : " \u2022 empty");
  } else {
    const r = findRabbit(sheetState.name);
    list = r && statusOf(r) === "Active" ? [r] : [];
    title.textContent = sheetState.name;
  }

  body.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = cageId ? "Nobody is in this cage." : "This rabbit is no longer on the farm.";
    body.appendChild(empty);
  }

  list.forEach(function (r) { body.appendChild(rabbitDetailCard(r)); });

  if (cageId) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "action-btn secondary";
    add.textContent = list.length ? "Add another rabbit to " + cageId : "Add a rabbit to " + cageId;
    add.addEventListener("click", function () { startAddRabbit(cageId); });
    body.appendChild(add);
  }
}

function openSheet(state) {
  sheetState = state;
  renderSheet();
  if (sheet && !sheet.open) {
    if (sheet.showModal) sheet.showModal();
    else sheet.setAttribute("open", "");
  }
}

function closeSheet() {
  sheetState = null;
  if (sheet && sheet.open) {
    if (sheet.close) sheet.close();
    else sheet.removeAttribute("open");
  }
}

function refreshSheet() {
  if (sheetState) renderSheet();
}

// Jump to the Add Rabbit form with the cage already chosen
function startAddRabbit(cageId) {
  closeSheet();
  showPage("rabbits");
  setRabbitView("hutch");

  const box = document.getElementById("rabbit-box");
  if (box) box.open = true;

  const select = document.getElementById("rabbit-cage");
  if (select && cageId) keepChoice(select, cageId);

  if (box && box.scrollIntoView) box.scrollIntoView({ behavior: "smooth", block: "start" });
  const nameInput = document.getElementById("rabbit-name");
  if (nameInput && nameInput.focus) nameInput.focus();
}

// Jump to the Health form with this rabbit already chosen
function goToHealth(r) {
  closeSheet();
  showPage("health");
  keepChoice(healthRabbit, r.name);
}

if (sheet) {
  // Clicking the dark area around the pop-up closes it
  sheet.addEventListener("click", function (event) { if (event.target === sheet) closeSheet(); });
  // Esc or the Close button
  sheet.addEventListener("close", function () { sheetState = null; });
  const closeBtn = document.getElementById("sheet-close");
  if (closeBtn) closeBtn.addEventListener("click", closeSheet);
}

// ----- Hutch or List -----
function setRabbitView(view) {
  localStorage.setItem("rabbitView", view);
  if (hutchPanel) hutchPanel.hidden = view !== "hutch";
  if (listPanel) listPanel.hidden = view !== "list";
  const hutchBtn = document.getElementById("view-hutch");
  const listBtn = document.getElementById("view-list");
  if (hutchBtn) hutchBtn.classList.toggle("active", view === "hutch");
  if (listBtn) listBtn.classList.toggle("active", view === "list");
}

(function () {
  const hutchBtn = document.getElementById("view-hutch");
  const listBtn = document.getElementById("view-list");
  if (hutchBtn) hutchBtn.addEventListener("click", function () { setRabbitView("hutch"); });
  if (listBtn) listBtn.addEventListener("click", function () { setRabbitView("list"); });
  setRabbitView(localStorage.getItem("rabbitView") === "list" ? "list" : "hutch");
})();

// ----- Changing how many cages you have (More page) -----
const hutchForm = document.getElementById("hutch-form");
if (hutchForm) {
  hutchForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const cols = Math.floor(Number(document.getElementById("hutch-cols").value));
    const rows = Math.floor(Number(document.getElementById("hutch-rows").value));
    if (!(cols >= 1 && cols <= 10 && rows >= 1 && rows <= 8)) {
      alert("Columns can be 1 to 10, and rows 1 to 8.");
      return;
    }

    // Would any rabbit lose its cage?
    const staying = new Set(makeCageIds(cols, rows));
    const losing = rabbits.filter(function (r) {
      return statusOf(r) === "Active" && normalizeCage(r.cage) && !staying.has(normalizeCage(r.cage));
    });
    if (losing.length && !confirm(losing.length + (losing.length === 1 ? " rabbit is" : " rabbits are") +
        " in cages that won't exist any more. They move to \"Not in a cage\" and nothing is deleted.\n\nContinue?")) {
      return;
    }

    hutch = { cols: cols, rows: rows };
    saveHutch();
    renderRabbits();
    alert("Hutch layout saved.");
  });
}


// ===== 10. HERD REPORT =====

// Edit these to change the age groups (the numbers are days)
const AGE_BANDS = [
  { label: "Under 5 weeks (kits)", min: 0, max: 34 },
  { label: "5 weeks to 4 months (growers)", min: 35, max: 119 },
  { label: "4 to 12 months (young adults)", min: 120, max: 364 },
  { label: "Over 1 year (mature)", min: 365, max: Infinity },
];

const reportBody = document.getElementById("report-body");

function ageInDays(r) {
  if (!r.dob) return null;
  const days = Math.floor((new Date() - parseDate(r.dob)) / 86400000);
  return days < 0 ? null : days;
}

function sexGroup(r) {
  if (r.sex.startsWith("Doe")) return "Does";
  if (r.sex.startsWith("Buck")) return "Bucks";
  return "Unsexed";
}

// Counts everything for the report (only rabbits that are still on the farm)
function buildReport() {
  const active = rabbits.filter(function (r) { return statusOf(r) === "Active"; });

  const report = {
    generated: new Date(),
    total: active.length,
    sex: { Does: 0, Bucks: 0, Unsexed: 0 },
    bands: AGE_BANDS.map(function (b) {
      return { label: b.label, min: b.min, max: b.max, Does: 0, Bucks: 0, Unsexed: 0 };
    }),
    unknownAge: { label: "Age not recorded", Does: 0, Bucks: 0, Unsexed: 0 },
    breeds: {},
    ages: [],
    oldest: null,
    youngest: null,
    sold: rabbits.filter(function (r) { return statusOf(r) === "Sold"; }).length,
    deceased: rabbits.filter(function (r) { return statusOf(r) === "Deceased"; }).length,
  };

  active.forEach(function (r) {
    const group = sexGroup(r);
    report.sex[group]++;
    report.breeds[r.breed] = (report.breeds[r.breed] || 0) + 1;

    const days = ageInDays(r);
    if (days === null) {
      report.unknownAge[group]++;
      return;
    }

    report.ages.push(days);
    const band = report.bands.find(function (b) { return days >= b.min && days <= b.max; });
    band[group]++;

    if (!report.oldest || days > report.oldest.days) report.oldest = { name: r.name, days: days };
    if (!report.youngest || days < report.youngest.days) report.youngest = { name: r.name, days: days };
  });

  const found = rabbitsByCage();
  report.cagesTotal = cageIds().length;
  report.cagesUsed = Object.keys(found.map).length;
  report.unplaced = found.unplaced.length;
  return report;
}

// Small helper: make an element with a class and some text
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function makeTable(headers, rows, lastRowIsTotal) {
  const wrap = el("div", "report-table-wrap");
  const table = document.createElement("table");

  const headRow = document.createElement("tr");
  headers.forEach(function (h) { headRow.appendChild(el("th", "", h)); });
  const thead = document.createElement("thead");
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach(function (row, i) {
    const tr = document.createElement("tr");
    if (lastRowIsTotal && i === rows.length - 1) tr.className = "total-row";
    row.forEach(function (cellText) { tr.appendChild(el("td", "", String(cellText))); });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

function renderReport() {
  if (!reportBody) return;
  const r = buildReport();
  const farm = localStorage.getItem("farmName") || "Your farm";

  reportBody.innerHTML = "";
  reportBody.appendChild(el("h3", "report-title", farm + ": herd report"));
  reportBody.appendChild(el("p", "report-date",
    "Generated " + formatDate(r.generated) + " at " +
    r.generated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })));

  if (r.total === 0) {
    reportBody.appendChild(el("p", "empty", "There are no active rabbits yet."));
    return;
  }

  // Big numbers
  const cards = el("div", "report-cards");
  [["Total herd", r.total], ["Does", r.sex.Does], ["Bucks", r.sex.Bucks], ["Unsexed kits", r.sex.Unsexed]]
    .forEach(function (pair) {
      const card = el("div", "report-card");
      card.append(el("small", "", pair[0]), el("strong", "", String(pair[1])));
      cards.appendChild(card);
    });
  reportBody.appendChild(cards);

  // Age group by sex
  reportBody.appendChild(el("h4", "", "Age and sex"));
  const ageRows = r.bands.map(function (b) {
    return [b.label, b.Does, b.Bucks, b.Unsexed, b.Does + b.Bucks + b.Unsexed];
  });
  const u = r.unknownAge;
  if (u.Does + u.Bucks + u.Unsexed > 0) ageRows.push([u.label, u.Does, u.Bucks, u.Unsexed, u.Does + u.Bucks + u.Unsexed]);
  ageRows.push(["Total", r.sex.Does, r.sex.Bucks, r.sex.Unsexed, r.total]);
  reportBody.appendChild(makeTable(["Age group", "Does", "Bucks", "Unsexed", "Total"], ageRows, true));

  // Breeds
  reportBody.appendChild(el("h4", "", "Breeds"));
  const breedRows = Object.keys(r.breeds)
    .sort(function (a, b) { return r.breeds[b] - r.breeds[a]; })
    .map(function (name) {
      return [name, r.breeds[name], Math.round((r.breeds[name] / r.total) * 100) + "%"];
    });
  reportBody.appendChild(makeTable(["Breed", "Rabbits", "Share"], breedRows, false));

  // Key facts
  reportBody.appendChild(el("h4", "", "Key facts"));
  const facts = el("ul", "report-facts");
  if (r.ages.length) {
    const avg = r.ages.reduce(function (a, b) { return a + b; }, 0) / r.ages.length;
    facts.appendChild(el("li", "", "Average age: " + daysToText(Math.round(avg))));
    facts.appendChild(el("li", "", "Oldest: " + r.oldest.name + " (" + daysToText(r.oldest.days) + ")"));
    facts.appendChild(el("li", "", "Youngest: " + r.youngest.name + " (" + daysToText(r.youngest.days) + ")"));
  }
  facts.appendChild(el("li", "", "Cages in use: " + r.cagesUsed + " of " + r.cagesTotal));
  if (r.unplaced > 0) facts.appendChild(el("li", "", r.unplaced + (r.unplaced === 1 ? " rabbit is" : " rabbits are") + " not in a cage"));
  const unknown = u.Does + u.Bucks + u.Unsexed;
  if (unknown > 0) facts.appendChild(el("li", "", unknown + (unknown === 1 ? " rabbit has" : " rabbits have") + " no birth date recorded"));
  facts.appendChild(el("li", "", "On record: " + r.sold + " sold, " + r.deceased + " deceased"));
  reportBody.appendChild(facts);
}

// One spreadsheet-friendly line per rabbit (opens in Excel or Google Sheets)
function csvCell(value) {
  const text = String(value === undefined || value === null ? "" : value);
  return /[",\n]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text;
}

function buildCsvText() {
  const rows = [["Tag", "Breed", "Sex", "Date of birth", "Age", "Cage", "Status", "Latest weight (kg)"]];
  rabbits.forEach(function (r) {
    const w = latestWeight(r);
    rows.push([r.name, r.breed, r.sex, r.dob, ageText(r.dob), r.cage, statusOf(r), w ? w.kg : ""]);
  });
  return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
}

function downloadCsv() {
  const blob = new Blob(["\uFEFF" + buildCsvText()], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "herd-list-" + todayText() + ".csv";
  link.click();
  URL.revokeObjectURL(url);
}

(function () {
  const generate = document.getElementById("report-generate");
  const print = document.getElementById("report-print");
  const csv = document.getElementById("report-csv");

  if (reportBody) reportBody.appendChild(el("p", "empty", "Press \"Generate report\" to create a snapshot of your herd as it is today."));

  if (generate) {
    generate.addEventListener("click", function () {
      renderReport();
      if (print) print.hidden = false;
      if (csv) csv.hidden = false;
    });
  }
  if (print) print.addEventListener("click", function () { window.print(); });
  if (csv) csv.addEventListener("click", downloadCsv);
})();


// ===== 11. MORE (settings, backup, install) =====

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
    hutch: hutch,
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
  hutch = data.hutch || { cols: 5, rows: 3 };
  localStorage.setItem("farmName", data.farmName || "");

  saveRabbits();
  saveBreedings();
  saveTransactions();
  saveHealth();
  saveTasks();
  saveFeeds();
  saveHutch();
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


// ===== 12. START-UP: runs once when the page loads =====
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