/* ============================================================
   product-detail.js — single product page.
   Reads ?id=N from the URL and renders one product from the real
   data set, joining seller, tags, reviews, photos, and related products.
   Slide style: fetch JSON -> loop -> build HTML string -> innerHTML.
   ============================================================ */

(function () {
  var DATA = "../assets/json/";
  function getJSON(name) { return fetch(DATA + name).then(function (r) { return r.json(); }); }
  function normalizeImagePath(url) { return url && url.indexOf("/assets/") === 0 ? "../assets/" + url.slice(8) : url || ""; }

  function currentId() {
    var m = location.search.match(/[?&]id=(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }
  function money(n) { return "$" + Number(n).toFixed(2); }
  function stars(n) { var s = ""; for (var i = 1; i <= 5; i++) s += (i <= n ? "★" : "☆"); return s; }
  function gradFor(id) { return "grad-" + (id % 6); }

  Promise.all([
    getJSON("products.json"), getJSON("sellers.json"), getJSON("tags.json"),
    getJSON("product_tags.json"), getJSON("order_items.json"), getJSON("reviews_feedback.json"),
    getJSON("product_photos.json")
  ]).then(function (res) {
    var products = res[0], sellers = res[1], tags = res[2], productTags = res[3],
      orderItems = res[4], reviews = res[5], photosData = res[6];

    var id = currentId();
    var product = null;
    for (var i = 0; i < products.length; i++) if (products[i].product_id === id) product = products[i];
    if (!product) product = products[0];

    var seller = null;
    for (var s = 0; s < sellers.length; s++) if (sellers[s].seller_id === product.seller_id) seller = sellers[s];

    var tagIds = [];
    for (var t = 0; t < productTags.length; t++) if (productTags[t].product_id === product.product_id) tagIds.push(productTags[t].tag_id);
    var tagObjs = tags.filter(function (tg) { return tagIds.indexOf(tg.tag_id) !== -1; });

    // reviews: review.order_item_id -> order_item.product_id
    var oiProduct = {};
    for (var o = 0; o < orderItems.length; o++) oiProduct[orderItems[o].order_item_id] = orderItems[o].product_id;
    var productReviews = reviews.filter(function (rv) { return oiProduct[rv.order_item_id] === product.product_id; });

    var related = products.filter(function (p) {
      return p.category_id === product.category_id && p.product_id !== product.product_id && p.approval_status === "Active";
    }).slice(0, 4);

    // Photos for current product
    var productPhotos = photosData.filter(function (photo) {
      return photo.product_id === product.product_id;
    }).sort(function (a, b) { return a.display_order - b.display_order; });

    // Ensure we have at least one placeholder if no photos found
    if (!productPhotos.length) {
      productPhotos = [{ photo_url: "" }];
    }

    document.title = "ReViet — " + product.title;
    renderGallery(product, productPhotos);
    renderInfo(product, tagObjs);
    renderSustain(tagObjs);
    renderSeller(seller);
    renderReviews(productReviews);
    renderRelated(related, photosData);
  }).catch(function (err) {
    var info = document.getElementById("pd-info");
    if (info) info.innerHTML = '<p>Could not load product. Make sure the site is served over http (see README).</p>';
    console.error(err);
  });

  function renderGallery(p, photos) {
    var stage = document.getElementById("pd-stage");
    var thumbsContainer = document.getElementById("pd-thumbs");

    var mainPhotoUrl = normalizeImagePath(photos[0].photo_url);
    if (mainPhotoUrl) {
      stage.style.backgroundImage = 'url(' + mainPhotoUrl + ')';
      stage.className = "pd-stage";
    } else {
      stage.className = "pd-stage " + gradFor(p.product_id);
    }

    var thumbs = "";
    var numThumbs = Math.max(photos.length, 3);
    for (var i = 0; i < Math.min(3, numThumbs); i++) {
      var photoUrl = normalizeImagePath(photos[i] ? photos[i].photo_url : "");
      var styleStr = photoUrl ? 'style="background-image: url(' + photoUrl + ')"' : "";
      var classes = photoUrl ? "" : " " + gradFor((p.product_id + i) % 6);
      var isActive = (i === 0) ? " active" : "";
      thumbs += '<button class="pd-thumb' + classes + isActive + '" ' + styleStr + ' aria-label="View image ' + (i + 1) + '" data-img="' + photoUrl + '"></button>';
    }
    thumbsContainer.innerHTML = thumbs;

    // Attach click handlers to swap images
    var thumbBtns = thumbsContainer.querySelectorAll(".pd-thumb");
    thumbBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        thumbBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var imgUrl = btn.getAttribute("data-img");
        if (imgUrl) {
          stage.style.backgroundImage = 'url(' + imgUrl + ')';
          stage.className = "pd-stage";
        }
      });
    });
  }

  function renderInfo(p, tagObjs) {
    var eyebrow = p.is_preorder ? "Limited Edition" : (tagObjs[0] ? tagObjs[0].tag_name : "Handcrafted");
    var stock = p.stock_quantity > 0
      ? '<span class="pd-stock in"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:text-bottom;margin-right:4px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> In Stock &amp; Ready to Ship</span>'
      : (p.is_preorder ? '<span class="pd-stock pre">● Available for Pre-order</span>'
        : '<span class="pd-stock out">● Out of Stock</span>');

    var html =
      '<p class="eyebrow">' + eyebrow + '</p>' +
      '<h1 class="pd-title">' + p.title + '</h1>' +
      '<p class="pd-sub">“Handcrafted using ' + p.materials.toLowerCase() + '”</p>' +
      '<div class="pd-price-row"><span class="pd-price">' + money(p.price) + '</span>' + stock + '</div>' +
      '<div class="pd-actions">' +
      '<div class="pd-buy-row">' +
      '<button class="btn btn-primary pd-add" type="button">Add to Cart</button>' +
      '<button class="pd-wish-btn" type="button" aria-label="Add to wishlist"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>' +
      '</div>' +
      '<button class="btn btn-outline pd-buynow" type="button">Buy Now</button>' +
      '</div>' +
      '<div class="pd-details-group">' +
      '<p class="pd-label">Product Story</p>' +
      '<p class="pd-story">' + p.description + '</p>' +
      '<div class="pd-meta">' +
      '<div><span class="pd-meta-label">Dimensions</span><span class="pd-meta-val">32cm H x 24cm W</span></div>' +
      '<div><span class="pd-meta-label">Weight</span><span class="pd-meta-val">0.6 kg</span></div>' +
      '</div>' +
      '</div>';

    var info = document.getElementById("pd-info");
    info.innerHTML = html;

    function addCurrentProductToCart(options) {
      var session = null;
      try { session = JSON.parse(sessionStorage.getItem("rv_session") || "null"); } catch (e) { session = null; }
      if (!session || !session.user_id) {
        window.location.href = "login.html";
        return;
      }

      var cart = [];
      try { cart = JSON.parse(localStorage.getItem("rv_cart") || "[]"); } catch (e) {}
      var found = false;
      for (var ci = 0; ci < cart.length; ci++) {
        if (cart[ci].product_id === p.product_id) { cart[ci].quantity++; found = true; break; }
      }
      if (!found) cart.push({ product_id: p.product_id, quantity: 1, added_at: Date.now() });
      localStorage.setItem("rv_cart", JSON.stringify(cart));
      window.dispatchEvent(new Event("rv:cart-updated"));

      if (options && options.redirectToCart) {
        window.location.href = "cart.html";
        return;
      }

      var button = options && options.button ? options.button : null;
      if (button) {
        button.textContent = "Added to Cart ✓";
        button.disabled = true;
        setTimeout(function () { button.textContent = "Add to Cart"; button.disabled = false; }, 1800);
      }
    }

    var add = info.querySelector(".pd-add");
    add.addEventListener("click", function () {
      addCurrentProductToCart({ button: add });
    });

    var buyNow = info.querySelector(".pd-buynow");
    if (buyNow) {
      buyNow.addEventListener("click", function () {
        addCurrentProductToCart({ redirectToCart: true });
      });
    }

    /* Wishlist / Favourites button */
    var wishBtn = info.querySelector(".pd-wish-btn");
    if (wishBtn) {
      function getFavs() {
        try { return JSON.parse(localStorage.getItem("rv_favourites") || "[]"); } catch (e) { return []; }
      }
      function isFav() {
        var favs = getFavs();
        for (var fi = 0; fi < favs.length; fi++) { if (favs[fi].product_id === p.product_id) return true; }
        return false;
      }
      function updateWish() {
        var fav = isFav();
        var svg = wishBtn.querySelector("svg");
        if (svg) svg.setAttribute("fill", fav ? "currentColor" : "none");
        wishBtn.setAttribute("aria-label", fav ? "Remove from favourites" : "Add to favourites");
        wishBtn.style.color = fav ? "var(--sage)" : "";
      }
      updateWish();
      wishBtn.addEventListener("click", function () {
        var favs = getFavs();
        if (isFav()) {
          var next = [];
          for (var i = 0; i < favs.length; i++) { if (favs[i].product_id !== p.product_id) next.push(favs[i]); }
          localStorage.setItem("rv_favourites", JSON.stringify(next));
        } else {
          favs.push({ product_id: p.product_id, added_at: Date.now() });
          localStorage.setItem("rv_favourites", JSON.stringify(favs));
        }
        updateWish();
      });
    }
  }

  function renderSustain(tagObjs) {
    var items = tagObjs.length
      ? tagObjs
      : [{ tag_name: "Responsibly Sourced" }, { tag_name: "Zero Waste Process" }, { tag_name: "Biodegradable Packaging" }];

    var icons = [
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/></svg>', // Home/Sourced
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', // Waste/Economics
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 21C4 14 8 5 20 4c0 11-6 16-12 16-2 0-3-1-3-1z"/><path d="M5 21c2-5 6-8 10-9"/></svg>' // Leaf/Biodegradable
    ];

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var icon = icons[i % icons.length];
      html += '<li><span class="pd-sustain-ico">' + icon + "</span>" + items[i].tag_name + "</li>";
    }
    document.getElementById("pd-sustain-list").innerHTML = html;
  }

  function renderSeller(seller) {
    var host = document.getElementById("pd-seller");
    if (!seller) { host.innerHTML = ""; return; }
    var name = seller.shop_name || "ReViet Artisan";
    var initials = name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean)
      .slice(0, 2).map(function (w) { return w.charAt(0); }).join("").toUpperCase();
    var story = seller.craft_story || seller.shop_bio || "";
    var banner = seller.shop_banner;

    var avatarHtml = banner ?
      '<div class="pd-seller-avatar" style="background-image: url(' + banner + '); background-size: cover; background-position: center;"></div>' :
      '<div class="pd-seller-avatar">' + initials + "</div>";

    host.innerHTML =
      avatarHtml +
      '<div class="pd-seller-body">' +
      '<p class="pd-label">Shop</p>' +
      '<h3 class="pd-seller-name">' + name + "</h3>" +
      '<p class="pd-seller-story">' + story + "</p>" +
      '<a class="link-underline" href="#">Read the Full Story</a>' +
      "</div>";
  }

  function renderReviews(reviews) {
    var grid = document.getElementById("pd-reviews");
    var allLink = document.getElementById("pd-reviews-all");
    allLink.textContent = "View All " + reviews.length + " Reviews";
    if (!reviews.length) {
      grid.innerHTML = '<p class="pd-no-reviews">No reflections yet — be the first to share your story.</p>';
      allLink.style.display = "none";
      return;
    }
    var top = reviews.slice(0, 3);
    var html = "";
    for (var i = 0; i < top.length; i++) {
      // Mock some names based on index for variety
      var name = ["Eleanor R., London", "Hiroshi K., Tokyo", "Sarah M., New York"][i % 3];
      html += '<article class="pd-review">' +
        '<div class="pd-review-stars">' + stars(top[i].rating) + "</div>" +
        '<p class="pd-review-text">“' + (top[i].review_text || "") + '”</p>' +
        '<p class="pd-review-by">— ' + name + '</p>' +
        "</article>";
    }
    grid.innerHTML = html;
  }

  function renderRelated(related, photosData) {
    var html = "";
    for (var i = 0; i < related.length; i++) {
      var p = related[i];
      var pPhotos = photosData.filter(function (photo) { return photo.product_id === p.product_id; }).sort(function (a, b) { return a.display_order - b.display_order; });
      var photoUrl = normalizeImagePath(pPhotos.length ? pPhotos[0].photo_url : "");

      var styleStr = photoUrl ? 'style="background-image: url(' + photoUrl + ')"' : "";
      var classes = photoUrl ? "pd-rel-thumb" : "pd-rel-thumb " + gradFor(p.product_id);

      html += '<a class="pd-rel-card" href="product_detail.html?id=' + p.product_id + '">' +
        '<span class="' + classes + '" ' + styleStr + '></span>' +
        '<span class="pd-rel-name">' + p.title + "</span>" +
        '<span class="pd-rel-price">' + money(p.price) + "</span>" +
        "</a>";
    }
    document.getElementById("pd-related").innerHTML = html || '<p class="empty">No related items yet.</p>';
  }
})();
