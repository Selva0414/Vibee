const formData = new FormData();
formData.append('message', 'Return ONLY a JSON Array containing 10 love song names. Example format: ["Song 1", "Song 2"]');

fetch('https://ai-agent-v01.onrender.com/chat', {
  method: 'POST',
  body: formData
})
.then(res => res.text())
.then(console.log)
.catch(console.error);
