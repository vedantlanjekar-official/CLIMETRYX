"use client";

import { useEffect } from "react";

export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const viewport = window.innerHeight;
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      if (rect.top < viewport && rect.bottom > 0) node.classList.add("is-revealed");
    }
    root.classList.add("cx-js");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    nodes.filter((node) => !node.classList.contains("is-revealed")).forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      root.classList.remove("cx-js");
    };
  }, []);

  return null;
}
