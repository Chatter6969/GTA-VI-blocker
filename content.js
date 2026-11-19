// Any standalone "GTA"/"#GTA" except GTA V / GTA 5 / GTA IV / GTA 4, plus GTA VI / 6 and game names
const RE = /\bGTA\b(?!\s*(V|5|IV|4)\b)|(GTA|Grand Theft Auto)\s*(VI|6)\b|\b(Jason|Lucia|Vice City|Leonida)\b/i;

// Smallest "unit of content" around a match: post, search result, comment, list item...
const CONTAINER = [
  "article", "[role='article']", "[data-pagelet^='FeedUnit']",
  ".MjjYud", "div.g",                                   // Google results
  "ytd-video-renderer", "ytd-rich-item-renderer", "ytd-comment-thread-renderer",
  "[data-testid='tweet']", "shreddit-post", "shreddit-comment",
  "a[href*='/reel/']:not([href*='/hashtag/'])", "a[href*='/videos/']", // FB reel/video preview cards (not hashtag links)
  ".post", ".comment", "li",
].join(",");

// data-mw-file-dropzone / data-scope=messages_table = Messenger chat window (also the popups on facebook.com)
const SKIP = "script,style,noscript,textarea,[data-gta-notice],[data-gta-hidden],[data-gta-ok],[data-mw-file-dropzone],[data-scope='messages_table']";

function containerFor(el) {
  let c = el.closest(CONTAINER);
  // No post-like wrapper: fall back to the nearest block (paragraph) so we never nuke the page
  if (!c) {
    c = el.closest("p,blockquote,section,div");
    // Posts without role=article: climb to the post root = the highest ancestor that still holds
    // the same media (video / big image) and no more, and is shorter than the feed
    const media = (p) => [...p.querySelectorAll("video,img")].filter((m) => m.tagName === "VIDEO" || m.clientWidth >= 150).length;
    let p = c, base = 0, best = null;
    for (let i = 0; p && i < 40 && p !== document.body && p.tagName !== "MAIN"; i++, p = p.parentElement) {
      if (p.getBoundingClientRect().height > innerHeight * 1.2) break; // that's the feed, not a post
      const n = media(p);
      if (n > 4) break;
      if (!base) { if (n) { base = n; best = p; } }
      else if (n === base) best = p;
      else break;
    }
    if (best) c = best;
  }
  if (!c || c === document.body || c === document.documentElement || c.tagName === "MAIN") return null;
  // Never block a page-level wrapper (it would hide, then after "Open anyway" un-scan, the whole site)
  if (c.querySelector("[role='main'],[role='banner'],[role='navigation'],[role='feed']") || c.querySelectorAll("[role='article']").length > 1) return null;
  return c;
}

function block(el) {
  el.dataset.gtaHidden = "1";
  const display = el.style.display;
  // Videos/reels: keep the original size and show a tile; everything else: a thin inline note
  const r = el.getBoundingClientRect();
  const tile = (el.matches("[role='gridcell'],a[href*='/reel/']:not([href*='/hashtag/'])") || el.querySelector("video")) && r.width >= 100 && r.height >= 150;
  el.style.setProperty("display", "none", "important");

  const notice = document.createElement("div");
  notice.dataset.gtaNotice = "1";
  const link = document.createElement("a");
  link.href = "#";
  link.textContent = "Open anyway";
  if (tile) {
    notice.style.cssText =
      `box-sizing:border-box;width:${r.width}px;height:${r.height}px;flex:none;display:flex;flex-direction:column;` +
      "align-items:center;justify-content:center;gap:10px;border-radius:12px;border:1px solid rgba(128,128,128,.4);" +
      "background:rgba(128,128,128,.15);font:600 16px/1.3 sans-serif;color:#999;text-align:center;";
    notice.append("🎮 GTA VI content");
    link.style.cssText = "font:13px sans-serif;color:#d00;cursor:pointer;";
  } else {
    notice.style.cssText =
      "font:13px/1.4 sans-serif;color:#888;padding:6px 10px;margin:4px 0;border-left:3px solid #d00;";
    notice.append("GTA VI content ");
    link.style.cssText = "color:#d00;margin-left:6px;cursor:pointer;";
  }
  link.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    notice.remove();
    delete el.dataset.gtaHidden;
    el.dataset.gtaOk = "1";
    el.style.display = display;
  });

  notice.append(link);
  el.before(notice);
}

