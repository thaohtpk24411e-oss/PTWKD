/* ============================================================
   include.js — tiny component loader (no framework, no build step)

   Usage in a page:  <div data-include="/components/header/header"></div>
   It will:  load /components/header/header.css  (once, into <head>)
             fetch /components/header/header.html (inject into the div)
             load /components/header/header.js   (once, after the HTML)

   NOTE: uses fetch(), so the site must be served over http
   (e.g. `python -m http.server`), not opened with file://.
   ============================================================ */

(function () {
  function loadComponent(host) {
    var path = host.getAttribute("data-include"); // e.g. "/components/header/header"

    // 1) Component CSS — add once.
    if (!document.querySelector('link[data-cmp="' + path + '"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = path + ".css";
      link.setAttribute("data-cmp", path);
      document.head.appendChild(link);
    }

    // 2) Component HTML — fetch and inject.
    return fetch(path + ".html")
      .then(function (res) { return res.text(); })
      .then(function (html) {
        host.innerHTML = html;
        // 3) Component JS — add once, after the markup exists.
        if (!document.querySelector('script[data-cmp="' + path + '"]')) {
          var script = document.createElement("script");
          script.src = path + ".js";
          script.setAttribute("data-cmp", path);
          document.body.appendChild(script);
        }
      })
      .catch(function (err) { console.error("Include failed for " + path, err); });
  }

  function run() {
    var hosts = document.querySelectorAll("[data-include]");
    hosts.forEach(loadComponent);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
