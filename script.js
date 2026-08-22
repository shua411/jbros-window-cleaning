/* =========================================================
   JBros Window Cleaning — interactions
   ========================================================= */
(function () {
  "use strict";

  /* ---- Year ---- */
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  /* ---- Seamless infinite city marquee ----
     Clone the group until there are 8 identical copies; the CSS
     animation shifts -50% (4 copies), so the loop never shows a gap
     on any screen width. */
  var track = document.querySelector(".citybar__track");
  if (track) {
    var group = track.querySelector(".citybar__group");
    if (group) {
      for (var g = 0; g < 7; g++) track.appendChild(group.cloneNode(true));
    }
  }

  /* ---- Logo: show images/logo.png everywhere once the file exists ---- */
  var logoTest = new Image();
  logoTest.onload = function () {
    document.querySelectorAll(".brand").forEach(function (b) {
      b.classList.add("haslogo");
    });
  };
  logoTest.src = "images/logo.png";

  /* ---- Nav: elevate on scroll + mobile menu ---- */
  var nav = document.getElementById("nav");
  window.addEventListener("scroll", function () {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 20);
  }, { passive: true });

  var burger = document.getElementById("burger");
  var navLinks = document.getElementById("navLinks");
  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      burger.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        navLinks.classList.remove("open");
        burger.classList.remove("open");
      });
    });
  }

  /* ---- Scroll reveal with a soft stagger between siblings ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    reveals.forEach(function (el) {
      var sibs = Array.prototype.filter.call(
        el.parentElement.children,
        function (c) { return c.classList.contains("reveal"); }
      );
      var i = sibs.indexOf(el);
      if (i > 0) el.style.transitionDelay = (i % 6) * 80 + "ms";
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
            setTimeout(function () { e.target.style.transitionDelay = ""; }, 1300);
          }
        });
      },
      { threshold: 0.12 }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Image loading for [data-img] spots ---- */
  document.querySelectorAll("[data-img]").forEach(function (el) {
    var local = el.getAttribute("data-img");
    var inline = el.style.backgroundImage;
    var m = inline && inline.match(/url\(["']?(.*?)["']?\)/);
    var stockUrl = m ? m[1] : null;

    // Always prefer YOUR local image (images/xxx.jpg). If it exists, use it.
    // If not, fall back to the stock URL, and if that fails too, show the gradient placeholder.
    var tryLocal = new Image();
    tryLocal.onload = function () {
      el.style.backgroundImage = "url('" + local + "')";
      el.classList.remove("noimg");
    };
    tryLocal.onerror = function () {
      if (stockUrl) {
        var tryStock = new Image();
        tryStock.onerror = showPlaceholder;
        tryStock.src = stockUrl; // stock stays as the inline background if it loads
      } else {
        showPlaceholder();
      }
    };
    tryLocal.src = local + "?v=" + Date.now(); // cache-bust so newly added photos show on refresh

    function showPlaceholder() {
      el.classList.add("noimg");
      el.style.backgroundImage = "";
      if (!el.getAttribute("data-label")) {
        var h3 = el.parentElement && el.parentElement.querySelector("h3");
        el.setAttribute("data-label", h3 ? h3.textContent : "Photo");
      }
    }
  });

  /* ---- FAQ accordion ---- */
  document.querySelectorAll(".faq__item").forEach(function (item) {
    item.querySelector(".faq__q").addEventListener("click", function () {
      var wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq__item.open").forEach(function (o) {
        o.classList.remove("open");
      });
      if (!wasOpen) item.classList.add("open");
    });
  });

  /* ---- Testimonials: hide the "scroll for more" hint once they scroll ---- */
  var tstscroll = document.getElementById("tstscroll");
  var tsthint = document.getElementById("tsthint");
  if (tstscroll && tsthint) {
    tstscroll.addEventListener("scroll", function () {
      // works for both the vertical panel (desktop) and swipe rail (mobile)
      var atEnd =
        tstscroll.scrollTop + tstscroll.clientHeight >= tstscroll.scrollHeight - 8 &&
        tstscroll.scrollLeft + tstscroll.clientWidth >= tstscroll.scrollWidth - 8;
      tsthint.style.opacity = atEnd ? "0" : "1";
    }, { passive: true });

    /* light up the cards currently in view; they dim as they scroll out */
    if ("IntersectionObserver" in window) {
      var lit = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          e.target.classList.toggle("lit", e.intersectionRatio >= 0.6);
        });
      }, { root: tstscroll, threshold: [0, 0.6, 1] });
      tstscroll.querySelectorAll(".tst").forEach(function (c) { lit.observe(c); });
    } else {
      tstscroll.querySelectorAll(".tst").forEach(function (c) { c.classList.add("lit"); });
    }
  }

  /* =========================================================
     Instant quote — service accordions + detail-aware estimator
     ========================================================= */
  var form = document.getElementById("quoteForm");
  var svcs = [];
  if (form) {
    var estimateBox = document.getElementById("estimate");
    var estimateValue = document.getElementById("estimateValue");
    svcs = Array.prototype.slice.call(form.querySelectorAll(".svc"));

    /* -- accordion open/close on checkbox -- */
    svcs.forEach(function (svc) {
      var check = svc.querySelector(".svc__check");
      svc.classList.toggle("on", check.checked);
      check.addEventListener("change", function () {
        svc.classList.toggle("on", check.checked);
      });
    });

    /* -- mark detail fields the user actually set (narrows the range) -- */
    form.querySelectorAll(".svc__panel select, .svc__panel input").forEach(function (el) {
      el.addEventListener("change", function () { el.dataset.touched = "1"; });
    });

    function val(svc, name) {
      return svc.querySelector('[data-opt="' + name + '"]');
    }
    function num(svc, name) {
      var el = val(svc, name);
      return el ? parseFloat(el.value) || 0 : 0;
    }

    function calc() {
      var size = parseFloat(document.getElementById("size").value) || 1;
      var stories = parseFloat(document.getElementById("stories").value) || 1;

      var total = 0;
      var detailControls = 0, detailTouched = 0;
      var extraUncertainty = 0;
      var anyChecked = false;

      svcs.forEach(function (svc) {
        var check = svc.querySelector(".svc__check");
        if (!check.checked) return;
        anyChecked = true;

        svc.querySelectorAll(".svc__panel select, .svc__panel input").forEach(function (el) {
          detailControls++;
          if (el.dataset.touched) detailTouched++;
        });

        var kind = svc.getAttribute("data-svc");
        var sub = 0;

        if (kind === "windows") {
          var scope = val(svc, "scope").value;
          var scopeBase = scope === "both" ? 330 : scope === "int" ? 165 : 200;
          sub = scopeBase * size * stories;
          sub += num(svc, "skylights") + num(svc, "screens") + num(svc, "awning") + num(svc, "railings");
        }

        if (kind === "pressure") {
          var surfaces = svc.querySelectorAll("[data-surface]:checked");
          if (surfaces.length === 0) {
            sub = 200 * size;
            extraUncertainty += 0.06;
          } else {
            surfaces.forEach(function (s) { sub += parseFloat(s.getAttribute("data-surface")); });
            sub *= size;
            if (surfaces.length >= 3) sub *= 0.92;
          }
        }

        if (kind === "house") {
          sub = 380 * size * stories;
          sub += num(svc, "roof");
          if (val(svc, "siding").value === "unsure") extraUncertainty += 0.05;
        }

        if (kind === "gutters") {
          sub = num(svc, "gutterStories") * size + num(svc, "gutterLast");
        }

        if (kind === "solar") {
          sub = num(svc, "panels") + num(svc, "nano");
        }

        total += sub;
      });

      if (!anyChecked) return null;

      var checkedCount = svcs.filter(function (s) { return s.querySelector(".svc__check").checked; }).length;
      if (checkedCount >= 3) total *= 0.93;

      var completeness = detailControls ? detailTouched / detailControls : 0;
      var spread = 0.20 - 0.13 * completeness + extraUncertainty;

      return { low: total * (1 - spread), high: total * (1 + spread) };
    }

    function money(n) {
      return "$" + Math.round(n / 5) * 5;
    }

    function validate() {
      var ok = true, first = null;
      ["name", "phone", "email", "address"].forEach(function (n) {
        var input = form.querySelector('[name="' + n + '"]');
        var bad = !input.value.trim() ||
          (n === "email" && !/^\S+@\S+\.\S+$/.test(input.value.trim()));
        input.classList.toggle("invalid", bad);
        if (bad && !first) first = input;
        if (bad) ok = false;
      });
      if (first) first.focus();
      return ok;
    }
    form.querySelectorAll("input").forEach(function (i) {
      i.addEventListener("input", function () { i.classList.remove("invalid"); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var r = calc();
      if (!r) {
        estimateValue.textContent = "Select a service";
        estimateBox.hidden = false;
        return;
      }
      estimateBox.hidden = false;
      animateRange(estimateValue, r.low, r.high);
      estimateBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    form.addEventListener("change", function () {
      if (estimateBox.hidden) return;
      var r = calc();
      if (r) estimateValue.textContent = money(r.low) + " – " + money(r.high);
    });

    function animateRange(el, low, high) {
      var start = null, dur = 650;
      function frame(t) {
        if (!start) start = t;
        var p = Math.min((t - start) / dur, 1);
        var ease = 1 - Math.pow(1 - p, 3);
        el.textContent = money(low * ease) + " – " + money(high * ease);
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    /* -- photo upload feedback -- */
    var photoInput = document.getElementById("photoInput");
    var uploadText = document.getElementById("uploadText");
    var uploadBox = document.querySelector(".upload");
    if (photoInput) {
      photoInput.addEventListener("change", function () {
        var n = photoInput.files.length;
        uploadBox.classList.toggle("has", n > 0);
        uploadText.textContent = n
          ? "✓  " + n + " photo" + (n > 1 ? "s" : "") + " attached"
          : "📷  Add photos of your home to help us quote faster";
      });
    }

    /* =========================================================
       Request Final Quote  →  emails LEAD_EMAIL via FormSubmit
       ---------------------------------------------------------
       No account or key needed. The FIRST time a request is sent,
       FormSubmit emails LEAD_EMAIL a one-time "Activate" link —
       click it once and every request after that lands in the inbox.
       ========================================================= */
    var LEAD_EMAIL = "jbroswc@gmail.com";

    function collectRequest() {
      var f = function (n) { return form.querySelector('[name="' + n + '"]').value.trim(); };
      var sel = function (id) {
        var s = document.getElementById(id);
        return s.options[s.selectedIndex].textContent;
      };
      var lines = [
        "New quote request from the website",
        "",
        "Name: " + f("name"),
        "Phone: " + f("phone"),
        "Email: " + f("email"),
        "Address: " + f("address") + ", " + form.querySelector('[name="city"]').value,
        "Home: " + sel("size") + " · " + sel("stories"),
        "",
        "Services requested:"
      ];
      svcs.forEach(function (svc) {
        if (!svc.querySelector(".svc__check").checked) return;
        var name = svc.querySelector(".svc__name").textContent;
        var details = [];
        svc.querySelectorAll(".svc__panel select").forEach(function (s) {
          var label = s.closest(".opt").querySelector("label") ||
                      s.closest("div").querySelector("label");
          details.push((label ? label.textContent + " " : "") + s.options[s.selectedIndex].textContent);
        });
        svc.querySelectorAll("[data-surface]:checked").forEach(function (c) {
          details.push(c.parentElement.textContent.trim());
        });
        lines.push("• " + name + (details.length ? ": " + details.join("; ") : ""));
      });
      lines.push("", "Instant estimate shown: " + estimateValue.textContent);
      var photos = photoInput && photoInput.files.length;
      if (photos) lines.push("(Customer has " + photos + " photo(s) to share. Reply to request them.)");
      return lines.join("\n");
    }

    var reqBtn = document.getElementById("requestQuote");
    if (reqBtn) {
      reqBtn.addEventListener("click", function () {
        if (!validate()) return;
        var body = collectRequest();
        var name = form.querySelector('[name="name"]').value.trim();

        if (LEAD_EMAIL) {
          reqBtn.disabled = true;
          reqBtn.textContent = "Sending…";
          fetch("https://formsubmit.co/ajax/" + encodeURIComponent(LEAD_EMAIL), {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
              _subject: "New quote request: " + name,
              _template: "table",
              _captcha: "false",
              name: name,
              phone: form.querySelector('[name="phone"]').value.trim(),
              email: form.querySelector('[name="email"]').value.trim(),
              message: body
            })
          }).then(function (r) { return r.json(); })
            .then(function (data) {
              if (data && String(data.success) === "true") {
                reqBtn.textContent = "✓ Request Sent";
                if (window.fbq) fbq("track", "Lead"); // Meta Pixel conversion
              } else {
                reqBtn.disabled = false;
                reqBtn.textContent = "Didn't send — tap to retry";
              }
            })
            .catch(function () {
              reqBtn.disabled = false;
              reqBtn.textContent = "Didn't send — tap to retry";
            });
        } else {
          window.location.href =
            "mailto:jbroswc@gmail.com" +
            "?subject=" + encodeURIComponent("Quote request: " + name) +
            "&body=" + encodeURIComponent(body);
          reqBtn.textContent = "✓ Opening your email, just hit send";
        }
      });
    }
  }

  /* ---- Service cards → jump to the quote form pre-selected ---- */
  document.querySelectorAll(".card[data-quote]").forEach(function (card) {
    card.addEventListener("click", function () {
      var kind = card.getAttribute("data-quote");
      var svc = document.querySelector('.svc[data-svc="' + kind + '"]');
      if (!svc) return;

      var check = svc.querySelector(".svc__check");
      check.checked = true;
      svc.classList.add("on");

      var scope = card.getAttribute("data-scope");
      if (scope) {
        var scopeSel = svc.querySelector('[data-opt="scope"]');
        if (scopeSel) { scopeSel.value = scope; scopeSel.dataset.touched = "1"; }
      }

      document.getElementById("quote").scrollIntoView({ behavior: "smooth" });
      svc.classList.add("flash");
      setTimeout(function () { svc.classList.remove("flash"); }, 1800);
    });
  });

  /* =========================================================
     Before / After — "slide to see results" bars (+ drag on image)
     ========================================================= */
  document.querySelectorAll(".ba-block").forEach(function (block) {
    var ba = block.querySelector(".ba");
    var before = block.querySelector(".ba__before");
    var range = block.querySelector('input[type="range"]');
    if (!ba || !before || !range) return;

    var line = document.createElement("div");
    line.className = "ba__line";
    ba.appendChild(line);

    function apply(pct) {
      pct = Math.min(Math.max(pct, 0), 100);
      before.style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";
      line.style.left = pct + "%";
      range.value = pct;
    }
    apply(50);

    range.addEventListener("input", function () { apply(parseFloat(range.value)); });

    /* bonus: dragging directly on the image also works */
    var dragging = false;
    function fromEvent(e) {
      var rect = ba.getBoundingClientRect();
      var x = (e.touches ? e.touches[0] : e).clientX - rect.left;
      apply((x / rect.width) * 100);
    }
    ba.addEventListener("mousedown", function (e) { dragging = true; fromEvent(e); });
    ba.addEventListener("touchstart", function (e) { dragging = true; fromEvent(e); }, { passive: true });
    window.addEventListener("mousemove", function (e) { if (dragging) fromEvent(e); });
    window.addEventListener("touchmove", function (e) { if (dragging) fromEvent(e); }, { passive: true });
    window.addEventListener("mouseup", function () { dragging = false; });
    window.addEventListener("touchend", function () { dragging = false; });
  });
})();