function scan() {
  if (!document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = new Set();
  for (let n; (n = walker.nextNode()); ) {
    if (!RE.test(n.nodeValue) || !n.parentElement || n.parentElement.closest(SKIP)) continue;
    const c = containerFor(n.parentElement);
    if (c) hits.add(c);
  }
  // Text attached to images/videos: alt, aria-label, title
  document.body.querySelectorAll("img[alt],[aria-label],[title]").forEach((el) => {
    const t = (el.getAttribute("alt") || "") + " " + (el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || "");
    if (!RE.test(t) || el.closest(SKIP)) return;
    const c = containerFor(el);
    if (c) hits.add(c);
  });
  // Reel previews show no description. Remember reels flagged on their own page (no network),
  // then hide every preview linking to them.
  let known = [];
  try { known = JSON.parse(localStorage.getItem("gtaReels") || "[]"); } catch {}
  const m = location.pathname.match(/\/reel\/(\d+)/);
  if (m && hits.size && !known.includes(m[1])) {
    known.push(m[1]);
    try { localStorage.setItem("gtaReels", JSON.stringify(known.slice(-500))); } catch {}
  }
  if (known.length) {
    document.querySelectorAll("a[href*='/reel/']:not([href*='/hashtag/'])").forEach((a) => {
      if (known.includes((a.href.match(/\/reel\/(\d+)/) || [])[1]) && !a.closest(SKIP)) hits.add(a);
    });
  }
  hits.forEach((c) => { if (!c.dataset.gtaHidden) block(c); });
  // display:none doesn't stop audio
  document.querySelectorAll("[data-gta-hidden] video").forEach((v) => v.pause());
}

// --- OCR test (Chrome/Edge): read on-video text from frames of previews you actually watch ---
// Frames go to a local Tesseract worker (offscreen doc); nothing is sent to Facebook or anywhere else.
const OCR_AFTER_MS = 500, OCR_EVERY_MS = 1500, OCR_MAX = 3, TICK = 250;
let warmed; // first playing video wakes the OCR worker, so the model is loaded before the 0.5 s are up
const watch = new WeakMap(); // video -> {src, t, ms (continuous visible playtime), last (last OCR), n (OCR count)}
let ocrQueue = Promise.resolve();
function grabFrame(v) {
  const k = Math.min(1, 640 / v.videoWidth);
  const c = document.createElement("canvas");
  c.width = v.videoWidth * k;
  c.height = v.videoHeight * k;
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8); // throws if the video is cross-origin (tainted canvas)
}
// OCR often reads the "6" in "GTA6" as G / B / 8 ("GTAG", "GTAGB"), so OCR text gets a looser match
const OCR_RE = new RegExp(RE.source + "|\\bGTA\\s?[6GB8]{1,2}\\b", "i");
function ocrVideo(v) {
  ocrQueue = ocrQueue.then(async () => {
    try {
      if (!v.isConnected || !v.videoWidth) return console.log("[GTA OCR] skipped: no frame");
      const img = grabFrame(v);
      await chrome.runtime.sendMessage({ type: "gta-ocr-ensure" });
      const r = await chrome.runtime.sendMessage({ type: "gta-ocr", img });
      ocrResult(v, r);
    } catch (e) { console.log("[GTA OCR] error", String(e)); }
  });
}
function ocrResult(el, r) {
  console.log("[GTA OCR]", r?.error || JSON.stringify(r?.text?.trim()));
  if (r?.text && OCR_RE.test(r.text)) {
    const c = containerFor(el);
    if (c && !c.dataset.gtaHidden) { block(c); el.pause?.(); }
  }
}
// Images: the offscreen document re-reads the picture from the browser cache (canvas is tainted for CDN images)
const seenImg = new Set();
let imgBudget = 60; // ponytail: max 60 images per page load, raise if feeds need more
function ocrImages() {
  if (document.hidden) return;
  for (const img of document.images) {
    const src = img.currentSrc;
    if (!src || seenImg.has(src) || !img.complete || img.closest(SKIP)) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 200 || r.height < 120 || r.bottom < 0 || r.top > innerHeight) continue;
    if (imgBudget-- <= 0) return;
    seenImg.add(src);
    ocrQueue = ocrQueue.then(async () => {
      try {
        if (!img.isConnected || img.closest("[data-gta-hidden]")) return;
        await chrome.runtime.sendMessage({ type: "gta-ocr-ensure" });
        ocrResult(img, await chrome.runtime.sendMessage({ type: "gta-ocr-url", url: src }));
      } catch (e) { console.log("[GTA OCR] error", String(e)); }
    });
  }
}
setInterval(ocrImages, 1000);
console.log("[GTA OCR] content script loaded (polling v3)");
// Polling instead of play/pause events: Facebook's player fires them constantly and cancelled the timers
setInterval(() => {
  if (document.hidden) return;
  document.querySelectorAll("video").forEach((v) => {
    let s = watch.get(v);
    if (!s) watch.set(v, (s = { src: v.currentSrc, t: v.currentTime, ms: 0, last: 0, n: 0 }));
    if (v.currentSrc !== s.src) Object.assign(s, { src: v.currentSrc, ms: 0, n: 0 }); // element reused for the next reel
    const moving = !v.paused && v.currentTime !== s.t;
    s.t = v.currentTime;
    if (moving && !warmed) { warmed = 1; chrome.runtime.sendMessage({ type: "gta-ocr-ensure" }).catch(() => {}); }
    const r = v.getBoundingClientRect();
    const visible = r.width >= 100 && r.height >= 100 && r.bottom > 0 && r.top < innerHeight;
    s.ms = moving && visible ? s.ms + TICK : 0;
    if (s.ms >= OCR_AFTER_MS && s.n < OCR_MAX && Date.now() - s.last >= OCR_EVERY_MS && !v.closest(SKIP)) {
      s.n++;
      s.last = Date.now();
      ocrVideo(v);
    }
  });
}, TICK);

// Pages that load content dynamically (YouTube, X, Facebook...)
let timer;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 500);
}).observe(document.documentElement, { childList: true, subtree: true });

scan();
