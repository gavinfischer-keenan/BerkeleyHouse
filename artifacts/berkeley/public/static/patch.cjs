const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

const hnlLogic = `
function updateHNLBox() {
    const box = document.getElementById('hnl-status-box');
    if (!box) return;
    const apt = liveData.airport || { status: 'LOADING...', color: '#a4b0be', details: 'Awaiting data...' };
    box.style.display = 'block';
    box.style.borderColor = apt.color;
    box.innerHTML = \`
        <div style="font-weight:bold; font-size:12px; color:\${apt.color}; text-transform:uppercase; margin-bottom:4px; text-shadow: 0 0 4px \${apt.color};">
            ✈ HNL AIRPORT: \${apt.status}
        </div>
        <div style="font-size:9.5px; color:#dfe6e9; line-height:1.3;">
            \${apt.details}
        </div>
    \`;
}

function hideHNLBox() {
    const box = document.getElementById('hnl-status-box');
    if (box) box.style.display = 'none';
}

function updateLegend`;

s = s.replace('function updateLegend', hnlLogic);
s = s.replace(/onEnter\(\) \{ fetchAirport\(\); updateLegend\('none'\); \},/, "onEnter() { fetchAirport(); updateLegend('none'); updateHNLBox(); },\n        onExit()  { updateLegend('none'); hideHNLBox(); },");
s = s.replace(/onExit\(\)\s*\{\s*updateLegend\('none'\);\s*\},\s*renderStatic/, 'renderStatic');

// Now, carefully extract the exact HNL block from renderStatic
const aptBlockRegex = /<div style="margin-bottom: 12px; background: rgba\(0,0,0,0\.85\); padding: 8px; border-radius: 6px; border: 1px solid \$\{apt\.color\}; box-shadow: 0 4px 12px rgba\(0,0,0,0\.5\);">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<div class="hazard-legend"/;

s = s.replace(aptBlockRegex, '<div class="hazard-legend"');
s = s.replace(/const apt = liveData\.airport \|\| \{ status: 'LOADING\.\.\.', color: '#a4b0be', details: 'Awaiting data\.\.\.' \};\s*return `/, 'return `');

fs.writeFileSync('script.js', s);
console.log('patched');
