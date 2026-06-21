/* ============================================================
   account.js — Buyer Account page.
   Joins: session → buyers → orders → order_items → products
          → product_photos → shipments
   ============================================================ */

(function () {
  var DATA = "/assets/json/";
  function getJSON(name) { return fetch(DATA + name).then(function (r) { return r.json(); }); }

  /* ── Guard: must be logged in ── */
  var session = null;
  try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch (e) {}
  if (!session || !session.user_id) {
    window.location.href = "login.html";
    return;
  }

  var activeFilter = "All";

  /* ── Status config ── */
  var STATUS_LABEL = {
    Pending:   "Pending Payment",
    Confirmed: "Processing",
    Shipped:   "In Transit",
    Delivered: "Delivered",
    Cancelled: "Cancelled"
  };

  var STATUS_ICON = {
    Pending:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" class="status-icon-Pending"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>',
    Confirmed:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" class="status-icon-Confirmed"><path d="M5 7h14l-1.5 9H6.5L5 7z"/><path d="M3 4h2l2 3M9 4h12"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>',
    Shipped:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" class="status-icon-Shipped"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    Delivered:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" class="status-icon-Delivered"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    Cancelled:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" class="status-icon-Cancelled"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
  };

  var FALLBACK_DETAIL = {
    Pending:   "Awaiting payment confirmation",
    Confirmed: "Order confirmed, preparing for shipment",
    Shipped:   "Package is on its way",
    Delivered: "Package delivered successfully",
    Cancelled: "Order has been cancelled"
  };

  /* ── Helpers ── */
  function money(n) { return "$" + Number(n).toFixed(2); }

  function formatDate(str) {
    if (!str) return "";
    var d = new Date(str.replace(" ", "T"));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }

  function formatDateShort(str) {
    if (!str) return "";
    var d = new Date(str.replace(" ", "T"));
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  /* ── Load all data ── */
  Promise.all([
    getJSON("buyers.json"),
    getJSON("orders.json"),
    getJSON("order_items.json"),
    getJSON("products.json"),
    getJSON("product_photos.json"),
    getJSON("shipments.json"),
    getJSON("promotions.json"),
    getJSON("sellers.json"),
    getJSON("users.json")
  ]).then(function (res) {
    var buyers     = res[0];
    var orders     = res[1];
    var orderItems = res[2];
    var products   = res[3];
    var photos     = res[4];
    var shipments  = res[5];
    var promotions = res[6];
    var sellers    = res[7];
    var users      = res[8];

    /* ── Build lookup maps ── */
    var productMap = {};
    for (var p = 0; p < products.length; p++) productMap[products[p].product_id] = products[p];

    /* first photo per product (lowest display_order) */
    var photoMap = {};
    for (var ph = 0; ph < photos.length; ph++) {
      var pid = photos[ph].product_id;
      if (!photoMap[pid] || photos[ph].display_order < photoMap[pid].display_order) {
        photoMap[pid] = photos[ph];
      }
    }

    /* shipment by order_id */
    var shipmentMap = {};
    for (var sh = 0; sh < shipments.length; sh++) {
      shipmentMap[shipments[sh].order_id] = shipments[sh];
    }

    /* first order_item per order */
    var firstItemMap = {};
    for (var oi = 0; oi < orderItems.length; oi++) {
      var oid = orderItems[oi].order_id;
      if (!firstItemMap[oid]) firstItemMap[oid] = orderItems[oi];
    }

    /* count items per order */
    var itemCountMap = {};
    for (var ic = 0; ic < orderItems.length; ic++) {
      var oic = orderItems[ic].order_id;
      itemCountMap[oic] = (itemCountMap[oic] || 0) + 1;
    }

    /* ── Buyer profile ── */
    var buyerProfile = null;
    for (var b = 0; b < buyers.length; b++) {
      if (buyers[b].buyer_id === session.user_id) { buyerProfile = buyers[b]; break; }
    }

    /* Find user record for created_at */
    var userRecord = null;
    for (var ur = 0; ur < users.length; ur++) {
      if (users[ur].user_id === session.user_id) { userRecord = users[ur]; break; }
    }

    /* Profile overrides from localStorage (saved edits) */
    function getProfileOverrides() {
      try { return JSON.parse(localStorage.getItem("rv_profile_" + session.user_id) || "{}"); } catch (e) { return {}; }
    }

    function getDisplayName() {
      var ov = getProfileOverrides();
      return ov.full_name ||
        (buyerProfile ? buyerProfile.full_name : "") ||
        ((session.first_name || "") + " " + (session.last_name || "")).trim() ||
        session.email;
    }

    function renderTopProfileCard(name) {
      var initials = name.replace(/[^A-Za-zÀ-ɏ ]/g, "")
        .split(" ").filter(Boolean).slice(0, 2)
        .map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "?";
      document.getElementById("acct-profile").innerHTML =
        '<div class="acct-avatar">' + initials + '</div>' +
        '<div class="acct-profile-info">' +
          '<h1 class="acct-profile-name">' + name + '</h1>' +
          '<div class="acct-badges">' +
            '<span class="acct-badge-pill acct-badge-gold">Gold Member</span>' +
            '<span class="acct-badge-pill acct-badge-verified">' +
              '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
              ' Verified Buyer' +
            '</span>' +
          '</div>' +
        '</div>' +
        '<button class="acct-profile-btn" id="top-edit-profile-btn">Edit Profile</button>';

      /* Top-card edit button → switch to profile view + scroll to edit form */
      var topEditBtn = document.getElementById("top-edit-profile-btn");
      if (topEditBtn) {
        topEditBtn.addEventListener("click", function () {
          document.querySelector('[data-view="profile"]').click();
          setTimeout(function () {
            var editBtn = document.getElementById("edit-profile-btn");
            if (editBtn) editBtn.click();
          }, 50);
        });
      }
    }

    renderTopProfileCard(getDisplayName());

    /* ── Filter buyer's orders ── */
    var myOrders = [];
    for (var o = 0; o < orders.length; o++) {
      if (orders[o].buyer_id === session.user_id) myOrders.push(orders[o]);
    }
    myOrders.sort(function (a, b) {
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    /* ── Badge count ── */
    var confirmedCount = 0;
    for (var oc = 0; oc < myOrders.length; oc++) {
      if (myOrders[oc].order_status === "Confirmed") confirmedCount++;
    }
    var tabBadge = document.getElementById("tab-badge-confirmed");
    if (tabBadge && confirmedCount > 0) tabBadge.textContent = confirmedCount;

    /* ── Build one order card HTML ── */
    function orderCardHTML(ord) {
      var item    = firstItemMap[ord.order_id];
      var prod    = item ? productMap[item.product_id] : null;
      var photo   = prod ? photoMap[prod.product_id] : null;
      var photoUrl = photo ? photo.photo_url : "";
      var ship    = shipmentMap[ord.order_id];

      var thumbClass = "order-thumb" + (photoUrl ? "" : " grad-" + ((prod ? prod.product_id : ord.order_id) % 6));
      var thumbStyle = photoUrl ? 'style="background-image:url(' + photoUrl + ')"' : "";

      var extra = (itemCountMap[ord.order_id] || 1) - 1;
      var prodName = prod ? prod.title + (extra > 0 ? " + " + extra + " more" : "") : "Order #" + ord.order_id;

      var trackingText = ship ? ship.status_details : (FALLBACK_DETAIL[ord.order_status] || "");
      var trackingDate = ship ? formatDate(ship.updated_at) : formatDateShort(ord.created_at);

      var orderNum = "Order #VC-" + String(ord.order_id).padStart(4, "0");
      var status   = ord.order_status;
      var icon     = STATUS_ICON[status] || "";
      var label    = STATUS_LABEL[status] || status;

      return '<div class="order-card">' +
        '<div class="order-card-header">' +
          '<span class="order-card-status">' + icon + ' ' + label + '</span>' +
          '<span class="order-card-num">' + orderNum + '</span>' +
        '</div>' +
        '<div class="order-card-body">' +
          '<div class="' + thumbClass + '" ' + thumbStyle + '></div>' +
          '<div class="order-product-info">' +
            '<p class="order-product-name">' + prodName + '</p>' +
            '<div class="order-tracking-detail">' +
              '<span class="order-tracking-dot"></span>' +
              '<span>' + trackingText + '</span>' +
            '</div>' +
            '<p class="order-tracking-date">' + trackingDate + '</p>' +
          '</div>' +
          '<div class="order-price-col">' +
            '<div class="order-price-amount">' + money(ord.total_amount) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="order-card-footer">' +
          '<button class="order-btn-outline">Contact Seller</button>' +
          '<button class="order-btn-solid">Track Details</button>' +
        '</div>' +
      '</div>';
    }

    /* ── Render order list (tracking view) ── */
    function renderOrders() {
      var filtered = myOrders.filter(function (ord) {
        return activeFilter === "All" || ord.order_status === activeFilter;
      });

      var el = document.getElementById("acct-orders-list");
      if (!filtered.length) {
        el.innerHTML = '<p class="acct-empty">No orders in this category.</p>';
        return;
      }
      var html = '<div class="order-cards">';
      for (var i = 0; i < filtered.length; i++) html += orderCardHTML(filtered[i]);
      html += '</div>';
      el.innerHTML = html;
    }

    /* ── Render recent orders (profile view, max 3, compact) ── */
    function renderRecent() {
      var recent = myOrders.slice(0, 3);
      var el = document.getElementById("acct-recent-orders");
      if (!recent.length) {
        el.innerHTML = '<p class="acct-empty">No orders yet.</p>';
        return;
      }
      var html = "";
      for (var i = 0; i < recent.length; i++) {
        var ord = recent[i];
        var item = firstItemMap[ord.order_id];
        var prod = item ? productMap[item.product_id] : null;
        var photo = prod ? photoMap[prod.product_id] : null;
        var photoUrl = photo ? photo.photo_url : "";
        var thumbClass = "acct-recent-thumb" + (photoUrl ? "" : " grad-" + ((prod ? prod.product_id : i) % 6));
        var thumbStyle = photoUrl ? 'style="background-image:url(' + photoUrl + ')"' : "";
        var name = prod ? prod.title : "Order #" + ord.order_id;
        var status = ord.order_status;
        html +=
          '<div class="acct-recent-row">' +
            '<div class="' + thumbClass + '" ' + thumbStyle + '></div>' +
            '<div>' +
              '<p class="acct-recent-name">' + name + '</p>' +
              '<div class="acct-recent-meta">' +
                '<span class="order-card-status" style="font-size:.8rem">' + (STATUS_ICON[status] || "") + ' ' + (STATUS_LABEL[status] || status) + '</span>' +
              '</div>' +
            '</div>' +
            '<span class="acct-recent-price">' + money(ord.total_amount) + '</span>' +
          '</div>';
      }
      el.innerHTML = html;
    }

    renderOrders();
    renderRecent();

    /* ── My Profile info card (read / edit mode) ── */
    function renderProfileView() {
      var card = document.getElementById("profile-info-card");
      if (!card) return;

      var ov = getProfileOverrides();
      var name     = ov.full_name         || (buyerProfile ? buyerProfile.full_name        : "") || ((session.first_name || "") + " " + (session.last_name || "")).trim() || "—";
      var phone    = ov.phone_number      || (buyerProfile ? buyerProfile.phone_number     : "") || "—";
      var shipAddr = ov.shipping_address  || (buyerProfile ? buyerProfile.shipping_address : "") || "—";
      var billAddr = ov.billing_address   || (buyerProfile ? buyerProfile.billing_address  : "") || "—";
      var email    = session.email || "—";
      var memberSince = "";
      if (userRecord && userRecord.created_at) {
        var d = new Date(userRecord.created_at.replace(" ", "T"));
        memberSince = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      }

      /* ── READ MODE ── */
      function showReadMode() {
        card.innerHTML =
          '<div class="profile-view-header">' +
            '<h2>Personal Information</h2>' +
            '<button class="acct-profile-btn" id="edit-profile-btn">Edit Profile</button>' +
          '</div>' +

          '<div class="profile-section">' +
            '<p class="profile-section-title">Account</p>' +
            '<div class="profile-fields-grid">' +
              '<div class="profile-field">' +
                '<span class="profile-field-label">Full Name</span>' +
                '<span class="profile-field-value">' + name + '</span>' +
              '</div>' +
              '<div class="profile-field">' +
                '<span class="profile-field-label">Email Address</span>' +
                '<span class="profile-field-value">' + email + '</span>' +
              '</div>' +
              (memberSince
                ? '<div class="profile-field"><span class="profile-field-label">Member Since</span><span class="profile-field-value">' + memberSince + '</span></div>'
                : '') +
              '<div class="profile-field">' +
                '<span class="profile-field-label">Account Role</span>' +
                '<span class="profile-field-value">Buyer</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="profile-section-divider"></div>' +

          '<div class="profile-section">' +
            '<p class="profile-section-title">Contact</p>' +
            '<div class="profile-fields-grid cols-1">' +
              '<div class="profile-field">' +
                '<span class="profile-field-label">Phone Number</span>' +
                '<span class="profile-field-value' + (phone === "—" ? " muted" : "") + '">' + phone + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="profile-section-divider"></div>' +

          '<div class="profile-section">' +
            '<p class="profile-section-title">Addresses</p>' +
            '<div class="profile-fields-grid">' +
              '<div class="profile-field">' +
                '<span class="profile-field-label">Shipping Address</span>' +
                '<span class="profile-field-value' + (shipAddr === "—" ? " muted" : "") + '">' + shipAddr + '</span>' +
              '</div>' +
              '<div class="profile-field">' +
                '<span class="profile-field-label">Billing Address</span>' +
                '<span class="profile-field-value' + (billAddr === "—" ? " muted" : "") + '">' + billAddr + '</span>' +
              '</div>' +
            '</div>' +
          '</div>';

        document.getElementById("edit-profile-btn").addEventListener("click", showEditMode);
      }

      /* ── EDIT MODE ── */
      function showEditMode() {
        /* Re-read in case something changed */
        var ov2 = getProfileOverrides();
        var curName  = ov2.full_name        || name;
        var curPhone = ov2.phone_number     || (phone === "—" ? "" : phone);
        var curShip  = ov2.shipping_address || (shipAddr === "—" ? "" : shipAddr);
        var curBill  = ov2.billing_address  || (billAddr === "—" ? "" : billAddr);

        card.innerHTML =
          '<div class="profile-view-header">' +
            '<h2>Edit Profile</h2>' +
          '</div>' +
          '<form id="profile-edit-form">' +
            '<div class="profile-edit-grid">' +

              '<div class="profile-edit-field">' +
                '<label for="edit-fullname">Full Name</label>' +
                '<input type="text" id="edit-fullname" value="' + curName.replace(/"/g, '&quot;') + '" placeholder="Your full name" />' +
              '</div>' +

              '<div class="profile-edit-field">' +
                '<label>Email <span class="locked-note">Cannot be changed</span></label>' +
                '<input type="email" value="' + email.replace(/"/g, '&quot;') + '" disabled />' +
              '</div>' +

              '<div class="profile-edit-field">' +
                '<label for="edit-phone">Phone Number</label>' +
                '<input type="tel" id="edit-phone" value="' + curPhone.replace(/"/g, '&quot;') + '" placeholder="+84 xxx xxx xxx" />' +
              '</div>' +

              '<div class="profile-edit-field">' +
                '<label>Account Role</label>' +
                '<input type="text" value="Buyer" disabled />' +
              '</div>' +

              '<div class="profile-edit-field full">' +
                '<label for="edit-ship">Shipping Address</label>' +
                '<input type="text" id="edit-ship" value="' + curShip.replace(/"/g, '&quot;') + '" placeholder="Street, District, City, Country" />' +
              '</div>' +

              '<div class="profile-edit-field full">' +
                '<label for="edit-bill">Billing Address</label>' +
                '<input type="text" id="edit-bill" value="' + curBill.replace(/"/g, '&quot;') + '" placeholder="Street, District, City, Country" />' +
              '</div>' +

            '</div>' +
            '<div class="profile-edit-actions">' +
              '<button type="button" id="cancel-edit-btn" class="btn-cancel-edit">Cancel</button>' +
              '<button type="submit" class="btn-save-edit">Save Changes</button>' +
            '</div>' +
          '</form>';

        document.getElementById("cancel-edit-btn").addEventListener("click", function () {
          showReadMode();
        });

        document.getElementById("profile-edit-form").addEventListener("submit", function (e) {
          e.preventDefault();
          var saveBtn = card.querySelector(".btn-save-edit");
          saveBtn.textContent = "Saving…";
          saveBtn.disabled = true;

          var newName  = document.getElementById("edit-fullname").value.trim() || curName;
          var newPhone = document.getElementById("edit-phone").value.trim();
          var newShip  = document.getElementById("edit-ship").value.trim();
          var newBill  = document.getElementById("edit-bill").value.trim();

          var saved = { full_name: newName, phone_number: newPhone, shipping_address: newShip, billing_address: newBill };
          localStorage.setItem("rv_profile_" + session.user_id, JSON.stringify(saved));

          /* Update local vars so read mode reflects changes immediately */
          name     = newName;
          phone    = newPhone || "—";
          shipAddr = newShip  || "—";
          billAddr = newBill  || "—";

          /* Refresh the top profile card name + initials */
          renderTopProfileCard(newName);

          setTimeout(function () {
            showReadMode();
            var msg = document.createElement("div");
            msg.className = "profile-save-success";
            msg.innerHTML =
              '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
              ' Profile updated successfully.';
            card.appendChild(msg);
            setTimeout(function () { if (msg.parentNode) msg.parentNode.removeChild(msg); }, 3000);
          }, 500);
        });
      }

      showReadMode();
    }

    renderProfileView();

    /* ── Voucher Vault ── */
    var sellerMap = {};
    for (var sv = 0; sv < sellers.length; sv++) sellerMap[sellers[sv].seller_id] = sellers[sv];

    var PLATFORM_ICON =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">' +
      '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
      '</svg>';

    var ARTIST_ICON =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">' +
      '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z"/>' +
      '<circle cx="6.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>' +
      '<circle cx="9.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>' +
      '<circle cx="14.5" cy="7.5" r="1.5" fill="currentColor" stroke="none"/>' +
      '<circle cx="17.5" cy="11.5" r="1.5" fill="currentColor" stroke="none"/>' +
      '</svg>';

    function discountLabel(promo) {
      if (promo.discount_type === "Percentage") return promo.discount_value + "% OFF";
      var val = promo.discount_value;
      if (val >= 1000) return "$" + (val / 1000).toFixed(0) + "k OFF";
      return "$" + val + " OFF";
    }

    function voucherStatus(endDate) {
      var now = new Date();
      var end = new Date(endDate.replace(" ", "T"));
      return end >= now ? "active" : "expired";
    }

    function fmtDateOnly(str) {
      if (!str) return "";
      var d = new Date(str.replace(" ", "T"));
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }

    function voucherCardHTML(promo) {
      var isPlatform = promo.seller_id === null;
      var type    = isPlatform ? "platform" : "artist";
      var icon    = isPlatform ? PLATFORM_ICON : ARTIST_ICON;
      var typeLabel = isPlatform ? "Platform\nVoucher" : "Artist\nVoucher";
      var seller  = isPlatform ? null : sellerMap[promo.seller_id];
      var source  = isPlatform ? "ReViet Platform" : (seller ? seller.shop_name : "Artisan Shop");
      var status  = voucherStatus(promo.end_date);
      var discount = discountLabel(promo);

      return '<div class="voucher-card">' +
        '<div class="voucher-left ' + type + '">' +
          '<div class="voucher-icon">' + icon + '</div>' +
          '<span class="voucher-type-label">' + typeLabel.replace("\n", "<br>") + '</span>' +
        '</div>' +
        '<div class="voucher-right">' +
          '<div class="voucher-top">' +
            '<span class="voucher-code">' + promo.promo_code + '</span>' +
            '<span class="voucher-discount">' + discount + '</span>' +
          '</div>' +
          '<p class="voucher-source">' + source + '</p>' +
          '<p class="voucher-dates">Valid: ' + fmtDateOnly(promo.start_date) + ' – ' + fmtDateOnly(promo.end_date) + '</p>' +
          '<div class="voucher-bottom">' +
            '<span class="voucher-status ' + status + '">' + (status === "active" ? "Active" : "Expired") + '</span>' +
            '<button class="voucher-copy" data-code="' + promo.promo_code + '">Copy Code</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    var activeVFilter = "All";

    function renderVouchers() {
      var filtered = promotions.filter(function (p) {
        if (activeVFilter === "platform") return p.seller_id === null;
        if (activeVFilter === "artist")   return p.seller_id !== null;
        return true;
      });

      var grid = document.getElementById("voucher-grid");
      if (!filtered.length) {
        grid.innerHTML = '<p class="acct-empty">No vouchers in this category.</p>';
        return;
      }
      var html = "";
      for (var i = 0; i < filtered.length; i++) html += voucherCardHTML(filtered[i]);
      grid.innerHTML = html;

      /* Copy-to-clipboard */
      grid.querySelectorAll(".voucher-copy").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var code = btn.getAttribute("data-code");
          if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(function () {
              btn.textContent = "Copied!";
              btn.classList.add("copied");
              setTimeout(function () {
                btn.textContent = "Copy Code";
                btn.classList.remove("copied");
              }, 1800);
            });
          } else {
            btn.textContent = "Copied!";
            btn.classList.add("copied");
            setTimeout(function () {
              btn.textContent = "Copy Code";
              btn.classList.remove("copied");
            }, 1800);
          }
        });
      });
    }

    renderVouchers();

    /* ── Favourites view ── */
    function renderFavourites() {
      var favs = [];
      try { favs = JSON.parse(localStorage.getItem("rv_favourites") || "[]"); } catch (e) {}
      var grid = document.getElementById("fav-grid");
      if (!grid) return;
      if (!favs.length) {
        grid.innerHTML = '<p class="acct-empty" style="grid-column:1/-1">No favourites yet. Browse the shop and click the ♡ icon on any product to save it here.</p>';
        return;
      }
      var html = "";
      for (var fi = 0; fi < favs.length; fi++) {
        var f = favs[fi];
        var prod = productMap[f.product_id];
        if (!prod) continue;
        var photo = photoMap[f.product_id];
        var photoUrl = photo ? photo.photo_url : "";
        var tClass = "fav-thumb" + (photoUrl ? "" : " grad-" + (f.product_id % 6));
        var tStyle = photoUrl ? 'style="background-image:url(' + photoUrl + ')"' : "";
        html +=
          '<div class="fav-card">' +
            '<a href="/html/product_detail.html?id=' + prod.product_id + '" class="' + tClass + '" ' + tStyle + '></a>' +
            '<div class="fav-card-body">' +
              '<p class="fav-card-name">' + prod.title + '</p>' +
              '<p class="fav-card-price">$' + Number(prod.price).toFixed(2) + '</p>' +
            '</div>' +
            '<div class="fav-card-actions">' +
              '<button class="fav-add-cart" data-pid="' + prod.product_id + '">Add to Cart</button>' +
              '<button class="fav-remove" data-pid="' + prod.product_id + '">Remove</button>' +
            '</div>' +
          '</div>';
      }
      grid.innerHTML = html || '<p class="acct-empty" style="grid-column:1/-1">No favourites found.</p>';

      /* Wire buttons */
      grid.querySelectorAll(".fav-add-cart").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var pid = parseInt(btn.getAttribute("data-pid"), 10);
          var cart = [];
          try { cart = JSON.parse(localStorage.getItem("rv_cart") || "[]"); } catch (e) {}
          var found = false;
          for (var ci = 0; ci < cart.length; ci++) {
            if (cart[ci].product_id === pid) { cart[ci].quantity++; found = true; break; }
          }
          if (!found) cart.push({ product_id: pid, quantity: 1, added_at: Date.now() });
          localStorage.setItem("rv_cart", JSON.stringify(cart));
          btn.textContent = "Added ✓";
          setTimeout(function () { btn.textContent = "Add to Cart"; }, 1500);
        });
      });

      grid.querySelectorAll(".fav-remove").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var pid = parseInt(btn.getAttribute("data-pid"), 10);
          var curFavs = [];
          try { curFavs = JSON.parse(localStorage.getItem("rv_favourites") || "[]"); } catch (e) {}
          var newFavs = [];
          for (var i = 0; i < curFavs.length; i++) { if (curFavs[i].product_id !== pid) newFavs.push(curFavs[i]); }
          localStorage.setItem("rv_favourites", JSON.stringify(newFavs));
          renderFavourites();
        });
      });
    }
    renderFavourites();

    document.querySelectorAll(".voucher-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".voucher-tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        activeVFilter = tab.getAttribute("data-vfilter");
        renderVouchers();
      });
    });

    /* ── Tab filter wiring ── */
    document.querySelectorAll(".order-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".order-tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        activeFilter = tab.getAttribute("data-filter");
        renderOrders();
      });
    });

  }).catch(function (err) {
    console.error(err);
    var el = document.getElementById("acct-orders-list");
    if (el) el.innerHTML = '<p class="acct-empty">Could not load data. Serve the site over http (python -m http.server 8000).</p>';
  });

  /* ── Sidebar section switching ── */
  document.querySelectorAll(".acct-nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".acct-nav-item").forEach(function (b) { b.classList.remove("active"); });
      document.querySelectorAll(".acct-view").forEach(function (v) { v.classList.remove("active"); });
      btn.classList.add("active");
      var view = document.getElementById("view-" + btn.getAttribute("data-view"));
      if (view) view.classList.add("active");
    });
  });

  /* "View All" on profile view → switch to orders view */
  var goOrders = document.getElementById("go-to-orders");
  if (goOrders) {
    goOrders.addEventListener("click", function () {
      document.querySelector('[data-view="orders"]').click();
    });
  }

  /* ── Logout ── */
  var logoutBtn = document.getElementById("sidebar-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      sessionStorage.removeItem("rv_session");
      window.location.href = "login.html";
    });
  }

})();
