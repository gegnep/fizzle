/* AI-ASSISTED: portions of this file were written with the help of an AI assistant (Claude), per course policy. */
/* guestbook.js: the required form page.
   Validates the required fields inline, saves entries to localStorage under
   "fizzle-guestbook", and re-renders the wall. The email address is validated
   but deliberately never stored. */

(function () {
  "use strict";

  var KEY = "fizzle-guestbook";
  var form, entriesBox, thanks, seeded;

  function load() {
    if (memory) { return memory; }
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(list) === "[object Array]" ? list : [];
    } catch (e) { return []; }
  }

  /* When localStorage is unavailable (private mode, or some file:// setups)
     the wall still works for this visit, it just cannot outlive the tab. */
  var memory = null;

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      memory = null;
      return true;
    } catch (e) {
      memory = list;
      return false;
    }
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return "recently"; }
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function render() {
    var list = load();
    if (!list.length) {
      entriesBox.innerHTML = seeded;
      return;
    }
    entriesBox.innerHTML = "";
    list.slice().reverse().forEach(function (e) {
      var card = document.createElement("div");
      card.className = "fz-entry";

      var who = document.createElement("div");
      who.className = "who";
      var handle = document.createElement("strong");
      handle.textContent = "@" + e.name;
      who.appendChild(handle);
      var meta = " · " + fmtDate(e.dateISO);
      if (e.fav) { meta += " · liked " + e.fav; }
      if (e.rating) { meta += " · " + e.rating; }
      who.appendChild(document.createTextNode(meta));

      var p = document.createElement("p");
      p.textContent = e.message;

      card.appendChild(who);
      card.appendChild(p);
      entriesBox.appendChild(card);
    });
  }

  function setBad(rowId, bad) {
    var row = document.getElementById(rowId);
    if (row) {
      row.classList.toggle("bad", bad);
      var field = row.querySelector("input, textarea");
      if (field) { field.setAttribute("aria-invalid", bad ? "true" : "false"); }
    }
    return !bad;
  }

  function submit(ev) {
    ev.preventDefault();
    var name = document.getElementById("gb-name").value.trim();
    var email = document.getElementById("gb-email").value.trim();
    var msg = document.getElementById("gb-msg").value.trim();
    var fav = document.getElementById("gb-fav").value;
    var ratingEl = form.querySelector('input[name="rating"]:checked');

    var okName = setBad("gb-row-name", name.length === 0);
    var okMail = setBad("gb-row-email", !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    var okMsg = setBad("gb-row-msg", msg.length === 0);

    if (!(okName && okMail && okMsg)) {
      thanks.classList.remove("show");
      var firstBad = form.querySelector(".row.bad input, .row.bad textarea");
      if (firstBad) { firstBad.focus(); }
      return;
    }

    var list = load();
    /* the email is validated above and intentionally not saved */
    list.push({
      name: name.replace(/^@/, ""),
      fav: fav,
      rating: ratingEl ? ratingEl.value : "",
      message: msg,
      dateISO: new Date().toISOString()
    });
    var persisted = save(list);
    render();

    form.reset();
    thanks.textContent = persisted
      ? "Posted. Your note is on the wall below."
      : "Posted for this visit. Your browser is blocking storage, so the note will not survive a reload.";
    thanks.classList.add("show");
    thanks.setAttribute("tabindex", "-1");
    thanks.focus();
  }

  function init() {
    form = document.getElementById("gb-form");
    entriesBox = document.getElementById("gb-entries");
    thanks = document.getElementById("gb-thanks");
    if (!form) { return; }
    /* keep the two starter entries as the empty state */
    seeded = entriesBox.innerHTML;
    form.addEventListener("submit", submit);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
