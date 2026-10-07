'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = require('./motor.js');
const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
const end = html.indexOf('/* ============ Interface — Calculadora ITCMD/SE');
const start = html.lastIndexOf('/* ===', html.indexOf('Motor de cálculo — ITCMD/SE'));
const context = {module: {exports: {}}};
vm.runInNewContext(html.slice(start, end), context);
const opts = {ufp: 87.19, hoje: '2026-10-07'};
function falecido(extra = {}) {
  return {nome:'Espólio sintético', obito:'2025-01-01', estadoCivil:'casado', regime:'parcial',
    conjuge:{nome:'Meeira sintética'}, filhosComuns:'sim', multaAtraso:true,
    descendentes:[{uid:'f1',nome:'Filho sintético',condicao:'vivo'}],
    bens:[{descricao:'Bem fictício',tipo:'imovel_urbano',valor:1000000,natureza:'comum',fracao:100}],
    dividas:0,...extra};
}
for (const [label, M] of [['fonte',source],['publicado',context.module.exports]]) {
  test(label + ': ajuste manual zera somente a multa e é reversível', () => {
    const f = falecido();
    const normal = M.inventario(f, opts), manual = M.inventario(f, {...opts,desconsiderarMulta:true});
    assert.ok(normal.itc.total > 0);
    assert.ok(normal.itc.totalMulta > 0);
    assert.equal(manual.itc.total, normal.itc.total);
    assert.equal(manual.itc.totalMulta, 0);
    assert.equal(manual.itc.totalGeral, normal.itc.total);
    assert.equal(manual.itc.multaCabivel, false);
    assert.deepEqual(manual.itc.linhas.map(x=>x.imposto),normal.itc.linhas.map(x=>x.imposto));
    assert.ok(manual.itc.linhas.every(x=>x.multa===0));
    assert.equal(JSON.stringify(manual.pat),JSON.stringify(normal.pat));
    assert.equal(JSON.stringify(manual.suc),JSON.stringify(normal.suc));
    assert.equal(JSON.stringify(M.inventario(f,{...opts,desconsiderarMulta:false})),JSON.stringify(normal));
  });
  test(label + ': não aplica multa em prazo nem desfaz opção individual', () => {
    for(const f of [falecido({obito:'2026-10-01'}), falecido({multaAtraso:false})]) {
      assert.equal(M.inventario(f,opts).itc.totalMulta,0);
      assert.equal(M.inventario(f,{...opts,desconsiderarMulta:true}).itc.totalMulta,0);
    }
  });
  test(label + ': cumulativo aplica ajuste nos dois inventários', () => {
    const f = falecido(), g = falecido({nome:'Meeira sintética',estadoCivil:'solteiro',obito:'2025-06-01',bens:[]});
    const normal = M.cumulativo(f,g,opts), manual=M.cumulativo(f,g,{...opts,desconsiderarMulta:true});
    for(const k of ['inv1','inv2']){
      assert.ok(normal[k].itc.totalMulta>0);
      assert.equal(manual[k].itc.totalMulta,0);
      assert.equal(manual[k].itc.total,normal[k].itc.total);
    }
  });
  test(label + ': opção permanece depois de serializar os dados salvos', () => {
    const estado = JSON.parse(JSON.stringify({inv:[falecido()],desconsiderarMulta:true,motivoMulta:'Conferência pendente'}));
    assert.equal(M.inventario(estado.inv[0],{...opts,desconsiderarMulta:estado.desconsiderarMulta}).itc.totalMulta,0);
    assert.equal(estado.motivoMulta,'Conferência pendente');
  });
  test(label + ': doação não muda com a opção de multa de inventário', () => {
    const d = {doadores:[{nome:'Doador fictício'}],donatarios:[{nome:'Donatário fictício'}],bens:[{valor:100000,tipo:'imovel_urbano',fracao:100}]};
    assert.equal(JSON.stringify(M.doacao(d,opts)),JSON.stringify(M.doacao(d,{...opts,desconsiderarMulta:true})));
  });
}
