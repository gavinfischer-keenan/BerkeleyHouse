const fs = require('fs');

const code = fs.readFileSync('script.js', 'utf8');

// Mock DOM
global.window = { addEventListener: (e, cb) => { if(e==='load') cb(); } };
global.document = {
    getElementById: (id) => ({
        style: {},
        classList: { remove: ()=>{}, add: ()=>{}, toggle: ()=>{} },
        appendChild: () => {},
        innerHTML: '',
        innerText: ''
    }),
    createElement: () => ({ style: {} })
};
global.L = {
    map: () => ({ fitBounds: function(){return this;}, dragging: {disable:()=>{}}, touchZoom: {disable:()=>{}}, doubleClickZoom: {disable:()=>{}}, scrollWheelZoom: {disable:()=>{}}, boxZoom: {disable:()=>{}}, keyboard: {disable:()=>{}},
        createPane: () => {},
        getPane: () => ({ style: {} }),
        addLayer: () => {},
        removeLayer: () => {},
        flyTo: () => {},
        flyToBounds: () => {},
        setMaxBounds: () => {},
        setMinZoom: () => {}, fitBounds: () => {},
        hasLayer: () => false, fitBounds: () => {}, dragging: { disable: () => {} },
        on: () => {}
    }),
    tileLayer: { wms: () => ({ addTo: () => ({ setZIndex: () => {} }) }) },
    layerGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
    featureGroup: () => ({ addTo: () => {}, clearLayers: () => {} }),
    marker: () => ({ addTo: () => {}, bindPopup: () => {} }),
    divIcon: () => ({}),
    polyline: () => ({ addTo: () => {} }),
    latLng: () => ({ toBounds: () => {} }),
    latLngBounds: () => ({ contains: () => true })
};
global.fetch = async () => ({ ok: true, json: async () => ({}) });
global.setInterval = () => {};
global.setTimeout = () => {};
global.clearTimeout = () => {};
global.Promise = {
    all: () => ({ finally: (cb) => { console.log('Promise.all finally executed!'); cb(); } })
};

try {
    eval(code);
    console.log("EVAL SUCCESSFUL");
} catch (e) {
    console.error("EVAL ERROR:", e);
}




