/* Hub CN2O · Atendimentos (NextQS) na aba Relatórios do Tabelião.
   Dados: n8n (workflow "CN2O · NextQS → dados para o Hub CN2O"), que confere a sessão do Hub antes de responder.
   Módulo isolado: não altera o app.js; embrulha pintarAbaRelatorios() e acrescenta a chave Escrituras | Atendimentos. */
(function () {
  'use strict';
  if (window.__ATD_HUB__) return;
  window.__ATD_HUB__ = true;
  var TK = 'tok' + 'en', HDR = 'X-Auth-' + 'Tok' + 'en';
  var URL_DADOS = 'https://cn2o.app.n8n.cloud/webhook/cn2o-hub-atendimentos';
  var PASTA_DRIVE = 'https://drive.google.com/drive/folders/1DtDPfQmlyz3HB93F-Xe_XEU-1nJ70QX-';
  var $ = function (id) { return document.getElementById(id); };
  var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  var MES_CURTO = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  var DSEM = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  function pad(n) { return String(n).padStart(2, '0'); }
  function isoD(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function deIso(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +(p[2] || 1)); }
  function brD(s) { if (!s) return ''; var p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : p[1] + '/' + p[0]; }
  function hojeD() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function fimMes(y, m) { return new Date(y, m + 1, 0); }
  function fmtN(n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('pt-BR'); }
  function fmtP(n) { return n == null || isNaN(n) ? '—' : (n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%'; }
  function fmtT(s) { if (s == null || isNaN(s)) return '—'; s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? h + 'h' + pad(m) : m + 'min' + (m < 10 ? ' ' + pad(x) + 's' : ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function quandoBr(iso) { var d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  function cab() { var h = {}; h[HDR] = (typeof SESSAO !== 'undefined' && SESSAO[TK]) || ''; return h; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- estado ---------- */
  var S = { dados: null, erro: '', carregando: false, rows: [], horas: [], status: {}, p: 'mes', ini: '', fim: '', fila: '', at: '', juntar: lsGet('atd_juntar') !== '0', aba: lsGet('atd_aba') || 'escrituras' };
  function limpaNome(v) { return v == null ? null : (String(v).replace(/\s+/g, ' ').trim() || null); }
  function nomeFila(v) { var t = limpaNome(v); return S.juntar && t ? (t.replace(/[\s.·,;:\-–—]+$/, '').trim() || t) : t; }

  function carregar(forcar) {
    if (S.carregando) return;
    if (S.dados && !forcar) { pintarConteudo(); return; }
    S.carregando = true; S.erro = '';
    pintarConteudo();
    var desde = new Date(); desde.setDate(desde.getDate() - 400);
    fetch(URL_DADOS + '?desde=' + isoD(desde), { headers: cab(), cache: 'no-store' })
      .then(function (r) { if (r.status === 401) throw new Error('Sua sessão não tem acesso a estes números (só o Tabelião).'); if (!r.ok) throw new Error('O n8n respondeu com erro ' + r.status + '.'); return r.json(); })
      .then(function (j) { S.dados = j; montar(j); S.carregando = false; pintarConteudo(); })
      .catch(function (e) { S.carregando = false; S.erro = e && e.message ? e.message : 'Não foi possível buscar os atendimentos.'; pintarConteudo(); });
  }
  function montar(j) {
    var rows = [], horas = [], status = {};
    (j.dias || []).forEach(function (x) {
      if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.dia || '') || x.dia < '2001') return;
      var d; try { d = typeof x.dados === 'string' ? JSON.parse(x.dados) : x.dados; } catch (e) { d = null; }
      if (!d) return;
      (d.r || []).forEach(function (r) {
        if (!r[4] && !r[5]) return;
        rows.push({ d: x.dia, m: x.dia.slice(0, 7), u: r[3] || null, fo: r[0] || null, a: limpaNome(r[1]), g: limpaNome(r[2]), em: r[4] || 0, at: r[5] || 0, na: r[6] == null ? null : r[6], te: r[7] || 0, tw: r[8] || 0, ta: r[9] || 0, aw: r[10] || 0 });
      });
      (d.h || []).forEach(function (h) { horas.push({ d: x.dia, h: h[0], em: h[1] }); });
    });
    (j.status || []).forEach(function (s) { if (s && s.chave) status[s.chave] = s; });
    S.rows = rows; S.horas = horas; S.status = status;
  }

  /* ---------- filtros e agregação ---------- */
  function intervalo() {
    var h = hojeD(), y = h.getFullYear(), m = h.getMonth();
    switch (S.p) {
      case 'mes': return [isoD(new Date(y, m, 1)), isoD(fimMes(y, m))];
      case 'mes_ant': return [isoD(new Date(y, m - 1, 1)), isoD(fimMes(y, m - 1))];
      case '30': var a = new Date(h); a.setDate(a.getDate() - 29); return [isoD(a), isoD(h)];
      case 'ano': return [y + '-01-01', y + '-12-31'];
      default: return ['0000-01-01', '9999-12-31'];
    }
  }
  function tituloIntervalo(r) {
    if (S.p === 'mes' || S.p === 'mes_ant') { var d = deIso(r[0]); return MESES[d.getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' de ' + d.getFullYear(); }
    return { '30': 'Últimos 30 dias', ano: 'Ano de ' + hojeD().getFullYear(), tudo: 'Todo o histórico' }[S.p];
  }
  function comFila(x) { var o = Object.assign({}, x); o.f = nomeFila(x.fo); return o; }
  function passaDim(r) { return (!S.fila || r.f === S.fila) && (!S.at || r.a === S.at); }
  function somar(rows) {
    var s = { em: 0, at: 0, na: 0, temNa: false, te: 0, tw: 0, ta: 0, aw: 0 };
    rows.forEach(function (r) { s.em += r.em || 0; s.at += r.at || 0; if (r.na != null) { s.na += r.na; s.temNa = true; } s.te += r.te || 0; s.tw += r.tw || 0; s.ta += r.ta || 0; s.aw += r.aw || 0; });
    s.tme = s.tw ? s.te / s.tw : null; s.tma = s.aw ? s.ta / s.aw : null; if (!s.temNa) s.na = null; return s;
  }
  function agrupar(rows, chave) {
    var g = {}, o = [];
    rows.forEach(function (r) { var k = typeof chave === 'function' ? chave(r) : r[chave]; if (k == null || k === '') k = '(sem informação)'; if (!g[k]) { g[k] = []; o.push(k); } g[k].push(r); });
    return o.map(function (k) { var s = somar(g[k]); s.k = k; return s; });
  }
  function base() {
    var r = intervalo(), todos = S.rows.map(comFila);
    var noPer = todos.filter(function (x) { return x.d >= r[0] && x.d <= r[1]; });
    return { r: r, todos: todos, noPer: noPer, rows: noPer.filter(passaDim) };
  }

var SVGNS='http://www.w3.org/2000/svg';
var COR={v:'#631325',m:'#202a3a',m18:'rgba(32,42,58,.22)',grade:'rgba(32,42,58,.14)',tx:'#202a3a',tx2:'#3a4454'};
function el(tag,at,pai){var e=document.createElementNS(SVGNS,tag);for(var k in at)e.setAttribute(k,at[k]);if(pai)pai.appendChild(e);return e;}
function txt(pai,x,y,t,at){var e=el('text',Object.assign({x:x,y:y,fill:COR.tx2,'font-size':13,'font-family':'"Atkinson Hyperlegible",Lato,Arial,sans-serif'},at||{}),pai);e.textContent=t;return e;}
function largura(box){var w=box.getBoundingClientRect().width;return Math.max(260,Math.floor(w||600));}
function escala(max,n){n=n||5;if(!(max>0))max=1;var bruto=max/n,e=Math.pow(10,Math.floor(Math.log10(bruto))),m=bruto/e,p=m<=1?1:m<=2?2:m<=2.5?2.5:m<=5?5:10;var passo=p*e,topo=Math.ceil(max/passo-1e-9)*passo,t=[];for(var v=0;v<=topo+1e-9;v+=passo)t.push(Math.round(v*100)/100);return{topo:topo,t:t};}
function fmtEixo(v){return v>=10000?(v/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil':Math.round(v).toLocaleString('pt-BR');}
function caixa(id){var b=$(id);b.innerHTML='';b.style.position='relative';return b;}
function dica(box){var d=box.querySelector('.dica');if(!d){d=document.createElement('div');d.className='dica';d.hidden=true;box.appendChild(d);}return d;}
function mostraDica(box,x,y,html){var d=dica(box);d.innerHTML=html;d.hidden=false;var W=box.clientWidth,w=d.offsetWidth,h=d.offsetHeight;var l=Math.min(Math.max(4,x+14),W-w-4);if(x+14+w>W)l=Math.max(4,x-w-14);d.style.left=l+'px';d.style.top=Math.max(0,y-h-10)+'px';}
function escondeDica(box){var d=box.querySelector('.dica');if(d)d.hidden=true;}
function areaVazia(areaId,boxId,msg){
  var a=$(areaId),box=$(boxId),v=a.querySelector('.vazio');
  if(msg){box.hidden=true;box.innerHTML='';if(!v){v=document.createElement('div');v.className='vazio';a.appendChild(v);}v.textContent=msg;a.style.height='auto';}
  else{box.hidden=false;if(v)v.remove();a.style.height='';}
  return !!msg;
}

/* Linha com área (a "serra" do período) */
function graficoLinha(boxId,rot,series,dicas){
  var box=caixa(boxId),W=largura(box),H=box.clientHeight||280,M={t:series.length>1?30:14,r:14,b:30,l:52};
  var pw=W-M.l-M.r,ph=H-M.t-M.b,n=rot.length;
  var max=0;series.forEach(function(s){s.v.forEach(function(v){if(v>max)max=v;});});
  var E=escala(max),X=function(i){return M.l+(n<2?pw/2:i*pw/(n-1));},Y=function(v){return M.t+ph-(v/E.topo)*ph;};
  var svg=el('svg',{width:W,height:H,viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Gráfico de linha'},box);
  var defs=el('defs',{},svg),gid='g'+boxId,lg=el('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1},defs);
  el('stop',{offset:'0%','stop-color':'#202a3a','stop-opacity':.28},lg);el('stop',{offset:'100%','stop-color':'#202a3a','stop-opacity':.02},lg);
  E.t.forEach(function(v){var y=Y(v);el('line',{x1:M.l,x2:W-M.r,y1:y,y2:y,stroke:COR.grade},svg);txt(svg,M.l-8,y+4,fmtEixo(v),{'text-anchor':'end'});});
  el('line',{x1:M.l,x2:W-M.r,y1:M.t+ph,y2:M.t+ph,stroke:COR.m,'stroke-width':1.5},svg);
  var maxRot=Math.max(1,Math.floor(pw/74)),passo=Math.max(1,Math.ceil(n/maxRot));
  rot.forEach(function(r,i){if(i%passo===0||i===n-1&&(n-1)%passo>passo/2)txt(svg,X(i),H-8,r,{'text-anchor':i===0?'start':(i===n-1?'end':'middle')});});
  function caminho(v){return v.map(function(y,i){return(i?'L':'M')+X(i).toFixed(1)+' '+Y(y).toFixed(1);}).join(' ');}
  series.slice().reverse().forEach(function(s){
    if(s.area&&n>1)el('path',{d:caminho(s.v)+' L'+X(n-1)+' '+(M.t+ph)+' L'+X(0)+' '+(M.t+ph)+' Z',fill:'url(#'+gid+')'},svg);
    el('path',{d:caminho(s.v),fill:'none',stroke:s.cor,'stroke-width':s.tracejada?2:3,'stroke-dasharray':s.tracejada?'6 5':'none','stroke-linejoin':'round','stroke-linecap':'round'},svg);
    if(!s.tracejada&&n<=45)s.v.forEach(function(v,i){el('circle',{cx:X(i),cy:Y(v),r:3.5,fill:s.cor},svg);});
  });
  if(series.length>1){var lx=W-M.r;series.slice().reverse().forEach(function(s){var t=txt(svg,lx,16,s.nome,{'text-anchor':'end',fill:COR.tx,'font-weight':700});var w=s.nome.length*7.4;el('line',{x1:lx-w-26,x2:lx-w-8,y1:12,y2:12,stroke:s.cor,'stroke-width':3,'stroke-dasharray':s.tracejada?'5 4':'none'},svg);lx-=w+42;});}
  var guia=el('line',{x1:0,x2:0,y1:M.t,y2:M.t+ph,stroke:COR.m,'stroke-width':1,'stroke-dasharray':'3 3',visibility:'hidden'},svg);
  var marca=el('circle',{r:6,fill:'#fff',stroke:COR.v,'stroke-width':3,visibility:'hidden'},svg);
  var alvo=el('rect',{x:M.l,y:M.t,width:pw,height:ph,fill:'transparent'},svg);
  function mover(ev){var b=svg.getBoundingClientRect(),x=ev.clientX-b.left,i=n<2?0:Math.round((x-M.l)/pw*(n-1));i=Math.max(0,Math.min(n-1,i));
    guia.setAttribute('x1',X(i));guia.setAttribute('x2',X(i));guia.setAttribute('visibility','visible');
    marca.setAttribute('cx',X(i));marca.setAttribute('cy',Y(series[0].v[i]));marca.setAttribute('visibility','visible');
    mostraDica(box,X(i),Y(series[0].v[i]),dicas(i));}
  alvo.addEventListener('mousemove',mover);alvo.addEventListener('touchstart',function(e){mover(e.touches[0]);},{passive:true});
  alvo.addEventListener('mouseleave',function(){guia.setAttribute('visibility','hidden');marca.setAttribute('visibility','hidden');escondeDica(box);});
}

/* Barras deitadas (filas, equipe) */
function graficoBarrasH(boxId,areaId,itens,dicas){
  itens=itens.slice().sort(function(a,b){return b.v-a.v;}).slice(0,15);
  var linha=34,H=itens.length*linha+34;$(areaId).style.height=H+'px';
  var box=caixa(boxId),W=largura(box);box.style.height=H+'px';
  var maxRotulo=Math.max.apply(null,itens.map(function(x){return String(x.k).length;}));
  var L=Math.min(Math.round(W*.42),Math.max(90,maxRotulo*8.2+12)),R=64,pw=W-L-R;
  var max=Math.max.apply(null,itens.map(function(x){return x.v;}).concat([1])),E=escala(max,4);
  var svg=el('svg',{width:W,height:H,viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Gráfico de barras'},box);
  E.t.forEach(function(v){var x=L+v/E.topo*pw;el('line',{x1:x,x2:x,y1:4,y2:H-24,stroke:COR.grade},svg);txt(svg,x,H-6,fmtEixo(v),{'text-anchor':'middle','font-size':12});});
  itens.forEach(function(it,i){
    var y=6+i*linha,w=Math.max(2,it.v/E.topo*pw),cor=i===0?COR.v:COR.m;
    var nome=String(it.k);if(nome.length*8.2>L-12)nome=nome.slice(0,Math.floor((L-12)/8.2)-1)+'…';
    txt(svg,L-10,y+linha/2+1,nome,{'text-anchor':'end',fill:COR.tx,'font-weight':700,'font-size':14});
    var bar=el('rect',{x:L,y:y+5,width:w,height:linha-12,rx:3,fill:cor},svg);
    txt(svg,L+w+6,y+linha/2+1,fmtN(it.v),{fill:COR.tx,'font-weight':700,'font-size':13});
    var alvo=el('rect',{x:0,y:y,width:W,height:linha,fill:'transparent'},svg);
    alvo.addEventListener('mousemove',function(ev){var b=box.getBoundingClientRect();bar.setAttribute('opacity',.8);mostraDica(box,ev.clientX-b.left,y+6,'<b>'+esc(it.k)+'</b><br>'+dicas(it).join('<br>'));});
    alvo.addEventListener('mouseleave',function(){bar.setAttribute('opacity',1);escondeDica(box);});
  });
}

/* Colunas (dia da semana, meses, horas) */
function graficoColunas(boxId,rot,vals,cores,dicas){
  var box=caixa(boxId),W=largura(box),H=box.clientHeight||280,M={t:24,r:10,b:30,l:52},pw=W-M.l-M.r,ph=H-M.t-M.b,n=rot.length;
  var max=Math.max.apply(null,vals.concat([1])),E=escala(max);
  var svg=el('svg',{width:W,height:H,viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Gráfico de colunas'},box);
  E.t.forEach(function(v){var y=M.t+ph-v/E.topo*ph;el('line',{x1:M.l,x2:W-M.r,y1:y,y2:y,stroke:COR.grade},svg);txt(svg,M.l-8,y+4,fmtEixo(v),{'text-anchor':'end'});});
  el('line',{x1:M.l,x2:W-M.r,y1:M.t+ph,y2:M.t+ph,stroke:COR.m,'stroke-width':1.5},svg);
  var slot=pw/n,bw=Math.min(64,slot*.68),passo=Math.max(1,Math.ceil(n/Math.floor(pw/46)));
  vals.forEach(function(v,i){
    var h=v/E.topo*ph,x=M.l+i*slot+(slot-bw)/2,y=M.t+ph-h;
    var bar=el('rect',{x:x,y:y,width:bw,height:Math.max(0,h),rx:3,fill:cores[i]||COR.m},svg);
    if(bw>=26)txt(svg,x+bw/2,y-6,fmtEixo(v),{'text-anchor':'middle',fill:COR.tx,'font-weight':700,'font-size':12});
    if(i%passo===0)txt(svg,x+bw/2,H-8,rot[i],{'text-anchor':'middle'});
    var alvo=el('rect',{x:M.l+i*slot,y:M.t,width:slot,height:ph,fill:'transparent'},svg);
    alvo.addEventListener('mousemove',function(){bar.setAttribute('opacity',.8);mostraDica(box,x+bw/2,y,dicas(i));});
    alvo.addEventListener('mouseleave',function(){bar.setAttribute('opacity',1);escondeDica(box);});
  });
}



  /* ---------- estilos ---------- */
  function css() {
    if ($('atd-css')) return;
    var st = document.createElement('style'); st.id = 'atd-css';
    st.textContent = [
      '.atd-chave{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px;padding:4px;border-radius:12px;background:rgba(32,42,58,.06);width:max-content;max-width:100%}',
      '.atd-chave button{border:0;background:transparent;border-radius:9px;padding:9px 16px;font:700 16px inherit;font-family:inherit;color:#202a3a;cursor:pointer}',
      '.atd-chave button[aria-pressed="true"]{background:#fff;color:#631325;box-shadow:0 1px 3px rgba(32,42,58,.18)}',
      '.atd{color:#202a3a}',
      '.atd .atd-topo{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}',
      '.atd .atd-api{flex:1;min-width:240px;border-left:5px solid #202a3a;background:#fbf5dd;border-radius:10px;padding:10px 14px;font-size:16px}',
      '.atd .atd-api.ok{border-left-color:#631325;background:#edf3ec}',
      '.atd .atd-api.erro{border-left-color:#631325;background:#f3e6e9}',
      '.atd .atd-api b{display:block;color:#202a3a}',
      '.atd .atd-junta{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px;align-self:flex-end;padding-bottom:6px}',
      '.atd .atd-junta input{width:20px;height:20px;accent-color:#631325}',
      '.atd h4.atd-per{margin:16px 0 2px;font:800 28px/1.15 Montserrat,Arial,sans-serif;color:#202a3a}',
      '.atd .atd-nota{margin:0 0 8px;font-size:15px;color:#3a4454}',
      '.atd .atd-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:12px 0 6px}',
      '.atd .atd-kpis div{border-radius:10px;padding:12px 14px}',
      '.atd .atd-kpis div:nth-child(1),.atd .atd-kpis div:nth-child(5){background:#e4eaf4}',
      '.atd .atd-kpis div:nth-child(2),.atd .atd-kpis div:nth-child(6){background:#edf3ec}',
      '.atd .atd-kpis div:nth-child(3){background:#f3e6e9}.atd .atd-kpis div:nth-child(4){background:#fbf5dd}',
      '.atd .atd-kpis span{display:block;font:700 12px Montserrat,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}',
      '.atd .atd-kpis strong{display:block;font:800 26px/1.15 Montserrat,Arial,sans-serif;margin-top:4px}',
      '.atd .atd-kpis strong.v{color:#631325}',
      '.atd .atd-kpis small{display:block;font-size:13px;color:#3a4454;margin-top:2px}',
      '.atd .atd-grade{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}',
      '.atd .atd-q{border:1px solid rgba(32,42,58,.16);border-radius:12px;padding:16px 18px;min-width:0;background:#fff}',
      '.atd .atd-q.cheio{grid-column:1/-1}',
      '.atd .atd-q .cab{display:flex;align-items:center;gap:12px}',
      '.atd .atd-q .num{font:800 26px/1 Montserrat,Arial,sans-serif;color:#631325;min-width:36px}',
      '.atd .atd-q h5{margin:0;font:700 19px Montserrat,Arial,sans-serif;color:#202a3a}',
      '.atd .atd-q p.sub{margin:4px 0 10px;font-size:14px;color:#3a4454}',
      '.atd .area{position:relative;height:280px}',
      '.atd .grafico{position:relative;height:100%}',
      '.atd .grafico svg{display:block;overflow:visible}',
      '.atd .vazio{border:2px dashed rgba(32,42,58,.3);border-radius:8px;padding:14px;font-size:15px}',
      '.atd .dica{position:absolute;z-index:5;pointer-events:none;background:#fff;color:#202a3a;border:2px solid #202a3a;border-radius:6px;padding:8px 10px;font-size:14px;line-height:1.35;box-shadow:0 6px 18px rgba(32,42,58,.18);white-space:nowrap}',
      '.atd .atd-faixas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}',
      '.atd .atd-faixas div{border-radius:10px;padding:10px 14px;background:#e4eaf4}.atd .atd-faixas div:nth-child(2){background:#edf3ec}.atd .atd-faixas div:nth-child(3){background:#fbf5dd}',
      '.atd .atd-faixas span{display:block;font:700 12px Montserrat,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}',
      '.atd .atd-faixas strong{display:block;font:800 22px Montserrat,Arial,sans-serif}',
      '.atd .atd-faixas small{font-size:13px;color:#3a4454}',
      '.atd .atd-rel{list-style:none;margin:8px 0 0;padding:0}',
      '.atd .atd-rel li{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid rgba(32,42,58,.14);font-size:16px}',
      '.atd .atd-rel .pdf{display:inline-flex;align-items:center;justify-content:center;width:36px;height:44px;border-radius:4px;background:#631325;color:#fff;font:800 11px Montserrat,Arial,sans-serif}',
      '.atd .atd-rel .dir{margin-left:auto}',
      '.atd a.btn-link{display:inline-flex;align-items:center;min-height:38px;padding:6px 14px;border:2px solid #631325;border-radius:8px;color:#631325;font-weight:700;text-decoration:none}',
      '@media (max-width:1100px){.atd .atd-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}',
      '@media (max-width:760px){.atd .atd-grade{grid-template-columns:1fr}.atd .atd-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.atd .atd-faixas{grid-template-columns:1fr}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ---------- estrutura ---------- */
  var PAINEL = null;
  function montarChave(painel) {
    PAINEL = painel; css();
    var orig = Array.prototype.slice.call(painel.childNodes);
    var chave = document.createElement('div'); chave.className = 'atd-chave'; chave.setAttribute('role', 'group'); chave.setAttribute('aria-label', 'Tipo de relatório');
    chave.innerHTML = '<button type="button" data-atd="escrituras">Escrituras concluídas</button><button type="button" data-atd="atendimentos">Atendimentos (NextQS)</button>';
    var envEsc = document.createElement('div'); envEsc.id = 'atdOrig';
    orig.forEach(function (n) { envEsc.appendChild(n); });
    var envAtd = document.createElement('div'); envAtd.id = 'atdRaiz'; envAtd.className = 'atd';
    painel.appendChild(chave); painel.appendChild(envEsc); painel.appendChild(envAtd);
    chave.querySelectorAll('button').forEach(function (b) { b.onclick = function () { S.aba = b.dataset.atd; lsSet('atd_aba', S.aba); aplicarAba(); }; });
    aplicarAba();
  }
  function aplicarAba() {
    if (!PAINEL || !PAINEL.isConnected) return;
    PAINEL.querySelectorAll('.atd-chave button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.atd === S.aba ? 'true' : 'false'); });
    $('atdOrig').hidden = S.aba !== 'escrituras';
    $('atdRaiz').hidden = S.aba !== 'atendimentos';
    if (S.aba === 'atendimentos') carregar(false);
  }
  function opcoes(vals, atual, rot) { return '<option value="">' + rot + '</option>' + vals.map(function (v) { return '<option' + (v === atual ? ' selected' : '') + ' value="' + esc(v) + '">' + esc(v) + '</option>'; }).join(''); }

  function pintarConteudo() {
    var raiz = $('atdRaiz'); if (!raiz || raiz.hidden) return;
    if (S.carregando && !S.dados) { raiz.innerHTML = '<p class="ed-vazio">Buscando os atendimentos no n8n…</p>'; return; }
    if (S.erro && !S.dados) { raiz.innerHTML = '<div class="atd-api erro"><b>Não deu para ler os atendimentos</b>' + esc(S.erro) + '</div><p style="margin-top:10px"><button type="button" class="btn-vinho" id="atdTentar">Tentar de novo</button></p>'; $('atdTentar').onclick = function () { carregar(true); }; return; }
    var B = base();
    var filas = [], ats = [];
    B.noPer.forEach(function (r) { if (r.f && filas.indexOf(r.f) < 0) filas.push(r.f); if (r.a && ats.indexOf(r.a) < 0) ats.push(r.a); });
    filas.sort(); ats.sort();
    var st = S.status.ultima, falhou = st && !(st.ok === true || st.ok === 'true');
    var ultima = st ? quandoBr(st.quando) : '—';
    var rels = Object.keys(S.status).filter(function (k) { return k.indexOf('relatorio_') === 0 && S.status[k].mensagem; }).sort().reverse();
    var meses = {}; S.rows.forEach(function (x) { if (x.em > 0) meses[x.m] = 1; });
    var mesesL = Object.keys(meses).sort().reverse(), mesHoje = isoD(hojeD()).slice(0, 7);
    raiz.innerHTML =
      '<div class="atd-topo"><div class="atd-api ' + (falhou ? 'erro' : 'ok') + '"><b>' + (falhou ? 'A última coleta do NextQS falhou' : 'API do NextQS · coleta diária às 17h') + '</b>' +
        (falhou ? esc(st.mensagem) + ' · ' : '') + 'Última coleta: ' + esc(ultima) + (S.carregando ? ' · atualizando…' : '') + '</div>' +
        '<button type="button" class="btn-fantasma" id="atdAtualizar">Atualizar</button></div>' +
      '<div class="aud-filtros">' +
        '<label class="aud-campo"><span>Período</span><select id="atdPer">' + [['mes', 'Mês atual'], ['mes_ant', 'Mês anterior'], ['30', 'Últimos 30 dias'], ['ano', 'Este ano'], ['tudo', 'Tudo']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === S.p ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="aud-campo"><span>Fila / serviço</span><select id="atdFila">' + opcoes(filas, S.fila, 'Todas') + '</select></label>' +
        '<label class="aud-campo"><span>Atendente</span><select id="atdAt">' + opcoes(ats, S.at, 'Todos') + '</select></label>' +
        '<label class="atd-junta"><input type="checkbox" id="atdJuntar"' + (S.juntar ? ' checked' : '') + '> Juntar filas de mesmo nome</label>' +
      '</div>' +
      '<h4 class="atd-per">' + esc(tituloIntervalo(B.r)) + '</h4><p class="atd-nota" id="atdNota"></p>' +
      '<div class="atd-kpis" id="atdKpis"></div>' +
      '<div class="atd-q cheio"><div class="cab"><span class="num">01</span><h5>Atendidas por dia</h5></div><p class="sub">Linha vinho: atendidas · tracejado: senhas emitidas.</p><div class="area" id="atdADia"><div class="grafico" id="atdGDia"></div></div></div>' +
      '<div class="atd-grade">' +
        '<div class="atd-q"><div class="cab"><span class="num">02</span><h5>Filas e serviços</h5></div><p class="sub">Atendidas por fila (passe o mouse para ver a espera).</p><div class="area" id="atdAFilas"><div class="grafico" id="atdGFilas"></div></div></div>' +
        '<div class="atd-q"><div class="cab"><span class="num">03</span><h5>Equipe</h5></div><p class="sub">Atendimentos por atendente e tempo médio no guichê.</p><div class="area" id="atdAEq"><div class="grafico" id="atdGEq"></div></div></div>' +
        '<div class="atd-q"><div class="cab"><span class="num">04</span><h5>Dia da semana</h5></div><p class="sub">Média de atendidas em cada dia útil do período.</p><div class="area" id="atdASem"><div class="grafico" id="atdGSem"></div></div></div>' +
        '<div class="atd-q"><div class="cab"><span class="num">05</span><h5>Mês a mês</h5></div><p class="sub">Todos os meses com dados; em vinho, os do período.</p><div class="area" id="atdAMes"><div class="grafico" id="atdGMes"></div></div></div>' +
        '<div class="atd-q cheio"><div class="cab"><span class="num">06</span><h5>Dia do mês</h5></div><p class="sub">Média de atendidas em cada dia do mês, somando todos os meses. Em vinho, os 3 dias mais movimentados.</p><div class="area" id="atdADM"><div class="grafico" id="atdGDM"></div></div><div class="atd-faixas" id="atdFaixas"></div></div>' +
        '<div class="atd-q cheio"><div class="cab"><span class="num">07</span><h5>Horário de pico</h5></div><p class="sub" id="atdHorSub">Senhas emitidas por hora de chegada no período.</p><div class="area" id="atdAHor"><div class="grafico" id="atdGHor"></div></div></div>' +
      '</div>' +
      '<div class="atd-q cheio" style="margin-top:12px"><div class="cab"><span class="num">08</span><h5>Relatórios mensais em PDF</h5></div>' +
        '<p class="sub">Gerados sozinhos às 7h do 1º dia útil de cada mês e guardados no Drive (02 · CARTÓRIO — ADMINISTRATIVO › Relatórios de Atendimento — NextQS).</p>' +
        '<div class="aud-filtros"><label class="aud-campo"><span>Mês</span><select id="atdRelMes">' + mesesL.map(function (m) { var p = m.split('-'); return '<option value="' + m + '">' + MESES[+p[1] - 1] + ' de ' + p[0] + (m === mesHoje ? ' (parcial)' : '') + '</option>'; }).join('') + '</select></label>' +
        '<button type="button" class="btn-vinho" id="atdRelGerar">Gerar o PDF agora</button><a class="btn-link" href="' + PASTA_DRIVE + '" target="_blank" rel="noopener">Abrir a pasta no Drive</a></div>' +
        '<p class="atd-nota" id="atdRelMsg" aria-live="polite"></p>' +
        '<ul class="atd-rel">' + (rels.length ? rels.map(function (k) { var s = S.status[k], p = k.slice(10).split('-'); return '<li><span class="pdf">PDF</span><span><b>' + MESES[+p[1] - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + ' de ' + p[0] + '</b><br><small>gerado em ' + esc(quandoBr(s.quando)) + '</small></span><span class="dir"><a class="btn-link" href="' + esc(s.mensagem) + '" target="_blank" rel="noopener">Abrir o PDF</a></span></li>'; }).join('') : '<li>Nenhum relatório gerado ainda.</li>') + '</ul></div>';
    if (mesesL.length > 1 && mesesL[0] === mesHoje) $('atdRelMes').value = mesesL[1];
    $('atdAtualizar').onclick = function () { carregar(true); };
    $('atdPer').onchange = function () { S.p = this.value; pintarConteudo(); };
    $('atdFila').onchange = function () { S.fila = this.value; pintarConteudo(); };
    $('atdAt').onchange = function () { S.at = this.value; pintarConteudo(); };
    $('atdJuntar').onchange = function () { S.juntar = this.checked; lsSet('atd_juntar', S.juntar ? '1' : '0'); S.fila = ''; pintarConteudo(); };
    $('atdRelGerar').onclick = gerarPdf;
    desenhar(B);
  }

  function desenhar(B) {
    var s = somar(B.rows), porDia = agrupar(B.rows, 'd').filter(function (x) { return x.em > 0; }).sort(function (a, b) { return a.k.localeCompare(b.k); });
    var nd = porDia.length, taxa = s.na != null && s.em ? s.na / s.em : null;
    $('atdNota').textContent = nd ? nd + ' dia(s) com atendimento' + (S.fila || S.at ? ' · filtro: ' + [S.fila, S.at].filter(Boolean).join(' · ') : '') + '.' : 'Nenhum atendimento neste período.';
    var k = [['Senhas emitidas', fmtN(s.em), ''], ['Atendidas', fmtN(s.at), s.em ? fmtP(s.at / s.em) + ' das emitidas' : ''], ['Não atendidas', s.na == null ? '—' : fmtN(s.na), taxa == null ? '' : fmtP(taxa) + ' das emitidas', taxa != null && taxa > .1],
      ['Espera média', fmtT(s.tme), 'da emissão à chamada'], ['Atendimento médio', fmtT(s.tma), 'tempo no guichê'], ['Média por dia', nd ? fmtN(s.at / nd) : '—', 'atendidas por dia útil']];
    $('atdKpis').innerHTML = k.map(function (x) { return '<div><span>' + x[0] + '</span><strong class="' + (x[3] ? 'v' : '') + '">' + x[1] + '</strong><small>' + x[2] + '</small></div>'; }).join('');
    /* 01 por dia */
    if (!areaVazia('atdADia', 'atdGDia', nd ? '' : 'Sem dados no período.')) {
      var series = [{ nome: 'Atendidas', v: porDia.map(function (x) { return x.at; }), cor: COR.v, area: true }];
      if (porDia.some(function (x) { return x.em > x.at; })) series.push({ nome: 'Senhas emitidas', v: porDia.map(function (x) { return x.em; }), cor: 'rgba(32,42,58,.6)', tracejada: true });
      graficoLinha('atdGDia', porDia.map(function (x) { var d = deIso(x.k); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); }), series, function (i) { var x = porDia[i], d = deIso(x.k); var l = ['<b>' + DSEM[d.getDay()] + ', ' + brD(x.k) + '</b>', 'Atendidas: ' + fmtN(x.at), 'Emitidas: ' + fmtN(x.em)]; if (x.na != null) l.push('Não atendidas: ' + fmtN(x.na)); if (x.tme != null) l.push('Espera média: ' + fmtT(x.tme)); if (x.tma != null) l.push('Atendimento médio: ' + fmtT(x.tma)); return l.join('<br>'); });
    }
    /* 02 filas */
    var gf = agrupar(B.rows, 'f').filter(function (x) { return x.em > 0; });
    if (!areaVazia('atdAFilas', 'atdGFilas', gf.length ? '' : 'Sem dados no período.'))
      graficoBarrasH('atdGFilas', 'atdAFilas', gf.map(function (x) { return Object.assign({ v: x.at }, x); }), function (x) { var l = ['Atendidas: ' + fmtN(x.at), 'Emitidas: ' + fmtN(x.em)]; if (x.tme != null) l.push('Espera média: ' + fmtT(x.tme)); if (x.tma != null) l.push('Atendimento médio: ' + fmtT(x.tma)); return l; });
    /* 03 equipe */
    var ga = agrupar(B.rows, 'a').filter(function (x) { return x.k !== '(sem informação)' && x.at > 0; });
    if (!areaVazia('atdAEq', 'atdGEq', ga.length ? '' : 'Sem dados no período.'))
      graficoBarrasH('atdGEq', 'atdAEq', ga.map(function (x) { return Object.assign({ v: x.at }, x); }), function (x) { var l = ['Atendimentos: ' + fmtN(x.at)]; if (x.tma != null) l.push('Tempo médio no guichê: ' + fmtT(x.tma)); if (x.tme != null) l.push('Espera média das senhas: ' + fmtT(x.tme)); return l; });
    /* 04 dia da semana */
    if (!areaVazia('atdASem', 'atdGSem', nd ? '' : 'Sem dados no período.')) {
      var sm = [0, 0, 0, 0, 0, 0, 0], qt = [0, 0, 0, 0, 0, 0, 0];
      porDia.forEach(function (x) { var w = deIso(x.k).getDay(); sm[w] += x.at; qt[w]++; });
      var ids = [1, 2, 3, 4, 5]; if (qt[6]) ids.push(6); if (qt[0]) ids.push(0);
      var med = ids.map(function (i) { return qt[i] ? sm[i] / qt[i] : 0; }), mx = Math.max.apply(null, med);
      graficoColunas('atdGSem', ids.map(function (i) { return DSEM[i]; }), med, med.map(function (v) { return v === mx && v > 0 ? COR.v : COR.m; }), function (j) { var i = ids[j]; return '<b>' + DSEM[i] + '</b><br>Média: ' + fmtN(med[j]) + ' atendidas por dia<br>' + qt[i] + ' dia(s) no período'; });
    }
    /* 05 mês a mês (todos os meses, com filtros) */
    var todosF = B.todos.filter(passaDim), gm = agrupar(todosF, 'm').filter(function (x) { return x.em > 0; }).sort(function (a, b) { return a.k.localeCompare(b.k); });
    if (!areaVazia('atdAMes', 'atdGMes', gm.length ? '' : 'Ainda não há meses com dados.'))
      graficoColunas('atdGMes', gm.map(function (x) { var p = x.k.split('-'); return MES_CURTO[+p[1] - 1] + '/' + p[0].slice(2); }), gm.map(function (x) { return x.at; }), gm.map(function (x) { return (x.k >= B.r[0].slice(0, 7) && x.k <= B.r[1].slice(0, 7)) ? COR.v : COR.m18; }), function (i) { var x = gm[i], p = x.k.split('-'), l = ['<b>' + MESES[+p[1] - 1] + ' de ' + p[0] + '</b>', 'Atendidas: ' + fmtN(x.at), 'Emitidas: ' + fmtN(x.em)]; if (x.tme != null) l.push('Espera média: ' + fmtT(x.tme)); return l.join('<br>'); });
    /* 06 dia do mês */
    var pd = agrupar(todosF, 'd').filter(function (x) { return x.em > 0; }), so = [], qd = [], i;
    for (i = 0; i <= 31; i++) { so[i] = 0; qd[i] = 0; }
    pd.forEach(function (x) { var n = +x.k.slice(8, 10); so[n] += x.at; qd[n]++; });
    if (!areaVazia('atdADM', 'atdGDM', pd.length ? '' : 'Precisa de dados por dia.')) {
      var rot = [], vals = []; for (i = 1; i <= 31; i++) { rot.push(String(i)); vals.push(qd[i] ? so[i] / qd[i] : 0); }
      var top = vals.slice().sort(function (a, b) { return b - a; })[2] || Infinity;
      graficoColunas('atdGDM', rot, vals, vals.map(function (v) { return v > 0 && v >= top ? COR.v : COR.m; }), function (j) { return '<b>Dia ' + (j + 1) + '</b><br>Média: ' + fmtN(vals[j]) + ' atendidas<br>' + qd[j + 1] + ' dia(s) útil(eis) com dados'; });
      var fx = function (a, b) { var t = 0, n = 0; for (var j = a; j <= b; j++) { t += so[j]; n += qd[j]; } return n ? t / n : null; };
      $('atdFaixas').innerHTML = [['Início do mês', 'dias 1 a 10', fx(1, 10)], ['Meio do mês', 'dias 11 a 20', fx(11, 20)], ['Fim do mês', 'dias 21 a 31', fx(21, 31)]].map(function (f) { return '<div><span>' + f[0] + '</span><strong>' + fmtN(f[2]) + '</strong><small>atendidas por dia · ' + f[1] + '</small></div>'; }).join('');
    } else $('atdFaixas').innerHTML = '';
    /* 07 horário */
    var hs = S.horas.filter(function (x) { return x.d >= B.r[0] && x.d <= B.r[1]; });
    if (!areaVazia('atdAHor', 'atdGHor', hs.length ? '' : 'Sem dados de horário no período.')) {
      var gh = agrupar(hs, 'h').sort(function (a, b) { return String(a.k).localeCompare(String(b.k)); }), ndh = agrupar(hs, 'd').length, mh = Math.max.apply(null, gh.map(function (x) { return x.em; }));
      $('atdHorSub').textContent = 'Senhas emitidas por hora de chegada, somando ' + ndh + ' dia(s) do período' + (S.fila || S.at ? ' (todas as filas e atendentes)' : '') + '.';
      graficoColunas('atdGHor', gh.map(function (x) { return x.k; }), gh.map(function (x) { return x.em; }), gh.map(function (x) { return x.em === mh ? COR.v : COR.m; }), function (j) { var x = gh[j]; return '<b>' + esc(x.k) + '</b><br>' + fmtN(x.em) + ' senhas emitidas<br>Média: ' + fmtN(x.em / ndh) + ' por dia'; });
    }
  }

  function gerarPdf() {
    var mes = $('atdRelMes').value, b = $('atdRelGerar'); if (!mes) return;
    b.disabled = true; $('atdRelMsg').textContent = 'Pedindo o PDF de ' + brD(mes) + ' ao n8n…';
    fetch(URL_DADOS + '?acao=gerar&mes=' + mes, { headers: cab(), cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('erro ' + r.status); return r.json(); })
      .then(function () { $('atdRelMsg').textContent = 'Gerando… o link aparece aqui em alguns segundos.'; setTimeout(function () { S.dados = null; carregar(true); }, 12000); })
      .catch(function (e) { b.disabled = false; $('atdRelMsg').textContent = 'Não foi possível pedir o PDF (' + e.message + ').'; });
  }

  var _r; window.addEventListener('resize', function () { clearTimeout(_r); _r = setTimeout(function () { var r = $('atdRaiz'); if (r && !r.hidden && S.dados) pintarConteudo(); }, 250); });

  /* ---------- gancho na aba Relatórios ---------- */
  function instalar() {
    if (typeof pintarAbaRelatorios !== 'function') return false;
    var original = pintarAbaRelatorios;
    pintarAbaRelatorios = function (painel) { original.apply(this, arguments); try { montarChave(painel); } catch (e) { if (window.console) console.error('Atendimentos:', e); } };
    return true;
  }
  if (!instalar()) document.addEventListener('DOMContentLoaded', instalar);
})();
