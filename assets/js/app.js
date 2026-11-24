/* ============================================================
   SITA — site interactions (no build step, no dependencies)
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const DATA = window.SITA || {
    products: {}, whatsapp: "", email: "",
    currency: "دج", freeShippingFrom: 2500, shippingFee: 400,
  };
  const BASE_PATH = document.body.dataset.base || "";
  const CART_KEY = "sita_cart_v1";
  const ORDER_KEY = "sita_orders_v1";

  const money = (n) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " " + (DATA.currency || "دج");

  const icons = {
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    box:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
    shield:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
    leaf:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/></svg>',
  };

  /* ---------------- Storage ---------------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
  const getCart = () => read(CART_KEY, []);
  const setCart = (cart) => write(CART_KEY, cart);

  /* ---------------- Toast ---------------- */
  function toast(message) {
    let stack = $(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = icons.check + "<span></span>";
    $("span", el).textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ---------------- Event delegation ---------------- */
  document.addEventListener("click", (e) => {

    const waOrder = e.target.closest("[data-wa-order]");
    if (waOrder) {
      e.preventDefault();
      const id = waOrder.dataset.waOrder;
      const p = productOf(id);
      if (!p) return;
      let qty = 1;
      if (waOrder.hasAttribute("data-wa-qty")) {
        const input = $(".pdp-info input[type=number]");
        qty = input ? Math.max(1, Number(input.value || 1)) : 1;
      }
      const lines = [
        "طلب جديد من متجر SITA",
        "--------------------",
        "المنتج: " + p.name,
        "الكمية: " + qty,
        "السعر: " + money(p.price * qty),
        "--------------------",
        "الاسم:",
        "الهاتف:",
        "الولاية/المدينة:",
        "العنوان:",
      ];
      const wa = "https://wa.me/" + DATA.whatsapp + "?text=" + encodeURIComponent(lines.join("\n"));
      px("InitiateCheckout", { content_ids: [id], content_type: "product", num_items: qty, value: p.price * qty, currency: "DZD" });
      window.open(wa, "_blank", "noopener");
      return;
    }

    const menuOpen = e.target.closest("[data-menu-open]");
    if (menuOpen) {
      $(".mobile-drawer").classList.add("open");
      document.body.classList.add("menu-open");
      return;
    }

    const menuClose = e.target.closest("[data-menu-close]");
    if (menuClose) {
      $(".mobile-drawer").classList.remove("open");
      document.body.classList.remove("menu-open");
      return;
    }

    const copy = e.target.closest("[data-copy-order]");
    if (copy) {
      const id = copy.dataset.copyOrder;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(id).then(() => toast("نُسخ رقم الطلب"));
      } else {
        toast("رقم الطلب: " + id);
      }
      return;
    }
  });

  /* ---------------- PDP quantity + gallery ---------------- */
  $$("[data-stepper]").forEach((wrap) => {
    const input = $("input", wrap);
    $$("button", wrap).forEach((btn) => {
      btn.addEventListener("click", () => {
        let v = Number(input.value || 1) + Number(btn.dataset.step || 0);
        input.value = Math.max(1, Math.min(20, v));
      });
    });
  });

  $$(".gallery-thumb").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const main = $(".gallery-main");
      if (!main) return;
      const img = $("img", main);
      img.src = thumb.dataset.src || $("img", thumb).src;
      main.classList.remove("zoom-1", "zoom-2");
      if (thumb.dataset.zoom) main.classList.add(thumb.dataset.zoom);
      $$(".gallery-thumb").forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  const faqs = $$("details.faq");
  faqs.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (d.open) faqs.forEach((other) => other !== d && (other.open = false));
    });
  });

  /* ---------------- Shop filtering ---------------- */
  const shopCards = $$("[data-category]");
  let activeCategory = "all";
  let searchTerm = "";

  function applyFilters() {
    let shown = 0;
    shopCards.forEach((card) => {
      const matchCat = activeCategory === "all" || card.dataset.category === activeCategory;
      const matchText = !searchTerm || card.textContent.toLowerCase().includes(searchTerm);
      const visible = matchCat && matchText;
      card.classList.toggle("hidden", !visible);
      if (visible) shown++;
    });
    const counter = $("#resultCount");
    if (counter) counter.textContent = shown;
    const empty = $("#shopEmpty");
    if (empty) empty.style.display = shown ? "none" : "block";
  }

  $$(".chip[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".chip[data-filter]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeCategory = chip.dataset.filter;
      applyFilters();
    });
  });

  const searchInput = $("#productSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      applyFilters();
    });
  }

  const sortSelect = $("#sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      const grid = $("#shopGrid");
      if (!grid) return;
      const cards = Array.from(grid.children);
      cards.sort((a, b) => {
        const pa = productOf(a.dataset.id) || { price: 0, name: "" };
        const pb = productOf(b.dataset.id) || { price: 0, name: "" };
        if (sortSelect.value === "price-asc") return pa.price - pb.price;
        if (sortSelect.value === "price-desc") return pb.price - pa.price;
        return pa.name.localeCompare(pb.name, "ar");
      });
      cards.forEach((c) => grid.appendChild(c));
    });
  }

  /* ---------------- Forms ---------------- */
  const checkoutForm = $("#checkoutForm");
  if (checkoutForm) {
    checkoutForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = cartTotals();
      const err = $("#checkoutError");
      if (!t.count) {
        if (err) err.textContent = "سلتكِ فارغة. أضيفي منتجاً أولاً.";
        return;
      }
      const fd = new FormData(checkoutForm);
      const required = ["name", "phone", "city", "address"];
      for (const key of required) {
        if (!String(fd.get(key) || "").trim()) {
          if (err) err.textContent = "يرجى تعبئة جميع الحقول المطلوبة.";
          return;
        }
      }
      if (err) err.textContent = "";
      const d = new Date();
      const stamp =
        d.getFullYear().toString() +
        String(d.getMonth() + 1).padStart(2, "0") +
        String(d.getDate()).padStart(2, "0");
      const order = {
        id: "SITA-" + stamp + "-" + Math.floor(1000 + Math.random() * 9000),
        date: d.toLocaleDateString("ar-DZ", { dateStyle: "long" }),
        items: t.cart.map((line) => {
          const p = productOf(line.id);
          return { name: p.name, qty: line.qty, price: p.price };
        }),
        total: t.total,
        shipping: t.shipping,
        customer: {
          name: String(fd.get("name") || "").trim(),
          phone: String(fd.get("phone") || "").trim(),
          city: String(fd.get("city") || "").trim(),
          address: String(fd.get("address") || "").trim(),
          notes: String(fd.get("notes") || "").trim(),
        },
        payment: fd.get("payment") || "الدفع عند الاستلام",
        discreet: fd.get("discreet") === "on",
      };
      const orders = read(ORDER_KEY, []);
      orders.push(order);
      write(ORDER_KEY, orders);

      const lines = [
        "طلب جديد من متجر SITA",
        "رقم الطلب: " + order.id,
        "--------------------",
        "المنتجات:",
        ...order.items.map((it) => "- " + it.name + " × " + it.qty + " = " + money(it.price * it.qty)),
        "--------------------",
        "المجموع الفرعي: " + money(t.subtotal),
        "الشحن: " + (t.shipping === 0 ? "مجاني" : money(t.shipping)),
        "الإجمالي: " + money(order.total),
        "طريقة الدفع: " + order.payment,
        "تغليف سري: " + (order.discreet ? "نعم" : "لا"),
        "--------------------",
        "بيانات الزبونة:",
        "الاسم: " + order.customer.name,
        "الهاتف: " + order.customer.phone,
        "المدينة: " + order.customer.city,
        "العنوان: " + order.customer.address,
      ];
      if (order.customer.notes) lines.push("ملاحظات: " + order.customer.notes);
      const msg = lines.join("\n");
      const wa = "https://wa.me/" + DATA.whatsapp + "?text=" + encodeURIComponent(msg);

      px("Purchase", { content_ids: order.items.map((i) => i.name), content_type: "product", num_items: order.items.reduce((n,i)=>n+i.qty,0), value: order.total, currency: "DZD" });
      setCart([]);
      sessionStorage.setItem("sita_last_wa", wa);
      window.open(wa, "_blank", "noopener");
      location.href = BASE_PATH + "order-confirmation.html?order=" + encodeURIComponent(order.id);
    });
  }

  const trackForm = $("#trackForm");
  if (trackForm) {
    trackForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = ($("#trackId") || {}).value.trim();
      const order = read(ORDER_KEY, []).find((o) => o.id.toLowerCase() === id.toLowerCase());
      const box = $("#trackResult");
      if (!box) return;
      if (!order) {
        box.innerHTML =
          '<div class="warn-box">لم نعثر على هذا الرقم. تأكدي من رقم الطلب المرسل إليكِ في رسالة التأكيد.</div>';
        return;
      }
      box.innerHTML =
        '<div class="confirm-card" style="text-align:right">' +
        "<h3>طلبكِ " + order.id + "</h3>" +
        '<p class="muted">بتاريخ ' + order.date + " · الإجمالي " + money(order.total) + "</p>" +
        '<ul class="timeline">' +
        "<li><div class=\"timeline-dot\"></div><div><strong>تم استلام الطلب</strong><small>وصلنا طلبكِ بنجاح</small></div></li>" +
        "<li><div class=\"timeline-dot\" style=\"background:var(--gold)\"></div><div><strong>قيد التجهيز</strong><small>نجهّز طلبكِ بتغليف سري</small></div></li>" +
        "<li><div class=\"timeline-dot\" style=\"background:var(--cream-3);box-shadow:none\"></div><div><strong>في الطريق إليكِ</strong><small>يُحدَّث بعد خروج الطرد</small></div></li>" +
        "<li><div class=\"timeline-dot\" style=\"background:var(--cream-3);box-shadow:none\"></div><div><strong>تم التسليم</strong><small>نتمنى لكِ تجربة مريحة</small></div></li>" +
        "</ul></div>";
    });
  }

  const newsletter = $("#newsletterForm");
  if (newsletter) {
    newsletter.addEventListener("submit", (e) => {
      e.preventDefault();
      toast("شكراً لكِ! سنرسل لكِ نصائح العناية قريباً.");
      newsletter.reset();
    });
  }

  const contact = $("#contactForm");
  if (contact) {
    contact.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(contact);
      const name = String(fd.get("name") || "").trim();
      const phone = String(fd.get("phone") || "").trim();
      const email = String(fd.get("email") || "").trim();
      const message = String(fd.get("message") || "").trim();
      const lines = [
        "رسالة جديدة من موقع SITA",
        "الاسم: " + name,
        phone ? "الهاتف: " + phone : "",
        "البريد: " + email,
        "الرسالة: " + message,
      ].filter(Boolean);
      const wa = "https://wa.me/" + DATA.whatsapp + "?text=" + encodeURIComponent(lines.join("\n"));
      px("Contact", { content_name: "contact_form" });
      window.open(wa, "_blank", "noopener");
      toast("تم تجهيز رسالتكِ على واتساب.");
      contact.reset();
    });
  }

  /* ---------------- Confirmation page ---------------- */
  const params = new URLSearchParams(location.search);
  const orderId = params.get("order");
  if (orderId) {
    const order = read(ORDER_KEY, []).find((o) => o.id === orderId);
    const idEl = $("#orderIdText");
    if (idEl) {
      idEl.textContent = orderId;
      const btn = $("#copyOrderBtn");
      if (btn) btn.dataset.copyOrder = orderId;
    }
    if (order) {
      const details = $("#orderDetails");
      if (details) {
        details.innerHTML =
          "<p>شكراً لكِ " + order.customer.name + "، طلبكِ قيد التجهيز.</p>" +
          '<ul class="timeline">' +
          "<li><div class=\"timeline-dot\"></div><div><strong>تم استلام الطلب</strong><small>" + order.date + "</small></div></li>" +
          "<li><div class=\"timeline-dot\" style=\"background:var(--gold)\"></div><div><strong>قيد التجهيز</strong><small>تغليف سري باسم SITA فقط</small></div></li>" +
          "<li><div class=\"timeline-dot\" style=\"background:var(--cream-3);box-shadow:none\"></div><div><strong>في الطريق إليكِ</strong><small>سنرسل رسالة عند الشحن</small></div></li>" +
          "</ul>";
      }
      const items = $("#orderItems");
      if (items) {
        items.innerHTML = order.items
          .map(
            (i) =>
              '<div class="summary-row"><span>' +
              i.name +
              " × " +
              i.qty +
              "</span><strong>" +
              money(i.price * i.qty) +
              "</strong></div>"
          )
          .join("") +
          '<div class="summary-row"><span>الشحن</span><strong>' +
          (order.shipping === 0 ? "مجاني" : money(order.shipping)) +
          '</strong></div><div class="summary-row total"><span>الإجمالي</span><span>' +
          money(order.total) +
          "</span></div>";
      }
      const wa = sessionStorage.getItem("sita_last_wa");
      const waBtn = $("#orderWaBtn");
      if (waBtn) {
        waBtn.href = wa || ("https://wa.me/" + DATA.whatsapp + "?text=" + encodeURIComponent("طلب جديد من متجر SITA\nرقم الطلب: " + order.id + "\nالإجمالي: " + money(order.total)));
        waBtn.style.display = "inline-flex";
      }
    }
  }

  /* ---------------- Whatsapp links ---------------- */
  if (DATA.whatsapp) {
    const msg = encodeURIComponent("مرحباً SITA، أود الاستفسار عن منتجاتكم.");
    $$("[data-wa-link]").forEach((a) => {
      a.href = "https://wa.me/" + DATA.whatsapp + "?text=" + msg;
      a.target = "_blank";
      a.rel = "noopener";
    });
  }

  /* ---------------- Header + reveal ---------------- */
  const header = $(".site-header");
  const onScroll = () => header && header.classList.toggle("scrolled", window.scrollY > 12);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    $$("[data-reveal]").forEach((el) => io.observe(el));
  } else {
    $$("[data-reveal]").forEach((el) => el.classList.add("in-view"));
  }

})();
