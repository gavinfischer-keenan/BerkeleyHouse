const fs = require('fs');

// Patch script.js
let s = fs.readFileSync('script.js', 'utf8');
const replacement = `
            const altStr  = a.altFt != null ? (a.altFt > 18000 ? 'FL' + Math.round(a.altFt/100) : Math.round(a.altFt) + 'ft') : '';
            const typeStr = a.acType || '';
            const call = a.callsign || a.icao24 || 'UNK';
            const label = \`\${icon} \${call} \${typeStr} \${altStr}\`.trim();
`.trim();

const targetRegex = /const label = `\$\{icon\} \$\{a\.callsign\}`;/;
s = s.replace(targetRegex, replacement);
fs.writeFileSync('script.js', s);

// Patch style.css
let css = fs.readFileSync('style.css', 'utf8');
css = css.replace('font-size: 10px;\r\n    font-weight: bold;\r\n    text-shadow', 'font-size: 12.5px;\r\n    font-weight: bold;\r\n    text-shadow');
css = css.replace('font-size: 10px;\n    font-weight: bold;\n    text-shadow', 'font-size: 12.5px;\n    font-weight: bold;\n    text-shadow');
css = css.replace('.deep-ocean-air {\r\n    color: #00d2d3;\r\n    font-size: 16px;', '.deep-ocean-air {\r\n    color: #00d2d3;\r\n    font-size: 18.5px;');
css = css.replace('.deep-ocean-air {\n    color: #00d2d3;\n    font-size: 16px;', '.deep-ocean-air {\n    color: #00d2d3;\n    font-size: 18.5px;');
css = css.replace('.waikiki-zoom .traffic-label {\r\n    font-size: 16px;', '.waikiki-zoom .traffic-label {\r\n    font-size: 18.5px;');
css = css.replace('.waikiki-zoom .traffic-label {\n    font-size: 16px;', '.waikiki-zoom .traffic-label {\n    font-size: 18.5px;');
fs.writeFileSync('style.css', css);

console.log('patched');
