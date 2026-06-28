/* ============================================================
   artisans.js — The Artisan Guild page.
   Loads sellers.json + products.json, renders filterable/
   paginated artisan cards with follow state in localStorage.
   ============================================================ */

(function () {
  var DATA = "../assets/json/";
  function getJSON(name) { return fetch(DATA + name).then(function (r) { return r.json(); }); }
  function normalizeImagePath(url) {
    return url && url.indexOf("/assets/") === 0 ? "../assets/" + url.slice(8) : url || "";
  }

  var PER_PAGE = 6;
  var state = { query: "", region: "", sort: "rating", page: 1 };
  var allSellers = [];
  var productCountMap = {};

  /* ── Format follower count ── */
  function formatFollowers(n) {
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
    return String(n);
  }

  /* ── Star SVG ── */
  function starSVG(type) {
    if (type === "full") {
      return '<svg class="ag-star full" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
    if (type === "half") {
      return '<svg class="ag-star half" viewBox="0 0 24 24"><defs><linearGradient id="hg"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="#ddd"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#hg)"/></svg>';
    }
    return '<svg class="ag-star empty" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  }

  function renderStars(rating) {
    var html = "";
    for (var i = 1; i <= 5; i++) {
      if (rating >= i) html += starSVG("full");
      else if (rating >= i - 0.5) html += starSVG("half");
      else html += starSVG("empty");
    }
    return html;
  }

  /* ── Following state ── */
  function getFollowing() {
    try { return JSON.parse(localStorage.getItem("rv_following") || "[]"); } catch (e) { return []; }
  }
  function toggleFollow(sellerId) {
    var following = getFollowing();
    var idx = following.indexOf(sellerId);
    if (idx === -1) following.push(sellerId);
    else following.splice(idx, 1);
    localStorage.setItem("rv_following", JSON.stringify(following));
    return idx === -1;
  }

  /* ── Build card HTML ── */
  function cardHTML(seller) {
    var sid = seller.seller_id;
    var name = seller.shop_name || "Artisan";
    var initials = name.replace(/[^A-Za-zÀ-ɏ ]/g, "")
      .split(" ").filter(Boolean).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "?";

    var imgSrc = normalizeImagePath(seller.shop_banner || "");
    var rating = seller.rating || 0;
    var responseRate = seller.response_rate || 0;
    var productCount = productCountMap[sid] || 0;
    var background = seller.seller_background || "";
    var baseFollowers = seller.followers || 0;
    var following = getFollowing();
    var isFollowing = following.indexOf(sid) !== -1;
    var displayFollowers = isFollowing ? baseFollowers + 1 : baseFollowers;

    var avatarInner = imgSrc
      ? '<img src="' + imgSrc + '" alt="' + name + '" onerror="this.parentNode.removeChild(this);this.parentNode.textContent=\'' + initials + '\';" />'
      : initials;

    return '<div class="ag-card" data-sid="' + sid + '">' +
      '<div class="ag-avatar">' + avatarInner + '</div>' +
      '<div class="ag-card-body">' +
        '<p class="ag-shop-name">' + name + '</p>' +
        '<div class="ag-stats">' +
          '<span class="ag-stat">' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>' +
            responseRate + '% Response' +
          '</span>' +
          '<span class="ag-stat">' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>' +
            productCount + ' Products' +
          '</span>' +
          '<span class="ag-stat">' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' +
            '<span class="ag-follower-count" data-sid="' + sid + '">' + formatFollowers(displayFollowers) + '</span>' +
            ' Followers' +
          '</span>' +
          '<span class="ag-stat">' +
            '<span class="ag-stars">' + renderStars(rating) + '</span>' +
            '<span class="ag-rating-num">' + rating.toFixed(1) + '</span>' +
          '</span>' +
        '</div>' +
        (background ? '<p class="ag-background">' + background + '</p>' : '') +
      '</div>' +
      '<div class="ag-actions">' +
        '<button class="ag-btn-msg" data-msg-sid="' + sid + '">Message</button>' +
        '<button class="ag-btn-follow' + (isFollowing ? ' following' : '') + '" data-follow-sid="' + sid + '" data-base-followers="' + baseFollowers + '">' +
          (isFollowing ? 'Following' : 'Follow') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  /* ── Filter & sort sellers ── */
  function filtered() {
    var q = state.query.toLowerCase().trim();
    var reg = state.region;
    return allSellers.filter(function (s) {
      var bg = (s.seller_background || "").toLowerCase();
      var matchQ = !q ||
        s.shop_name.toLowerCase().indexOf(q) !== -1 ||
        bg.indexOf(q) !== -1 ||
        (s.title_story || "").toLowerCase().indexOf(q) !== -1;
      var matchR = !reg || bg.indexOf(reg.toLowerCase()) !== -1;
      return matchQ && matchR;
    }).sort(function (a, b) {
      if (state.sort === "rating") return (b.rating || 0) - (a.rating || 0);
      if (state.sort === "response") return (b.response_rate || 0) - (a.response_rate || 0);
      return (a.shop_name || "").localeCompare(b.shop_name || "");
    });
  }

  /* ── Render ── */
  function render() {
    var list = filtered();
    var totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > totalPages) state.page = totalPages;
    var start = (state.page - 1) * PER_PAGE;
    var slice = list.slice(start, start + PER_PAGE);

    var metaEl = document.getElementById("ag-results-meta");
    if (metaEl) {
      metaEl.textContent = list.length + " artisan" + (list.length !== 1 ? "s" : "") + " found";
    }

    var listEl = document.getElementById("ag-list");
    if (!listEl) return;
    if (!slice.length) {
      listEl.innerHTML = '<p class="ag-empty">No artisans match your search.</p>';
    } else {
      var html = "";
      for (var i = 0; i < slice.length; i++) html += cardHTML(slice[i]);
      listEl.innerHTML = html;
      wireCardButtons(listEl);
    }

    renderPagination(totalPages);
  }

  /* ── Wire buttons in the card list ── */
  function wireCardButtons(listEl) {
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch (e) {}

    listEl.querySelectorAll(".ag-btn-follow").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sid = parseInt(btn.getAttribute("data-follow-sid"), 10);
        var nowFollowing = toggleFollow(sid);
        btn.textContent = nowFollowing ? "Following" : "Follow";
        btn.classList.toggle("following", nowFollowing);
        /* Update follower count display */
        var card = btn.closest(".ag-card");
        var countEl = card ? card.querySelector(".ag-follower-count") : null;
        if (countEl) {
          var base = parseInt(btn.getAttribute("data-base-followers") || "0", 10);
          countEl.textContent = formatFollowers(nowFollowing ? base + 1 : base);
        }
      });
    });

    listEl.querySelectorAll(".ag-btn-msg").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sid = btn.getAttribute("data-msg-sid");
        if (!session || !session.user_id) {
          window.location.href = "login.html";
          return;
        }
        window.location.href = "account.html?view=chat&seller=" + sid;
      });
    });

    /* Card click -> seller profile (ignore button clicks) */
    listEl.querySelectorAll(".ag-card").forEach(function (card) {
      card.style.cursor = "pointer";
      card.addEventListener("click", function (e) {
        if (e.target.closest(".ag-btn-follow") || e.target.closest(".ag-btn-msg")) return;
        var sid = card.getAttribute("data-sid");
        if (sid) window.location.href = "seller_profile.html?id=" + sid;
      });
    });
  }

  /* ── Pagination ── */
  function renderPagination(totalPages) {
    var el = document.getElementById("ag-pagination");
    if (!el) return;
    if (totalPages <= 1) { el.innerHTML = ""; return; }

    var prevDisabled = state.page <= 1 ? " disabled" : "";
    var nextDisabled = state.page >= totalPages ? " disabled" : "";

    el.innerHTML =
      '<button class="ag-page-btn" id="ag-prev"' + prevDisabled + ' aria-label="Previous page">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
      '</button>' +
      '<span class="ag-page-info">' + state.page + ' of ' + totalPages + '</span>' +
      '<button class="ag-page-btn" id="ag-next"' + nextDisabled + ' aria-label="Next page">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
      '</button>';

    var prevBtn = document.getElementById("ag-prev");
    var nextBtn = document.getElementById("ag-next");
    if (prevBtn) prevBtn.addEventListener("click", function () { state.page--; render(); window.scrollTo(0, 0); });
    if (nextBtn) nextBtn.addEventListener("click", function () { state.page++; render(); window.scrollTo(0, 0); });
  }

  /* ── Custom dropdown helpers ── */
  function openDropdown(triggerId, panelId) {
    var trigger = document.getElementById(triggerId);
    var panel   = document.getElementById(panelId);
    if (!trigger || !panel) return;
    var isOpen = !panel.hidden;
    closeAllDropdowns();
    if (!isOpen) {
      panel.hidden = false;
      trigger.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    }
  }

  function closeAllDropdowns() {
    ["ag-region-panel", "ag-sort-panel"].forEach(function (pid) {
      var panel   = document.getElementById(pid);
      var trigger = document.getElementById(pid.replace("panel", "trigger"));
      if (panel)   panel.hidden = true;
      if (trigger) { trigger.classList.remove("open"); trigger.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ── Populate region dropdown ── */
  function buildRegionFilter() {
    var regionSet = {};
    for (var i = 0; i < allSellers.length; i++) {
      var bg = allSellers[i].seller_background || "";
      var parts = bg.split("·");
      if (parts.length >= 2) {
        var loc = parts[1].trim();
        if (loc) regionSet[loc] = true;
      }
    }
    var panel = document.getElementById("ag-region-panel");
    if (!panel) return;

    var allOpt = document.createElement("button");
    allOpt.className = "ag-dd-option selected";
    allOpt.setAttribute("data-val", "");
    allOpt.setAttribute("role", "option");
    allOpt.textContent = "All Regions";
    panel.appendChild(allOpt);

    var regions = Object.keys(regionSet).sort();
    for (var r = 0; r < regions.length; r++) {
      var opt = document.createElement("button");
      opt.className = "ag-dd-option";
      opt.setAttribute("data-val", regions[r]);
      opt.setAttribute("role", "option");
      opt.textContent = regions[r];
      panel.appendChild(opt);
    }
  }

  /* ── Load data ── */
  Promise.all([
    getJSON("sellers.json"),
    getJSON("products.json")
  ]).then(function (res) {
    var sellers = res[0];
    var products = res[1];

    for (var pi = 0; pi < products.length; pi++) {
      var sid = products[pi].seller_id;
      productCountMap[sid] = (productCountMap[sid] || 0) + 1;
    }

    allSellers = sellers;
    buildRegionFilter();
    render();

    /* ── Search ── */
    var searchEl = document.getElementById("ag-search");
    if (searchEl) {
      var debounce;
      searchEl.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          state.query = searchEl.value;
          state.page = 1;
          render();
        }, 220);
      });
    }

    /* ── Region dropdown ── */
    var regionTrigger = document.getElementById("ag-region-trigger");
    var regionPanel   = document.getElementById("ag-region-panel");
    if (regionTrigger) {
      regionTrigger.addEventListener("click", function (e) {
        e.stopPropagation();
        openDropdown("ag-region-trigger", "ag-region-panel");
      });
    }
    if (regionPanel) {
      regionPanel.addEventListener("click", function (e) {
        var opt = e.target.closest(".ag-dd-option");
        if (!opt) return;
        state.region = opt.getAttribute("data-val");
        state.page = 1;
        var label = document.getElementById("ag-region-label");
        if (label) label.textContent = state.region || "Region";
        regionPanel.querySelectorAll(".ag-dd-option").forEach(function (o) {
          o.classList.toggle("selected", o.getAttribute("data-val") === state.region);
        });
        closeAllDropdowns();
        render();
      });
    }

    /* ── Sort dropdown ── */
    var sortTrigger = document.getElementById("ag-sort-trigger");
    var sortPanel   = document.getElementById("ag-sort-panel");
    var sortLabels  = { rating: "Top Rated", response: "Response Rate", name: "A – Z" };
    if (sortTrigger) {
      sortTrigger.addEventListener("click", function (e) {
        e.stopPropagation();
        openDropdown("ag-sort-trigger", "ag-sort-panel");
      });
    }
    if (sortPanel) {
      sortPanel.addEventListener("click", function (e) {
        var opt = e.target.closest(".ag-dd-option");
        if (!opt) return;
        state.sort = opt.getAttribute("data-val");
        state.page = 1;
        var label = document.getElementById("ag-sort-label");
        if (label) label.textContent = sortLabels[state.sort] || "Sort";
        sortPanel.querySelectorAll(".ag-dd-option").forEach(function (o) {
          o.classList.toggle("selected", o.getAttribute("data-val") === state.sort);
        });
        closeAllDropdowns();
        render();
      });
    }

    /* ── Close on outside click ── */
    document.addEventListener("click", closeAllDropdowns);

  }).catch(function (err) {
    console.error(err);
    var listEl = document.getElementById("ag-list");
    if (listEl) listEl.innerHTML = '<p class="ag-empty">Could not load artisans. Serve over http (python -m http.server 8000).</p>';
  });

})();
