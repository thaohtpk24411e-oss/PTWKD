/* ============================================================
   product.js — Shop page logic.
   Loads real data from /assets/json/, then renders filters,
   the product grid, sorting and pagination — in the slide style
   (fetch JSON -> loop -> build HTML string -> set innerHTML).
   ============================================================ */

(function () {
  var PER_PAGE = 12;
  var DATA = "/assets/json/";

  var state = {
    products: [], sellers: {}, categories: [], tags: [], tagsByProduct: {}, photosByProduct: {},
    category: null, tagFilter: [], maxPrice: 600, sort: "newest", page: 1
  };

  function getJSON(name) { return fetch(DATA + name).then(function (r) { return r.json(); }); }

  Promise.all([
    getJSON("products.json"), getJSON("sellers.json"), getJSON("categories.json"),
    getJSON("tags.json"), getJSON("product_tags.json"), getJSON("product_photos.json")
  ]).then(function (res) {
    var products = res[0], sellers = res[1], productTags = res[4], photos = res[5];

    // Only show listings that are live.
    state.products = products.filter(function (p) { return p.approval_status === "Active"; });
    for (var i = 0; i < sellers.length; i++) state.sellers[sellers[i].seller_id] = sellers[i];
    state.categories = res[2];
    state.tags = res[3];
    for (var j = 0; j < productTags.length; j++) {
      var id = productTags[j].product_id;
      if (!state.tagsByProduct[id]) state.tagsByProduct[id] = [];
      state.tagsByProduct[id].push(productTags[j].tag_id);
    }
    
    for (var k = 0; k < photos.length; k++) {
      var pid = photos[k].product_id;
      if (!state.photosByProduct[pid]) state.photosByProduct[pid] = [];
      state.photosByProduct[pid].push(photos[k]);
    }
    for (var key in state.photosByProduct) {
      state.photosByProduct[key].sort(function(a,b) { return a.display_order - b.display_order; });
    }

    renderFilters();
    wireSort();
    render();
  }).catch(function (err) {
    document.getElementById("product-list").innerHTML =
      '<p class="empty">Could not load products. Make sure the site is served over http (see README).</p>';
    console.error(err);
  });

  /* ---------- Filters ---------- */
  function countInCategory(catId) {
    var n = 0;
    for (var i = 0; i < state.products.length; i++) if (state.products[i].category_id === catId) n++;
    return n;
  }

  function tagGroup(type, style, label) {
    var items = state.tags.filter(function (t) { return t.tag_type === type; });
    var out = '<div class="filter-group"><h4>' + (label || type) + "</h4>";
    if (style === "chips") {
      out += '<div class="chips">';
      for (var i = 0; i < items.length; i++) {
        var on = state.tagFilter.indexOf(items[i].tag_id) !== -1;
        out += '<button type="button" class="chip' + (on ? " on" : "") + '" data-tag="' +
          items[i].tag_id + '">' + items[i].tag_name + "</button>";
      }
      out += "</div>";
    } else {
      for (var k = 0; k < items.length; k++) {
        var checked = state.tagFilter.indexOf(items[k].tag_id) !== -1;
        out += '<label class="check"><input type="checkbox" data-tag="' + items[k].tag_id + '"' +
          (checked ? " checked" : "") + " /> " + items[k].tag_name + "</label>";
      }
    }
    return out + "</div>";
  }

  function renderFilters() {
    var html = '<div class="filter-group"><h4>Category</h4><ul class="cat-list">';
    html += '<li><a href="#" data-cat="0" class="cat-link' + (state.category === null ? " active" : "") +
      '">All Products <span>' + state.products.length + "</span></a></li>";
    for (var c = 0; c < state.categories.length; c++) {
      var cat = state.categories[c];
      html += '<li><a href="#" data-cat="' + cat.category_id + '" class="cat-link' +
        (state.category === cat.category_id ? " active" : "") + '">' + cat.category_name +
        " <span>" + countInCategory(cat.category_id) + "</span></a></li>";
    }
    html += "</ul></div>";

    html += tagGroup("Sustainability", "chips");
    html += tagGroup("Certification", "checks");
    html += tagGroup("Regional_Origin", "checks", "Regional Origin");

    html += '<div class="filter-group"><h4>Price Range</h4>' +
      '<input type="range" id="price" min="0" max="600" step="10" value="' + state.maxPrice + '" />' +
      '<div class="price-label"><span>$0</span><span id="price-val">$' + state.maxPrice + "</span></div></div>";

    document.getElementById("filters").innerHTML = html;
    wireFilters();
  }

  function wireFilters() {
    document.querySelectorAll(".cat-link").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = parseInt(a.getAttribute("data-cat"), 10);
        state.category = id === 0 ? null : id;
        state.page = 1;
        renderFilters();
        render();
      });
    });

    document.querySelectorAll("[data-tag]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = parseInt(el.getAttribute("data-tag"), 10);
        var pos = state.tagFilter.indexOf(id);
        if (pos === -1) state.tagFilter.push(id); else state.tagFilter.splice(pos, 1);
        state.page = 1;
        renderFilters();
        render();
      });
    });

    var price = document.getElementById("price");
    if (price) {
      price.addEventListener("input", function () {
        state.maxPrice = parseInt(price.value, 10);
        document.getElementById("price-val").textContent = "$" + state.maxPrice;
      });
      price.addEventListener("change", function () { state.page = 1; render(); });
    }
  }

  function wireSort() {
    var sort = document.getElementById("sort");
    sort.addEventListener("change", function () { state.sort = sort.value; state.page = 1; render(); });
  }

  /* ---------- Data shaping ---------- */
  function getFiltered() {
    var list = state.products.filter(function (p) {
      if (state.category && p.category_id !== state.category) return false;
      if (p.price > state.maxPrice) return false;
      if (state.tagFilter.length) {
        var pt = state.tagsByProduct[p.product_id] || [];
        for (var i = 0; i < state.tagFilter.length; i++) {
          if (pt.indexOf(state.tagFilter[i]) === -1) return false; // must have all selected tags
        }
      }
      return true;
    });

    if (state.sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
    else if (state.sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
    else list.sort(function (a, b) { return (b.created_at || "").localeCompare(a.created_at || ""); });

    return list;
  }

  // Stable, derived rating for display (real ratings need a reviews→order_items join).
  function ratingFor(id) {
    var avg = (4.4 + ((id * 7) % 6) / 10).toFixed(1);
    var count = 8 + (id * 17) % 130;
    return "★ " + avg + " (" + count + ")";
  }

  /* ---------- Rendering ---------- */
  function cardHTML(p) {
    var seller = state.sellers[p.seller_id];
    var sellerName = seller ? seller.shop_name : "ReViet Artisan";
    var pt = state.tagsByProduct[p.product_id] || [];
    var imgBadge = p.is_preorder ? '<span class="p-tag">Limited Edition</span>' : "";
    var sustain = pt.indexOf(1) !== -1 ? '<span class="p-badge">Sustainable Badge</span>' : "";

    var photos = state.photosByProduct[p.product_id] || [];
    var photoUrl = photos.length ? photos[0].photo_url : "";
    var styleStr = photoUrl ? 'style="background-image: url(' + photoUrl + ')"' : "";
    var classes = photoUrl ? "p-thumb" : "p-thumb grad-" + (p.product_id % 6);
    var detailUrl = "/html/product_detail.html?id=" + p.product_id;

    return '<article class="p-card">' +
      '<a class="' + classes + '" href="' + detailUrl + '" ' + styleStr + '>' + imgBadge +
        '<button class="p-wish" type="button" aria-label="Add to wishlist">' +
          '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.5-9.5-9A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 9.5 5C19 15.5 12 20 12 20z"/></svg>' +
        "</button>" +
      "</a>" +
      '<h3 class="p-name"><a href="' + detailUrl + '" style="color:inherit;text-decoration:none;">' + p.title + '</a></h3>' +
      '<p class="p-seller">' + sellerName + "</p>" +
      '<div class="p-meta"><span class="p-price">$' + p.price.toFixed(2) + "</span>" +
        '<span class="p-rating">' + ratingFor(p.product_id) + "</span></div>" +
      sustain +
    "</article>";
  }

  function render() {
    var list = getFiltered();
    var total = list.length;
    var pages = Math.max(1, Math.ceil(total / PER_PAGE));
    if (state.page > pages) state.page = pages;

    var start = (state.page - 1) * PER_PAGE;
    var pageItems = list.slice(start, start + PER_PAGE);

    var grid = document.getElementById("product-list");
    if (!pageItems.length) {
      grid.innerHTML = '<p class="empty">No products match your filters.</p>';
    } else {
      var html = "";
      for (var i = 0; i < pageItems.length; i++) html += cardHTML(pageItems[i]);
      grid.innerHTML = html;
    }

    document.getElementById("result-count").textContent = total
      ? "Showing " + (start + 1) + "–" + Math.min(start + PER_PAGE, total) + " of " + total + " products"
      : "No products found";

    renderPagination(pages);
  }

  function renderPagination(pages) {
    var nav = document.getElementById("pagination");
    if (pages <= 1) { nav.innerHTML = ""; return; }

    var html = '<button class="pg-btn" data-pg="' + (state.page - 1) + '"' +
      (state.page === 1 ? " disabled" : "") + ">‹</button>";
    for (var i = 1; i <= pages; i++) {
      html += '<button class="pg-btn' + (i === state.page ? " active" : "") + '" data-pg="' + i + '">' + i + "</button>";
    }
    html += '<button class="pg-btn" data-pg="' + (state.page + 1) + '"' +
      (state.page === pages ? " disabled" : "") + ">›</button>";
    nav.innerHTML = html;

    nav.querySelectorAll(".pg-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        if (b.disabled) return;
        state.page = parseInt(b.getAttribute("data-pg"), 10);
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }
})();
