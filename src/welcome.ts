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
  document.querySelector("#viewer")!.append(root);
  // Animation is transient; no retained particles, listeners, timers or GPU context.
  const duration = reduced ? 2200 : 4200;
  const dismiss = () => {
    clearTimeout(timer);
    document.removeEventListener("pointerdown", dismiss);
    document.removeEventListener("keydown", dismiss);
    root.remove();
  };
  const timer = setTimeout(dismiss, duration);
  document.addEventListener("pointerdown", dismiss, { once: true });
  document.addEventListener("keydown", dismiss, { once: true });
  return dismiss;
}
