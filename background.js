// Offscreen document hosts the OCR worker (service workers can't spawn Workers)
let creating;
async function ensure() {
  if (await chrome.offscreen.hasDocument()) return;
  creating ||= chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Local OCR of video frames" });
  await creating;
  creating = null;
}
chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type !== "gta-ocr-ensure") return;
  ensure().then(() => reply(true));
  return true; // async reply
});
