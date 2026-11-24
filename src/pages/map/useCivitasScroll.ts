import { useEffect, useRef } from "react";
import type { PanelKey } from "./mapConfig";

export function useCivitasScroll(panel: PanelKey) {
  const civitasScrollRef = useRef<HTMLDivElement | null>(null);

  const civitasScrollThumbRef = useRef<HTMLDivElement | null>(null);

  const civitasScrollRailRef = useRef<HTMLDivElement | null>(null);

  const civitasHeroRef = useRef<HTMLElement | null>(null);

  const syncCivitasScrollThumb = () => {
    const scrollEl = civitasScrollRef.current;
    const thumbEl = civitasScrollThumbRef.current;
    const railEl = civitasScrollRailRef.current;
    const heroEl = civitasHeroRef.current;
    if (!scrollEl || !thumbEl || !railEl) return;

    const panelEl = scrollEl.parentElement;
    if (panelEl && heroEl) {
      const panelRect = panelEl.getBoundingClientRect();
      const heroRect = heroEl.getBoundingClientRect();
      const railTop = Math.max(12, heroRect.bottom - panelRect.top + 6);
      railEl.style.top = `${railTop}px`;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollEl;
    if (heroEl) {
      heroEl.classList.toggle("civitasHero--scrolled", scrollTop > 1);
    }
    const canScroll = scrollHeight > clientHeight + 1;
    if (!canScroll) {
      thumbEl.style.opacity = "0";
      return;
    }

    const railHeight = railEl.clientHeight;
    if (railHeight <= 0) {
      thumbEl.style.opacity = "0";
      return;
    }

    const minThumbPx = 28;
    const thumbHeight = Math.max(minThumbPx, (clientHeight / scrollHeight) * railHeight);
    const maxTop = Math.max(0, railHeight - thumbHeight);
    const progress = scrollTop / Math.max(1, scrollHeight - clientHeight);
    const top = maxTop * progress;

    thumbEl.style.height = `${thumbHeight}px`;
    thumbEl.style.transform = `translateY(${top}px)`;
    thumbEl.style.opacity = "1";
  };

  useEffect(() => {
    if (panel !== "civitas") return;
    const scrollEl = civitasScrollRef.current;
    if (!scrollEl) return;

    const onScroll = () => syncCivitasScrollThumb();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncCivitasScrollThumb()) : null;
    ro?.observe(scrollEl);

    window.addEventListener("resize", syncCivitasScrollThumb);
    window.requestAnimationFrame(syncCivitasScrollThumb);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      ro?.disconnect();
      window.removeEventListener("resize", syncCivitasScrollThumb);
    };
  }, [panel]);

  return { civitasScrollRef, civitasScrollThumbRef, civitasScrollRailRef, civitasHeroRef };
}
