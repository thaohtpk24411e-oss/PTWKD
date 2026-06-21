/* Footer behavior: newsletter signup (client-side only). */
(function () {
  var form = document.getElementById("news-form");
  var status = document.getElementById("news-status");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.checkValidity()) {
      status.textContent = "Please enter a valid email.";
      return;
    }
    status.textContent = "Thank you — you're on the list.";
    form.reset();
  });
})();
