const fs = require('fs');
let ok = true;
try {
  const js = fs.readFileSync('element/candidate-management.js', 'utf8');
  new Function(js.replace(/import\s[\s\S]*?from\s*['"][^'"]*['"]/g, '//'));
  console.log('JS: OK');
} catch (e) { console.error('JS Error:', e.message); ok = false; }
try {
  const h = fs.readFileSync('data/candidate-management.html', 'utf8');
  const o = (h.match(/<div[\s>]/g)||[]).length, c = (h.match(/<\/div>/g)||[]).length;
  console.log('HTML divs:', o, '/', c, o===c?'OK':'MISMATCH');
} catch (e) { console.error('HTML Error:', e.message); ok = false; }
process.exit(ok?0:1);
