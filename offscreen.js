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
