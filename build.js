const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

async function main() {
  const distPath = path.join(__dirname, 'dist');
  if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, { recursive: true, force: true });
  }
  fs.mkdirSync(distPath);

  // Handle JS/TS bundling
  try {
    await esbuild.build({
      entryPoints: ['index.tsx'],
      bundle: true,
      outfile: 'dist/index.js',
      minify: true,
      sourcemap: false,
      target: 'es2020',
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
      },
      define: {
        'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
      },
    });
    console.log('JavaScript bundled successfully.');
  } catch (err) {
    console.error('Error bundling JavaScript:', err);
    process.exit(1);
  }

  // Handle HTML
  let html = fs.readFileSync('index.html', 'utf-8');
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/s, '');
  html = html.replace('<script type="module" src="index.tsx"></script>', '<script src="./index.js" defer></script>');
  fs.writeFileSync(path.join(distPath, 'index.html'), html);
  console.log('HTML processed successfully.');

  console.log('Build finished.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});