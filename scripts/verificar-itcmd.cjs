// Confere os fragmentos editáveis contra o artefato Netlify sem reconstruir o Hub.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const html = read(path.join(root, 'index.html'));
for (const nome of ['motor.js', 'ui.js', 'corpo.html']) {
  let fonte = read(path.join(root, 'frontend/src/itcmd', nome));
  if (nome === 'corpo.html') fonte = fonte.replace(/<header class="topo">[\s\S]*?<\/header>\s*/, '').replace(/<p class="rodape">[\s\S]*?<\/p>\s*/, '');
  if (html.split(fonte.trim()).length !== 2) throw new Error(nome + ' ausente, divergente ou duplicado no index.html');
  console.log(nome + ': corresponde exatamente ao trecho publicado');
}
