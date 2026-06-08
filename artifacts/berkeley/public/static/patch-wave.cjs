const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

const replacement = `
var waveLayerOahu = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/swan_oahu/SWAN_Oahu_Regional_Wave_Model_best.ncd', {
    layers: 'shgt',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '0,2.5',
    styles: 'boxfill/rainbow'
});
var waveLayerMaui = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/swan_maui/SWAN_Maui_Regional_Wave_Model_best.ncd', {
    layers: 'shgt',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '0,2.5',
    styles: 'boxfill/rainbow'
});
var waveLayerKauai = L.tileLayer.wms('https://pae-paha.pacioos.hawaii.edu/thredds/wms/swan_kauai/SWAN_Kauai_Regional_Wave_Model_best.ncd', {
    layers: 'shgt',
    format: 'image/png',
    transparent: true,
    opacity: 0.65,
    colorscalerange: '0,2.5',
    styles: 'boxfill/rainbow'
});
var waveLayer = L.layerGroup([waveLayerOahu, waveLayerMaui, waveLayerKauai]);
`.trim();

const targetRegex = /var waveLayer\s*=\s*L\.tileLayer\.wms\('https:\/\/pae-paha\.pacioos\.hawaii\.edu\/thredds\/wms\/swan_oahu\/SWAN_Oahu_Regional_Wave_Model_best\.ncd', \{\s*layers: 'shgt',\s*format: 'image\/png',\s*transparent: true,\s*opacity: 0\.65,\s*colorscalerange: '0,2\.5',\s*styles: 'boxfill\/rainbow'\s*\}\);/;

s = s.replace(targetRegex, replacement);

fs.writeFileSync('script.js', s);
console.log('patched');
