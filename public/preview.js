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
        '<div class="pv-splash"><i class="pv-glow g1"></i><i class="pv-glow g2"></i><i class="pv-glow g3"></i><i class="pv-glow g4"></i><p class="pv-text"></p></div>' +
        '<div class="pv-clock">00:00</div></div>';
      root = box.firstElementChild;
      textEl = root.querySelector(".pv-text");
      clockEl = root.querySelector(".pv-clock");
    },
    setOn(value) { on = value; box.hidden = !value; }, // hidden = animations stop, saving battery
    update({ splash, text, ms, total }) {
      if (!on || !root) return;
      root.dataset.mode = splash ? "splash" : "timer";
      const label = text || "";
      if (textEl.textContent !== label) textEl.textContent = label;
      if (splash) return;
      const s = fmt(ms), secs = Math.ceil(ms / 1000);
      clockEl.textContent = s;
      clockEl.classList.toggle("long", s.length > 5);
      root.dataset.state = total <= 0 ? "" : ms <= 0 ? "done" : secs <= 10 ? "danger" : secs <= 60 ? "warn" : "";
    },
  };
})();
