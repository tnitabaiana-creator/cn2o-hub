/* Relatório privado: dados apenas na sessão; documento executado em origem opaca. */
(function (root) {
  'use strict';
  const ROTA = '/hub/gestao/produtividade-escrituras';
  const ROTA_FINANCEIRO = '/hub/relatorios/produtividade';
  const PROJECAO = 'cn2o-financeiro-liquido-v1';
  const CHAVE = 'CN2O_MONTHS_V2';
  const LIMITE = 2 * 1024 * 1024;
  const SANDBOX = 'allow-scripts allow-downloads allow-modals allow-popups allow-popups-to-escape-sandbox';
  // Apenas adaptação de largura; tabelas mantêm suas colunas e rolam dentro do painel.
  const RESPONSIVO = '<style id="cn2o-produtividade-responsivo">@media(max-width:600px){' +
    'html,body{max-width:100%}.wrap{padding-left:16px;padding-right:16px;min-width:0}' +
    '.wrap.head-in{padding:28px 16px}.wrap.monthbar-in{padding:12px 16px}.monthbar{position:static}' +
    '.head-in>div,.head-actions,.mb-grp,.comp-box,.grid-3>div,.kpi,.anrow>div,.perfil,.cx-box{min-width:0;max-width:100%}' +
    '.head-in h1{font-size:26px;line-height:1.17;overflow-wrap:anywhere}.eyebrow{letter-spacing:.13em;font-size:10px;overflow-wrap:anywhere}' +
    '.head-actions{gap:8px}.head-actions button{max-width:100%;white-space:normal}' +
    '.mb-grp{width:100%;flex-wrap:wrap;gap:8px}.tabs,.subtabs{max-width:100%;overflow-x:auto}.tabs{width:100%}' +
    '.comp-box{width:100%}.comp-select{min-width:0;max-width:100%;flex:1}.badge-mode{max-width:100%;overflow-wrap:anywhere}' +
    '.grid-3,.an3 .anrow,.anrow,.cards{grid-template-columns:minmax(0,1fr)}.kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}' +
    '.kpi{padding:12px 10px}.kpi .val{font-size:19px;overflow-wrap:anywhere}.kpi .lbl,.kpi .det{overflow-wrap:anywhere}' +
    '.panel{min-width:0;max-width:100%;padding:14px}.panel.tight{padding:0;overflow-x:auto}.cx{flex-direction:column}' +
    '.cx-box+.cx-box{border-left:0;border-top:1px dashed var(--line)}.cx-box,.perfil{padding:18px}' +
    '.fn{grid-template-columns:minmax(0,1fr) auto;gap:8px}.fn-t{grid-column:1;grid-row:1}.fn-v{grid-column:2;grid-row:1;font-size:14px}.fn-b{grid-column:1/-1;grid-row:2}' +
    '.tools{max-width:100%;flex-wrap:wrap}.sec-head h2{min-width:0;overflow-wrap:anywhere}.tblock-head h2{font-size:24px}' +
    '.filtro{min-width:0}.filtro input,.filtro select{min-width:0!important;max-width:100%}.filtro input{width:100%}' +
    '.obs{padding:24px 18px}.anrow{padding:16px}.modal-bg{padding:12px}.modal-head,.modal-body{padding:18px}' +
    '.modal-head{gap:12px}.modal-head h3{min-width:0;font-size:18px}.modal-actions,.manage-item{flex-wrap:wrap;gap:10px}' +
    '.toast{left:12px;right:12px;bottom:12px;max-width:calc(100% - 24px);padding:12px}.toast svg{flex-shrink:0}' +
    'footer{overflow-wrap:anywhere}.btn-primary svg,.btn-download svg{flex-shrink:0}' +
    '}</style>';
  function jsonSeguro(valor) {
    return JSON.stringify(valor).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  }
  function validarMeses(valor) {
    if (valor === null) return null;
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('Formato de meses inválido.');
    const texto = JSON.stringify(valor);
    if (texto.length > LIMITE) throw new Error('Os meses ultrapassam o limite de armazenamento.');
    const copia = JSON.parse(texto);
    function conferir(obj, nivel) {
      if (nivel > 20) throw new Error('Estrutura dos meses inválida.');
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function (k) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') throw new Error('Estrutura dos meses inválida.');
        conferir(obj[k], nivel + 1);
      });
    }
    conferir(copia, 0);
    return copia;
  }
  function projetarFinanceiro(resposta) {
    const r = validarMeses(resposta);
    if (!r || !Array.isArray(r.meses) || !r.meses.length) throw new Error('Base financeira canônica indisponível.');
    const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const valor = n => typeof n === 'number' && Number.isFinite(n);
    const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
    const meses = {}, canonicos = [];
    r.meses.slice().sort((a,b) => a.ano-b.ano || a.mes-b.mes).forEach(row => {
      const d = row.dados_liquidos, bruto = row.dados, f = row.financeiro;
      if (!Number.isInteger(row.ano) || row.ano < 1900 || row.ano > 9999 || !Number.isInteger(row.mes) || row.mes < 1 || row.mes > 12 ||
          !d || !bruto || !f || !valor(d.total) || !valor(bruto.total) || !valor(f.bruto) || !valor(f.repasses) || !valor(f.receita_liquida) ||
          f.percentual_repasses !== 29.5694 || typeof f.criterio !== 'string' || !f.criterio || d.base_receita !== 'liquida_apos_repasses' || d.versao_financeira !== 'receita-liquida-2026-10-v1' ||
          Math.abs(f.bruto - bruto.total) > .011 || Math.abs(d.total - f.receita_liquida) > .011 || Math.abs(f.bruto-f.repasses-f.receita_liquida) > .011 ||
          !Number.isSafeInteger(d.atos) || d.atos < 0 || d.atos !== bruto.atos || !Number.isSafeInteger(d.diasUteis) || d.diasUteis < 1 ||
          !Array.isArray(d.pessoas) || !Array.isArray(d.pgto) || (d.faixas != null && !Array.isArray(d.faixas))) throw new Error('Contrato financeiro canônico inválido.');
      const key = row.ano + '-' + String(row.mes).padStart(2,'0');
      if (meses[key]) throw new Error('Competência financeira repetida.');
      const pessoas = new Set();
      const users = d.pessoas.map(p => {
        if (!p || typeof p.id !== 'string' || !p.id.trim() || (p.nome != null && typeof p.nome !== 'string') || pessoas.has(p.id) || !valor(p.total) || !Number.isSafeInteger(p.atos) || p.atos < 0 ||
            (p.mediana != null && !valor(p.mediana)) || (p.max != null && !valor(p.max))) throw new Error('Pessoa financeira inválida.');
        pessoas.add(p.id);
        return { nome:esc(p.nome && p.nome.trim() ? p.nome : p.id),login:esc(p.id),atos:p.atos,total:p.total,total_bruto:p.total_bruto,
          ticket:p.atos ? round(p.total/p.atos) : 0,mediana:p.mediana,max:p.max,
          shareR:d.total ? p.total/d.total*100 : 0,shareA:d.atos ? p.atos/d.atos*100 : 0,
          indice:d.total && p.atos ? (p.total/d.total)/(p.atos/d.atos) : 0,
          mediaDia:round(p.total/d.diasUteis),atosDia:p.atos/d.diasUteis,diasAtivos:p.dias };
      }).sort((a,b) => b.total-a.total);
      const notas = Array.isArray(f.notas) ? f.notas.slice() : [];
      // A fonte pode ter grupos parciais. Mantemos o total mensal e o grupo tal como
      // recebido, sem criar uma pessoa residual nem ratear a diferença não comprovada.
      if (users.reduce((n,p) => n+p.atos,0) !== d.atos) notas.push({grupo:'pessoas',codigo:'QUANTIDADES_NAO_RECONCILIADAS',mensagem:'A quantidade atribuída aos operadores financeiros não coincide com os lançamentos do mês. O total mensal e as quantidades da fonte foram preservados, sem completar a diferença.'});
      if (Math.abs(users.reduce((n,p) => n+p.total,0)-d.total) > Math.max(.02,users.length*.011)) notas.push({grupo:'pessoas',codigo:'PESSOAS_NAO_RECONCILIADAS',mensagem:'A receita atribuída aos operadores financeiros não coincide com a receita mensal. Ambos os valores da fonte foram preservados; as participações podem não somar 100%.'});
      const serie = d.serie || {}, dias = Array.isArray(serie.dias) ? serie.dias.slice() : [], totalDia = Array.isArray(serie.total) ? serie.total.slice() : [];
      if (dias.length !== totalDia.length || totalDia.some(n => !valor(n)) || dias.some(s => !/^\d{4}-\d{2}-\d{2}$/.test(s) || s.slice(0,7)!==key || new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)) throw new Error('Série financeira inválida.');
      const porUsuarioDia = {}, dow = {};
      d.pessoas.forEach(p => {
        const a = serie.porPessoa && serie.porPessoa[p.id];
        if (a !== undefined && (!Array.isArray(a) || a.length!==dias.length || a.some(n=>!valor(n)))) throw new Error('Série individual inválida.');
        porUsuarioDia[esc(p.nome && p.nome.trim() ? p.nome : p.id)] = a ? a.slice() : [];
      });
      dias.forEach((dia,i) => { const dw = new Date(dia+'T12:00:00Z').getUTCDay(); if(dw>=1&&dw<=5){if(!dow[dw])dow[dw]=[];dow[dw].push(totalDia[i]);} });
      const seq = a => (a || []).map(x => { if(!valor(x.total)||!Number.isSafeInteger(x.qtd)||x.qtd<0)throw new Error('Distribuição monetária inválida.');return {...x,forma:x.forma==null?x.forma:esc(x.forma),faixa:x.faixa==null?x.faixa:esc(x.faixa)}; });
      const max = totalDia.length ? Math.max(...totalDia) : null, pos = totalDia.indexOf(max);
      meses[key] = {key,nome:nomes[row.mes-1],ano:String(row.ano),total:d.total,atos:d.atos,ticket:d.atos?round(d.total/d.atos):0,
        mediana:d.mediana,diasUteis:d.diasUteis,mediaDiaria:round(d.total/d.diasUteis),detalhe:'Fonte financeira canônica do Hub · valores líquidos',
        temData:dias.length>0,temFaixas:!!d.faixas?.length,users,pgto:seq(d.pgto),faixas:d.faixas==null?null:seq(d.faixas),
        melhorDia:pos<0?null:{dia:dias[pos],valor:max},dias:dias.map(s=>s.slice(8,10)+'/'+s.slice(5,7)),serieDiaria:totalDia,porUsuarioDia,
        dow:Object.keys(dow).map(k=>({dia:['','Segunda','Terça','Quarta','Quinta','Sexta'][k],media:round(dow[k].reduce((s,n)=>s+n,0)/dow[k].length)})),
        cascata:{bruto:f.bruto,ferd:f.repasses,emol:d.total,ir:0,disp:d.total},caixa:null,
        fonte:'Pesquisa de Produtividade do Extra Digital · base mensal do Hub · receita líquida após 29,5694% de repasses',
        financeiro:{...f,notas},projecao:PROJECAO};
      canonicos.push({ano:row.ano,mes:row.mes,dados:bruto,dados_liquidos:d,financeiro:f});
    });
    return {versao:PROJECAO,meses,canonicos};
  }
  function adaptador(config) {
    // Esta função é serializada para o iframe. Não referencia a sessão do Hub.
    'use strict';
    var chave = 'CN2O_MONTHS_V2';
    var atual = config.meses === null ? null : JSON.stringify(config.meses);
    function avisar() {
      parent.postMessage({ tipo: 'cn2o-produtividade-estado', canal: config.canal, chave: chave, valor: atual }, '*');
    }
    function informarPeriodo() {
      if (typeof M === 'undefined' || typeof CUR === 'undefined') return;
      var nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
      function periodo(m) {
        var mes = m && nomes.indexOf(String(m.nome || '').toLowerCase());
        return m && mes >= 0 && /^\d{4}$/.test(String(m.ano)) ? m.ano + '-' + String(mes + 1).padStart(2, '0') : '';
      }
      var mes = periodo(M[CUR]);
      parent.postMessage({ tipo: 'cn2o-produtividade-periodo', canal: config.canal, mes: mes || null, meses: Object.keys(M).map(function (k) { return periodo(M[k]); }).filter(Boolean) }, '*');
    }
    function depoisDoControle() { if (typeof setTimeout === 'function') setTimeout(informarPeriodo, 0); }
    document.addEventListener('DOMContentLoaded', informarPeriodo);
    document.addEventListener('change', depoisDoControle);
    var memoria = {
      getItem: function (k) { return k === chave ? atual : null; },
      setItem: function (k, valor) {
        if (k !== chave) return;
        if (config.financeiro) return; // Projeção líquida nunca volta ao endpoint de meses brutos.
        valor = String(valor);
        if (valor === atual) return;
        atual = valor; avisar();
      },
      removeItem: function (k) { if (k === chave) throw new Error('Use a opção Restaurar padrões do relatório para restaurar os meses.'); },
      clear: function () { this.removeItem(chave); },
      key: function (i) { return i === 0 && atual !== null ? chave : null; }
    };
    Object.defineProperty(memoria, 'length', { get: function () { return atual === null ? 0 : 1; } });
    Object.defineProperty(window, 'localStorage', { value: memoria, configurable: false });
    document.addEventListener('click', function (ev) {
      depoisDoControle();
      var botao = ev.target && ev.target.closest && ev.target.closest('button');
      if (botao && (botao.id === 'btnDownloadHtml' || botao.id === 'btnManageDownloadHtml')) {
        var ponte = document.getElementById('cn2o-produtividade-ponte');
        // O HTML exportado deve reabrir os meses atuais, nunca a cópia inicial da sessão.
        if (ponte) {
          var copia = { meses: atual === null ? null : JSON.parse(atual), canal: config.canal, financeiro: config.financeiro };
          var seguro = JSON.stringify(copia).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
          ponte.textContent = '(' + adaptador.toString() + ')(' + seguro + ');';
        }
      }
      var link = ev.target && ev.target.closest && ev.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (href.indexOf('blob:') === 0 && link.hasAttribute('download')) return;
      if (href.charAt(0) === '#') return;
      try {
        var url = new URL(href);
        if (url.protocol !== 'https:' || url.hostname !== 'trello.com') { ev.preventDefault(); return; }
        link.target = '_blank'; link.rel = 'noopener noreferrer';
      } catch (_) { ev.preventDefault(); }
    }, true);
  }
  // Serializada antes da primeira renderização do V3, sem acesso à sessão.
  function adequarFinanceiro(config) {
    'use strict';
    if (!config.financeiro || config.financeiro.versao !== 'cn2o-financeiro-liquido-v1') throw new Error('Projeção financeira indisponível.');
    M = JSON.parse(JSON.stringify(config.meses));
    var keys = Object.keys(M);
    if (!M[CUR]) CUR = keys[keys.length - 1];
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    var aviso = function () { if (typeof showToast === 'function') showToast('Financeiro somente leitura. Importe a Pesquisa de Produtividade na área financeira do Hub.'); };
    persistMonths = function () { aviso(); };
    handleFile = processCsvText = renderManageModal = function () { aviso(); };
    window.deleteMonth = function () { aviso(); };
    ['btnOpenImport','btnOpenManage','btnResetDefaults','btnConfirmImport'].forEach(function (id) {
      var el = document.getElementById(id); if (el) { el.disabled = true; el.hidden = true; el.onclick = aviso; }
    });
    ['fileCsv','dropZone'].forEach(function (id) { var el = document.getElementById(id); if(el){el.onchange=el.ondrop=el.onclick=aviso;} });
    ['modalImport','modalManage','s-casc','s-caixa'].forEach(function(id){var el=document.getElementById(id);if(el){el.hidden=true;el.classList.add('hidden');el.innerHTML='';}});
    cascata = caixa = function () {};
    var antigoComparador = getComparator;
    getComparator = function (m) { if (COMP_TARGET === 'auto' && Object.keys(M).indexOf(m.key) === 0) return null; return antigoComparador(m); };
    kpis = function (m, cmp) {
      var idx=Object.keys(M).indexOf(m.key), anterior=cmp&&cmp.mes || (idx>0?M[Object.keys(M)[idx-1]]:null);
      var variacao=anterior&&anterior.total>0?(m.total-anterior.total)/anterior.total*100:null;
      var cards=[['Receita líquida',fmtBRL(m.total),'Após 29,5694% de repasses · antes de despesas e IR'],['Lançamentos',num(m.atos),'Quantidade financeira; não é a contagem de escrituras'],['Média/dia útil',fmtBRL(m.mediaDiaria),m.diasUteis+' dias úteis na fonte'],['Variação com o mês',variacao===null?'—':pct(variacao),anterior?'Comparação com '+anterior.nome+'/'+anterior.ano:'Sem mês anterior disponível']];
      document.getElementById('kpis').innerHTML=cards.map(function(c,i){return '<div class="kpi '+(i===0?'hero':'')+'"><div class="lbl">'+esc(c[0])+'</div><div class="val">'+esc(c[1])+'</div><div class="det">'+esc(c[2])+'</div></div>';}).join('');
    };
    observacoes = function (m) {
      document.getElementById('obsList').innerHTML='<li><strong>Base financeira:</strong> Pesquisa de Produtividade importada no Hub para '+esc(m.nome)+'/'+esc(m.ano)+'.</li><li>Receita líquida de <strong>'+esc(fmtBRL(m.total))+'</strong>, após 29,5694% de repasses. Pessoas, médias, tickets, séries e comparações usam essa mesma base líquida.</li><li>Despesas e imposto de renda são tratados no Livro Caixa. Os valores desta visão não são resultado final após despesas.</li><li>Faixas são definidas pelo valor bruto do lançamento na fonte; os totais monetários das barras são líquidos.</li><li>Operador do lançamento financeiro não identifica automaticamente quem lavrou a escritura.</li>'+(m.financeiro.notas||[]).map(function(n){return '<li>'+esc(n.mensagem)+'</li>';}).join('');
    };
    function rotulo(s) {return typeof s==='string'?s.replace(/Faturamento bruto/gi,'Receita líquida').replace(/Receita bruta/gi,'Receita líquida').replace(/Emolumento bruto/gi,'Receita líquida'):s;}
    var antigoChart = mkChart;
    mkChart = function (id,cfg) {
      function ajustar(obj){if(!obj||typeof obj!=='object')return;Object.keys(obj).forEach(function(k){if(['label','text'].indexOf(k)>=0&&typeof obj[k]==='string')obj[k]=rotulo(obj[k]);else if(obj[k]&&typeof obj[k]==='object')ajustar(obj[k]);});}
      ajustar(cfg);return antigoChart(id,cfg);
    };
    function rotularDOM() {
      if(!document.createTreeWalker)return;
      var walker=document.createTreeWalker(document.body,4),node;
      while((node=walker.nextNode())){var tag=node.parentNode&&node.parentNode.tagName;if(tag!=='SCRIPT'&&tag!=='STYLE')node.nodeValue=rotulo(node.nodeValue);}
      var heading=document.getElementById('h-mes');if(heading)heading.textContent=M[CUR].nome+' de '+M[CUR].ano+' · lançamentos financeiros';
      var faixasTitulo=document.querySelector('#s-faixa h2'),faixasNota=document.querySelector('#s-faixa .sec-sub');
      if(faixasTitulo)faixasTitulo.textContent='Receita líquida por faixa do lançamento bruto';
      if(faixasNota)faixasNota.textContent='Faixas: valor bruto unitário da fonte. Barras: receita líquida após repasses. Linha: quantidade de lançamentos.';
    }
    var antigoRender=render;
    render=function(){antigoRender();rotularDOM();};
    var css=document.createElement('style');css.id='cn2o-financeiro-view-estilo';css.textContent='.kpis{grid-template-columns:repeat(4,minmax(0,1fr))}#s-casc,#s-caixa,#modalImport,#modalManage{display:none!important}@media(max-width:600px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.appendChild(css);
    document.getElementById('btnCsv').onclick=function(){
      var m=M[CUR],cmp=getComparator(m),head=['Base de receita','Versão financeira','Responsável pelo lançamento','Lançamentos','Receita líquida','Ticket líquido','Mediana líquida','Maior lançamento líquido','Média líquida por dia útil'];
      if(cmp)head.push('Receita líquida '+cmp.label,'Variação líquida percentual');
      var lines=[head];m.users.forEach(function(u){var p=cmp&&cmp.byName[u.nome],row=['liquida_apos_repasses','receita-liquida-2026-10-v1',u.nome,u.atos,u.total,u.ticket,u.mediana,u.max,u.mediaDia];if(cmp)row.push(p?p.total:'',p&&p.total?(u.total-p.total)/p.total*100:'');lines.push(row);});
      var text='\ufeff'+lines.map(function(row){return row.map(function(v){var s=v==null?'':typeof v==='number'?String(v).replace('.',','):String(v);if(typeof v==='string'&&/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}).join(';');}).join('\r\n');
      var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));a.download='CN2O_Receita_Liquida_'+CUR+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
    };
    // Exportação contém o snapshot bruto+líquido canônico e esta projeção versionada.
    // BASE_DATA histórico é removido somente da cópia de visualização/exportação.
    downloadDashboardHtml = function () {
      var full='<!DOCTYPE html>\n'+document.documentElement.outerHTML;
      full=full.replace(/\/\* --- INICIO_BASE_DATA --- \*\/[\s\S]*?\/\* --- FIM_BASE_DATA --- \*\//,'/* --- INICIO_BASE_DATA --- */\nconst BASE_DATA = {};\n/* --- FIM_BASE_DATA --- */');
      full=full.replace(/let CUR\s*=\s*['"][^'"]+['"];/,'let CUR = '+JSON.stringify(CUR)+';');
      var blob=new Blob([full],{type:'text/html;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='CN2O_Receita_Liquida_'+CUR+'_snapshot.html';a.click();setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
    };
    ['btnDownloadHtml','btnManageDownloadHtml'].forEach(function(id){var el=document.getElementById(id);if(el)el.onclick=downloadDashboardHtml;});
  }
  // Executada depois do script original. Esclarece o cruzamento sem recalcular o histórico.
  function esclarecerHistorico(financeiroAtual) {
    if (document.body && !document.getElementById('cn2o-aviso-exportacao-oficial')) {
      var aviso = document.createElement('p'); aviso.id = 'cn2o-aviso-exportacao-oficial';
      aviso.style.cssText = 'padding:14px 20px;margin:0;background:#631325;color:#fff;font:13px/1.6 sans-serif';
      aviso.textContent = financeiroAtual ? 'Financeiro líquido: snapshot da base mensal do Hub, somente leitura. Para atualizar a fonte, importe a Pesquisa de Produtividade na área financeira do Hub. Cartões Trello e senhas mantêm seus períodos históricos. A exportação não incorpora a contagem oficial de escrituras lavradas.' : 'Documento histórico: financeiro, cartões e senhas. A contagem oficial de escrituras lavradas está disponível na seção Gestão do Hub. A exportação deste HTML não incorpora a fonte oficial nem transforma cartões arquivados em escrituras lavradas.';
      document.body.insertBefore(aviso, document.body.firstChild);
    }
    function indicar(p) {
      var tabela = document.getElementById('tblFusao');
      if (!tabela || typeof M === 'undefined' || typeof CUR === 'undefined') return;
      var financeiro = M[CUR], fluxo = typeof PER_LBL !== 'undefined' && PER_LBL[p] ? PER_LBL[p] : 'período do histórico';
      var mes = financeiro ? financeiro.nome + '/' + financeiro.ano : 'período não informado';
      var nota = document.getElementById('cn2o-periodos-historicos');
      if (!nota) {
        nota = document.createElement('p'); nota.id = 'cn2o-periodos-historicos';
        nota.style.cssText = 'padding:12px 16px;margin:0;border-left:3px solid #631325;background:#f6eef0;color:#202a3a;font-size:13px;line-height:1.6';
        tabela.parentNode.insertBefore(nota, tabela);
      }
      nota.textContent = 'Fontes e períodos independentes: financeiro de ' + mes + '; cartões arquivados de ' + fluxo + '; senhas de setembro/2026. Os seletores não representam um único período. Este quadro histórico não é a contagem oficial de escrituras lavradas.';
      var th = tabela.querySelectorAll('thead th');
      if (th[2]) th[2].textContent = 'Lançamentos financeiros (' + mes + ')';
      if (th[3]) th[3].textContent = 'Cartões arquivados (' + fluxo + ')';
    }
    if (typeof tFusao === 'function') {
      var anterior = tFusao;
      tFusao = function (p) { anterior(p); indicar(p); };
      indicar(typeof TPER !== 'undefined' ? TPER : '');
    }
  }
  function prepararDocumento(html, meses, canal, financeiro) {
    if (typeof html !== 'string' || !html.trim() || html.length > 4 * LIMITE) throw new Error('O relatório recebido está inválido.');
    const config = { meses: financeiro ? financeiro.meses : validarMeses(meses), canal: canal, financeiro: financeiro || null };
    html = html.replace(/<script id="cn2o-produtividade-ponte">[\s\S]*?<\/script>/gi, '');
    html = html.replace(/\/\* CN2O_FINANCEIRO_VIEW_INICIO \*\/[\s\S]*?\/\* CN2O_FINANCEIRO_VIEW_FIM \*\//g,'');
    html = html.replace(/<style id="cn2o-financeiro-view-estilo">[\s\S]*?<\/style>/gi,'');
    if (financeiro) {
      const marker = /\/\* --- INICIO_BASE_DATA --- \*\/[\s\S]*?\/\* --- FIM_BASE_DATA --- \*\//;
      const init = /\nrefreshSelectors\(\);\s*\nrender\(\);\s*\n<\/script>/;
      if (!marker.test(html) || !init.test(html)) throw new Error('Estrutura V3 não reconhecida; financeiro histórico não será exibido como atual.');
      html = html.replace(marker,'/* --- INICIO_BASE_DATA --- */\nconst BASE_DATA = {};\n/* --- FIM_BASE_DATA --- */');
      const instalar = '/* CN2O_FINANCEIRO_VIEW_INICIO */\n('+adequarFinanceiro.toString()+')('+jsonSeguro(config)+');\n/* CN2O_FINANCEIRO_VIEW_FIM */\n';
      html = html.replace(init,function(t){return '\n'+instalar+t;});
    }
    const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
    const preambulo = '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' +
      '<meta name="referrer" content="no-referrer">' +
      '<script id="cn2o-produtividade-ponte">(' + adaptador.toString() + ')(' + jsonSeguro(config) + ');<\/script>';
    // Fontes locais de fallback mantêm o relatório independente de serviços externos.
    html = html.replace(/<link\b[^>]*>/gi, function (tag) { return /(?:https?:)?\/\//i.test(tag) ? '' : tag; });
    html = html.replace(/<base\b[^>]*>/gi, '');
    // A exportação pode conter a adaptação de uma sessão anterior: não duplicá-la.
    html = html.replace(/<script id="cn2o-historico-periodos">[\s\S]*?<\/script>/gi, '');
    const historico = /const\s+TRELLO_DATA\s*=/.test(html) ? '<script id="cn2o-historico-periodos">(' + esclarecerHistorico.toString() + ')(' + !!financeiro + ');<\/script>' : '';
    if (/<head\b[^>]*>/i.test(html)) {
      html = html.replace(/<head\b[^>]*>/i, function (tag) { return tag + preambulo; });
      html = /<\/head\s*>/i.test(html) ? html.replace(/<\/head\s*>/i, RESPONSIVO + '</head>') : html + RESPONSIVO;
    } else html = '<!doctype html><html><head>' + preambulo + RESPONSIVO + '</head><body>' + html + '</body></html>';
    return /<\/body\s*>/i.test(html) ? html.replace(/<\/body\s*>/i, historico + '</body>') : html + historico;
  }
  function montar(op) {
    if (!op || !op.host || typeof op.api !== 'function' || typeof op.sessao !== 'function') throw new Error('Configuração do relatório incompleta.');
    const win = op.window || root, doc = op.document || op.host.ownerDocument || root.document;
    const host = op.host;
    const financeiroCanonico = op.financeiroCanonico !== false;
    let vivo = true, geracao = 0, frame = null, canal = '', revisao = null, dono = null;
    let pendente, ultimoSalvo = null, salvando = false, conflito = false, erroSalvar = false;
    let monitor = null, oficiais = null;
    const painel = doc.createElement('section'); painel.className = 'gestao-produtividade';
    const topo = doc.createElement('div'); topo.className = 'gestao-produtividade__topo';
    const titulo = doc.createElement('h3'); titulo.textContent = 'Produção oficial e histórico';
    const periodo = doc.createElement('p'); periodo.textContent = 'Confira as escrituras lavradas por mês na fonte oficial Extra Digital.';
    const aviso = doc.createElement('p'); aviso.className = 'gestao-produtividade__nota';
    aviso.textContent = 'A visão financeira usa a Pesquisa de Produtividade atual do Hub, com receita líquida após os repasses. Cartões, pesos de complexidade e senhas conservam seus períodos históricos. Cartões arquivados não substituem escrituras lavradas.';
    const status = doc.createElement('p'); status.className = 'gestao-produtividade__status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const tentar = doc.createElement('button'); tentar.type = 'button'; tentar.className = 'gestao-produtividade__tentar'; tentar.textContent = 'Tentar novamente'; tentar.hidden = true;
    const area = doc.createElement('div'); area.className = 'gestao-produtividade__area';
    const oficiaisHost = doc.createElement('div'); oficiaisHost.className = 'gestao-produtividade__oficiais';
    const historicoTitulo = doc.createElement('h3'); historicoTitulo.textContent = 'Financeiro líquido e histórico operacional';
    const historicoNota = doc.createElement('p'); historicoNota.className = 'gestao-produtividade__nota';
    historicoNota.textContent = 'Critérios originais do relatório. Os totais e rankings de cartões abaixo são históricos; consulte acima a conferência de escrituras lavradas. Não há conversão automática dos scores por cartão em pesos por ato.';
    topo.append(titulo, periodo, aviso, status, tentar); painel.append(topo, oficiaisHost, historicoTitulo, historicoNota, area); host.replaceChildren(painel);
    function sessao() { const s = op.sessao() || {}; return { token: s.token || '', login: s.login || '', admin: s.admin === true }; }
    function igual(a, b) { return a && b && a.token === b.token && a.login === b.login && a.admin === b.admin; }
    function permitido() { const s = sessao(); return !!s.token && !!s.login && s.admin; }
    function atual(g) { return vivo && g === geracao && permitido() && igual(dono, sessao()); }
    function ocupado() { return vivo && (salvando || pendente !== undefined); }
    function antesDeSair(ev) {
      if (atual(geracao) && ocupado()) { ev.preventDefault(); ev.returnValue = ''; }
    }
    function mostrar(texto, erro, retry) {
      if (!vivo) return;
      status.textContent = texto; status.classList.toggle('gestao-produtividade__status--erro', !!erro);
      tentar.hidden = !retry; tentar.textContent = conflito ? 'Reabrir versão salva' : 'Tentar novamente';
    }
    function apagarFrame() {
      if (frame) { frame.srcdoc = ''; frame.remove(); frame = null; }
      area.replaceChildren(); canal = '';
    }
    function destruir() {
      if (!vivo) return;
      vivo = false; geracao++; pendente = undefined; ultimoSalvo = null; dono = null; revisao = null;
      win.removeEventListener('message', receber);
      win.removeEventListener('beforeunload', antesDeSair);
      if (monitor !== null) win.clearInterval(monitor);
      if (oficiais) oficiais.destruir(); oficiais = null;
      apagarFrame(); painel.remove();
    }
    function expirar() { destruir(); if (op.expirada) op.expirada(); }
    function conferirSessao() { if (vivo && dono && (!permitido() || !igual(dono, sessao()))) expirar(); }
    function novoCanal() {
      const crypto = op.crypto || win.crypto;
      if (!crypto || !crypto.getRandomValues) throw new Error('Não foi possível iniciar o relatório com segurança.');
      return Array.from(crypto.getRandomValues(new Uint32Array(4)), function (v) { return v.toString(16).padStart(8, '0'); }).join('');
    }
    function statusHttp(e) { return Number(e && (e.status || e.statusCode || (e.response && e.response.status))); }
    async function carregar() {
      if (!vivo) return;
      if (!permitido()) { mostrar('Entre com uma conta autorizada para consultar este relatório.', true, false); return; }
      const fonteOficial = op.lavrados || root.GestaoLavrados;
      if (!oficiais && fonteOficial) oficiais = fonteOficial.montar({ host: oficiaisHost, api: op.api, sessao: op.sessao, expirada: op.expirada, window: win });
      const g = ++geracao; dono = sessao(); apagarFrame(); pendente = undefined; ultimoSalvo = null;
      revisao = null; salvando = false; conflito = false; erroSalvar = false;
      mostrar('Carregando relatório…', false, false);
      try {
        const respostas = await Promise.all([op.api(ROTA), financeiroCanonico ? op.api(ROTA_FINANCEIRO) : Promise.resolve(null)]);
        const resposta = respostas[0];
        if (!atual(g)) { conferirSessao(); return; }
        if (!resposta || !Number.isSafeInteger(resposta.revisao) || resposta.revisao < 1) throw new Error('Resposta do relatório inválida.');
        const meses = validarMeses(resposta.meses == null ? null : resposta.meses);
        canal = novoCanal();
        const financeiro = financeiroCanonico ? projetarFinanceiro(respostas[1]) : null;
        const documento = prepararDocumento(resposta.html, meses, canal, financeiro);
        revisao = resposta.revisao; ultimoSalvo = JSON.stringify(meses);
        frame = doc.createElement('iframe'); frame.className = 'gestao-produtividade__frame'; frame.title = 'Relatório de produtividade de escrituras';
        frame.setAttribute('sandbox', SANDBOX); frame.setAttribute('referrerpolicy', 'no-referrer'); frame.srcdoc = documento;
        area.append(frame);
        mostrar(financeiroCanonico ? 'Base financeira atual do Hub, somente leitura. Receita líquida após 29,5694% de repasses; despesas e IR no Livro Caixa.' : 'Relatório pronto. Alterações nos meses financeiros serão salvas no Hub.', false, false);
      } catch (e) {
        if (!atual(g)) { conferirSessao(); return; }
        if (statusHttp(e) === 401 || statusHttp(e) === 403) { expirar(); return; }
        mostrar(financeiroCanonico ? 'A base financeira atual está indisponível. O financeiro antigo do documento não foi usado como substituto. Tente novamente.' : 'Não foi possível carregar o relatório. Tente novamente.', true, true);
      }
    }
    async function salvar() {
      if (!vivo || salvando || conflito || pendente === undefined || !atual(geracao)) return;
      const g = geracao, enviando = pendente;
      pendente = undefined; salvando = true; erroSalvar = false;
      mostrar('Salvando alterações dos meses financeiros…', false, false);
      try {
        const resposta = await op.api(ROTA + '/estado', { metodo: 'POST', corpo: { meses: JSON.parse(enviando), revisao: revisao } });
        if (!atual(g)) { conferirSessao(); return; }
        if (!resposta || !Number.isSafeInteger(resposta.revisao) || resposta.revisao <= revisao) throw new Error('Confirmação de salvamento inválida.');
        revisao = resposta.revisao; ultimoSalvo = enviando;
        if (pendente === ultimoSalvo) pendente = undefined;
        mostrar('Meses financeiros salvos no Hub.', false, false);
      } catch (e) {
        if (!atual(g)) { conferirSessao(); return; }
        if (pendente === undefined) pendente = enviando;
        if (statusHttp(e) === 401 || statusHttp(e) === 403) { expirar(); return; }
        conflito = statusHttp(e) === 409 || e.codigo === 'REVISAO_DESATUALIZADA'; erroSalvar = true;
        mostrar(conflito ? 'Há uma versão mais recente no Hub. Suas alterações permanecem neste relatório; exporte-as antes de reabrir a versão salva.' : 'Não foi possível salvar os meses financeiros. Suas alterações permanecem neste relatório. Tente novamente.', true, true);
      } finally {
        if (atual(g)) { salvando = false; if (!erroSalvar && pendente !== undefined) salvar(); }
      }
    }
    function receber(ev) {
      if (!vivo) return;
      if (!atual(geracao)) { conferirSessao(); return; }
      const msg = ev.data;
      if (!frame || ev.source !== frame.contentWindow || ev.origin !== 'null' || !msg || msg.canal !== canal) return;
      if (msg.tipo === 'cn2o-produtividade-periodo') {
        const formato = /^\d{4}-(0[1-9]|1[0-2])$/;
        if (oficiais && (msg.mes === null || formato.test(msg.mes || '')) && Array.isArray(msg.meses) && msg.meses.length <= 120 && msg.meses.every(m => typeof m === 'string' && formato.test(m))) oficiais.selecionar(msg.mes, msg.meses);
        return;
      }
      if (msg.tipo !== 'cn2o-produtividade-estado' || msg.chave !== CHAVE) return;
      if (financeiroCanonico) return; // Nunca salvar valores projetados líquidos como meses brutos.
      try {
        if (msg.valor !== null && (typeof msg.valor !== 'string' || msg.valor.length > LIMITE)) throw new Error('Estado inválido.');
        const dados = validarMeses(msg.valor === null ? null : JSON.parse(msg.valor));
        if (dados === null) throw new Error('Use Restaurar padrões para restaurar os meses.');
        const serializado = JSON.stringify(dados);
        if (!salvando && serializado === ultimoSalvo) { pendente = undefined; return; }
        pendente = serializado;
        if (!conflito && !erroSalvar) salvar();
      } catch (_) { mostrar('Os meses recebidos não puderam ser salvos. Confira o arquivo importado.', true, false); }
    }
    tentar.addEventListener('click', function () {
      if (conflito) {
        if (win.confirm('Reabrir a versão salva no Hub? Alterações ainda não salvas neste relatório serão descartadas. Exporte-as antes, se necessário.')) carregar();
      } else if (erroSalvar && pendente !== undefined) { erroSalvar = false; salvar(); }
      else carregar();
    });
    win.addEventListener('message', receber);
    win.addEventListener('beforeunload', antesDeSair);
    monitor = win.setInterval(conferirSessao, 500);
    carregar();
    return { destruir: destruir, recarregar: carregar, ocupado: ocupado, podeSair: function () { return !ocupado(); } };
  }
  const api = { montar: montar, prepararDocumento: prepararDocumento, validarMeses: validarMeses, projetarFinanceiro: projetarFinanceiro, SANDBOX: SANDBOX };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GestaoProdutividade = api;
})(typeof window !== 'undefined' ? window : globalThis);
