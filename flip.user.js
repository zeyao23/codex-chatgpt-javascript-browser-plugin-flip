// ==UserScript==
// @name         E-Ink Click Flip Reader
// @namespace    https://example.com/
// @version      1.1.0
// @description  Disable smooth scrolling, tap-to-flip, and optional reading mode for E-Ink devices.
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TOP_ZONE_RATIO = 0.3;
  const BOTTOM_ZONE_RATIO = 0.3;
  const OVERLAP_PX = 40;
  const READING_MODE_STORAGE_KEY = '__eink_reading_mode__';
  const NO_BREAK_PATTERN =
    /(……|\.{6}|——|[0-9０-９]+(?:\.[0-9０-９]+)?(?:%|‰|kg|g|mg|km|m|cm|mm|℃|°C|年|月|日|小时|小時|分钟|分鐘|分|秒|岁|頁|页)|[A-Za-z]+(?:['’][A-Za-z]+)*)/g;

  let isReadingMode = false;
  let originalBodyFragment = null;

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
        '#eink-reading-mode-toggle, a, button, input, textarea, select, summary, [role="button"], [contenteditable=""], [contenteditable="true"]'
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

  function removeSiteStyles() {
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => node.remove());
    document.querySelectorAll('[style]').forEach((node) => node.removeAttribute('style'));
  }

  function scoreElement(el) {
    const textLen = (el.innerText || '').replace(/\s+/g, '').length;
    if (textLen < 200) {
      return -1;
    }

    const pCount = el.querySelectorAll('p').length;
    const imgCount = el.querySelectorAll('img').length;
    const headingCount = el.querySelectorAll('h1, h2, h3').length;
    const linkCount = el.querySelectorAll('a').length;

    return textLen + pCount * 80 + imgCount * 40 + headingCount * 60 - linkCount * 20;
  }

  function extractMainContentRoot() {
    const preferred = document.querySelectorAll('article, main, [role="main"]');
    let best = document.body;
    let bestScore = scoreElement(document.body);

    preferred.forEach((el) => {
      const score = scoreElement(el);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });

    document.querySelectorAll('body section, body div').forEach((el) => {
      const score = scoreElement(el);
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    });

    return best;
  }

  function sanitizeNode(node, outputDoc) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (!text.trim()) {
        return outputDoc.createTextNode(' ');
      }
      return outputDoc.createTextNode(text.replace(/\s+/g, ' '));
    }

    if (!(node instanceof Element)) {
      return null;
    }

    const tag = node.tagName.toLowerCase();
    const blockTags = new Set([
      'article',
      'section',
      'div',
      'main',
      'p',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'pre',
      'ul',
      'ol',
      'li',
      'figure',
      'figcaption'
    ]);
    const inlineTags = new Set(['span', 'strong', 'em', 'b', 'i', 'u', 'code', 'small', 'sub', 'sup']);

    if (tag === 'img') {
      const img = outputDoc.createElement('img');
      const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
      if (!src) {
        return null;
      }
      img.src = src;
      const alt = node.getAttribute('alt') || '';
      if (alt) {
        img.alt = alt;
      }
      img.loading = 'lazy';
      return img;
    }

    if (!blockTags.has(tag) && !inlineTags.has(tag) && tag !== 'a' && tag !== 'br') {
      const frag = outputDoc.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        const clean = sanitizeNode(child, outputDoc);
        if (clean) {
          frag.appendChild(clean);
        }
      });
      return frag;
    }

    if (tag === 'br') {
      return outputDoc.createElement('br');
    }

    const normalizedTag = blockTags.has(tag) || inlineTags.has(tag) ? tag : 'span';
    const cleanEl = outputDoc.createElement(normalizedTag);

    Array.from(node.childNodes).forEach((child) => {
      const clean = sanitizeNode(child, outputDoc);
      if (clean) {
        cleanEl.appendChild(clean);
      }
    });

    if (!cleanEl.textContent?.trim() && cleanEl.querySelectorAll('img').length === 0) {
      return null;
    }

    return cleanEl;
  }

  function applyTypographyProtection(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const textNodes = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.textContent && node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    textNodes.forEach((textNode) => {
      const parent = textNode.parentNode;
      if (!parent) {
        return;
      }

      const text = textNode.textContent || '';
      let lastIndex = 0;
      let match = NO_BREAK_PATTERN.exec(text);
      if (!match) {
        NO_BREAK_PATTERN.lastIndex = 0;
        return;
      }

      NO_BREAK_PATTERN.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      while ((match = NO_BREAK_PATTERN.exec(text))) {
        const start = match.index;
        const end = start + match[0].length;
        if (start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }
        const span = document.createElement('span');
        span.className = 'eink-no-break';
        span.textContent = match[0];
        fragment.appendChild(span);
        lastIndex = end;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      parent.replaceChild(fragment, textNode);
      NO_BREAK_PATTERN.lastIndex = 0;
    });
  }

  function injectReadingModeStyle() {
    const style = document.createElement('style');
    style.id = 'eink-reading-layout-style';
    style.textContent = `
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #f7f7f2 !important;
        color: #111 !important;
      }

      #eink-reading-mode-root {
        box-sizing: border-box;
        max-width: 840px;
        margin: 0 auto;
        padding: 28px 20px 120px;
        font-size: 22px;
        line-height: 1.85;
        letter-spacing: 0.01em;
        word-break: keep-all;
        line-break: strict;
        overflow-wrap: break-word;
        text-wrap: pretty;
        hanging-punctuation: first allow-end last;
        text-align: justify;
        text-justify: inter-character;
      }

      #eink-reading-mode-root p,
      #eink-reading-mode-root li,
      #eink-reading-mode-root blockquote,
      #eink-reading-mode-root figcaption {
        margin: 0 0 1em;
      }

      #eink-reading-mode-root h1,
      #eink-reading-mode-root h2,
      #eink-reading-mode-root h3 {
        margin: 1.2em 0 0.6em;
        line-height: 1.35;
      }

      #eink-reading-mode-root img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 1em auto;
      }

      #eink-reading-mode-root .eink-no-break {
        white-space: nowrap;
      }

      #eink-reading-mode-toggle {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 2147483647;
        border: 1px solid #444;
        background: #fff;
        color: #111;
        border-radius: 6px;
        font-size: 14px;
        padding: 8px 10px;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function buildReadingMode() {
    const sourceRoot = extractMainContentRoot();
    const outputDoc = document.implementation.createHTMLDocument('eink-reading-mode');
    const root = outputDoc.createElement('article');
    root.id = 'eink-reading-mode-root';

    Array.from(sourceRoot.childNodes).forEach((node) => {
      const clean = sanitizeNode(node, outputDoc);
      if (clean) {
        root.appendChild(clean);
      }
    });

    return root;
  }

  function snapshotBody() {
    const fragment = document.createDocumentFragment();
    while (document.body.firstChild) {
      fragment.appendChild(document.body.firstChild);
    }
    return fragment;
  }

  function restoreBody(snapshot) {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    document.body.appendChild(snapshot);
  }

  function setReadingModeButtonText(button) {
    button.textContent = isReadingMode ? '退出阅读模式' : '阅读模式';
  }

  function toggleReadingMode(force) {
    const nextMode = typeof force === 'boolean' ? force : !isReadingMode;
    if (nextMode === isReadingMode) {
      return;
    }

    const toggleButton = document.getElementById('eink-reading-mode-toggle');

    if (nextMode) {
      originalBodyFragment = snapshotBody();
      removeSiteStyles();
      const readingRoot = buildReadingMode();
      while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
      }
      document.body.appendChild(readingRoot);
      applyTypographyProtection(readingRoot);
      if (toggleButton) {
        document.body.appendChild(toggleButton);
      }
    } else if (originalBodyFragment) {
      restoreBody(originalBodyFragment);
      if (toggleButton) {
        document.body.appendChild(toggleButton);
      }
      originalBodyFragment = null;
    }

    isReadingMode = nextMode;
    localStorage.setItem(READING_MODE_STORAGE_KEY, String(isReadingMode));
    if (toggleButton) {
      setReadingModeButtonText(toggleButton);
    }
  }

  function initReadingModeToggle() {
    injectReadingModeStyle();

    const button = document.createElement('button');
    button.id = 'eink-reading-mode-toggle';
    button.type = 'button';
    button.addEventListener('click', () => toggleReadingMode());
    document.body.appendChild(button);

    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'r' && !isInteractiveElement(event.target)) {
        toggleReadingMode();
      }
    });

    const saved = localStorage.getItem(READING_MODE_STORAGE_KEY) === 'true';
    isReadingMode = false;
    setReadingModeButtonText(button);
    if (saved) {
      toggleReadingMode(true);
    }
  }

  function boot() {
    injectNoSmoothScrollStyle();
    window.addEventListener('pointerup', onPointerUp, { passive: false, capture: true });
    initReadingModeToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
