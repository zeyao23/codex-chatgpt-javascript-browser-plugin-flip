// ==UserScript==
// @name         E-Ink Click Flip Reader
// @namespace    https://example.com/
// @version      1.0.0
// @description  Disable smooth scrolling and flip by tapping top/bottom screen zones for E-Ink devices.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TOP_ZONE_RATIO = 0.3;
  const BOTTOM_ZONE_RATIO = 0.3;
  const OVERLAP_PX = 40;

  function injectNoSmoothScrollStyle() {
    const style = document.createElement('style');
    style.id = 'eink-no-smooth-scroll';
    style.textContent = `
      html, body, * {
        scroll-behavior: auto !important;
      }
    `;

    const mount = () => {
      if (document.head) {
        document.head.appendChild(style);
      } else {
        document.documentElement.appendChild(style);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }
  }

  function flipPage(direction) {
    const viewportHeight = window.innerHeight;
    const delta = Math.max(0, viewportHeight - OVERLAP_PX);
    const distance = direction === 'down' ? delta : -delta;
    window.scrollBy({ top: distance, left: 0, behavior: 'auto' });
  }

  function isInteractiveElement(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(
      target.closest(
        'a, button, input, textarea, select, summary, [role="button"], [contenteditable=""], [contenteditable="true"]'
      )
    );
  }

  function onPointerUp(event) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }

    if (isInteractiveElement(event.target)) {
      return;
    }

    const viewportHeight = window.innerHeight;
    const y = event.clientY;

    if (y >= viewportHeight * (1 - BOTTOM_ZONE_RATIO)) {
      event.preventDefault();
      flipPage('down');
      return;
    }

    if (y <= viewportHeight * TOP_ZONE_RATIO) {
      event.preventDefault();
      flipPage('up');
    }
  }

  injectNoSmoothScrollStyle();
  window.addEventListener('pointerup', onPointerUp, { passive: false, capture: true });
})();
