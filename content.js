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

const SKIP = "script,style,noscript,textarea,[data-gta-notice],[data-gta-hidden],[data-gta-ok]";

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
const ocrTimers = new WeakMap();
const OCR_AFTER_MS = 1500, OCR_EVERY_MS = 2000, OCR_MAX = 3;
let ocrQueue = Promise.resolve();
function grabFrame(v) {
  const k = Math.min(1, 640 / v.videoWidth);
  const c = document.createElement("canvas");
  c.width = v.videoWidth * k;
  c.height = v.videoHeight * k;
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8); // throws if the video is cross-origin (tainted canvas)
}
function ocrVideo(v, n = 0) {
  const why = v.paused ? "paused" : !v.isConnected ? "detached" : v.closest(SKIP) ? "skip" : !v.videoWidth ? "no videoWidth" : document.hidden ? "tab hidden" : "";
  if (why) return console.log("[GTA OCR] skipped:", why);
  ocrQueue = ocrQueue.then(async () => {
    try {
      await chrome.runtime.sendMessage({ type: "gta-ocr-ensure" });
      const r = await chrome.runtime.sendMessage({ type: "gta-ocr", img: grabFrame(v) });
      console.log("[GTA OCR]", r?.error || r?.text?.trim());
      if (r?.text && RE.test(r.text)) {
        const c = containerFor(v);
        if (c && !c.dataset.gtaHidden) { block(c); v.pause(); }
        return;
      }
    } catch (e) { console.log("[GTA OCR] error", String(e)); return; }
    if (n + 1 < OCR_MAX) ocrTimers.set(v, setTimeout(() => { ocrTimers.delete(v); ocrVideo(v, n + 1); }, OCR_EVERY_MS));
  });
}
console.log("[GTA OCR] content script loaded");
document.addEventListener("playing", (e) => {
  const v = e.target;
  if (v.tagName !== "VIDEO" || ocrTimers.has(v)) return;
  console.log("[GTA OCR] video playing, waiting", OCR_AFTER_MS, "ms");
  ocrTimers.set(v, setTimeout(() => { ocrTimers.delete(v); ocrVideo(v); }, OCR_AFTER_MS));
}, true);
["pause", "emptied", "ended"].forEach((ev) =>
  document.addEventListener(ev, (e) => { clearTimeout(ocrTimers.get(e.target)); ocrTimers.delete(e.target); }, true));

// Pages that load content dynamically (YouTube, X, Facebook...)
let timer;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 500);
}).observe(document.documentElement, { childList: true, subtree: true });

scan();
