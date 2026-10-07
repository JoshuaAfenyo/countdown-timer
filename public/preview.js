// Shared by the display and the previews.
// SplashText: one line of text that sits centered if it fits, and scrolls in a seamless loop if it is wider than its box.
const SplashText = (() => {
  const item = (text, clone) => {
    const s = document.createElement("span");
    s.className = "st-item";
    s.textContent = text;
    if (clone) s.setAttribute("aria-hidden", "true");
    return s;
  };
  function layout(box) {
    const track = box.firstElementChild, text = box.dataset.text || "";
    box.classList.remove("st-scroll");
    track.replaceChildren(item(text));
    const w = box.clientWidth;
    if (!w || !text || track.offsetWidth <= w) return; // fits (or hidden): stay centered
    box.classList.add("st-scroll");
    track.replaceChildren(item(text), item(text, true)); // two copies make the loop seamless
    box.style.setProperty("--st-dur", (track.offsetWidth / 2 / (w * 0.06)) + "s"); // speed scales with the box width
  }
  return {
    attach(box) { new ResizeObserver(() => layout(box)).observe(box); }, // re-checks when the size or font size changes
    set(box, text) { if (box.dataset.text !== text) { box.dataset.text = text; layout(box); } },
  };
})();

// Draws the miniature display. Call Preview.mount(element) once, then Preview.update({ splash, text, ms, total }).
const Preview = (() => {
  let box, root, textEl, clockEl, on = true;
  const pad = n => String(n).padStart(2, "0");
  function fmt(ms) {
    const t = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  return {
    mount(el) {
      box = el;
      box.innerHTML = '<div class="pv" data-mode="splash" data-state="" aria-hidden="true">' +
        '<div class="pv-splash"><i class="pv-glow g1"></i><i class="pv-glow g2"></i><i class="pv-glow g3"></i><i class="pv-glow g4"></i><div class="pv-text st"><div class="st-track"><span class="st-item"></span></div></div></div>' +
        '<div class="pv-clock">00:00</div></div>';
      root = box.firstElementChild;
      textEl = root.querySelector(".pv-text");
      SplashText.attach(textEl);
      clockEl = root.querySelector(".pv-clock");
    },
    setOn(value) { on = value; box.hidden = !value; }, // hidden = animations stop, saving battery
    update({ splash, text, ms, total, size }) {
      if (!on || !root) return;
      root.dataset.mode = splash ? "splash" : "timer";
      const label = text || "";
      SplashText.set(textEl, label);
      root.style.setProperty("--k", (size || 100) / 100);
      if (splash) return;
      const s = fmt(ms), secs = Math.ceil(ms / 1000);
      clockEl.textContent = s;
      clockEl.classList.toggle("long", s.length > 5);
      root.dataset.state = total <= 0 ? "" : ms <= 0 ? "done" : secs <= 10 ? "danger" : secs <= 60 ? "warn" : "";
    },
  };
})();
