const fs = require('fs');
const path = require('path');

const paths = [
  './.env',
  './sentinel-agent/.env'
];

paths.forEach(p => {
  const abs = path.resolve(p);
  if (fs.existsSync(abs)) {
    console.log(`--- ${abs} ---`);
    console.log(fs.readFileSync(abs, 'utf8'));
  } else {
    console.log(`NOT FOUND: ${abs}`);
  }
});
