const fs = require('fs');

const path = 'artifacts/honolulu/public/static/script.js';
let text = fs.readFileSync(path, 'utf8');

const newWaikiki = `function isInHarbor(lat, lng) {
    if (!lat || !lng) return false;
    // Box for Ala Wai Harbor
    return (lat >= 21.282 && lat <= 21.288 && lng >= -157.844 && lng <= -157.838);
}

function renderWaikikiTrafficCard(item) {
    const raw = item.raw || {};
    const imgUrl = raw.image_url;
    const visits = raw.visit_count || 1;
    const inHarbor = isInHarbor(raw.lat, raw.lng);
    const showImage = imgUrl && !inHarbor;
    const firstSeen = raw.first_seen || Date.now();
    
    let imgHtml = '';
    if (showImage) {
        imgHtml = \\\`<img src="\${imgUrl}" class="traffic-image">\\\`;
    } else {
        imgHtml = \\\`<div class="traffic-image-placeholder">\${item.icon}</div>\\\`;
    }

    let titleBadge = '';
    if ((Date.now() - firstSeen) > 3 * 24 * 60 * 60 * 1000 && !imgUrl) {
        titleBadge = \\\`<span class="pic-wanted">PIC WANTED</span>\\\`;
    }

    return \\\`
    <div class="traffic-card" style="border-left-color:\${item.color};">
        <div class="traffic-card-left">\${imgHtml}</div>
        <div class="traffic-card-right">
            <div class="tc-title">\${item.name}\${titleBadge}</div>
            <div class="tc-sub">\${item.sub}</div>
            <div class="tc-detail">\${item.detail.replace(/\\n/g, '<br>')}</div>
            <div class="tc-visits">Observed Visits: \${visits}</div>
        </div>
    </div>\\\`;
}`;

text = text.replace(/function renderWaikikiTrafficCard[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>\`;\r?\n\}/, newWaikiki);

const newBtm = `function renderBottomTrafficItem(item) {
    const raw = item.raw || {};
    const imgUrl = raw.image_url;
    const inHarbor = isInHarbor(raw.lat, raw.lng);
    const showImage = imgUrl && !inHarbor;
    const firstSeen = raw.first_seen || Date.now();
    
    let imgHtml = '';
    if (showImage) {
        imgHtml = \\\`<img src="\${imgUrl}" class="btm-hud-img">\\\`;
    }

    let titleBadge = '';
    if ((Date.now() - firstSeen) > 3 * 24 * 60 * 60 * 1000 && !imgUrl) {
        titleBadge = \\\`<span class="pic-wanted">PIC WANTED</span>\\\`;
    }

    const pl = showImage ? '65px' : '8px';
    return \\\`<div class="btm-hud-item" style="border-left-color:\${item.color}; padding-left: \${pl} !important;">
        \${imgHtml}
        <div class="btm-hud-title" style="color:\${item.color}">\${item.icon} \${item.name}\${titleBadge}</div>
        <div class="btm-hud-sub">\${item.sub}</div>
        <div class="btm-hud-spd">\${item.detail}</div>
    </div>\\\`;
}`;

text = text.replace(/function renderBottomTrafficItem[\s\S]*?<\/div>\`;\r?\n\}/, newBtm);

fs.writeFileSync(path, text.replace(/\\\\`/g, '`'));
console.log("Replaced successfully!");
