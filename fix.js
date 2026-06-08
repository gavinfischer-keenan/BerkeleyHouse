const fs = require('fs');
let text = fs.readFileSync('artifacts/honolulu/public/static/script.js', 'utf8');

const newJs = `function renderBottomTrafficItem(item) {
    const raw = item.raw || {};
    const imgUrl = raw.image_url;
    const inHarbor = isInHarbor(raw.lat, raw.lng);
    const showImage = imgUrl && !inHarbor;
    const firstSeen = raw.first_seen || Date.now();
    
    let imgHtml = '';
    if (showImage) {
        imgHtml = \`<img src="\${imgUrl}" class="btm-hud-img">\`;
    }

    let titleBadge = '';
    if ((Date.now() - firstSeen) > 3 * 24 * 60 * 60 * 1000 && !imgUrl) {
        titleBadge = \`<span class="pic-wanted">PIC WANTED</span>\`;
    }

    const pl = showImage ? '65px' : '8px';
    return \`<div class="btm-hud-item" style="border-left-color:\${item.color}; padding-left: \${pl} !important;">
        \${imgHtml}
        <div class="btm-hud-title" style="color:\${item.color}">\${item.icon} \${item.name}\${titleBadge}</div>
        <div class="btm-hud-sub">\${item.sub}</div>
        <div class="btm-hud-spd">\${item.detail}</div>
    </div>\`;
}`;

text = text.replace(/function renderBottomTrafficItem\(item\)\s*\{[\s\S]*?<\/div>\`;\s*\}/, newJs);
fs.writeFileSync('artifacts/honolulu/public/static/script.js', text);
console.log('Fixed renderBottomTrafficItem');

