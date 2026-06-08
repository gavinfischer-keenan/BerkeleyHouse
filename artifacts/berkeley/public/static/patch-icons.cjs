const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

const helpers = `
function getAircraftClass(acType, altFt, speedKt) {
    if (!acType) {
        if ((altFt != null && altFt < 3000) || (speedKt != null && speedKt < 120 && altFt < 5000)) return 'helo';
        return 'air';
    }
    const t = acType.toUpperCase();
    if (t.match(/^(R44|R66|H60|UH6|AH6|AS3|EC1|B06|B40|A10|AW1|MD5|S76|S92)/)) return 'helo';
    if (t.match(/^(C1|C2|P2|PA|SR|BE|PC|TBM|M20|DA)/)) return 'small';
    return 'air';
}

function getAircraftIcon(cls) {
    if (cls === 'helo') return '🚁';
    if (cls === 'small') return '🛩️';
    return '✈️';
}

function fetchAircraft() {`;

s = s.replace(/function fetchAircraft\(\) \{/, helpers);

const fetchAircraftRegex = /const isHelo = \(a\.altFt != null && a\.altFt < 3000\) \|\| \(a\.speedKt != null && a\.speedKt < 120 && a\.altFt < 5000\);\s*const icon  = isHelo \? '[^']+' : '[^']+';\s*const altStr[^;]+;\s*const typeStr[^;]+;\s*const call[^;]+;\s*const label[^;]+;\s*const cls   = isHelo \? 'traffic-label traffic-label-helo' : 'traffic-label traffic-label-air';/;

const fetchAircraftReplacement = `
            const acCls = getAircraftClass(a.acType, a.altFt, a.speedKt);
            const icon  = getAircraftIcon(acCls);
            const altStr  = a.altFt != null ? (a.altFt > 18000 ? 'FL' + Math.round(a.altFt/100) : Math.round(a.altFt) + 'ft') : '';
            const typeStr = a.acType || '';
            const call = a.callsign || a.icao24 || 'UNK';
            const label = \`\${icon} \${call} \${typeStr} \${altStr}\`.trim();
            const cls   = acCls === 'helo' ? 'traffic-label traffic-label-helo' : (acCls === 'small' ? 'traffic-label traffic-label-small' : 'traffic-label traffic-label-air');
`.trim();

s = s.replace(fetchAircraftRegex, fetchAircraftReplacement);

const getAviationRegex = /const isHelo = \(a\.altFt != null && a\.altFt < 3000\) \|\| \(a\.speedKt != null && a\.speedKt < 120 && a\.altFt < 5000\);\s*const alt    = a\.altFt  != null \? `\$\{Math\.round\(a\.altFt \/ 100\) \* 100\}ft` : '--';\s*const spd    = a\.speedKt != null \? `\$\{a\.speedKt\} kts` : '--';\s*const route  = \(a\.origin && a\.dest\)\s*\?\s*`\$\{a\.origin\} [^`]+ `\$\{a\.dest\}`\s*:\s*a\.registration\s*\?\s*`\$\{a\.registration\}\$\{a\.acType \? ' [^']+' \+ a\.acType : ''\}`\s*:\s*\(a\.acType \|\| a\.icao24 \|\| '[^']+'\);\s*return \{ call: a\.callsign, type: isHelo \? '[^']+' : '[^']+',/;

const getAviationReplacement = `
          const acCls = getAircraftClass(a.acType, a.altFt, a.speedKt);
          const icon  = getAircraftIcon(acCls);
          const alt    = a.altFt  != null ? \`\${Math.round(a.altFt / 100) * 100}ft\` : '--';
          const spd    = a.speedKt != null ? \`\${a.speedKt} kts\` : '--';
          const route  = (a.origin && a.dest)
              ? \`\${a.origin} → \${a.dest}\`
              : a.registration
                  ? \`\${a.registration}\${a.acType ? ' • ' + a.acType : ''}\`
                  : (a.acType || a.icao24 || '---');
          return { call: a.callsign, type: icon, acCls: acCls,
`.trim();

s = s.replace(getAviationRegex, getAviationReplacement);

const renderAviationRegex = /const isHelo = item\.type === '[^']+';\s*const color  = isHelo \? '#ffd32a' : '#10ac84';/;
const renderAviationReplacement = `
    const color = item.acCls === 'helo' ? '#ffd32a' : (item.acCls === 'small' ? '#74b9ff' : '#10ac84');
`.trim();
s = s.replace(renderAviationRegex, renderAviationReplacement);

fs.writeFileSync('script.js', s);

let css = fs.readFileSync('style.css', 'utf8');
css += `\n.traffic-label-small { color: #74b9ff; }\n`;
fs.writeFileSync('style.css', css);

console.log('patched icons');
