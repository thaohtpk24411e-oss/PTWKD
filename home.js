(function () {
  var DATA = "/assets/json/";
  function getJSON(name) { return fetch(DATA + name).then(function (r) { return r.json(); }); }

  Promise.all([
    getJSON("products.json"), getJSON("product_photos.json")
  ])
    .then(function (res) {
      var products = res[0].filter(function (p) { return p.approval_status === "Active"; });
      products.sort(function (a, b) { return (b.created_at || "").localeCompare(a.created_at || ""); });
      var photos = res[1];
      
      var photosByProduct = {};
      for (var i = 0; i < photos.length; i++) {
        var pid = photos[i].product_id;
        if (!photosByProduct[pid]) photosByProduct[pid] = [];
        photosByProduct[pid].push(photos[i]);
      }

      var grid = document.querySelector(".product-grid");
      if (!grid) return;

      var html = "";
      var items = products.slice(0, 4);
      for (var j = 0; j < items.length; j++) {
        var p = items[j];
        var photosForProduct = photosByProduct[p.product_id] || [];
        var photoUrl = photosForProduct.length ? photosForProduct[0].photo_url : "";
        var styleStr = "";
        if (photoUrl) {
          styleStr = 'style="background-image: url(' + photoUrl + ');"';
        } else {
          var hue = (p.product_id * 37) % 360;
          styleStr = 'style="background: linear-gradient(160deg, hsla(' + hue + ', 20%, 85%, 1), hsla(' + hue + ', 20%, 70%, 1));"';
        }

        html += '<article class="product-card">';
        html += '<a class="product-media" href="/html/product_detail.html?id=' + p.product_id + '" ' + styleStr + '></a>';
        html += '<h3 class="product-name"><a href="/html/product_detail.html?id=' + p.product_id + '" style="color:inherit;text-decoration:none;">' + p.title + '</a></h3>';
        html += '<p class="price">$' + p.price.toFixed(2) + '</p>';
        html += '</article>';
      }

      if (!html) {
        html = '<p class="empty">No new arrivals available right now.</p>';
      }

      grid.innerHTML = html;
    })
    .catch(function (err) {
      console.error("Could not load home arrivals", err);
    });
})();
