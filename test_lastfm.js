const https = require('https');
const API_KEY = 'ac09a781b56b0af27edd7961a6b67d8b';
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}
async function test() {
  console.log("1. Testing tag.gettoptracks for 'tamil sad'");
  const tagRes = await fetchUrl(https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=tamil+sad&api_key=&format=json&limit=5);
  console.log("Tag 'tamil sad':", tagRes?.tracks?.track?.map(t => t.name) || "None");
  console.log("\n2. Testing track.search for 'tamil sad'");
  const searchRes = await fetchUrl(https://ws.audioscrobbler.com/2.0/?method=track.search&track=tamil+sad&api_key=&format=json&limit=5);
  console.log("Search 'tamil sad':", searchRes?.results?.trackmatches?.track?.map(t => t.name) || "None");
}
test();
