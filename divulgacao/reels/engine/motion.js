// Tiny deterministic motion kit: every frame is a pure function of t (seconds).
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = {
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2),
  lin: (x) => x,
};
/** 0→1 between a and b. */
const p = (t, a, b, e = ease.out) => e(clamp((t - a) / (b - a)));
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const lerp = (a, b, k) => a + (b - a) * k;
/** Scene visible between a and b with fades of f seconds. */
function scene(el, t, a, b, f = 0.35) {
  const v = Math.min(p(t, a, a + f, ease.lin), 1 - p(t, b - f, b, ease.lin));
  el.style.opacity = v;
  el.style.visibility = v > 0 ? "visible" : "hidden";
  return v;
}
/** Pop in (scale+fade+rise) at time a. */
function pop(el, t, a, d = 0.45, rise = 40) {
  const k = p(t, a, a + d, ease.back);
  const o = p(t, a, a + d * 0.6, ease.lin);
  el.style.opacity = o;
  el.style.transform = `translateY(${(1 - k) * rise}px) scale(${lerp(0.86, 1, k)})`;
  el.style.display = t < a ? "none" : "";
}
/** Words of a caption appear one by one. */
function words(el, t, a, per = 0.09) {
  if (!el.dataset.split) {
    el.innerHTML = el.innerHTML.replace(/(<em>.*?<\/em>|[^\s<]+)/g, '<span class="w">$1</span>');
    el.dataset.split = 1;
  }
  [...el.querySelectorAll(".w")].forEach((w, i) => {
    const k = p(t, a + i * per, a + i * per + 0.4);
    w.style.display = "inline-block";
    w.style.opacity = k;
    w.style.transform = `translateY(${(1 - k) * 30}px)`;
  });
}
/** Typing dots bounce. */
function dots(el, t, a, b) {
  el.style.display = t >= a && t < b ? "" : "none";
  [...el.children].forEach((d, i) => {
    d.style.transform = `translateY(${Math.sin((t * 8) - i * 0.9) * 6}px)`;
  });
}
const money = (v) => "R$ " + Math.round(v).toLocaleString("pt-BR");
