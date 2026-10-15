// Shared by the display, the control page, the phone remote and the previews.

// TimerFmt: shows a time in ms as MM:SS (or H:MM:SS). Below zero it keeps going as negative time ("-00:05").
const TimerFmt = (() => {
  const pad = n => String(n).padStart(2, "0");
  const text = ms => {
    const t = Math.ceil(ms / 1000), a = Math.abs(t); // rounds up while counting down, so 00:00 lasts one second and then -00:01 follows
    const h = Math.floor(a / 3600), m = Math.floor((a % 3600) / 60), s = a % 60;
    return (t < 0 ? "-" : "") + (h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
  };
  return {
    text,
    // Writes the time into el and sets the "long" (hours shown) and "neg" (below zero) classes so the CSS can size the text to fit.
    show(el, ms) {
      const s = text(ms);
      el.textContent = s;
      el.classList.toggle("long", s.split(":").length > 2);
      el.classList.toggle("neg", s[0] === "-");
    },
  };
})();

// HalfFlash: a running timer that counts down past half of its set time flashes 3 times. The timer itself keeps running.
// Each screen compares its previous and current time, so the display, the previews and the phone all work out the moment themselves.
const HalfFlash = {
  crossed: (prev, cur, total, running) => running && total > 1000 && prev != null && prev > total / 2 && cur <= total / 2,
  play(el) {
    clearTimeout(el._flashTimer);
    el.classList.remove("flash");
    void el.offsetWidth; // restarts the animation if one is already playing
    el.classList.add("flash");
    el._flashTimer = setTimeout(() => el.classList.remove("flash"), matchMedia("(prefers-reduced-motion: reduce)").matches ? 3800 : 1900);
  },
};

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

// Draws the miniature display. Call Preview.mount(element) once, then Preview.update({ splash, text, ms, total, running }).
const Preview = (() => {
  let box, root, textEl, clockEl, on = true, prev = null; // prev: the time at the last update, used to spot the half-time moment
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
    setOn(value) { on = value; box.hidden = !value; prev = null; }, // hidden = animations stop, saving battery
    update({ splash, text, ms, total, size, running }) {
      if (!on || !root) return;
      root.dataset.mode = splash ? "splash" : "timer";
      const label = text || "";
      SplashText.set(textEl, label);
      root.style.setProperty("--k", (size || 100) / 100);
      if (splash) { prev = null; return; } // no flash for a moment nobody saw
      TimerFmt.show(clockEl, ms);
      const secs = Math.ceil(ms / 1000);
      root.dataset.state = total <= 0 ? "" : ms <= 0 ? "done" : secs <= 10 ? "danger" : secs <= 60 ? "warn" : "";
      if (HalfFlash.crossed(prev, ms, total, running)) HalfFlash.play(root);
      prev = ms;
    },
  };
})();
