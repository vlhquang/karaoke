"use client";

import { useEffect, type RefObject } from "react";

export function useMobileControls(appRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const app = appRef.current;
    if (!app) return;
    let lastTap: { at: number; x: number; y: number; target: EventTarget | null } | null = null;
    let viewportFrame = 0;
    const preventGesture = (event: Event) => { if (event.cancelable) event.preventDefault(); };
    const preventPinch = (event: TouchEvent) => {
      if (event.touches.length > 1) { lastTap = null; preventGesture(event); }
    };
    const preventDoubleTap = (event: TouchEvent) => {
      if (event.touches.length || event.changedTouches.length !== 1) { lastTap = null; return; }
      const target = event.target;
      // Native controls keep their clicks, text selection and caret behavior.
      // Their CSS touch-action blocks zoom; the canvas manages its own pointer.
      if (target instanceof Element && target.closest("button,a,input,textarea,select,summary,[role='button'],canvas")) { lastTap = null; return; }
      const touch = event.changedTouches[0];
      const at = performance.now();
      if (lastTap && at - lastTap.at < 350 && lastTap.target === target && Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 28) preventGesture(event);
      lastTap = { at, x: touch.clientX, y: touch.clientY, target };
    };
    const updateKeyboardOffset = () => {
      cancelAnimationFrame(viewportFrame);
      viewportFrame = requestAnimationFrame(() => {
        const viewport = window.visualViewport;
        const active = document.activeElement;
        const editing = active instanceof HTMLElement && app.contains(active) && active.matches("input:not([readonly]),textarea,[contenteditable='true']");
        const offset = viewport && editing ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
        app.style.setProperty("--vv-keyboard-offset", `${offset}px`);
      });
    };
    const options = { passive: false, capture: true };
    app.addEventListener("touchstart", preventPinch, options);
    app.addEventListener("touchmove", preventPinch, options);
    app.addEventListener("touchend", preventDoubleTap, options);
    for (const event of ["gesturestart", "gesturechange", "gestureend"]) app.addEventListener(event, preventGesture, options);
    app.addEventListener("focusin", updateKeyboardOffset);
    app.addEventListener("focusout", updateKeyboardOffset);
    window.addEventListener("resize", updateKeyboardOffset);
    window.visualViewport?.addEventListener("resize", updateKeyboardOffset);
    window.visualViewport?.addEventListener("scroll", updateKeyboardOffset);
    updateKeyboardOffset();
    return () => {
      app.removeEventListener("touchstart", preventPinch, true);
      app.removeEventListener("touchmove", preventPinch, true);
      app.removeEventListener("touchend", preventDoubleTap, true);
      for (const event of ["gesturestart", "gesturechange", "gestureend"]) app.removeEventListener(event, preventGesture, true);
      app.removeEventListener("focusin", updateKeyboardOffset);
      app.removeEventListener("focusout", updateKeyboardOffset);
      window.removeEventListener("resize", updateKeyboardOffset);
      window.visualViewport?.removeEventListener("resize", updateKeyboardOffset);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardOffset);
      cancelAnimationFrame(viewportFrame);
      app.style.removeProperty("--vv-keyboard-offset");
    };
  }, [appRef]);
}
