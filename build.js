const fs = require('fs');
const babel = require('@babel/core');

const html = fs.readFileSync('index.html', 'utf8');

// バックアップ
fs.writeFileSync('index.html.bak', html);
console.log('Backup saved to index.html.bak');

// <script type="text/babel"> の中身を抽出
const match = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!match) {
  console.error('text/babel block not found');
  process.exit(1);
}

const jsx = match[1];
console.log(`JSX code: ${jsx.length} chars`);

// Babel compile
const result = babel.transformSync(jsx, {
  presets: ['@babel/preset-react'],
  plugins: [],
});
console.log(`Compiled JS: ${result.code.length} chars`);

let output = html;

// Replace text/babel with compiled JS
output = output.replace(
  `<script type="text/babel">${match[1]}</script>`,
  `<script>${result.code}</script>`
);

// Remove Babel preload
output = output.replace(/<link rel="preload"[^>]*babel[^>]*>\n?/g, '');

// Remove Babel script tag
output = output.replace(/<script src="[^"]*babel[^"]*"><\/script>\n?/g, '');

fs.writeFileSync('index.html', output);
console.log('Build complete - Babel removed, JSX pre-compiled');
