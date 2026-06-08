const https = require('https');

https.get('https://api.open-meteo.com/v1/elevation?latitude=21.2&longitude=-157.9', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log(data));
});
