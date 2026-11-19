const RE = /(GTA|Grand Theft Auto)\s*(VI|6)\b|\b(Jason|Lucia|Vice City|Leonida)\b/i;

// Smallest "unit of content" around a match: post, search result, comment, list item...
const CONTAINER = [
  "article", "[role='article']", "[data-pagelet^='FeedUnit']",
  ".MjjYud", "div.g",                                   // Google results
  "ytd-video-renderer", "ytd-rich-item-renderer", "ytd-comment-thread-renderer",
  "[data-testid='tweet']", "shreddit-post", "shreddit-comment",
  "a[href*='/reel/']", "a[href*='/videos/']",           // FB reel/video preview cards
  ".post", ".comment", "li",
].join(",");

const SKIP = "script,style,noscript,textarea,[data-gta-notice],[data-gta-hidden],[data-gta-ok]";

function containerFor(el) {
  let c = el.closest(CONTAINER);
  // No post-like wrapper: fall back to the nearest block (paragraph) so we never nuke the page
  if (!c) {
    c = el.closest("p,blockquote,section,div");
    // Reels/video players: climb to the nearest ancestor holding exactly one <video>
    let p = c;
    for (let i = 0; p && i < 12 && p !== document.body && p.tagName !== "MAIN"; i++, p = p.parentElement) {
      const n = p.querySelectorAll("video").length;
      if (n > 1) break;
      if (n === 1) { c = p; break; }
    }
  }
  if (!c || c === document.body || c === document.documentElement || c.tagName === "MAIN") return null;
  return c;
}

function block(el) {
  el.dataset.gtaHidden = "1";
  const display = el.style.display;
  el.style.setProperty("display", "none", "important");

  const notice = document.createElement("div");
  notice.dataset.gtaNotice = "1";
  notice.style.cssText =
    "font:13px/1.4 sans-serif;color:#888;padding:6px 10px;margin:4px 0;border-left:3px solid #d00;";
  notice.append("GTA VI content ");

  const link = document.createElement("a");
  link.href = "#";
  link.textContent = "Open anyway";
  link.style.cssText = "color:#d00;margin-left:6px;cursor:pointer;";
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
  hits.forEach((c) => { if (!c.dataset.gtaHidden) block(c); });
  // display:none doesn't stop audio
  document.querySelectorAll("[data-gta-hidden] video").forEach((v) => v.pause());
}

// Pages that load content dynamically (YouTube, X, Facebook...)
let timer;
new MutationObserver(() => {
  clearTimeout(timer);
  timer = setTimeout(scan, 500);
}).observe(document.documentElement, { childList: true, subtree: true });

scan();
