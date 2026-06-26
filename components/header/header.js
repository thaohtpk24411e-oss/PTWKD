/* Header behavior: mobile nav, search, notification dropdown, cart preview.
   Runs immediately after include.js injects the markup. */
(function () {

  /* ── Mobile nav toggle ── */
  var toggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    var links = nav.querySelectorAll("a");
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener("click", function () {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    }
  }

  /* ── Active nav link ── */
  var current = location.pathname.split("/").pop();
  if (nav && current) {
    var navLinks = nav.querySelectorAll("a");
    for (var n = 0; n < navLinks.length; n++) {
      var href = navLinks[n].getAttribute("href") || "";
      if (href.indexOf(current) !== -1) navLinks[n].classList.add("active");
    }
  }

  /* ── Session: update account link ── */
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch (e) {}
  var accountLink = document.getElementById("account-link");
  if (accountLink && session && session.user_id) {
    accountLink.setAttribute("href", "account.html");
    accountLink.setAttribute("aria-label", "My Account");

    /* Build initials avatar */
    function setAvatarInitials(fullName) {
      var parts = (fullName || "").trim().split(/\s+/);
      var initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : (parts[0] || "?")[0].toUpperCase();
      var img = accountLink.querySelector("img");
      if (img) img.style.display = "none";
      var existing = accountLink.querySelector(".hdr-avatar");
      if (existing) { existing.textContent = initials; return; }
      var av = document.createElement("span");
      av.className = "hdr-avatar";
      av.textContent = initials;
      accountLink.appendChild(av);
    }

    /* Check localStorage override first (set by account.js edit profile) */
    var overrideName = localStorage.getItem("rv_profile_full_name");
    if (overrideName) {
      setAvatarInitials(overrideName);
    } else {
      fetch("../assets/json/buyers.json")
        .then(function(r) { return r.json(); })
        .then(function(buyers) {
          for (var i = 0; i < buyers.length; i++) {
            if (buyers[i].buyer_id === session.user_id) {
              setAvatarInitials(buyers[i].full_name);
              break;
            }
          }
        })
        .catch(function() {});
    }
  }

  /* ── Header badge helpers ── */
  function getCartItems() {
    try { return JSON.parse(localStorage.getItem("rv_cart") || "[]"); } catch (e) { return []; }
  }

  function getCartCount() {
    var cart = getCartItems();
    var count = 0;
    for (var i = 0; i < cart.length; i++) {
      count += Number(cart[i].quantity || 0);
    }
    return count;
  }

  function updateCartBadge() {
    var badge = document.getElementById("cart-badge");
    if (!badge) return;
    var count = getCartCount();
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.add("count");
      badge.hidden = false;
    } else {
      badge.textContent = "";
      badge.classList.remove("count");
      badge.hidden = true;
    }
  }

  function refreshCartBadge() {
    updateCartBadge();
  }

  function updateHeaderBadges() {
    updateCartBadge();
    updateNotificationBadge();
  }

  window.addEventListener("rv:cart-updated", updateHeaderBadges);
  window.addEventListener("rv:notifications-updated", updateHeaderBadges);
  window.addEventListener("storage", function (event) {
    if (event.key === "rv_cart" || event.key === "rv_session") {
      updateHeaderBadges();
    }
  });

  setTimeout(updateHeaderBadges, 0);

  /* ── Dropdown toggle helper ── */
  function toggleDropdown(dropId) {
    var drop = document.getElementById(dropId);
    if (!drop) return false;
    var wasHidden = drop.hidden;
    /* close all */
    var allIds = ["notif-dropdown", "cart-dropdown"];
    for (var d = 0; d < allIds.length; d++) {
      var el = document.getElementById(allIds[d]);
      if (el) el.hidden = true;
    }
    if (wasHidden) drop.hidden = false;
    return wasHidden; /* true = we just opened it */
  }

  document.addEventListener("click", function (e) {
    var inNotif = document.getElementById("notif-wrap") && document.getElementById("notif-wrap").contains(e.target);
    var inCart  = document.getElementById("cart-wrap")  && document.getElementById("cart-wrap").contains(e.target);
    if (!inNotif && !inCart) {
      var allIds = ["notif-dropdown", "cart-dropdown"];
      for (var d = 0; d < allIds.length; d++) {
        var el = document.getElementById(allIds[d]);
        if (el) el.hidden = true;
      }
    }
  });

  /* ═══════════════════════════════════════════════
     NOTIFICATIONS
  ═══════════════════════════════════════════════ */
  var NOTIF_PAGE_SIZE = 3;
  var notifAll = [];
  var notifShown = 0;
  var notifLoaded = false;

  function notifIconHTML(type) {
    if (type === "order_delivered" || type === "order_confirmed") {
      return '<span class="notif-icon order">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></span>';
    }
    if (type === "order_shipped" || type === "shipment_update") {
      return '<span class="notif-icon ship">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">' +
        '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/>' +
        '<circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>';
    }
    return '<span class="notif-icon voucher">' +
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8">' +
      '<rect x="1" y="7" width="22" height="13" rx="2"/><path d="M1 12h4m14 0h4"/></svg></span>';
  }

  function timeAgo(dateStr) {
    var then = new Date(dateStr.replace(" ", "T"));
    var diffSec = Math.floor((Date.now() - then.getTime()) / 1000);
    if (diffSec < 60)   return "just now";
    if (diffSec < 3600) return Math.floor(diffSec / 60) + "m ago";
    var diffH = Math.floor(diffSec / 3600);
    if (diffH < 24)  return diffH + "h ago";
    var diffD = Math.floor(diffH / 24);
    if (diffD < 30)  return diffD + "d ago";
    return Math.floor(diffD / 30) + "mo ago";
  }

  function renderNotifBatch(items, append) {
    var list = document.getElementById("notif-list");
    if (!list) return;
    var html = append ? list.innerHTML : "";
    for (var i = 0; i < items.length; i++) {
      var n = items[i];
      var unread = !n.is_read ? " unread" : "";
      var dot    = !n.is_read ? '<span class="notif-dot"></span>' : "";
      html +=
        '<div class="notif-item' + unread + '">' +
          notifIconHTML(n.type) +
          '<div class="notif-body">' +
            '<p class="notif-title">' + n.title + '</p>' +
            '<p class="notif-msg">' + n.message + '</p>' +
            '<p class="notif-time">' + timeAgo(n.created_at) + '</p>' +
          '</div>' +
          dot +
        '</div>';
    }
    if (!items.length && !append) {
      html = '<p style="padding:20px 18px;color:var(--muted);font-size:.85rem;text-align:center;">No notifications yet.</p>';
    }
    list.innerHTML = html;
  }

  function updateNotificationBadge() {
    var unread = notifAll.filter(function (n) { return !n.is_read; }).length;
    var badge = document.getElementById("notif-badge");
    if (!badge) return;
    if (unread > 0) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.classList.add("count");
      badge.hidden = false;
    } else {
      badge.textContent = "";
      badge.classList.remove("count");
      badge.hidden = true;
    }
  }

  function updateNotifBadge() {
    updateNotificationBadge();
  }

  function updateSeeMore() {
    var btn = document.getElementById("notif-see-more");
    if (btn) btn.style.display = notifShown < notifAll.length ? "block" : "none";
  }

  function loadNotifications() {
    if (notifLoaded) {
      updateNotificationBadge();
      return;
    }
    notifLoaded = true;
    var list = document.getElementById("notif-list");
    if (list) list.innerHTML = '<p style="padding:16px 18px;color:var(--muted);font-size:.82rem">Loading…</p>';

    if (!session || !session.user_id) {
      if (list) list.innerHTML =
        '<p style="padding:20px 18px;color:var(--muted);font-size:.85rem;text-align:center;">' +
        '<a href="login.html" style="color:var(--ink)">Log in</a> to see notifications.</p>';
      var sm = document.getElementById("notif-see-more");
      if (sm) sm.style.display = "none";
      updateNotificationBadge();
      return;
    }

    fetch("../assets/json/notifications.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        notifAll = data.filter(function (n) { return n.buyer_id === session.user_id; });
        notifAll.sort(function (a, b) { return b.notification_id - a.notification_id; });
        var first = notifAll.slice(0, NOTIF_PAGE_SIZE);
        notifShown = first.length;
        renderNotifBatch(first, false);
        updateHeaderBadges();
        window.dispatchEvent(new Event("rv:notifications-updated"));
        updateSeeMore();
      })
      .catch(function () {
        notifLoaded = false;
        var l = document.getElementById("notif-list");
        if (l) l.innerHTML = '<p style="padding:16px 18px;color:var(--muted);font-size:.82rem">Could not load notifications.</p>';
        updateNotificationBadge();
      });
  }

  var notifToggle = document.getElementById("notif-toggle");
  if (notifToggle) {
    notifToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var opened = toggleDropdown("notif-dropdown");
      if (opened) loadNotifications();
    });
  }

  var seeMoreBtn = document.getElementById("notif-see-more");
  if (seeMoreBtn) {
    seeMoreBtn.addEventListener("click", function () {
      var nextBatch = notifAll.slice(notifShown, notifShown + NOTIF_PAGE_SIZE);
      notifShown += nextBatch.length;
      renderNotifBatch(nextBatch, true);
      updateSeeMore();
    });
  }

  var markAllBtn = document.getElementById("notif-mark-all");
  if (markAllBtn) {
    markAllBtn.addEventListener("click", function () {
      for (var i = 0; i < notifAll.length; i++) notifAll[i].is_read = true;
      updateHeaderBadges();
      window.dispatchEvent(new Event("rv:notifications-updated"));
      var shown = notifAll.slice(0, notifShown);
      renderNotifBatch(shown, false);
    });
  }

  loadNotifications();

  /* ═══════════════════════════════════════════════
     CART PREVIEW
  ═══════════════════════════════════════════════ */
  var cartPreviewLoaded = false;

  function loadCartPreview() {
    if (cartPreviewLoaded) return;
    cartPreviewLoaded = true;

    var cart = [];
    try { cart = JSON.parse(localStorage.getItem("rv_cart") || "[]"); } catch (e) {}
    var previewList = document.getElementById("cart-preview-list");

    if (!cart.length) {
      if (previewList) previewList.innerHTML = '<div class="cart-preview-empty">Your cart is empty.</div>';
      return;
    }
    if (previewList) previewList.innerHTML = '<div class="cart-preview-empty" style="font-size:.8rem">Loading…</div>';

    Promise.all([
      fetch("../assets/json/products.json").then(function (r) { return r.json(); }),
      fetch("../assets/json/product_photos.json").then(function (r) { return r.json(); })
    ]).then(function (res) {
      var products = res[0], photos = res[1];
      var prodMap = {}, photoMap = {};
      for (var p = 0; p < products.length; p++) prodMap[products[p].product_id] = products[p];
      for (var ph = 0; ph < photos.length; ph++) {
        var pid = photos[ph].product_id;
        if (!photoMap[pid] || photos[ph].display_order < photoMap[pid].display_order) photoMap[pid] = photos[ph];
      }

      /* show last 3 added items (most recent first) */
      var recent = cart.slice().reverse().slice(0, 3);
      var html = "";
      for (var i = 0; i < recent.length; i++) {
        var ci = recent[i];
        var prod = prodMap[ci.product_id];
        if (!prod) continue;
        var photo = photoMap[ci.product_id];
        var photoUrl = photo ? photo.photo_url : "";
        var thumbClass = "cart-preview-thumb" + (photoUrl ? "" : " grad-" + (ci.product_id % 6));
        var thumbStyle = photoUrl ? 'style="background-image:url(' + photoUrl + ')"' : "";
        html +=
          '<div class="cart-preview-item">' +
            '<div class="' + thumbClass + '" ' + thumbStyle + '></div>' +
            '<div class="cart-preview-info">' +
              '<p class="cart-preview-name">' + prod.title + '</p>' +
              '<p class="cart-preview-meta">Qty: ' + ci.quantity + '</p>' +
            '</div>' +
            '<span class="cart-preview-price">$' + (prod.price * ci.quantity).toFixed(2) + '</span>' +
          '</div>';
      }
      if (previewList) previewList.innerHTML = html || '<div class="cart-preview-empty">Your cart is empty.</div>';
    }).catch(function () {
      cartPreviewLoaded = false;
    });
  }

  var cartToggle = document.getElementById("cart-toggle");
  if (cartToggle) {
    cartToggle.addEventListener("click", function (e) {
      e.stopPropagation();
      var opened = toggleDropdown("cart-dropdown");
      if (opened) loadCartPreview();
    });
  }

  /* ═══════════════════════════════════════════════
     SEARCH
  ═══════════════════════════════════════════════ */
  var searchToggle = document.getElementById("search-toggle");
  var searchBar    = document.getElementById("header-search");
  var searchInput  = document.getElementById("search-input");
  var searchResults = document.getElementById("search-results");
  var searchProducts = null;
  var searchPhotos   = null;
  var searchTimer    = null;

  if (searchToggle && searchBar) {
    searchToggle.addEventListener("click", function () {
      searchBar.hidden = !searchBar.hidden;
      if (!searchBar.hidden && searchInput) searchInput.focus();
      if (searchBar.hidden && searchResults) searchResults.hidden = true;
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      var q = searchInput.value.trim().toLowerCase();
      if (!q) { if (searchResults) searchResults.hidden = true; return; }
      searchTimer = setTimeout(function () {
        if (searchProducts) {
          doSearch(q);
        } else {
          Promise.all([
            fetch("../assets/json/products.json").then(function (r) { return r.json(); }),
            fetch("../assets/json/product_photos.json").then(function (r) { return r.json(); })
          ]).then(function (res) {
            searchProducts = res[0];
            searchPhotos   = res[1];
            doSearch(q);
          });
        }
      }, 200);
    });

    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        if (searchBar)    searchBar.hidden = true;
        if (searchResults) searchResults.hidden = true;
      }
    });
  }

  document.addEventListener("click", function (e) {
    if (!searchBar || searchBar.hidden) return;
    if (!searchBar.contains(e.target) && e.target !== searchToggle) {
      if (searchResults) searchResults.hidden = true;
    }
  });

  function doSearch(q) {
    if (!searchResults) return;
    var photoMap = {};
    for (var ph = 0; ph < searchPhotos.length; ph++) {
      var pid = searchPhotos[ph].product_id;
      if (!photoMap[pid] || searchPhotos[ph].display_order < photoMap[pid].display_order) photoMap[pid] = searchPhotos[ph];
    }
    var filtered = [];
    for (var p = 0; p < searchProducts.length; p++) {
      var prod = searchProducts[p];
      if (prod.approval_status !== "Active") continue;
      var haystack = (prod.title + " " + (prod.description || "") + " " + (prod.materials || "")).toLowerCase();
      if (haystack.indexOf(q) !== -1) filtered.push(prod);
      if (filtered.length >= 8) break;
    }

    var html = "";
    if (!filtered.length) {
      html = '<div class="sr-no-results">No results for "' + searchInput.value + '"</div>';
    } else {
      for (var i = 0; i < filtered.length; i++) {
        var pr = filtered[i];
        var photo = photoMap[pr.product_id];
        var photoUrl = photo ? photo.photo_url : "";
        var tClass = "sr-thumb" + (photoUrl ? "" : " grad-" + (pr.product_id % 6));
        var tStyle = photoUrl ? 'style="background-image:url(' + photoUrl + ')"' : "";
        html +=
          '<a class="search-result-item" href="product_detail.html?id=' + pr.product_id + '">' +            '<span class="' + tClass + '" ' + tStyle + '></span>' +
            '<span class="sr-info">' +
              '<span class="sr-name">' + pr.title + '</span>' +
              '<span class="sr-meta">' + (pr.materials || "") + '</span>' +
            '</span>' +
            '<span class="sr-price">$' + Number(pr.price).toFixed(2) + '</span>' +
          '</a>';
      }
    }
    searchResults.innerHTML = html;
    searchResults.hidden = false;
  }

})();
