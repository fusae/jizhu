const { copyFileSync, mkdirSync, readdirSync } = require('fs');
const { join } = require('path');

const sourceDir = join(__dirname, '..', 'src', 'renderer');
const targetDir = join(__dirname, '..', 'dist', 'renderer');

mkdirSync(targetDir, { recursive: true });

for (const fileName of readdirSync(sourceDir)) {
  if (fileName.endsWith('.html')) {
    copyFileSync(join(sourceDir, fileName), join(targetDir, fileName));
  }
}
