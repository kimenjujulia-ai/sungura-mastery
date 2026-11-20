// =====================================================================
// SUNGURA MASTER - sync.js  (optional cloud sync)
//
// What it does:
//   - Lets you sign in with an email and password (Supabase Auth)
//   - Keeps ONE copy of your farm data in the cloud, so your phone and
//     laptop share the same rabbits, breedings, health, tasks and feed
//   - Your data is always saved on the device first, so the app still
//     works offline. Changes are sent when the internet is back.
//
// If you never fill in the two settings below, the app works exactly
// as before and the Cloud sync card says it isn't set up.
// =====================================================================

(function () {
  "use strict";

  // ===== 1. YOUR SETTINGS (Supabase dashboard > Project Settings > API Keys) =====
  var SUPABASE_URL = "https://your-url-from-the-dashboard.supabase.co";
  var SUPABASE_KEY = "sb_publishable_your-full-key-here";  // starts with sb_publishable_  (NEVER the secret key)
  var TABLE = "farms";


  // ===== 2. SETUP =====
  var SESSION_KEY = "sungura_session";    // who is signed in on this device
  var META_KEY = "sungura_syncmeta";      // what version of the cloud copy we last saw

  function $(id) { return document.getElementById(id); }

  if (!$("sync-card")) return;            // the Cloud sync card isn't in the HTML

  function show(id, visible) { var el = $(id); if (el) el.hidden = !visible; }
  function setStatus(text) { var el = $("sync-status"); if (el) el.textContent = text; }

  var configured = SUPABASE_URL.indexOf("YOUR-PROJECT") === -1 &&
                   SUPABASE_KEY.indexOf("YOUR-PUBLISHABLE") === -1;

  if (!configured) {
    show("sync-out", false);
    show("sync-in", false);
    setStatus("Cloud sync isn't set up yet. Add your Supabase details to sync.js to turn it on.");
    return;
  }

  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  var session = readJSON(SESSION_KEY);    // { access_token, refresh_token, expires_at, user_id, email }
  var meta = readJSON(META_KEY) || { version: 0, dirty: false, user_id: "" };

  var applying = false;    // true while we are writing cloud data into the app
  var syncing = false;     // true while a sync is running
  var again = false;       // something changed during a sync, so run once more
  var changes = 0;         // counts local changes
  var timer = null;


  // ===== 3. TALKING TO SUPABASE =====

  // Sign in, sign up and refresh all go through here
  function authRequest(path, body) {
    return fetch(SUPABASE_URL + "/auth/v1/" + path, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) {
          var err = new Error(json.error_description || json.msg || json.message || "Request failed");
          err.auth = true;
          throw err;
        }
        return json;
      });
    });
  }

  function storeSession(json) {
    session = {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: Date.now() + (json.expires_in || 3600) * 1000,
      user_id: json.user.id,
      email: json.user.email,
    };
    writeJSON(SESSION_KEY, session);
  }

  // Logins expire after about an hour, so renew quietly when needed
  function ensureToken() {
    if (!session) return Promise.reject(new Error("Not signed in"));
    if (session.expires_at - Date.now() > 60000) return Promise.resolve(session.access_token);

    return authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then(function (json) { storeSession(json); return session.access_token; });
  }

  // Reads and writes your row in the "farms" table.
  // Note: the publishable key goes in "apikey"; the Authorization header carries YOUR login.
  function dataRequest(method, query, body, prefer) {
    return ensureToken().then(function (token) {
      var headers = {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      };
      if (prefer) headers.Prefer = prefer;

      return fetch(SUPABASE_URL + "/rest/v1/" + TABLE + query, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    }).then(function (res) {
      if (res.status === 409) {
        var conflict = new Error("conflict");
        conflict.conflict = true;
        throw conflict;
      }
      if (!res.ok) {
        return res.text().then(function (text) {
          var err = new Error("Cloud error " + res.status + ": " + text.slice(0, 120));
          err.auth = res.status === 401;
          throw err;
        });
      }
      return res.status === 204 ? null : res.json();
    });
  }


  // ===== 4. THE SYNC LOGIC =====

  function localData() { return window.Sungura.buildBackup(); }

  function count(list) { return (list || []).length; }

  function isEmpty(d) {
    return !(count(d.rabbits) || count(d.breedings) || count(d.transactions) ||
             count(d.healthRecords) || count(d.tasks) || count(d.feeds) || d.farmName);
  }

  function saveMeta() { writeJSON(META_KEY, meta); }

  // Put cloud data into the app
  function pull(remote) {
    if (!remote.data || remote.data.app !== "sungura-master") {
      throw new Error("The cloud data isn't a Sungura backup.");
    }
    applying = true;                    // so our own writes don't count as new changes
    try { window.Sungura.applyBackup(remote.data); }
    finally { applying = false; }

    meta = { version: remote.version, dirty: false, user_id: session.user_id };
    saveMeta();
  }

  // Send this device's data to the cloud (only if nobody changed it meanwhile)
  function push(local, version) {
    var snapshot = changes;
    var request = version === 0
      ? dataRequest("POST", "", { user_id: session.user_id, data: local, version: 1 }, "return=representation")
      : dataRequest(
          "PATCH",
          "?user_id=eq." + session.user_id + "&version=eq." + version,
          { data: local, version: version + 1, updated_at: new Date().toISOString() },
          "return=representation"
        );

    return request.then(function (rows) {
      if (!rows || rows.length === 0) {         // nothing matched: the version moved on
        var conflict = new Error("conflict");
        conflict.conflict = true;
        throw conflict;
      }
      meta = { version: rows[0].version, dirty: changes !== snapshot, user_id: session.user_id };
      saveMeta();
      if (meta.dirty) again = true;             // more edits arrived while sending
    });
  }

  // Both sides changed: let the farmer choose. Nothing is merged silently.
  function resolveConflict(local, remote) {
    var useCloud = confirm(
      "This device and the cloud both have data the other doesn't.\n\n" +
      "Cloud: " + count(remote.data.rabbits) + " rabbits\n" +
      "This device: " + count(local.rabbits) + " rabbits\n\n" +
      "OK = use the CLOUD copy (replaces this device)\n" +
      "Cancel = keep THIS DEVICE (replaces the cloud)\n\n" +
      "Not sure? Cancel, then download a backup on the More page first."
    );
    return useCloud ? pull(remote) : push(local, remote.version);
  }

  function pullAndPush() {
    return dataRequest("GET", "?select=data,version&user_id=eq." + session.user_id).then(function (rows) {
      var local = localData();
      var remote = rows && rows[0];

      // Nothing in the cloud yet
      if (!remote) {
        if (isEmpty(local)) return;
        return push(local, 0);
      }

      // We are up to date with the cloud
      if (meta.version === remote.version) {
        return meta.dirty ? push(local, remote.version) : undefined;
      }

      // The cloud has something we haven't seen
      if (!meta.dirty && (meta.version > 0 || isEmpty(local))) return pull(remote);

      // Both sides have changes
      return resolveConflict(local, remote);
    });
  }

  function clock() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function describe(err) {
    if (err && err.name === "TypeError") {
      return "Offline. Your changes are saved here and will sync when you're back online.";
    }
    if (err && err.conflict) return "The cloud changed while syncing. Press Sync now to try again.";
    return (err && err.message) || "Something went wrong.";
  }

  function handleError(err) {
    if (err && err.auth) {
      signOut("Please sign in again. (" + describe(err) + ")");
    } else {
      setStatus(describe(err));
    }
  }

  function syncNow() {
    if (!session) return Promise.resolve();
    if (syncing) { again = true; return Promise.resolve(); }

    syncing = true;
    setStatus("Syncing…");

    return pullAndPush()
      .catch(function (err) {
        if (err && err.conflict) return pullAndPush();   // the cloud moved on: look again once
        throw err;
      })
      .then(function () { setStatus("Synced at " + clock()); })
      .catch(handleError)
      .then(function () {
        syncing = false;
        if (again) { again = false; return syncNow(); }
      });
  }


  // ===== 5. SIGN IN / SIGN UP / SIGN OUT =====

  function render() {
    show("sync-out", !session);
    show("sync-in", !!session);
    var account = $("sync-account");
    if (account && session) account.textContent = "Signed in as " + session.email;
  }

  function afterSignIn(json) {
    storeSession(json);
    if (meta.user_id !== session.user_id) {       // a different person: start fresh
      meta = { version: 0, dirty: false, user_id: session.user_id };
      saveMeta();
    }
    render();
    return syncNow();
  }

  function signOut(message) {
    session = null;
    localStorage.removeItem(SESSION_KEY);
    meta = { version: 0, dirty: false, user_id: "" };
    saveMeta();
    render();
    setStatus(message || "Signed out. Your data stays on this device.");
  }

  function credentials() {
    var email = ($("sync-email").value || "").trim();
    var password = $("sync-password").value || "";
    if (!email || password.length < 6) {
      setStatus("Enter your email and a password of at least 6 characters.");
      return null;
    }
    return { email: email, password: password };
  }

  function busy(isBusy) {
    ["sync-signin", "sync-signup", "sync-now", "sync-signout"].forEach(function (id) {
      var el = $(id);
      if (el) el.disabled = isBusy;
    });
  }

  function doSignIn() {
    var c = credentials();
    if (!c) return;
    busy(true);
    setStatus("Signing in…");
    authRequest("token?grant_type=password", c)
      .then(afterSignIn)
      .catch(function (err) { setStatus(describe(err)); })
      .then(function () { busy(false); });
  }

  function doSignUp() {
    var c = credentials();
    if (!c) return;
    busy(true);
    setStatus("Creating your account…");
    authRequest("signup", c)
      .then(function (json) {
        if (json.access_token) return afterSignIn(json);   // confirmation is switched off
        setStatus("Account created. Check your email to confirm it, then press Sign in.");
      })
      .catch(function (err) { setStatus(describe(err)); })
      .then(function () { busy(false); });
  }

  if ($("sync-form")) {
    $("sync-form").addEventListener("submit", function (event) {
      event.preventDefault();
      doSignIn();
    });
  }
  if ($("sync-signup")) $("sync-signup").addEventListener("click", doSignUp);
  if ($("sync-now")) $("sync-now").addEventListener("click", function () { syncNow(); });
  if ($("sync-signout")) {
    $("sync-signout").addEventListener("click", function () {
      if (confirm("Sign out? Your data stays on this device, but it will stop syncing.")) signOut();
    });
  }


  // ===== 6. WHEN TO SYNC =====

  // Any change in the app: wait 2 seconds (in case you're still typing), then send it
  document.addEventListener("sungura:changed", function () {
    if (applying || !session) return;
    changes++;
    meta.dirty = true;
    saveMeta();
    clearTimeout(timer);
    timer = setTimeout(syncNow, 2000);
  });

  // Coming back to the app, getting internet back, and every 2 minutes while it's open
  document.addEventListener("visibilitychange", function () { if (!document.hidden) syncNow(); });
  window.addEventListener("online", function () { syncNow(); });
  setInterval(function () { if (!document.hidden) syncNow(); }, 120000);

  // Handy for testing from the browser console
  window.SungurSync = { syncNow: syncNow };


  // ===== 7. START =====
  render();
  if (session) {
    setStatus("Signed in. Syncing…");
    syncNow();
  } else {
    setStatus("Not signed in. Your data is only on this device.");
  }
})();