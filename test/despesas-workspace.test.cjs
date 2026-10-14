'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
test('workspace selection never silently falls back from an unknown or Bravo destination',async()=>{
  const {resolveWorkspace}=await import('../controle-despesas/workspace.mjs');
  assert.equal(resolveWorkspace().id,'cn2o');assert.equal(resolveWorkspace('?workspace=bravo').api,'/hub/despesas-bravo/');
  assert.notEqual(resolveWorkspace().database,resolveWorkspace('?workspace=bravo').database);
  assert.throws(()=>resolveWorkspace('?workspace=other'));
});
test('Bravo requests use only their own API and reject a CN2O response',()=>{
  const url=pathToFileURL(path.join(__dirname,'../controle-despesas/cloud-client.mjs')).href;
  const code=`
    import assert from 'node:assert/strict';
    globalThis.location={search:'?workspace=bravo'};
    globalThis.sessionStorage={getItem:()=>''};
    globalThis.document={getElementById:()=>({})};
    globalThis.window={parent:{document:{documentElement:{dataset:{}}}}};
    globalThis.MutationObserver=class{observe(){}};
    const calls=[];let wrong=false;
    globalThis.fetch=async url=>{calls.push(url);return new Response(JSON.stringify({workspace:wrong?'cn2o':'bravo',user:{login:'cesar.bravo'},documents:[],entries:[]}));};
    const {cloud}=await import(${JSON.stringify(url)});
    await cloud.refresh();assert(calls.every(u=>u.includes('/hub/despesas-bravo/')));
    wrong=true;await assert.rejects(cloud.refresh(),/controle de destino/);
    const {checkManifest}=await import(new URL('./batch-import.mjs',${JSON.stringify(url)}));
    const manifest={format:'cn2o-expenses-1',documents:[],entries:[]};
    assert.throws(()=>checkManifest(manifest));assert.throws(()=>checkManifest({...manifest,workspace:'cn2o'}));assert.equal(checkManifest({...manifest,workspace:'bravo'}).workspace,'bravo');
  `;
  const r=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('Bravo exports identify company accounting without the notary fiscal-limit notice',async()=>{
  const {reportHTML,standaloneReport,detailCSV}=await import('../controle-despesas/expense-exports.mjs');
  const filters={from:'2026-10-01',to:'2026-10-31',allEntries:[]};
  const report=reportHTML([],[],filters,{company:'Bravo Patrimonial',bravo:true});
  assert(report.includes('Bravo Patrimonial'));assert(report.includes('separada do Livro-caixa do tabelião'));
  assert(!report.includes('Antes do limite fiscal'));assert(standaloneReport(report,{company:'Bravo Patrimonial'}).includes('<title>Controle de Despesas · Bravo Patrimonial</title>'));
  assert(detailCSV([],[],{bravo:true}).includes('contabilidade da Bravo'));
});
