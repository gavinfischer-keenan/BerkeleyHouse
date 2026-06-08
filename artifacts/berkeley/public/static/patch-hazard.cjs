const fs = require('fs');

let s = fs.readFileSync('script.js', 'utf8');

// Fix 1: Remove the buoys from the POI array
s = s.replace(/\{\s*c:\s*\[21\.297,\s*-157\.959\],\s*n:\s*"⚓ 51211 Pearl Harbor"\s*\},/g, '');
s = s.replace(/\{\s*c:\s*\[21\.414,\s*-157\.678\],\s*n:\s*"⚓ 51202 Mokapu"\s*\},/g, '');
s = s.replace(/\{\s*c:\s*\[21\.323,\s*-158\.149\],\s*n:\s*"⚓ 51212 Barbers Pt"\s*\},/g, '');
s = s.replace(/\{\s*c:\s*\[21\.750,\s*-158\.200\],\s*n:\s*"⚓ 51201 Waimea"\s*\},/g, '');
s = s.replace(/\{\s*c:\s*\[21\.065,\s*-156\.970\],\s*n:\s*"⚓ 51204 Pailolo Ch"\s*\},/g, '');
s = s.replace(/\{\s*c:\s*\[21\.080,\s*-157\.050\],\s*n:\s*"⚓ 51213 Kawaihae"\s*\},/g, '');

// Also handle if the anchor emoji isn't matched due to encoding (fallback regex)
s = s.replace(/\{\s*c:\s*\[[0-9\.\-,\s]+\],\s*n:\s*"[^"]*51211 Pearl Harbor"\s*\},?/g, '');
s = s.replace(/\{\s*c:\s*\[[0-9\.\-,\s]+\],\s*n:\s*"[^"]*51202 Mokapu"\s*\},?/g, '');
s = s.replace(/\{\s*c:\s*\[[0-9\.\-,\s]+\],\s*n:\s*"[^"]*51212 Barbers Pt"\s*\},?/g, '');
s = s.replace(/\{\s*c:\s*\[[0-9\.\-,\s]+\],\s*n:\s*"[^"]*51201 Waimea"\s*\},?/g, '');
s = s.replace(/\{\s*c:\s*\[[0-9\.\-,\s]+\],\s*n:\s*"[^"]*51204 Pailolo Ch"\s*\},?/g, '');
s = s.replace(/\{\s*c:\s*\[[0-9\.\-,\s]+\],\s*n:\s*"[^"]*51213 Kawaihae"\s*\},?/g, '');
s = s.replace(/\/\/\s*Buoys[\r\n\s]*/g, '');

// Fix 2: Remove the HNL airport block from Hazard state renderStatic()
const hazardStaticRegex = /<div style="margin-bottom: 12px; background: rgba\(0,0,0,0\.85\); padding: 8px; border-radius: 6px; border: 1px solid \$\{apt\.color\}; box-shadow: 0 4px 12px rgba\(0,0,0,0\.5\);">[\s\S]*?<\/div>\s*<div class="hazard-legend"/g;
s = s.replace(hazardStaticRegex, '<div class="hazard-legend"');

fs.writeFileSync('script.js', s);
console.log('patched');
