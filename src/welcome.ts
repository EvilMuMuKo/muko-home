/** A finite, compositor-only welcome. It never starts the WebGL render loop. */
export function showWelcome(): () => void {
  const portrait = matchMedia("(orientation: portrait) and (max-width: 1000px)");
  if (portrait.matches) {
    const onLandscape = () => {
      if (!portrait.matches) {
        portrait.removeEventListener("change", onLandscape);
        showWelcome();
      }
    };
    portrait.addEventListener("change", onLandscape);
    return () => portrait.removeEventListener("change", onLandscape);
  }
  const root = document.createElement("div");
  root.className = "home-welcome";
  root.setAttribute("role", "status");
  root.setAttribute("aria-live", "polite");
  const text = document.createElement("p");
  text.textContent = "welcome to MuKo’s home";
  root.append(text);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduced) {
    const colors = ["#a77448", "#7c8d67", "#e2c08b", "#bb7967", "#e7dfc9"];
    const count = matchMedia("(max-width: 1000px)").matches ? 24 : 40;
    for (let i = 0; i < count; i++) {
      const ribbon = document.createElement("i");
      ribbon.setAttribute("aria-hidden", "true");
      ribbon.style.cssText = `--x:${(i * 47.3) % 100}%;--drift:${(i % 2 ? 1 : -1) * (25 + (i * 13) % 90)}px;--turn:${(i % 2 ? 1 : -1) * (260 + (i * 31) % 360)}deg;--delay:${(i * 0.073) % 0.8}s;--duration:${2.3 + (i % 5) * 0.17}s;background:${colors[i % colors.length]}`;
      root.append(ribbon);
    }
  }
  // Wait until module/deferred scene initialization has completed and the browser
  // has had a chance to paint the arrival view. Starting the timer while the
  // renderer is still booting can consume the entire welcome before it is seen.
  const duration = reduced ? 2200 : 4200;
  let timer: number | undefined;
  let frame1 = 0;
  let frame2 = 0;
  let dismissed = false;
  const start = () => {
    if (dismissed) return;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        if (dismissed) return;
        document.querySelector("#viewer")!.append(root);
        // CSS animations start on insertion, so begin the dismissal clock here too.
        timer = window.setTimeout(dismiss, duration);
      });
    });
  };
  const dismiss = () => {
    dismissed = true;
    if (timer !== undefined) clearTimeout(timer);
    cancelAnimationFrame(frame1);
    cancelAnimationFrame(frame2);
    window.removeEventListener("load", onLoad);
    document.removeEventListener("pointerdown", dismiss);
    document.removeEventListener("keydown", dismiss);
    root.remove();
  };
  const onLoad = () => start();
  if (document.readyState === "complete") start();
  else window.addEventListener("load", onLoad, { once: true });
  document.addEventListener("pointerdown", dismiss, { once: true });
  document.addEventListener("keydown", dismiss, { once: true });
  return dismiss;
}
