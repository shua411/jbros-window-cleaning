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

  /* ---- Reviews ticker: duplicate the group for a seamless loop ---- */
  var rvTrack = document.getElementById("rvbarTrack");
  if (rvTrack) {
    var rvGroup = rvTrack.querySelector(".rvbar__group");
    if (rvGroup) rvTrack.appendChild(rvGroup.cloneNode(true));
  }

  /* ---- Logo: reveal it once the file loads. Read the path off the <img>
     itself so this works from subfolders (e.g. /services/*.html) too. ---- */
  var logoImg = document.querySelector(".brand__logo");
  if (logoImg) {
    var logoTest = new Image();
    logoTest.onload = function () {
      document.querySelectorAll(".brand").forEach(function (b) {
        b.classList.add("haslogo");
      });
    };
    logoTest.src = logoImg.getAttribute("src");
  }

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

  /* ---- Image loading for [data-img] spots ----
     The HTML already sets each element's real background-image directly,
     so the browser can request and cache it normally (no re-fetching, no
     cache-busting). This just watches for a photo going missing later
     (e.g. a file gets deleted) and swaps in a graceful gradient + label
     instead of a broken image. */
  document.querySelectorAll("[data-img]").forEach(function (el) {
    var m = el.style.backgroundImage && el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
    var src = m ? m[1] : el.getAttribute("data-img");
    if (!src) return;

    var test = new Image();
    test.onload = function () {
      el.style.backgroundImage = "url('" + src + "')";
    };
    test.onerror = function () {
      el.classList.add("noimg");
      el.style.backgroundImage = "";
      if (!el.getAttribute("data-label")) {
        var h3 = el.parentElement && el.parentElement.querySelector("h3");
        el.setAttribute("data-label", h3 ? h3.textContent : "Photo");
      }
    };
    test.src = src;
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
          sub = num(svc, "gutterStories") * size + num(svc, "gutterLast") + num(svc, "roofClean");
        }

        if (kind === "sealcoat") {
          sub = (num(svc, "sealSurface") + num(svc, "sealSize")) * size +
                num(svc, "sealFinish") + num(svc, "sealPrep");
        }

        if (kind === "holiday") {
          sub = num(svc, "holidayLength") * size +
                num(svc, "holidayLights") +
                num(svc, "holidayExtras") +
                num(svc, "holidayTakedown");
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

    /* callbackOnly = customer skipped the details and just wants a phone call */
    function collectRequest(callbackOnly) {
      var f = function (n) { return form.querySelector('[name="' + n + '"]').value.trim(); };
      var sel = function (id) {
        var s = document.getElementById(id);
        return s.options[s.selectedIndex].textContent;
      };
      var lines = [
        callbackOnly
          ? "*** CALLBACK REQUEST — customer would rather talk on the phone ***"
          : "New quote request from the website",
        "",
        "Name: " + f("name"),
        "Phone: " + f("phone"),
        "Email: " + f("email"),
        "Address: " + f("address") + ", " + form.querySelector('[name="city"]').value,
        "Home: " + sel("size") + " · " + sel("stories"),
        ""
      ];
      if (callbackOnly) {
        lines.push("They did not fill out the service details — give them a call.");
        return lines.join("\n");
      }
      lines.push("Services requested:");
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

    /* shared sender for both the full quote request and the callback request */
    function sendLead(btn, opts) {
      if (!validate()) return;
      var name = form.querySelector('[name="name"]').value.trim();
      var body = collectRequest(opts.callbackOnly);

      if (!LEAD_EMAIL) {
        window.location.href =
          "mailto:jbroswc@gmail.com" +
          "?subject=" + encodeURIComponent(opts.subject + name) +
          "&body=" + encodeURIComponent(body);
        btn.textContent = "✓ Opening your email, just hit send";
        return;
      }

      btn.disabled = true;
      btn.textContent = "Sending…";
      fetch("https://formsubmit.co/ajax/" + encodeURIComponent(LEAD_EMAIL), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          _subject: opts.subject + name,
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
            btn.textContent = opts.done;
            if (window.fbq) fbq("track", "Lead"); // Meta Pixel conversion
          } else {
            btn.disabled = false;
            btn.textContent = "Didn't send — tap to retry";
          }
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = "Didn't send — tap to retry";
        });
    }

    var reqBtn = document.getElementById("requestQuote");
    if (reqBtn) {
      reqBtn.addEventListener("click", function () {
        sendLead(reqBtn, { subject: "New quote request: ", done: "✓ Request Sent" });
      });
    }

    var callBtn = document.getElementById("callMeBtn");
    if (callBtn) {
      callBtn.addEventListener("click", function () {
        sendLead(callBtn, {
          callbackOnly: true,
          subject: "CALLBACK REQUEST: ",
          done: "✓ Got it — we'll call you shortly"
        });
      });
    }
  }

  /* ---- Arriving from a service page: index.html?service=windows&scope=ext#quote
     preselects that service in the form and highlights it ---- */
  (function preselectFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var kind = params.get("service");
    if (!kind) return;

    var svc = document.querySelector('.svc[data-svc="' + kind + '"]');
    if (!svc) return;

    // start clean so the arriving service is the only one ticked
    document.querySelectorAll(".svc").forEach(function (s) {
      s.querySelector(".svc__check").checked = false;
      s.classList.remove("on");
    });

    svc.querySelector(".svc__check").checked = true;
    svc.classList.add("on");

    var scope = params.get("scope");
    if (scope) {
      var scopeSel = svc.querySelector('[data-opt="scope"]');
      if (scopeSel) { scopeSel.value = scope; scopeSel.dataset.touched = "1"; }
    }

    setTimeout(function () {
      document.getElementById("quote").scrollIntoView({ behavior: "smooth", block: "start" });
      svc.classList.add("flash");
      setTimeout(function () { svc.classList.remove("flash"); }, 1800);
    }, 300);
  })();

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

  /* =========================================================
     Careers page — "why join" cards advance sideways while the
     page scrolls down. The section is tall, the slider is pinned
     inside it, and scroll progress drives the horizontal offset.
     ========================================================= */
  var crWhy = document.getElementById("crWhy");
  var crTrack = document.getElementById("crTrack");
  if (crWhy && crTrack) {
    var crSlideEls = Array.prototype.slice.call(crTrack.querySelectorAll(".crslide"));
    var crDots = document.getElementById("crDots");
    var crViewport = crTrack.parentElement;
    var lastIdx = -1;

    // one dot per card; clicking scrolls the page to that card's position
    crSlideEls.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", "Card " + (i + 1));
      dot.addEventListener("click", function () {
        var span = crWhy.offsetHeight - crSticky.offsetHeight;
        var p = crSlideEls.length > 1 ? i / (crSlideEls.length - 1) : 0;
        window.scrollTo({ top: crWhy.offsetTop - stickyTop() + span * p, behavior: "smooth" });
      });
      crDots.appendChild(dot);
    });
    var crDotEls = Array.prototype.slice.call(crDots.children);

    var crSticky = crWhy.querySelector(".crwhy__sticky");
    function stickyTop() {
      // the CSS `top` offset the sticky block pins at
      return parseFloat(getComputedStyle(crSticky).top) || 0;
    }

    var ticking = false;
    function updateSlider() {
      ticking = false;
      var span = crWhy.offsetHeight - crSticky.offsetHeight;
      if (span <= 0) return;

      // 0 when the slider pins, 1 when it releases at the section's end
      var p = (window.scrollY - (crWhy.offsetTop - stickyTop())) / span;
      p = Math.min(Math.max(p, 0), 1);

      var maxX = crTrack.scrollWidth - crViewport.clientWidth;
      crTrack.style.transform = "translateX(" + (-p * maxX) + "px)";

      var idx = Math.round(p * (crSlideEls.length - 1));
      if (idx !== lastIdx) {
        lastIdx = idx;
        crSlideEls.forEach(function (el, n) { el.classList.toggle("active", n === idx); });
        crDotEls.forEach(function (d, n) { d.classList.toggle("on", n === idx); });
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(updateSlider); }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateSlider);
    updateSlider();
  }

  /* =========================================================
     Careers page — applicant form (same FormSubmit inbox)
     ========================================================= */
  var crForm = document.getElementById("careersForm");
  if (crForm) {
    var CR_EMAIL = "jbroswc@gmail.com";
    var crBtn = document.getElementById("crSubmit");

    crForm.querySelectorAll("input").forEach(function (i) {
      i.addEventListener("input", function () { i.classList.remove("invalid"); });
    });

    function crValidate() {
      var ok = true, first = null;
      ["name", "phone", "email"].forEach(function (n) {
        var input = crForm.querySelector('[name="' + n + '"]');
        var bad = !input.value.trim() ||
          (n === "email" && !/^\S+@\S+\.\S+$/.test(input.value.trim()));
        input.classList.toggle("invalid", bad);
        if (bad && !first) first = input;
        if (bad) ok = false;
      });
      if (first) first.focus();
      return ok;
    }

    function crVal(n) {
      var el = crForm.querySelector('[name="' + n + '"]:checked') ||
               crForm.querySelector('[name="' + n + '"]');
      return el ? el.value.trim() : "";
    }

    crForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!crValidate()) return;

      var name = crVal("name");
      var body = [
        "*** SALES REP APPLICANT ***",
        "",
        "Name: " + name,
        "Phone: " + crVal("phone"),
        "Email: " + crVal("email"),
        "",
        "Sales experience: " + crVal("experience"),
        "Availability: " + crVal("availability"),
        "",
        "Their note: " + (crVal("note") || "(none)")
      ].join("\n");

      crBtn.disabled = true;
      crBtn.textContent = "Sending…";

      fetch("https://formsubmit.co/ajax/" + encodeURIComponent(CR_EMAIL), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          _subject: "JOB APPLICANT: " + name,
          _template: "table",
          _captcha: "false",
          name: name,
          phone: crVal("phone"),
          email: crVal("email"),
          message: body
        })
      }).then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && String(data.success) === "true") {
            crForm.parentElement.innerHTML =
              '<div class="crsent">' +
              '<div class="crsent__tick">✓</div>' +
              "<h2>Got it, " + name.split(" ")[0] + ".</h2>" +
              "<p>We'll reach out within a day or two with the pay structure, " +
              "the schedule and what the first week looks like. Keep an eye on your phone.</p>" +
              "</div>";
          } else {
            crBtn.disabled = false;
            crBtn.textContent = "Didn't send — tap to retry";
          }
        })
        .catch(function () {
          crBtn.disabled = false;
          crBtn.textContent = "Didn't send — tap to retry";
        });
    });
  }
})();
