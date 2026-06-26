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

  // Load products + photos, then render
  Promise.all([getJSON("products.json"), getJSON("product_photos.json"), getJSON("buyers.json"), getJSON("sellers.json")])
  .then(function(res) {
    var products = res[0], photos = res[1], buyers = res[2], sellers = res[3];

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
      var tax = subtotal * TAX_RATE;
      var total = subtotal + shipping + tax;
      var set = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
      set("summary-subtotal", "$" + subtotal.toFixed(2));
      set("summary-shipping", shipping === 0 ? "Free" : "$" + shipping.toFixed(2));
      set("summary-tax", "$" + tax.toFixed(2));
      set("summary-total", "$" + total.toFixed(2));
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

    // Checkout button
    var checkoutBtn = document.getElementById("checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", function() {
        var cart = getCart();
        if (!cart.length) { alert("Your cart is empty."); return; }
        checkoutBtn.textContent = "Order Placed! ✓";
        checkoutBtn.disabled = true;
        // In a real app: submit to backend. Here: clear cart and show confirmation.
        setTimeout(function() {
          localStorage.removeItem("rv_cart");
          window.dispatchEvent(new Event("rv:cart-updated"));
          window.location.href = "account.html";
        }, 1500);
      });
    }

  }).catch(function(err) {
    console.error(err);
    var list = document.getElementById("cart-items-list");
    if (list) list.innerHTML = '<p style="color:var(--muted)">Could not load cart. Serve the site over http.</p>';
  });
})();
