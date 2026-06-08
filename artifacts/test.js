const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('C:/Users/gavin/.gemini/antigravity/scratch/Hawaii_Telemetry/artifacts/honolulu/index.html', 'utf-8');
const js = fs.readFileSync('C:/Users/gavin/.gemini/antigravity/scratch/Hawaii_Telemetry/artifacts/honolulu/public/static/script.js', 'utf-8');

const dom = new JSDOM(html, { runScripts: "dangerously" });
dom.window.eval("globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });");
try {
    dom.window.eval(js);
    console.log("Script executed successfully without top-level errors.");
} catch(e) {
    console.error("Top level error:", e);
}
