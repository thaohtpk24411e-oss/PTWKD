/* ============================================================
   seller-profile.js — Seller Profile page.
   URL: seller_profile.html?id=SELLER_ID
   Loads sellers, products, photos, promotions, reviews, order_items, buyers.
   ============================================================ */

(function () {
  var DATA = "../assets/json/";
  function getJSON(name) { return fetch(DATA + name).then(function (r) { return r.json(); }); }

  function normalizeImagePath(url) {
    return url && url.indexOf("/assets/") === 0 ? "../assets/" + url.slice(8) : url || "";
  }

  function money(n) {
    return "$" + parseFloat(n).toFixed(2);
  }

  function formatNum(n) {
    if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "k";
    return String(n);
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── Star helpers ── */
  function starSVG(cls) {
    var paths = {
      full:  '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
      half:  '<defs><linearGradient id="spHG"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="#ddd"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#spHG)"/>',
      empty: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
    };
    return '<svg class="' + cls + ' ' + (cls === 'sp-rev-big-star' || cls === 'sp-star' || cls === 'sp-rev-star' ? '' : '') + '" viewBox="0 0 24 24" fill="currentColor" stroke="none">' + (paths[Object.keys(paths).find(function(k){return k;}) || 'full']) + '</svg>';
  }

  function renderStars(rating, cls) {
    var html = "";
    for (var i = 1; i <= 5; i++) {
      var type = rating >= i ? "full" : (rating >= i - 0.5 ? "half" : "empty");
      html += '<svg class="' + cls + ' ' + type + '" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
    return html;
  }

  /* ── Follow state ── */
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

  /* ── Favourites state ── */
  function getFavourites() {
    try { return JSON.parse(localStorage.getItem("rv_favourites") || "[]"); } catch (e) { return []; }
  }
  function toggleFavourite(productId) {
    var favs = getFavourites();
    var idx = favs.indexOf(productId);
    if (idx === -1) favs.push(productId);
    else favs.splice(idx, 1);
    localStorage.setItem("rv_favourites", JSON.stringify(favs));
    return idx === -1;
  }

  /* ── Toast ── */
  function showToast(msg) {
    var t = document.getElementById("sp-global-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "sp-global-toast";
      t.className = "sp-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }

  /* ── Parse seller ID from URL ── */
  var params = new URLSearchParams(window.location.search);
  var sellerId = parseInt(params.get("id"), 10);

  if (!sellerId) {
    document.getElementById("sp-profile-card").innerHTML =
      '<p class="sp-loading">No seller specified. Add ?id=SELLER_ID to the URL.</p>';
  }

  /* ── Load all data ── */
  Promise.all([
    getJSON("sellers.json"),
    getJSON("products.json"),
    getJSON("product_photos.json"),
    getJSON("promotions.json"),
    getJSON("reviews_feedback.json"),
    getJSON("order_items.json"),
    getJSON("buyers.json")
  ]).then(function (res) {
    var sellers     = res[0];
    var products    = res[1];
    var photos      = res[2];
    var promotions  = res[3];
    var reviews     = res[4];
    var orderItems  = res[5];
    var buyers      = res[6];

    /* Find seller */
    var seller = null;
    for (var si = 0; si < sellers.length; si++) {
      if (sellers[si].seller_id === sellerId) { seller = sellers[si]; break; }
    }
    if (!seller) {
      document.getElementById("sp-profile-card").innerHTML =
        '<p class="sp-loading">Seller not found.</p>';
      return;
    }

    /* Build product photo map: product_id -> first photo URL */
    var photoMap = {};
    for (var pi = 0; pi < photos.length; pi++) {
      var ph = photos[pi];
      if (!photoMap[ph.product_id]) photoMap[ph.product_id] = normalizeImagePath(ph.photo_url);
    }

    /* Seller products (active) */
    var sellerProducts = [];
    for (var qi = 0; qi < products.length; qi++) {
      var p = products[qi];
      if (p.seller_id === sellerId && p.approval_status === "Active") {
        sellerProducts.push(p);
      }
    }

    /* Seller promotions (active) */
    var now = new Date();
    var sellerPromos = [];
    for (var pri = 0; pri < promotions.length; pri++) {
      var pr = promotions[pri];
      if (pr.seller_id === sellerId && new Date(pr.end_date) > now) {
        sellerPromos.push(pr);
      }
    }

    /* Build product ID set for review joining */
    var productIdSet = {};
    for (var psi = 0; psi < sellerProducts.length; psi++) {
      productIdSet[sellerProducts[psi].product_id] = sellerProducts[psi].title;
    }

    /* Build order_item -> product_id map */
    var oiProductMap = {};
    for (var oi = 0; oi < orderItems.length; oi++) {
      oiProductMap[orderItems[oi].order_item_id] = orderItems[oi].product_id;
    }

    /* Seller reviews (via order_items -> products -> seller) */
    var sellerReviews = [];
    for (var ri = 0; ri < reviews.length; ri++) {
      var rv = reviews[ri];
      var prodId = oiProductMap[rv.order_item_id];
      if (prodId && productIdSet[prodId]) {
        rv._product_title = productIdSet[prodId];
        sellerReviews.push(rv);
      }
    }

    /* Build buyer map */
    var buyerMap = {};
    for (var bi = 0; bi < buyers.length; bi++) {
      buyerMap[buyers[bi].buyer_id] = buyers[bi];
    }

    /* ── Render all sections ── */
    renderBanner(seller);
    renderProfileCard(seller);
    renderVoucher(sellerPromos[0], seller);
    renderFeaturedProducts(sellerProducts, photoMap);
    renderAllProducts(sellerProducts, photoMap);
    renderStory(seller, sellerReviews, sellerProducts, photoMap, "sp-story");
    renderStory(seller, sellerReviews, sellerProducts, photoMap, "sp-shop-story");
    renderReviews(sellerReviews, buyerMap);
    wireTabs();
    wireFollow(seller);
    wireChat();

  }).catch(function (err) {
    console.error(err);
    document.getElementById("sp-profile-card").innerHTML =
      '<p class="sp-loading">Could not load seller data. Serve over http (python -m http.server 8000).</p>';
  });

  /* ────────────────────────────────────────────────────────── */

  function renderBanner(seller) {
    var bannerEl = document.getElementById("sp-banner");
    if (!bannerEl) return;
    var img = normalizeImagePath(seller.shop_banner || "");
    if (img) bannerEl.style.backgroundImage = "url('" + img + "')";
  }

  function renderProfileCard(seller) {
    var cardEl = document.getElementById("sp-profile-card");
    if (!cardEl) return;

    var name = escapeHtml(seller.shop_name || "Artisan Shop");
    var initials = (seller.shop_name || "?")
      .replace(/[^A-Za-zÀ-ɏ ]/g, "")
      .split(" ").filter(Boolean).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "?";

    var img = normalizeImagePath(seller.shop_banner || "");
    var rating = seller.rating || 0;
    var baseFollowers = seller.followers || 0;
    var following = getFollowing();
    var isFollowing = following.indexOf(sellerId) !== -1;

    /* Parse location from seller_background: "Founded X · Hanoi · ..." */
    var location = "";
    if (seller.seller_background) {
      var parts = seller.seller_background.split("·");
      if (parts.length >= 2) location = parts[1].trim() + ", Vietnam";
    }

    /* Badge level */
    var badge = "";
    if (rating >= 4.8) {
      badge = '<span class="sp-badge"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Master Artisan</span>';
    } else if (rating >= 4.5) {
      badge = '<span class="sp-badge">Featured Artisan</span>';
    }

    var avatarHtml = img
      ? '<img src="' + img + '" alt="' + name + '" onerror="this.parentNode.textContent=\'' + initials + '\';" />'
      : initials;

    cardEl.innerHTML =
      '<div class="sp-profile-top">' +
        '<div class="sp-avatar-wrap">' +
          '<div class="sp-avatar">' + avatarHtml + '</div>' +
        '</div>' +
        '<div class="sp-profile-info">' +
          '<h1 class="sp-shop-name">' + name + badge + '</h1>' +
          (location
            ? '<p class="sp-location"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>' + escapeHtml(location) + '</p>'
            : '') +
          (seller.title_story ? '<p class="sp-title-story">' + escapeHtml(seller.title_story) + '</p>' : '') +
        '</div>' +
        '<div class="sp-profile-actions">' +
          '<button class="sp-btn-follow' + (isFollowing ? ' following' : '') + '" id="sp-follow-btn" data-base-followers="' + baseFollowers + '">' +
            (isFollowing ? 'Following' : 'Follow') +
          '</button>' +
          '<button class="sp-btn-chat" id="sp-chat-btn">Chat</button>' +
        '</div>' +
      '</div>';

    document.title = (seller.shop_name || "Artisan") + " — ReViet";
  }

  function renderVoucher(promo, seller) {
    var el = document.getElementById("sp-voucher");
    if (!el) return;
    if (!promo) { el.innerHTML = ""; return; }

    var discountText = "";
    if (promo.discount_type === "Percentage") {
      discountText = promo.discount_value + "% off";
    } else {
      var amt = parseFloat(promo.discount_value || 0);
      discountText = (amt >= 1000 ? Math.round(amt / 1000) + "k" : money(amt)) + " off";
    }

    var minSpend = promo.min_order_value
      ? "Min. " + money(promo.min_order_value) + " spend"
      : "No minimum spend";

    var shopSuffix = seller && seller.shop_name
      ? " · Exclusive for " + seller.shop_name
      : (promo.description ? " · " + promo.description : "");

    el.innerHTML =
      '<div class="sp-voucher-banner">' +
        '<div class="sp-voucher-icon">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M16 7v10M8 7v10"/></svg>' +
        '</div>' +
        '<div class="sp-voucher-body">' +
          '<p class="sp-voucher-title">' + escapeHtml(discountText) + '</p>' +
          '<p class="sp-voucher-desc">' + escapeHtml(minSpend + shopSuffix) + '</p>' +
        '</div>' +
        '<button class="sp-voucher-btn" data-promo-code="' + escapeHtml(promo.code || "") + '">Claim Voucher</button>' +
      '</div>';

    el.querySelector(".sp-voucher-btn").addEventListener("click", function () {
      var code = this.getAttribute("data-promo-code");
      if (code) {
        try { navigator.clipboard.writeText(code); } catch (e) {}
        showToast("Voucher code copied: " + code);
      } else {
        showToast("Voucher applied to your next purchase!");
      }
    });
  }

  function productCardHTML(prod, photoMap, favs) {
    var pid = prod.product_id;
    var img = photoMap[pid] || "";
    var name = escapeHtml(prod.title || "Product");
    var material = escapeHtml(prod.materials || "");
    var price = money(prod.price || 0);
    var isLiked = favs.indexOf(pid) !== -1;

    var imgHtml = img
      ? '<img src="' + img + '" alt="' + name + '" loading="lazy" onerror="this.src=\'\'" />'
      : '<div style="width:100%;height:100%;background:#e4dcd0;position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b0a898;font-size:2rem;">🏺</div>';

    return '<div class="sp-prod-card" data-pid="' + pid + '">' +
      '<div class="sp-prod-img-wrap">' +
        imgHtml +
        '<button class="sp-prod-heart' + (isLiked ? ' liked' : '') + '" data-heart-pid="' + pid + '" aria-label="Add to favourites">' +
          '<svg viewBox="0 0 24 24" width="15" height="15" fill="' + (isLiked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="sp-prod-info">' +
        '<p class="sp-prod-name">' + name + '</p>' +
        (material ? '<p class="sp-prod-material">' + material + '</p>' : '') +
        '<p class="sp-prod-price">' + price + '</p>' +
      '</div>' +
    '</div>';
  }

  function renderFeaturedProducts(sellerProducts, photoMap) {
    var gridEl = document.getElementById("sp-featured-grid");
    var subEl  = document.getElementById("sp-featured-sub");
    var linkEl = document.getElementById("sp-view-all-link");
    if (!gridEl) return;

    var favs = getFavourites();
    var featured = sellerProducts.slice(0, 4);

    if (subEl) subEl.textContent = sellerProducts.length + " products in this shop";
    if (linkEl) {
      linkEl.href = "#";
      linkEl.addEventListener("click", function (e) {
        e.preventDefault();
        var tab = document.querySelector('.sp-tab[data-tab="products"]');
        if (tab) tab.click();
      });
    }

    if (!featured.length) {
      gridEl.innerHTML = '<p class="sp-empty">No products listed yet.</p>';
      return;
    }

    var html = "";
    for (var i = 0; i < featured.length; i++) html += productCardHTML(featured[i], photoMap, favs);
    gridEl.innerHTML = html;
    wireProductGrid(gridEl);
  }

  /* ── All Products tab with pagination + search ── */
  var allProdsState = { page: 1, query: "", items: [], photoMap: {} };
  var PRODS_PER_PAGE = 8;

  function renderAllProducts(sellerProducts, photoMap) {
    allProdsState.items = sellerProducts;
    allProdsState.photoMap = photoMap;

    var searchEl = document.getElementById("sp-prod-search");
    if (searchEl) {
      var debounce;
      searchEl.addEventListener("input", function () {
        clearTimeout(debounce);
        debounce = setTimeout(function () {
          allProdsState.query = searchEl.value.toLowerCase().trim();
          allProdsState.page = 1;
          renderAllProductsGrid();
        }, 200);
      });
    }

    renderAllProductsGrid();
  }

  function renderAllProductsGrid() {
    var gridEl = document.getElementById("sp-all-grid");
    var pagEl  = document.getElementById("sp-prod-pagination");
    if (!gridEl) return;

    var q = allProdsState.query;
    var filtered = allProdsState.items.filter(function (p) {
      if (!q) return true;
      return (p.title || "").toLowerCase().indexOf(q) !== -1 ||
             (p.materials || "").toLowerCase().indexOf(q) !== -1 ||
             (p.description || "").toLowerCase().indexOf(q) !== -1;
    });

    var totalPages = Math.max(1, Math.ceil(filtered.length / PRODS_PER_PAGE));
    if (allProdsState.page > totalPages) allProdsState.page = totalPages;
    var start = (allProdsState.page - 1) * PRODS_PER_PAGE;
    var slice = filtered.slice(start, start + PRODS_PER_PAGE);

    var favs = getFavourites();

    if (!slice.length) {
      gridEl.innerHTML = '<p class="sp-empty">No products match your search.</p>';
      if (pagEl) pagEl.innerHTML = "";
      return;
    }

    var html = "";
    for (var i = 0; i < slice.length; i++) {
      html += productCardHTML(slice[i], allProdsState.photoMap, favs);
    }
    gridEl.innerHTML = html;
    wireProductGrid(gridEl);

    /* Pagination */
    if (pagEl) {
      if (totalPages <= 1) { pagEl.innerHTML = ""; return; }
      pagEl.innerHTML =
        '<button class="sp-page-btn" id="sp-prev-btn"' + (allProdsState.page <= 1 ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>' +
        '</button>' +
        '<span class="sp-page-info">' + allProdsState.page + ' of ' + totalPages + '</span>' +
        '<button class="sp-page-btn" id="sp-next-btn"' + (allProdsState.page >= totalPages ? " disabled" : "") + '>' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
        '</button>';

      var prevBtn = document.getElementById("sp-prev-btn");
      var nextBtn = document.getElementById("sp-next-btn");
      if (prevBtn) prevBtn.addEventListener("click", function () { allProdsState.page--; renderAllProductsGrid(); });
      if (nextBtn) nextBtn.addEventListener("click", function () { allProdsState.page++; renderAllProductsGrid(); });
    }
  }

  function wireProductGrid(gridEl) {
    /* Heart buttons */
    var hearts = gridEl.querySelectorAll(".sp-prod-heart");
    for (var i = 0; i < hearts.length; i++) {
      hearts[i].addEventListener("click", function (e) {
        e.stopPropagation();
        var pid = parseInt(this.getAttribute("data-heart-pid"), 10);
        var nowLiked = toggleFavourite(pid);
        this.classList.toggle("liked", nowLiked);
        var svgPath = this.querySelector("svg");
        if (svgPath) svgPath.setAttribute("fill", nowLiked ? "currentColor" : "none");
        showToast(nowLiked ? "Added to favourites" : "Removed from favourites");
      });
    }

    /* Card click -> product detail */
    var cards = gridEl.querySelectorAll(".sp-prod-card");
    for (var ci = 0; ci < cards.length; ci++) {
      cards[ci].addEventListener("click", function (e) {
        if (e.target.closest(".sp-prod-heart")) return;
        var pid = this.getAttribute("data-pid");
        if (pid) window.location.href = "product_detail.html?id=" + pid;
      });
    }
  }

  function renderStory(seller, sellerReviews, sellerProducts, photoMap, targetId) {
    var el = document.getElementById(targetId || "sp-story");
    if (!el) return;

    var background = seller.seller_background || "";

    /* Parse founded year */
    var foundedYear = "";
    var foundMatch = background.match(/Founded\s+(\d{4})/i);
    if (foundMatch) foundedYear = foundMatch[1];

    /* Stats */
    var avgRating   = seller.rating || 0;
    var followers   = seller.followers || 0;
    var isFollowing = getFollowing().indexOf(sellerId) !== -1;
    var dispFollowers = formatNum(isFollowing ? followers + 1 : followers);

    /* Story content */
    var storyTitle = seller.title_story || seller.shop_name || "Crafted with Heart";
    var storyBody  = seller.story_text  || "A story of craft, passion, and tradition.";

    /* Story photo: prefer a product image, fallback to shop_banner */
    var storyImg = "";
    if (sellerProducts && photoMap) {
      for (var pi = 0; pi < sellerProducts.length; pi++) {
        var candidate = photoMap[sellerProducts[pi].product_id];
        if (candidate) { storyImg = candidate; break; }
      }
    }
    if (!storyImg) storyImg = normalizeImagePath(seller.shop_banner || "");

    el.innerHTML =
      '<div class="sp-story-left">' +
        '<p class="sp-story-eyebrow">Our Story</p>' +
        '<h2 class="sp-story-title">' + escapeHtml(storyTitle) + '</h2>' +
        '<p class="sp-story-text">' + escapeHtml(storyBody) + '</p>' +
        '<div class="sp-story-stats">' +
          '<div class="sp-story-stat"><span class="sp-story-stat-num" id="sp-story-follow-count">' + dispFollowers + '</span><span class="sp-story-stat-label">Followers</span></div>' +
          '<div class="sp-story-stat"><span class="sp-story-stat-num">' + avgRating.toFixed(1) + '</span><span class="sp-story-stat-label">Average Rating</span></div>' +
          (foundedYear ? '<div class="sp-story-stat"><span class="sp-story-stat-num">' + foundedYear + '</span><span class="sp-story-stat-label">Year Founded</span></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="sp-story-right">' +
        (storyImg
          ? '<img class="sp-story-photo" src="' + storyImg + '" alt="' + escapeHtml(seller.shop_name || "") + ' craft" />'
          : '<div class="sp-story-photo" style="background:#e4dcd0;display:flex;align-items:center;justify-content:center;font-size:4rem;">🏺</div>') +
      '</div>';
  }

  var REV_INITIAL = 6;

  function buildReviewCardHTML(rv, buyerMap) {
    var buyer = buyerMap[rv.buyer_id] || {};
    var buyerName = escapeHtml(buyer.full_name || "Customer");
    var initial   = buyerName.charAt(0).toUpperCase() || "C";
    var dateStr   = rv.created_at ? rv.created_at.slice(0, 10) : "";
    var rvRating  = parseInt(rv.rating, 10) || 0;

    var revStars = "";
    for (var s = 1; s <= 5; s++) {
      revStars += '<svg class="sp-rev-star ' + (s <= rvRating ? "full" : "empty") +
        '" viewBox="0 0 24 24" fill="currentColor" stroke="none">' +
        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }

    return '<div class="sp-review-card">' +
      '<div class="sp-rev-header">' +
        '<div class="sp-rev-avatar">' + initial + '</div>' +
        '<div>' +
          '<p class="sp-rev-name">' + buyerName + '</p>' +
          '<p class="sp-rev-date">' + escapeHtml(dateStr) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="sp-rev-stars">' + revStars + '</div>' +
      '<p class="sp-rev-text">' + escapeHtml(rv.review_text || "") + '</p>' +
      (rv._product_title ? '<p class="sp-rev-product">Re: ' + escapeHtml(rv._product_title) + '</p>' : '') +
    '</div>';
  }

  function renderReviews(sellerReviews, buyerMap) {
    var summaryEl = document.getElementById("sp-reviews-summary");
    var gridEl    = document.getElementById("sp-reviews-grid");

    /* Average rating */
    var avg = 0;
    if (sellerReviews.length) {
      var sum = 0;
      for (var si = 0; si < sellerReviews.length; si++) sum += (sellerReviews[si].rating || 0);
      avg = sum / sellerReviews.length;
    }

    if (summaryEl) {
      summaryEl.innerHTML =
        '<div class="sp-rev-big-num">' + avg.toFixed(1) + '</div>' +
        '<div>' +
          '<div class="sp-rev-big-stars">' + renderStars(avg, "sp-rev-big-star") + '</div>' +
          '<p class="sp-rev-count">' + sellerReviews.length + ' review' + (sellerReviews.length !== 1 ? "s" : "") + '</p>' +
        '</div>';
    }

    if (!gridEl) return;

    if (!sellerReviews.length) {
      gridEl.innerHTML = '<p class="sp-empty">No reviews yet for this seller.</p>';
      return;
    }

    /* Sort newest first */
    var sorted = sellerReviews.slice().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    var initial  = sorted.slice(0, REV_INITIAL);
    var extra    = sorted.slice(REV_INITIAL);
    var hasMore  = extra.length > 0;

    /* Build initial cards */
    var html = "";
    for (var i = 0; i < initial.length; i++) html += buildReviewCardHTML(initial[i], buyerMap);
    gridEl.innerHTML = html;

    /* Hidden extra block */
    var extraEl = document.getElementById("sp-reviews-extra");
    if (!extraEl) {
      extraEl = document.createElement("div");
      extraEl.id = "sp-reviews-extra";
      extraEl.className = "sp-reviews-grid sp-reviews-extra";
      gridEl.parentNode.insertBefore(extraEl, gridEl.nextSibling);
    }

    if (hasMore) {
      var extraHtml = "";
      for (var j = 0; j < extra.length; j++) extraHtml += buildReviewCardHTML(extra[j], buyerMap);
      extraEl.innerHTML = extraHtml;

      /* View All button */
      var btnWrap = document.getElementById("sp-rev-viewall-wrap");
      if (!btnWrap) {
        btnWrap = document.createElement("div");
        btnWrap.id = "sp-rev-viewall-wrap";
        btnWrap.className = "sp-rev-viewall-wrap";
        extraEl.parentNode.insertBefore(btnWrap, extraEl.nextSibling);
      }
      btnWrap.innerHTML =
        '<button class="sp-rev-viewall-btn" id="sp-rev-viewall-btn">' +
          'View All ' + sellerReviews.length + ' Reviews' +
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</button>';

      var btn = document.getElementById("sp-rev-viewall-btn");
      btn.addEventListener("click", function () {
        var isOpen = extraEl.classList.contains("open");
        if (isOpen) {
          extraEl.style.maxHeight = extraEl.scrollHeight + "px";
          requestAnimationFrame(function () {
            extraEl.style.maxHeight = "0";
          });
          extraEl.classList.remove("open");
          btn.innerHTML =
            'View All ' + sellerReviews.length + ' Reviews' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
          /* Scroll back to summary */
          var sumEl = document.getElementById("sp-reviews-summary");
          if (sumEl) sumEl.scrollIntoView({ behavior: "smooth", block: "start" });
        } else {
          extraEl.classList.add("open");
          extraEl.style.maxHeight = extraEl.scrollHeight + "px";
          btn.innerHTML =
            'Show Less' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
        }
      });
    } else {
      var oldBtn = document.getElementById("sp-rev-viewall-wrap");
      if (oldBtn) oldBtn.innerHTML = "";
      extraEl.innerHTML = "";
    }
  }

  /* ── Tabs ── */
  function wireTabs() {
    var tabs = document.querySelectorAll(".sp-tab");
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function () {
        var target = this.getAttribute("data-tab");
        document.querySelectorAll(".sp-tab").forEach(function (t) { t.classList.remove("active"); });
        document.querySelectorAll(".sp-panel").forEach(function (p) { p.classList.remove("active"); });
        this.classList.add("active");
        var panel = document.getElementById("panel-" + target);
        if (panel) panel.classList.add("active");
      });
    }
  }

  /* ── Follow button ── */
  function wireFollow(seller) {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("#sp-follow-btn");
      if (!btn) return;

      var session = null;
      try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch (err) {}
      if (!session || !session.user_id) {
        window.location.href = "login.html";
        return;
      }

      var nowFollowing = toggleFollow(sellerId);
      btn.textContent = nowFollowing ? "Following" : "Follow";
      btn.classList.toggle("following", nowFollowing);

      var base = parseInt(btn.getAttribute("data-base-followers") || "0", 10);
      var newCount = formatNum(nowFollowing ? base + 1 : base);
      var countEl = document.getElementById("sp-follow-count");
      if (countEl) countEl.textContent = newCount;
      /* also sync the story tab stat */
      var storyCountEl = document.getElementById("sp-story-follow-count");
      if (storyCountEl) storyCountEl.textContent = newCount;

      showToast(nowFollowing
        ? "You're now following " + (seller.shop_name || "this shop")
        : "Unfollowed " + (seller.shop_name || "this shop"));
    });
  }

  /* ── Chat button ── */
  function wireChat() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("#sp-chat-btn");
      if (!btn) return;

      var session = null;
      try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch (err) {}
      if (!session || !session.user_id) {
        window.location.href = "login.html";
        return;
      }

      window.location.href = "account.html?view=chat&seller=" + sellerId;
    });
  }

})();
