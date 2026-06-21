/* ============================================================
   auth.js — Login / Register logic for the static ReViet site.

   Since there is no backend, the strategy is:
     - users.json  : read-only seed data (bcrypt hashes — cannot verify)
     - localStorage "rv_users" : registered users stored as plain objects
     - sessionStorage "rv_session" : active login session

   Flow:
     Register  → validate → check duplicate email (json + localStorage)
               → save to localStorage → switch to Login tab w/ success msg
     Login     → look up email in localStorage registered users
               → compare plain password → save session → redirect to home
   ============================================================ */

(function () {

  /* ---------- helpers ---------- */
  function getRegistered() {
    try { return JSON.parse(localStorage.getItem("rv_users") || "[]"); }
    catch (e) { return []; }
  }

  function saveRegistered(list) {
    localStorage.setItem("rv_users", JSON.stringify(list));
  }

  function setSession(user) {
    sessionStorage.setItem("rv_session", JSON.stringify({
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role
    }));
  }

  function showMsg(el, text, isError) {
    el.textContent = text;
    el.className = "auth-msg " + (isError ? "auth-msg--err" : "auth-msg--ok");
    el.style.display = "block";
  }

  function switchToLogin(msg) {
    var tabs = document.querySelectorAll(".auth-tab");
    var views = document.querySelectorAll(".auth-view");
    tabs.forEach(function (t) { t.classList.remove("active"); });
    views.forEach(function (v) { v.classList.remove("active"); });
    document.querySelector('[data-target="login"]').classList.add("active");
    document.getElementById("view-login").classList.add("active");
    if (msg) {
      var msgEl = document.getElementById("login-msg");
      showMsg(msgEl, msg, false);
    }
  }

  /* ---------- tab switching ---------- */
  var tabs = document.querySelectorAll(".auth-tab");
  var views = document.querySelectorAll(".auth-view");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      views.forEach(function (v) { v.classList.remove("active"); });
      tab.classList.add("active");
      var targetView = document.getElementById("view-" + tab.getAttribute("data-target"));
      if (targetView) targetView.classList.add("active");
    });
  });

  /* ---------- REGISTER ---------- */
  var regForm = document.querySelector("#view-register .auth-form");
  var regMsg = document.getElementById("reg-msg");

  if (regForm) {
    regForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var firstName = document.getElementById("reg-fname").value.trim();
      var lastName  = document.getElementById("reg-lname").value.trim();
      var email     = document.getElementById("reg-email").value.trim().toLowerCase();
      var password  = document.getElementById("reg-pass").value;

      if (!firstName || !lastName || !email || !password) {
        showMsg(regMsg, "Please fill in all fields.", true);
        return;
      }
      if (password.length < 6) {
        showMsg(regMsg, "Password must be at least 6 characters.", true);
        return;
      }

      /* check duplicate in localStorage first (fast) */
      var registered = getRegistered();
      for (var i = 0; i < registered.length; i++) {
        if (registered[i].email === email) {
          showMsg(regMsg, "An account with this email already exists. Please log in.", true);
          return;
        }
      }

      /* then check against the seed users.json */
      showMsg(regMsg, "Checking…", false);
      fetch("/assets/json/users.json")
        .then(function (r) { return r.json(); })
        .then(function (seedUsers) {
          for (var j = 0; j < seedUsers.length; j++) {
            if (seedUsers[j].email.toLowerCase() === email) {
              showMsg(regMsg, "An account with this email already exists. Please log in.", true);
              return;
            }
          }

          /* generate a simple new id */
          var maxId = 0;
          for (var k = 0; k < registered.length; k++) if (registered[k].user_id > maxId) maxId = registered[k].user_id;
          var newId = Math.max(maxId, seedUsers.length) + 1;

          var now = new Date().toISOString().replace("T", " ").substring(0, 19);
          var newUser = {
            user_id:    newId,
            email:      email,
            password:   password,   /* plain — demo only, no backend */
            first_name: firstName,
            last_name:  lastName,
            role:       "Buyer",
            created_at: now,
            updated_at: now
          };

          registered.push(newUser);
          saveRegistered(registered);

          /* clear the form */
          regForm.reset();

          /* go back to login with success message */
          switchToLogin("Account created! Welcome, " + firstName + ". Please sign in.");
        })
        .catch(function () {
          /* if JSON fetch fails, still allow registration */
          var maxId = 0;
          var registered2 = getRegistered();
          for (var k = 0; k < registered2.length; k++) if (registered2[k].user_id > maxId) maxId = registered2[k].user_id;
          var newId = maxId + 1;
          var now = new Date().toISOString().replace("T", " ").substring(0, 19);
          var newUser = {
            user_id: newId, email: email, password: password,
            first_name: firstName, last_name: lastName,
            role: "Buyer", created_at: now, updated_at: now
          };
          registered2.push(newUser);
          saveRegistered(registered2);
          regForm.reset();
          switchToLogin("Account created! Welcome, " + firstName + ". Please sign in.");
        });
    });
  }

  /* ---------- LOGIN ---------- */
  var loginForm = document.querySelector("#view-login .auth-form");
  var loginMsg  = document.getElementById("login-msg");

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();

      var email    = document.getElementById("login-email").value.trim().toLowerCase();
      var password = document.getElementById("login-pass").value;

      if (!email || !password) {
        showMsg(loginMsg, "Please enter your email and password.", true);
        return;
      }

      /* 1. Check localStorage registered users (exact password match) */
      var registered = getRegistered();
      for (var i = 0; i < registered.length; i++) {
        if (registered[i].email === email && registered[i].password === password) {
          setSession(registered[i]);
          window.location.href = "home_page.html";
          return;
        }
      }

      /* 2. Check seed users.json — accept any password (bcrypt hash cannot be
            verified client-side; this is demo-only behaviour) */
      showMsg(loginMsg, "Verifying…", false);
      Promise.all([
        fetch("/assets/json/users.json").then(function (r) { return r.json(); }),
        fetch("/assets/json/buyers.json").then(function (r) { return r.json(); }),
        fetch("/assets/json/sellers.json").then(function (r) { return r.json(); })
      ]).then(function (res) {
        var users = res[0], buyers = res[1], sellers = res[2];

        var seedUser = null;
        for (var j = 0; j < users.length; j++) {
          if (users[j].email.toLowerCase() === email) { seedUser = users[j]; break; }
        }

        if (!seedUser) {
          showMsg(loginMsg, "Incorrect email or password. Please try again.", true);
          return;
        }

        /* derive display name from buyers / sellers profile */
        var firstName = "", lastName = "";
        if (seedUser.role === "Buyer") {
          for (var b = 0; b < buyers.length; b++) {
            if (buyers[b].buyer_id === seedUser.user_id) {
              var parts = (buyers[b].full_name || "").split(" ");
              lastName  = parts.pop() || "";
              firstName = parts.join(" ") || "Member";
              break;
            }
          }
        } else if (seedUser.role === "Seller") {
          for (var s = 0; s < sellers.length; s++) {
            if (sellers[s].seller_id === seedUser.user_id) {
              firstName = sellers[s].shop_name || "Artisan";
              break;
            }
          }
        } else {
          /* Admin — derive from email prefix */
          firstName = seedUser.email.split("@")[0].split(".")[1] || "Admin";
          firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }

        setSession({
          user_id:    seedUser.user_id,
          email:      seedUser.email,
          first_name: firstName,
          last_name:  lastName,
          role:       seedUser.role
        });
        window.location.href = "home_page.html";
      }).catch(function () {
        showMsg(loginMsg, "Could not reach the data files. Make sure the site is served over http.", true);
      });
    });
  }

})();
