const fs = require('fs');
const path = require('path');

const files = [
  'src/routes/webhooks/slack.ts'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  // Replace the conflict block with just the 'upstream' part
  const conflictRegex = /<<<<<<< Updated upstream[\r\n]+([\s\S]*?)=======[\r\n]+[\s\S]*?>>>>>>> Stashed changes[\r\n]*/g;
  
  newContent = newContent.replace(conflictRegex, '$1');
  
  fs.writeFileSync(filePath, newContent);
  console.log('Fixed ' + file);
});
