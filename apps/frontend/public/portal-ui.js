(() => {
  const root = document.documentElement;
  const mode = root.dataset.portalStatic;
  if (!mode) return;
  const embedded = window.self !== window.top;
  root.dataset.portalEmbedded = String(embedded);
  if (embedded) return;
  const id = { reading: "java", utility: "co-phieu", festive: "bao-li-xi", racing: "racing-game", arcade: "game-battle", gps: "gps-tracker" }[mode];
  if (id) {
    try {
      const saved = JSON.parse(localStorage.getItem("portal.recent.v1") || "[]");
      const recent = Array.isArray(saved) ? saved.filter(value => typeof value === "string" && value !== id) : [];
      localStorage.setItem("portal.recent.v1", JSON.stringify([id, ...recent].slice(0, 6)));
    } catch { /* Static applications stay usable without storage. */ }
  }
  const link = document.createElement("a");
  link.className = "portal-static-home";
  link.href = "/";
  link.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/></svg><span>Về nhà mình</span>';
  const target = mode === "reading" ? document.querySelector("header") : mode === "racing" ? document.querySelector(".lobby-container") : mode === "gps" ? document.querySelector(".container, #ui-panel") : mode === "arcade" ? document.querySelector("#start-screen .popup-box, #start-screen, #main-menu .popup-box, #main-menu") : null;
  if (target) target.append(link);
  else if (mode === "utility" || mode === "festive") document.body.prepend(link);
})();
