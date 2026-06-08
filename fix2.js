const fs = require('fs');

const path = 'artifacts/honolulu/public/static/script.js';
let text = fs.readFileSync(path, 'utf8');

const waikikiOld = `function renderWaikikiTrafficCard(item) {
    const raw = item.raw || {};
    const imgUrl = raw.image_url;
    const visits = raw.visit_count || 1;
    
    let imgHtml = '';
    if (imgUrl) {
        imgHtml = \`<img src="\${imgUrl}" class="traffic-image">\`;
    } else {
        imgHtml = \`<div class="traffic-image-placeholder">\${item.icon}</div>\`;
    }

    return \`
    <div class="traffic-card" style="border-left-color:\${item.color};">
        <div class="traffic-card-left">\${imgHtml}</div>
        <div class="traffic-card-right">
            <div class="tc-title">\${item.name}</div>
            <div class="tc-sub">\${item.sub}</div>
            <div class="tc-detail">\${item.detail.replace(/\\n/g, '<br>')}</div>
            <div class="tc-visits">Observed Visits: \${visits}</div>
        </div>
    </div>\`;
}`;

const waikikiNew = `function isInHarbor(lat, lng) {
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
        imgHtml = \`<img src="\${imgUrl}" class="traffic-image">\`;
    } else {
        imgHtml = \`<div class="traffic-image-placeholder">\${item.icon}</div>\`;
    }

    let titleBadge = '';
    if ((Date.now() - firstSeen) > 3 * 24 * 60 * 60 * 1000 && !imgUrl) {
        titleBadge = \`<span class="pic-wanted">PIC WANTED</span>\`;
    }

    return \`
    <div class="traffic-card" style="border-left-color:\${item.color};">
        <div class="traffic-card-left">\${imgHtml}</div>
        <div class="traffic-card-right">
            <div class="tc-title">\${item.name}\${titleBadge}</div>
            <div class="tc-sub">\${item.sub}</div>
            <div class="tc-detail">\${item.detail.replace(/\\n/g, '<br>')}</div>
            <div class="tc-visits">Observed Visits: \${visits}</div>
        </div>
    </div>\`;
}`;

if (text.includes(waikikiOld)) {
    text = text.replace(waikikiOld, waikikiNew);
    console.log("Replaced renderWaikikiTrafficCard successfully.");
} else {
    console.error("Could not find exact text for renderWaikikiTrafficCard");
}

fs.writeFileSync(path, text);
