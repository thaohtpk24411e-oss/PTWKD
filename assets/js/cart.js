(function() {
  var DATA = "../assets/json/";
  function getJSON(name) { return fetch(DATA + name).then(function(r) { return r.json(); }); }
  function normalizeImagePath(url) { return url && url.indexOf("/assets/") === 0 ? "../assets/" + url.slice(8) : url || ""; }

  // Read cart from localStorage
  function getCart() {
    try { return JSON.parse(localStorage.getItem("rv_cart") || "[]"); } catch(e) { return []; }
  }
  function saveCart(items) {
    localStorage.setItem("rv_cart", JSON.stringify(items));
    window.dispatchEvent(new Event("rv:cart-updated"));
  }

  var TAX_RATE = 0.06;
  var SHIP_EXPRESS = 25;
  var selectedShipping = "standard"; // or "express"
  var selectedPayment = "card"; // or "cash"

  // Load products + photos, then render
  Promise.all([getJSON("products.json"), getJSON("product_photos.json"), getJSON("buyers.json"), getJSON("sellers.json"), getJSON("promotions.json")])
  .then(function(res) {
    var products = res[0], photos = res[1], buyers = res[2], sellers = res[3], promotions = res[4];

    // Build maps
    var productMap = {};
    for (var p = 0; p < products.length; p++) productMap[products[p].product_id] = products[p];

    var photoMap = {}; // product_id → first photo URL
    for (var ph = 0; ph < photos.length; ph++) {
      var pid = photos[ph].product_id;
      if (!photoMap[pid] || photos[ph].display_order < photoMap[pid].display_order) photoMap[pid] = photos[ph];
    }

    var sellerMap = {};
    for (var s = 0; s < sellers.length; s++) sellerMap[sellers[s].seller_id] = sellers[s];

    /* Promotions: keyed by uppercased promo_code */
    var promoMap = {};
    for (var pr = 0; pr < promotions.length; pr++) {
      promoMap[promotions[pr].promo_code.toUpperCase()] = promotions[pr];
    }

    /* Voucher state */
    var VND_TO_USD = 1 / 25000;
    var appliedPlatformVoucher = null;
    var appliedShopVouchers    = {}; // seller_id → voucher object

    function calcDiscount(voucher, baseAmount) {
      if (!voucher) return 0;
      var disc = voucher.discount_type === "Percentage"
        ? baseAmount * (voucher.discount_value / 100)
        : voucher.discount_value * VND_TO_USD;
      return Math.min(disc, baseAmount); // never exceed base
    }

    function isExpired(voucher) {
      return new Date() > new Date(voucher.end_date.replace(" ", "T"));
    }

    function formatDiscount(voucher) {
      if (voucher.discount_type === "Percentage") return voucher.discount_value + "% off";
      return "$" + (voucher.discount_value * VND_TO_USD).toFixed(2) + " off";
    }

    // Pre-fill delivery form from session + buyers
    var session = null;
    try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch(e) {}
    if (session) {
      var buyer = null;
      for (var b = 0; b < buyers.length; b++) {
        if (buyers[b].buyer_id === session.user_id) { buyer = buyers[b]; break; }
      }
      // Fill first/last name from session
      var fname = document.getElementById("del-fname");
      var lname = document.getElementById("del-lname");
      if (fname && session.first_name) fname.value = session.first_name;
      if (lname && session.last_name) lname.value = session.last_name;
      // Fill address from buyer profile
      if (buyer && buyer.shipping_address) {
        var addr = document.getElementById("del-addr");
        if (addr) addr.value = buyer.shipping_address;
        // Try to extract city from address (last part before "Vietnam")
        var parts = buyer.shipping_address.split(",");
        var cityEl = document.getElementById("del-city");
        if (cityEl && parts.length >= 2) cityEl.value = parts[parts.length - 2].trim();
      }
    }

    function renderCart() {
      var cart = getCart();
      var heading = document.getElementById("cart-heading");
      if (heading) {
        heading.innerHTML = '<span class="cart-title">Cart</span><span class="cart-count-label">' + cart.length + ' ITEM' + (cart.length !== 1 ? 'S' : '') + '</span>';
      }

      var list = document.getElementById("cart-items-list");
      if (!list) return;

      if (!cart.length) {
        list.innerHTML = '<p style="color:var(--muted);padding:40px 0;text-align:center;">Your cart is empty. <a href="product_page.html" style="color:var(--ink);text-decoration:underline;">Browse the shop →</a></p>';
        updateSummary(0);
        return;
      }

      var html = "";
      for (var i = 0; i < cart.length; i++) {
        var ci = cart[i];
        var prod = productMap[ci.product_id];
        if (!prod) continue;
        var photo = photoMap[ci.product_id];
        var photoUrl = normalizeImagePath(photo ? photo.photo_url : "");
        var thumbClass = "cart-thumb" + (photoUrl ? "" : " grad-" + (ci.product_id % 6));
        var thumbStyle = photoUrl ? 'style="background-image:url(' + photoUrl + ')"' : "";
        var seller = sellerMap[prod.seller_id];
        var sellerName = seller ? seller.shop_name : "ReViet Artisan";
        var craftType = prod.materials ? prod.materials.split(",")[0] : "Handcrafted";
        var lineTotal = (prod.price * ci.quantity).toFixed(2);

        html += '<div class="cart-item" data-product-id="' + ci.product_id + '">' +
          '<a href="product_detail.html?id=' + ci.product_id + '" class="' + thumbClass + '" ' + thumbStyle + '></a>' +
          '<div class="cart-item-info">' +
            '<p class="cart-item-name">' + prod.title + '</p>' +
            '<p class="cart-item-meta">' + sellerName + ' · ' + craftType + '</p>' +
            '<div class="cart-qty-row">' +
              '<div class="qty-ctrl">' +
                '<button class="qty-btn qty-dec" aria-label="Decrease">−</button>' +
                '<span class="qty-val">' + String(ci.quantity).padStart(2, "0") + '</span>' +
                '<button class="qty-btn qty-inc" aria-label="Increase">+</button>' +
              '</div>' +
              '<span class="cart-item-price">$' + lineTotal + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="cart-remove" aria-label="Remove item">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>' +
            ' Remove' +
          '</button>' +
        '</div>';
      }
      list.innerHTML = html;

      // Wire quantity + remove buttons
      var items = list.querySelectorAll(".cart-item");
      items.forEach(function(item) {
        var pid = parseInt(item.getAttribute("data-product-id"), 10);
        item.querySelector(".qty-dec").addEventListener("click", function() { changeQty(pid, -1); });
        item.querySelector(".qty-inc").addEventListener("click", function() { changeQty(pid, +1); });
        item.querySelector(".cart-remove").addEventListener("click", function() { removeItem(pid); });
      });

      // Update summary
      var subtotal = 0;
      for (var j = 0; j < cart.length; j++) {
        var p2 = productMap[cart[j].product_id];
        if (p2) subtotal += p2.price * cart[j].quantity;
      }
      updateSummary(subtotal);
    }

    function changeQty(productId, delta) {
      var cart = getCart();
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].product_id === productId) {
          cart[i].quantity = Math.max(1, cart[i].quantity + delta);
          break;
        }
      }
      saveCart(cart);
      renderCart();
    }

    function removeItem(productId) {
      var cart = getCart();
      var newCart = [];
      for (var i = 0; i < cart.length; i++) {
        if (cart[i].product_id !== productId) newCart.push(cart[i]);
      }
      saveCart(newCart);
      renderCart();
    }

    function updateSummary(subtotal) {
      var shipping = selectedShipping === "express" ? SHIP_EXPRESS : 0;

      /* ── Calculate discount rows ── */
      var cart = getCart();
      var totalDiscount = 0;
      var discountRowsHTML = "";

      /* Shop vouchers: apply per-seller subtotal */
      Object.keys(appliedShopVouchers).forEach(function(sid) {
        var v = appliedShopVouchers[sid];
        var sellerSubtotal = 0;
        for (var i = 0; i < cart.length; i++) {
          var p = productMap[cart[i].product_id];
          if (p && String(p.seller_id) === String(sid)) sellerSubtotal += p.price * cart[i].quantity;
        }
        var disc = calcDiscount(v, sellerSubtotal);
        if (disc > 0) {
          totalDiscount += disc;
          var shopName = sellerMap[sid] ? sellerMap[sid].shop_name : "Shop";
          discountRowsHTML += '<div class="summary-discount-row">' +
            '<span class="discount-label">' + shopName + ' <span class="discount-code-chip">' + v.promo_code + '</span></span>' +
            '<span class="discount-amount">−$' + disc.toFixed(2) + '</span>' +
          '</div>';
        }
      });

      /* Platform voucher: applies to subtotal after shop discounts */
      if (appliedPlatformVoucher) {
        var platformBase = subtotal - totalDiscount;
        var platformDisc = calcDiscount(appliedPlatformVoucher, platformBase);
        if (platformDisc > 0) {
          totalDiscount += platformDisc;
          discountRowsHTML += '<div class="summary-discount-row">' +
            '<span class="discount-label">Platform <span class="discount-code-chip">' + appliedPlatformVoucher.promo_code + '</span></span>' +
            '<span class="discount-amount">−$' + platformDisc.toFixed(2) + '</span>' +
          '</div>';
        }
      }

      var discEl = document.getElementById("summary-discounts");
      if (discEl) discEl.innerHTML = discountRowsHTML;

      var discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      var tax   = discountedSubtotal * TAX_RATE;
      var total = discountedSubtotal + shipping + tax;

      var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      set("summary-subtotal", "$" + subtotal.toFixed(2));
      set("summary-shipping", shipping === 0 ? "Free" : "$" + shipping.toFixed(2));
      set("summary-tax",      "$" + tax.toFixed(2));
      set("summary-total",    "$" + total.toFixed(2));
    }

    renderCart();

    // Shipping method toggle
    document.querySelectorAll(".ship-card").forEach(function(card) {
      card.addEventListener("click", function() {
        document.querySelectorAll(".ship-card").forEach(function(c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        var radio = card.querySelector("input[type=radio]");
        if (radio) { radio.checked = true; selectedShipping = radio.value; }
        var cart = getCart();
        var subtotal = 0;
        for (var i = 0; i < cart.length; i++) {
          var p = productMap[cart[i].product_id];
          if (p) subtotal += p.price * cart[i].quantity;
        }
        updateSummary(subtotal);
      });
    });

    /* ── Voucher helpers ── */
    function currentSubtotal() {
      var cart = getCart(), sub = 0;
      for (var i = 0; i < cart.length; i++) {
        var p = productMap[cart[i].product_id];
        if (p) sub += p.price * cart[i].quantity;
      }
      return sub;
    }

    function voucherSearchValue() {
      var el = document.getElementById("voucher-search");
      return el ? el.value : "";
    }

    /* Build HTML for one group section (platform or one shop) */
    function renderVoucherGroupHTML(title, type, sellerId, vouchers) {
      var iconPlatform = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="3" width="22" height="14" rx="2"/><path d="M1 9h22"/></svg>';
      var iconShop     = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
      var icon = type === "platform" ? iconPlatform : iconShop;
      var selectedV = type === "platform" ? appliedPlatformVoucher : appliedShopVouchers[sellerId];

      var html = '<div class="voucher-group">' +
        '<div class="voucher-group-header">' +
          '<span class="vgroup-icon ' + type + '">' + icon + '</span>' +
          '<span class="vgroup-title">' + title + '</span>' +
        '</div>';

      if (!vouchers.length) {
        html += '<p class="voucher-none">No vouchers available.</p>';
      } else {
        html += '<div class="voucher-cards">';
        for (var vi = 0; vi < vouchers.length; vi++) {
          var v = vouchers[vi];
          var expired = isExpired(v);
          var isSelected = !!(selectedV && selectedV.promo_code === v.promo_code);

          var discLabel = v.discount_type === "Percentage"
            ? v.discount_value + "% OFF"
            : "SAVE " + formatDiscount(v);

          var scopeDesc = type === "platform" ? "Applies to entire order" : "This shop only";

          var expStr = "";
          if (v.end_date) {
            var dp = v.end_date.split(" ")[0].split("-");
            var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            expStr = dp[2] + " " + months[parseInt(dp[1], 10) - 1] + " " + dp[0];
          }

          var cardClass = "voucher-card" + (isSelected ? " selected" : "") + (expired ? " expired" : "");
          var dataStr = 'data-code="' + v.promo_code + '" data-type="' + type + '" data-seller="' + (sellerId !== null ? sellerId : "") + '"';

          html += '<div class="' + cardClass + '" ' + dataStr + (expired ? '' : ' tabindex="0"') + '>' +
            '<div class="vc-body">' +
              '<span class="vc-discount">' + discLabel + '</span>' +
              '<span class="vc-code">' + v.promo_code + '</span>' +
              '<span class="vc-desc">' + scopeDesc + (expStr ? ' · Exp ' + expStr : '') + '</span>' +
            '</div>' +
            '<div class="vc-check-col">' +
              (expired
                ? '<span class="vc-expired-badge">Expired</span>'
                : '<span class="vc-radio' + (isSelected ? ' checked' : '') + '">' +
                    (isSelected ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="4 12 9 17 20 7"/></svg>' : '') +
                  '</span>') +
            '</div>' +
          '</div>';
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    /* Main render: builds platform group + one group per cart seller */
    function renderVouchers() {
      var voucherList = document.getElementById("voucher-list");
      if (!voucherList) return;

      var filter = (voucherSearchValue() || "").trim().toUpperCase();

      /* Collect all promos as array */
      var allPromos = [];
      var promoKeys = Object.keys(promoMap);
      for (var pk = 0; pk < promoKeys.length; pk++) { allPromos.push(promoMap[promoKeys[pk]]); }

      /* Sellers in cart */
      var cart = getCart();
      var cartSellerIds = [], seenSid = {};
      for (var ci = 0; ci < cart.length; ci++) {
        var cp = productMap[cart[ci].product_id];
        if (cp && !seenSid[cp.seller_id]) { seenSid[cp.seller_id] = true; cartSellerIds.push(cp.seller_id); }
      }

      function matchFilter(v) {
        return !filter || v.promo_code.toUpperCase().indexOf(filter) !== -1;
      }

      var html = "";

      /* Platform group */
      var platformList = [];
      for (var pi = 0; pi < allPromos.length; pi++) {
        if (allPromos[pi].seller_id === null && matchFilter(allPromos[pi])) platformList.push(allPromos[pi]);
      }
      html += renderVoucherGroupHTML("Platform Vouchers", "platform", null, platformList);

      /* Shop groups */
      for (var si = 0; si < cartSellerIds.length; si++) {
        var sid = cartSellerIds[si];
        var shopList = [];
        for (var svi = 0; svi < allPromos.length; svi++) {
          if (allPromos[svi].seller_id === sid && matchFilter(allPromos[svi])) shopList.push(allPromos[svi]);
        }
        var shopName = sellerMap[sid] ? sellerMap[sid].shop_name : "Shop #" + sid;
        html += renderVoucherGroupHTML(shopName, "shop", sid, shopList);
      }

      if (!cartSellerIds.length && !platformList.length) {
        html = '<p class="voucher-none" style="padding:0.5rem 0;">Add items to cart to see available vouchers.</p>';
      }

      voucherList.innerHTML = html;
    }

    /* Toggle selection via event delegation */
    var voucherListEl = document.getElementById("voucher-list");
    if (voucherListEl) {
      voucherListEl.addEventListener("click", function(e) {
        var card = e.target.closest && e.target.closest(".voucher-card:not(.expired)");
        if (!card) return;
        var code = card.getAttribute("data-code");
        var type = card.getAttribute("data-type");
        var sellerStr = card.getAttribute("data-seller");
        var sid = sellerStr !== "" ? parseInt(sellerStr, 10) : null;

        if (type === "platform") {
          appliedPlatformVoucher = (appliedPlatformVoucher && appliedPlatformVoucher.promo_code === code) ? null : promoMap[code];
        } else {
          if (appliedShopVouchers[sid] && appliedShopVouchers[sid].promo_code === code) {
            delete appliedShopVouchers[sid];
          } else {
            appliedShopVouchers[sid] = promoMap[code];
          }
        }
        renderVouchers();
        updateSummary(currentSubtotal());
      });
    }

    /* Search filter */
    var voucherSearchEl = document.getElementById("voucher-search");
    if (voucherSearchEl) {
      voucherSearchEl.addEventListener("input", function() { renderVouchers(); });
    }

    /* Re-render vouchers whenever cart changes */
    var _origRenderCart = renderCart;
    renderCart = function() {
      _origRenderCart();
      renderVouchers();
    };
    renderVouchers();

    // Payment method toggle
    document.querySelectorAll(".payment-opt-card").forEach(function(card) {
      card.addEventListener("click", function() {
        document.querySelectorAll(".payment-opt-card").forEach(function(c) { c.classList.remove("selected"); });
        card.classList.add("selected");
        var radio = card.querySelector("input[type=radio]");
        if (radio) { radio.checked = true; selectedPayment = radio.value; }
        // Toggle secure note visibility: only show for card
        var note = document.getElementById("payment-secure-note");
        if (note) note.style.display = selectedPayment === "card" ? "" : "none";
      });
    });

    // Checkout button
    var checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", function() {
        var cart = getCart();
        if (!cart.length) { alert("Your cart is empty."); return; }

        // Build order items + calculate totals
        var orderItems = [];
        var subtotal = 0;
        for (var i = 0; i < cart.length; i++) {
          var p = productMap[cart[i].product_id];
          if (p) {
            subtotal += p.price * cart[i].quantity;
            orderItems.push({ product_id: cart[i].product_id, quantity: cart[i].quantity, unit_price: p.price });
          }
        }
        var shipping = selectedShipping === "express" ? SHIP_EXPRESS : 0;
        var tax = subtotal * TAX_RATE;
        var total = subtotal + shipping + tax;

        // ── Split order by seller ──────────────────────────────
        var itemsBySeller = {}, sellerOrderArr = [];
        for (var gi = 0; gi < orderItems.length; gi++) {
          var gProd = productMap[orderItems[gi].product_id];
          var gSid  = gProd ? gProd.seller_id : 0;
          if (!itemsBySeller[gSid]) { itemsBySeller[gSid] = []; sellerOrderArr.push(gSid); }
          itemsBySeller[gSid].push(orderItems[gi]);
        }

        /* Per-seller subtotals */
        var sellerSubs = {};
        for (var ssi = 0; ssi < sellerOrderArr.length; ssi++) {
          var ssSid = sellerOrderArr[ssi], ssSub = 0;
          for (var ssk = 0; ssk < itemsBySeller[ssSid].length; ssk++) {
            ssSub += itemsBySeller[ssSid][ssk].unit_price * itemsBySeller[ssSid][ssk].quantity;
          }
          sellerSubs[ssSid] = ssSub;
        }

        /* Total shop discount (for platform proportional calc) */
        var totalShopDisc = 0;
        for (var tsd = 0; tsd < sellerOrderArr.length; tsd++) {
          var tsdSid = sellerOrderArr[tsd];
          if (appliedShopVouchers[tsdSid]) totalShopDisc += calcDiscount(appliedShopVouchers[tsdSid], sellerSubs[tsdSid]);
        }
        var platformBase = Math.max(0, subtotal - totalShopDisc);
        var platformDiscTotal = calcDiscount(appliedPlatformVoucher, platformBase);

        var now = new Date();
        var pad = function(n) { return String(n).padStart(2, "0"); };
        var nowStr = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) +
          " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());

        var existingOrders = [];
        try { existingOrders = JSON.parse(localStorage.getItem("rv_new_orders") || "[]"); } catch(e) {}

        var createdOrders = [];
        var grandTotal = 0;

        for (var coi = 0; coi < sellerOrderArr.length; coi++) {
          var coSid      = sellerOrderArr[coi];
          var coItems    = itemsBySeller[coSid];
          var coSub      = sellerSubs[coSid];
          var coShopDisc = calcDiscount(appliedShopVouchers[coSid] || null, coSub);
          /* Platform discount: proportional share by subtotal */
          var coPlatDisc = subtotal > 0 ? platformDiscTotal * (coSub / subtotal) : 0;
          /* Shipping only on first sub-order */
          var coShip     = coi === 0 ? shipping : 0;
          var coDiscSub  = Math.max(0, coSub - coShopDisc - coPlatDisc);
          var coTax      = coDiscSub * TAX_RATE;
          var coTotal    = coDiscSub + coShip + coTax;
          grandTotal    += coTotal;

          var counter = parseInt(localStorage.getItem("rv_order_counter") || "0", 10) + 1;
          localStorage.setItem("rv_order_counter", String(counter));

          var coOrder = {
            order_id:       9000 + counter,
            buyer_id:       session ? session.user_id : 0,
            seller_id:      coSid,
            order_status:   selectedPayment === "cash" ? "Confirmed" : "Pending",
            total_amount:   coTotal,
            payment_method: selectedPayment,
            shipping_method: selectedShipping,
            created_at:     nowStr,
            items:          coItems
          };
          existingOrders.unshift(coOrder);
          createdOrders.push(coOrder);
        }

        localStorage.setItem("rv_new_orders", JSON.stringify(existingOrders));
        localStorage.removeItem("rv_cart");
        window.dispatchEvent(new Event("rv:cart-updated"));

        showConfirmModal(createdOrders, grandTotal);
      });
    }

    function showConfirmModal(orders, grandTotal) {
      var overlay = document.getElementById("order-confirm-overlay");
      if (!overlay) { window.location.href = "account.html?view=tracking"; return; }

      var isMulti = orders.length > 1;
      var numEl   = document.getElementById("confirm-order-num");
      if (numEl) {
        numEl.textContent = isMulti
          ? orders.length + " orders placed"
          : "Order #VC-" + String(orders[0].order_id).padStart(4, "0");
      }

      var summaryEl = document.getElementById("confirm-summary");
      if (summaryEl) {
        var html = "";
        if (isMulti) {
          /* Multi-order: one row per sub-order */
          for (var oi = 0; oi < orders.length; oi++) {
            var ord   = orders[oi];
            var sname = sellerMap[ord.seller_id] ? sellerMap[ord.seller_id].shop_name : "Shop";
            html += '<div class="confirm-item-row">' +
              '<span class="confirm-item-name">' + sname + ' · ' + ord.items.length + ' item(s)</span>' +
              '<span class="confirm-item-price">#VC-' + String(ord.order_id).padStart(4, "0") + '</span>' +
            '</div>';
          }
        } else {
          /* Single order: show up to 2 item lines */
          var items = orders[0].items, shown = 0;
          for (var ii = 0; ii < items.length; ii++) {
            var iprod = productMap[items[ii].product_id];
            if (iprod && shown < 2) {
              html += '<div class="confirm-item-row">' +
                '<span class="confirm-item-name">' + iprod.title + ' &times; ' + items[ii].quantity + '</span>' +
                '<span class="confirm-item-price">$' + (items[ii].unit_price * items[ii].quantity).toFixed(2) + '</span>' +
              '</div>';
              shown++;
            }
          }
          if (items.length > 2) html += '<p class="confirm-more">+ ' + (items.length - 2) + ' more item(s)</p>';
        }
        html += '<div class="confirm-total-row"><span>Total Paid</span><strong>$' + grandTotal.toFixed(2) + '</strong></div>';
        summaryEl.innerHTML = html;
      }

      overlay.removeAttribute("aria-hidden");
      overlay.classList.add("visible");
      document.body.style.overflow = "hidden";

      var trackBtn = document.getElementById("confirm-track-btn");
      if (trackBtn) {
        trackBtn.onclick = function() { window.location.href = "account.html?view=tracking"; };
      }
    }

  }).catch(function(err) {
    console.error(err);
    var list = document.getElementById("cart-items-list");
    if (list) list.innerHTML = '<p style="color:var(--muted)">Could not load cart. Serve the site over http.</p>';
  });
})();
