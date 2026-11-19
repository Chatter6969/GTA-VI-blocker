// Runs Tesseract locally (bundled files, nothing leaves the browser)
let worker;
const ready = () => (worker ||= Tesseract.createWorker("eng", 1, {
  workerPath: chrome.runtime.getURL("ocr/worker.min.js"),
  corePath: chrome.runtime.getURL("ocr/"),
  langPath: chrome.runtime.getURL("ocr/"),
  workerBlobURL: false,
}));
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type !== "gta-ocr") return;
  ready().then((w) => w.recognize(msg.img)).then((r) => reply({ text: r.data.text }), (e) => reply({ error: String(e) }));
  return true; // async reply
});
// Image URL (already in the browser cache): fetch, shrink to <=1280px, OCR
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type !== "gta-ocr-url") return;
  (async () => {
    const bmp = await createImageBitmap(await (await fetch(msg.url, { credentials: "omit" })).blob());
    const k = Math.min(1, 1280 / bmp.width);
    const c = new OffscreenCanvas(bmp.width * k, bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const w = await ready();
    return { text: (await w.recognize(await c.convertToBlob({ type: "image/jpeg", quality: 0.85 }))).data.text };
  })().then(reply, (e) => reply({ error: String(e) }));
  return true;
});
ready(); // load the model as soon as the offscreen document is created
