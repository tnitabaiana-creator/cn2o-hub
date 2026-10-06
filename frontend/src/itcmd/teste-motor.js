const M = require('./motor.js');
let ok = 0, falhas = 0;
function eq(a, b, msg, tol = 0.011) {
  const passou = typeof a === 'number' ? Math.abs(a - b) <= tol : a === b;
  if (passou) ok++; else { falhas++; console.log('FALHA:', msg, '→ obtido', a, 'esperado', b); }
}
const OPTS = { ufp: 86.25, hoje: '2026-09-25' };
const nome = (r, n) => r.suc.benef.find(b => b.nome === n);

// 1. Comunhão parcial, 2 filhos comuns, casa comum 300k + carro particular 50k
let r = M.inventario({ nome: 'A', obito: '2026-08-01', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Viúva' }, filhosComuns: 'sim',
  descendentes: [{ nome: 'F1' }, { nome: 'F2' }],
  bens: [{ descricao: 'Casa', tipo: 'imovel_urbano', valor: 300000, natureza: 'comum' }, { descricao: 'Carro', tipo: 'veiculo', valor: 50000, natureza: 'particular' }] }, OPTS);
eq(r.pat.meacao, 150000, '1 meação'); eq(r.pat.heranca, 200000, '1 herança');
eq(nome(r, 'Viúva').valor, 16666.67, '1 cônjuge concorre só nos particulares (1/3 de 50k)');
eq(nome(r, 'F1').valor, 91666.67, '1 filho'); eq(nome(r, 'F2').valor, 91666.67, '1 filho 2');
eq(r.itc.linhas.find(l => l.nome === 'Viúva').situacao, 'isento', '1 cônjuge isento (<500 UFP)');
eq(r.itc.linhas.find(l => l.nome === 'F1').imposto, 2750.00, '1 ITCMD filho 3%');
eq(r.itc.multaCabivel, false, '1 sem multa (55 dias)');
eq(r.itc.total, 5500, '1 total');
// partilha: casa → viúva 1/2 meação + 0; F1 1/4; carro → viúva 1/3, F1 1/3
const casa = r.partilha[0].linhas, carro = r.partilha[1].linhas;
eq(casa.find(l => l.papel === 'meação').fr.txt(), '1/2', '1 partilha casa meação');
eq(casa.find(l => l.quem === 'F1').fr.txt(), '1/4', '1 partilha casa F1');
eq(carro.find(l => l.quem === 'Viúva').fr.txt(), '1/3', '1 partilha carro viúva');
eq(casa.some(l => l.quem === 'Viúva' && l.papel !== 'meação'), false, '1 viúva não herda na casa');

// 2. Comunhão universal, 3 filhos, 900k comum
r = M.inventario({ estadoCivil: 'casado', regime: 'universal', conjuge: { nome: 'V' }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }, { nome: 'b' }, { nome: 'c' }],
  bens: [{ valor: 900000, natureza: 'particular' }] }, OPTS);
eq(r.pat.meacao, 450000, '2 meação universal (mesmo bem "particular")'); eq(nome(r, 'a').valor, 150000, '2 filho'); eq(r.suc.benef.length, 3, '2 cônjuge não concorre');
eq(r.itc.linhas[0].imposto, 4500, '2 ITCMD 3%');

// 3. Separação convencional, 1 filho comum, 1M
r = M.inventario({ estadoCivil: 'casado', regime: 'separacao_conv', conjuge: { nome: 'V' }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }], bens: [{ valor: 1000000 }] }, OPTS);
eq(r.pat.meacao, 0, '3 sem meação'); eq(nome(r, 'V').valor, 500000, '3 cônjuge 1/2'); eq(nome(r, 'a').valor, 500000, '3 filho 1/2');
eq(r.itc.linhas[0].imposto, 30000, '3 ITCMD 6%');
// 3b. 4 filhos comuns → reserva de 1/4 ao cônjuge (1/5 < 1/4)
r = M.inventario({ estadoCivil: 'casado', regime: 'separacao_conv', conjuge: { nome: 'V' }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }, { nome: 'b' }, { nome: 'c' }, { nome: 'd' }], bens: [{ valor: 800000 }] }, OPTS);
eq(nome(r, 'V').valor, 200000, '3b reserva da quarta parte'); eq(nome(r, 'a').valor, 150000, '3b filho 3/16');
// 3c. filiação híbrida → sem reserva
r = M.inventario({ estadoCivil: 'casado', regime: 'separacao_conv', conjuge: { nome: 'V' }, filhosComuns: 'nao', descendentes: [{ nome: 'a' }, { nome: 'b' }, { nome: 'c' }, { nome: 'd' }], bens: [{ valor: 800000 }] }, OPTS);
eq(nome(r, 'V').valor, 160000, '3c sem reserva: 1/5');

// 4. Sem descendentes, pai e mãe vivos, casado (universal — mesmo assim concorre com ascendentes)
r = M.inventario({ estadoCivil: 'casado', regime: 'universal', conjuge: { nome: 'V' }, ascendentes: { paiVivo: true, maeViva: true, pai: 'Pai', mae: 'Mãe' }, bens: [{ valor: 600000 }] }, OPTS);
eq(r.pat.meacao, 300000, '4 meação'); eq(nome(r, 'V').valor, 100000, '4 cônjuge 1/3'); eq(nome(r, 'Pai').valor, 100000, '4 pai'); eq(nome(r, 'Mãe').valor, 100000, '4 mãe');
// 5. Só mãe viva
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'V' }, ascendentes: { maeViva: true, mae: 'Mãe' }, bens: [{ valor: 100000, natureza: 'particular' }] }, OPTS);
eq(nome(r, 'V').valor, 50000, '5 cônjuge 1/2'); eq(nome(r, 'Mãe').valor, 50000, '5 mãe 1/2');
// 5b. avós: 1 paterno, 2 maternos, sem cônjuge
r = M.inventario({ estadoCivil: 'solteiro', ascendentes: { avosPaternos: 1, avosMaternos: 2 }, bens: [{ valor: 120000 }] }, OPTS);
eq(r.suc.benef[0].valor, 60000, '5b avô paterno 1/2'); eq(r.suc.benef[1].valor, 30000, '5b avó materna 1/4');

// 6. Representação: 2 filhos, um premorto com 3 netos; solteiro
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ nome: 'Vivo' }, { nome: 'Morto', condicao: 'premorto', representantes: [{ nome: 'n1' }, { nome: 'n2' }, { nome: 'n3' }] }], bens: [{ valor: 600000 }] }, OPTS);
eq(nome(r, 'Vivo').valor, 300000, '6 filho vivo 1/2'); eq(nome(r, 'n1').valor, 100000, '6 neto 1/6'); eq(nome(r, 'n1').frPart.txt(), '1/6', '6 fração neto');
eq(r.itc.linhas.find(l => l.nome === 'n1').aliq, 0.03, '6 neto: faixa própria (1159 UFP → 3%)');
eq(r.itc.linhas.find(l => l.nome === 'Vivo').aliq, 0.06, '6 filho: 3478 UFP → 6%');

// 7. Renúncia: 3 filhos, um renuncia
r = M.inventario({ estadoCivil: 'viuvo', descendentes: [{ nome: 'a' }, { nome: 'b', condicao: 'renuncia' }, { nome: 'c' }], bens: [{ valor: 100000 }] }, OPTS);
eq(r.suc.benef.length, 2, '7 renunciante fora'); eq(nome(r, 'a').valor, 50000, '7 acresce');

// 8. Colaterais
r = M.inventario({ estadoCivil: 'solteiro', colaterais: [{ nome: 'Bi', grau: 'irmao', tipo: 'bilateral' }, { nome: 'Uni', grau: 'irmao', tipo: 'unilateral' }], bens: [{ valor: 90000 }] }, OPTS);
eq(nome(r, 'Bi').valor, 60000, '8 bilateral dobro'); eq(nome(r, 'Uni').valor, 30000, '8 unilateral');
// 8b. cônjuge sozinho
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'V' }, bens: [{ valor: 100000, natureza: 'comum' }] }, OPTS);
eq(r.pat.meacao, 50000, '8b meação'); eq(nome(r, 'V').valor, 50000, '8b cônjuge herda tudo');

// 9. Cumulativo
const c = M.cumulativo(
  { nome: 'Pai', obito: '2015-03-10', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Mãe' }, filhosComuns: 'sim', descendentes: [{ nome: 'F1' }, { nome: 'F2' }], bens: [{ descricao: 'Sítio', tipo: 'imovel_rural', valor: 600000, natureza: 'comum' }] },
  { nome: 'Mãe', obito: '2023-05-05', estadoCivil: 'viuvo', descendentes: [{ nome: 'F1' }, { nome: 'F2' }], bens: [] }, OPTS);
eq(c.inv1.pat.meacao, 300000, '9 meação inv1'); eq(nome(c.inv1, 'F1').valor, 150000, '9 F1 inv1');
eq(c.inv2.pat.heranca, 300000, '9 herança inv2 = meação'); eq(nome(c.inv2, 'F1').valor, 150000, '9 F1 inv2');
eq(c.inv1.itc.multaCabivel, true, '9 multa por atraso (óbito 2015)');
eq(c.inv1.itc.linhas[0].multa, 900, '9 multa 20% de 4.500');
// 9b. cumulativo com particulares: pai tinha bem particular 100k → mãe concorre 1/3 dele
const c2 = M.cumulativo(
  { nome: 'Pai', estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'Mãe' }, filhosComuns: 'sim', descendentes: [{ nome: 'F1' }, { nome: 'F2' }], bens: [{ descricao: 'Casa', valor: 600000, natureza: 'comum' }, { descricao: 'Terreno', valor: 90000, natureza: 'particular' }] },
  { nome: 'Mãe', estadoCivil: 'viuvo', descendentes: [{ nome: 'F1' }, { nome: 'F2' }], bens: [{ descricao: 'Poupança', tipo: 'dinheiro', valor: 10000 }] }, OPTS);
eq(nome(c2.inv1, 'Mãe').valor, 30000, '9b mãe 1/3 do terreno'); eq(c2.inv2.pat.heranca, 340000, '9b inv2 = 300k + 30k + 10k');
eq(c2.inv2.pat.bens[1].fracao, 100 / 3, '9b fração do terreno herdada = 1/3', 1e-9);

// 10. Emolumentos TJSE
eq(M.EMOL.faixa(300000), 3296.76, '10 faixa 300k'); eq(M.EMOL.faixa(5000), 303.09, '10 faixa 5k'); eq(M.EMOL.faixa(6000), 513.01, '10 faixa 6k'); eq(M.EMOL.faixa(13000), 708.46, '10 13k'); eq(M.EMOL.faixa(25000), 708.46, '10 25k'); eq(M.EMOL.faixa(25000.01), 755.52, '10 25k+'); eq(M.EMOL.faixa(30000), 755.52, '10 30k'); eq(M.EMOL.faixa(1085000), 10685.18, '10 1.085k');
eq(M.EMOL.faixa(1090000), 10703.88, '10 1.090k'); eq(M.EMOL.faixa(1200000), 11115.28, '10 1.200k'); eq(M.EMOL.faixa(1300000), 11133.98, '10 1.300k'); eq(M.EMOL.faixa(2000000), 11264.88, '10 2M'); eq(M.EMOL.faixa(2500000), 11264.88, '10 teto');
let e = M.emolumentosEscritura(300000, 12); eq(e.emol, 3296.76, '10 emol'); eq(e.adicional, 9.54, '10 adicional 2 pessoas'); eq(e.ferd, 659.35, '10 FERD'); eq(e.total, 3965.65, '10 total = guia TJSE');
e = M.emolumentosEscritura(300000, 3, { acessorio: true }); eq(e.emol, 1648.38, '10 acessório 50%');

// 11. Doação
let d = M.doacao({ donatarios: [{ nome: 'X' }, { nome: 'Y' }], bens: [{ tipo: 'imovel_urbano', valor: 400000, destino: 'todos' }] }, OPTS);
eq(d.linhas[0].quinhao, 200000, '11 metade'); eq(d.linhas[0].imposto, 4000, '11 2%'); eq(d.total, 8000, '11 total');
d = M.doacao({ reservaUsufruto: true, baseNuaPropriedade: '50', donatarios: [{ nome: 'X' }, { nome: 'Y' }], bens: [{ tipo: 'imovel_urbano', valor: 400000, destino: 'todos' }] }, OPTS);
eq(d.linhas[0].quinhao, 100000, '11 nua-propriedade 50%'); eq(d.linhas[0].imposto, 2000, '11 imposto 50%');
d = M.doacao({ donatarios: [{ nome: 'X' }], bens: [{ tipo: 'imovel_urbano', valor: 700000, destino: 0 }, { tipo: 'veiculo', valor: 50000, destino: 0 }] }, OPTS);
eq(d.linhas[0].imposto, 700000 * 0.04 + 50000 * 0.02, '11 faixa 4% (8695 UFP) + móveis 2%');
d = M.doacao({ donatarios: [{ nome: 'X' }], bens: [{ tipo: 'imovel_urbano', valor: 40000, destino: 0 }] }, OPTS);
eq(d.linhas[0].situacao, 'isento', '11 isento (464 UFP)');
d = M.doacao({ donatarios: [{ nome: 'X', doacoesAnteriores: 10000 }], bens: [{ tipo: 'imovel_urbano', valor: 40000, destino: 0 }] }, OPTS);
eq(d.linhas[0].situacao, 'tributado', '11 doações anteriores no exercício somam para a isenção');

// 12. Quotas de sociedade a 2%
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ nome: 'a' }], bens: [{ tipo: 'quotas', valor: 100000 }, { tipo: 'imovel_urbano', valor: 100000 }] }, OPTS);
eq(r.itc.linhas[0].imposto, 100000 * 0.03 + 100000 * 0.02, '12 quotas 2% + geral 3%');

// 13. Separação obrigatória: cônjuge não concorre; com Súmula 377 há meação dos aquestos
r = M.inventario({ estadoCivil: 'casado', regime: 'separacao_obrig', conjuge: { nome: 'V', sumula377: true }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }], bens: [{ valor: 200000, natureza: 'comum' }, { valor: 100000, natureza: 'particular' }] }, OPTS);
eq(r.pat.meacao, 100000, '13 meação dos aquestos'); eq(r.suc.benef.length, 1, '13 cônjuge não concorre'); eq(nome(r, 'a').valor, 200000, '13 filho');
// 13b. separado de fato > 2 anos: mantém meação, não herda
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'V', separadoFato: true }, ascendentes: { maeViva: true, mae: 'Mãe' }, bens: [{ valor: 200000, natureza: 'comum' }] }, OPTS);
eq(r.pat.meacao, 100000, '13b meação'); eq(r.suc.benef.length, 1, '13b só a mãe'); eq(nome(r, 'Mãe').valor, 100000, '13b mãe tudo');

// 14. Dívidas abatem os comuns antes da meação
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'V' }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }], dividas: 40000, bens: [{ valor: 200000, natureza: 'comum' }] }, OPTS);
eq(r.pat.meacao, 80000, '14 meação líquida'); eq(nome(r, 'a').valor, 80000, '14 filho');

// 15. Fração exata acumulada (5 filhos + cônjuge 1/4 sobre particulares)
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'V' }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }, { nome: 'b' }, { nome: 'c' }, { nome: 'd' }, { nome: 'e' }], bens: [{ valor: 100000, natureza: 'particular' }] }, OPTS);
eq(nome(r, 'V').frPart.txt(), '1/4', '15 cônjuge 1/4'); eq(nome(r, 'a').frPart.txt(), '3/20', '15 filho 3/20');
const soma = r.suc.benef.reduce((s, b) => s.mais(b.frPart), new M.Fr(0)); eq(soma.txt(), '1', '15 frações somam 1');

// 16. UFP vigente por data
eq(M.ufpVigente('2026-09-25').valor, 86.25, '16 UFP set/2026'); eq(M.ufpVigente('2026-10-01').valor, 87.19, '16 UFP out/2026');

// ---- Cenários da auditoria ----
// (j) só sobrinhos → por cabeça (art. 1.843, §1º); bilateral dobro (§2º)
r = M.inventario({ estadoCivil: 'solteiro', colaterais: [{ nome: 'I1', grau: 'irmao', tipo: 'bilateral', condicao: 'premorto', representantes: [{ nome: 'S1' }] }, { nome: 'I2', grau: 'irmao', tipo: 'bilateral', condicao: 'premorto', representantes: [{ nome: 'S2' }, { nome: 'S3' }, { nome: 'S4' }] }], bens: [{ valor: 400000 }] }, OPTS);
eq(nome(r, 'S1').valor, 100000, 'j sobrinho por cabeça'); eq(nome(r, 'S4').valor, 100000, 'j sobrinho por cabeça 2');
r = M.inventario({ estadoCivil: 'solteiro', colaterais: [{ nome: 'I1', grau: 'irmao', tipo: 'bilateral', condicao: 'premorto', representantes: [{ nome: 'S1' }] }, { nome: 'I2', grau: 'irmao', tipo: 'unilateral', condicao: 'premorto', representantes: [{ nome: 'S2' }] }], bens: [{ valor: 300000 }] }, OPTS);
eq(nome(r, 'S1').valor, 200000, 'j §2º filho de bilateral dobro'); eq(nome(r, 'S2').valor, 100000, 'j §2º filho de unilateral');
// irmão vivo + irmão premorto → sobrinhos por estirpe (art. 1.840)
r = M.inventario({ estadoCivil: 'solteiro', colaterais: [{ nome: 'I1', grau: 'irmao', tipo: 'bilateral', condicao: 'vivo' }, { nome: 'I2', grau: 'irmao', tipo: 'bilateral', condicao: 'premorto', representantes: [{ nome: 'S2' }, { nome: 'S3' }] }], bens: [{ valor: 400000 }] }, OPTS);
eq(nome(r, 'I1').valor, 200000, 'j estirpe irmão vivo'); eq(nome(r, 'S2').valor, 100000, 'j estirpe sobrinho');
// (k) sobrinho exclui primo; tio excluído por sobrinho
r = M.inventario({ estadoCivil: 'solteiro', colaterais: [{ nome: 'Sob', grau: 'sobrinho' }, { nome: 'Primo', grau: 'primo' }, { nome: 'Tio', grau: 'tio' }], bens: [{ valor: 100000 }] }, OPTS);
eq(r.suc.benef.length, 1, 'k só o sobrinho'); eq(nome(r, 'Sob').valor, 100000, 'k sobrinho tudo');
r = M.inventario({ estadoCivil: 'solteiro', colaterais: [{ nome: 'Tio', grau: 'tio' }, { nome: 'Primo', grau: 'primo' }], bens: [{ valor: 100000 }] }, OPTS);
eq(nome(r, 'Tio').valor, 100000, 'k tio exclui primo');
// (l) descendente em branco não é herdeiro
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ nome: '', condicao: 'vivo', representantes: [] }], ascendentes: { maeViva: true, mae: 'Mãe' }, bens: [{ valor: 100000 }] }, OPTS);
eq(r.suc.classe, 'ascendentes', 'l classe ascendentes'); eq(nome(r, 'Mãe').valor, 100000, 'l mãe tudo');
// (m) doação: destino por id estável; donatário em branco não desloca
d = M.doacao({ donatarios: [{ uid: 'a', nome: '' }, { uid: 'b', nome: 'X' }], bens: [{ tipo: 'imovel_urbano', valor: 200000, destino: 'b' }] }, OPTS);
eq(d.linhas[0].quinhao, 200000, 'm destino por uid'); eq(d.total, 4000, 'm imposto');
d = M.doacao({ donatarios: [{ uid: 'b', nome: 'X' }], bens: [{ tipo: 'imovel_urbano', valor: 200000, destino: 'zz' }] }, OPTS);
eq(d.linhas[0].quinhao, 200000, 'm destino inválido → todos'); eq(d.avisos.some(a => /sem donatário válido/.test(a)), true, 'm aviso');
// (n) usufruto 50% em todos os bens
d = M.doacao({ reservaUsufruto: true, baseNuaPropriedade: '50', donatarios: [{ uid: 'a', nome: 'X' }], bens: [{ tipo: 'imovel_urbano', valor: 200000, destino: 'a' }, { tipo: 'veiculo', valor: 100000, destino: 'a' }] }, OPTS);
eq(d.linhas[0].imoveis, 100000, 'n imóveis 50%'); eq(d.linhas[0].moveis, 50000, 'n móveis 50%');
// (o) quotas por beneficiário conforme a partilha
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: 'V' }, filhosComuns: 'sim', descendentes: [{ nome: 'a' }], bens: [{ tipo: 'quotas', valor: 400000, natureza: 'comum' }, { tipo: 'imovel_urbano', valor: 200000, natureza: 'particular' }] }, OPTS);
eq(nome(r, 'V').valor, 100000, 'o cônjuge 1/2 do particular'); eq(r.itc.linhas.find(l => l.nome === 'V').imposto, 3000, 'o cônjuge 3% sem quotas');
eq(nome(r, 'a').valor, 300000, 'o filho 200k quotas + 100k imóvel'); eq(r.itc.linhas.find(l => l.nome === 'a').imposto, 200000 * 0.02 + 100000 * 0.06, 'o filho: faixa pelo total (3478 UFP → 6%) sobre imóvel, 2% quotas');
// (p) fração 0% exclui o bem; '' = 100%
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ nome: 'a' }], bens: [{ valor: 100000, fracao: 0 }, { valor: 50000, fracao: '' }] }, OPTS);
eq(r.pat.monteMor, 50000, 'p fração 0 exclui');
// (q) todos renunciam → aviso art. 1.811
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ nome: 'a', condicao: 'renuncia' }], ascendentes: { maeViva: true, mae: 'Mãe' }, bens: [{ valor: 100000 }] }, OPTS);
eq(r.suc.avisos.some(a => /1\.811/.test(a)), true, 'q aviso 1.811');
// isenção art. 8º VI: só o imóvel, e só se único imóvel ≤ 2.600 UFP
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ uid: 'h1', nome: 'a' }], isencaoUnicoImovel: true, isentosVI: { h1: true }, bens: [{ tipo: 'imovel_urbano', valor: 150000 }, { tipo: 'veiculo', valor: 60000 }] }, OPTS);
eq(r.itc.linhas[0].situacao, 'tributado', 'VI só o imóvel'); eq(r.itc.linhas[0].imposto, 60000 * 0.03, 'VI tributa só o carro');
r = M.inventario({ estadoCivil: 'solteiro', descendentes: [{ uid: 'h1', nome: 'a' }], isencaoUnicoImovel: true, isentosVI: { h1: true }, bens: [{ tipo: 'imovel_urbano', valor: 300000 }] }, OPTS);
eq(r.itc.unicoImovelOk, false, 'VI imóvel acima de 2.600 UFP'); eq(r.itc.linhas[0].situacao, 'tributado', 'VI negada');
// art. 10 §7: doação anterior 500k (imposto 10.000 já pago) + 200k agora → 4% × 700k − 10.000 = 18.000
d = M.doacao({ donatarios: [{ uid: 'a', nome: 'X', doacoesAnteriores: 500000, impostoAnterior: 10000 }], bens: [{ tipo: 'imovel_urbano', valor: 200000, destino: 'a' }] }, OPTS);
eq(d.linhas[0].imposto, 18000, '§7 recálculo sobre o acumulado');
// cônjuge sem nome → aviso
r = M.inventario({ estadoCivil: 'casado', regime: 'parcial', conjuge: { nome: '' }, descendentes: [{ nome: 'a' }], bens: [{ valor: 100000, natureza: 'comum' }] }, OPTS);
eq(r.suc.avisos.some(a => /sem o nome/.test(a)), true, 'aviso cônjuge sem nome');

// v1.43 — partilha acordada diferente da legal (caso José/Josefa do pacote SEFAZ): viúva, 6 filhos + 1 pré-morto (2 netos),
// imóvel particular de 499.500; os demais cedem 1570/2997 do próprio quinhão a Alysson (não onerosa)
const J = { nome: 'Josefa', obito: '2025-11-03', estadoCivil: 'solteiro', regime: 'parcial', conjuge: { nome: '' },
  descendentes: [{ uid: 'aly', nome: 'Alysson' }, { uid: 'adr', nome: 'Adriana' }, { uid: 'ado', nome: 'Adriano' }, { uid: 'ala', nome: 'Alan' }, { uid: 'ali', nome: 'Aline' }, { uid: 'and', nome: 'André' },
    { uid: 'ale', nome: 'Alessandra', condicao: 'premorto', representantes: [{ uid: 'bru', nome: 'Bruno' }, { uid: 'bia', nome: 'Bianca' }] }],
  bens: [{ descricao: 'Imóvel', tipo: 'imovel_urbano', valor: 499500, natureza: 'particular' }], multaAtraso: true };
r = M.inventario(J, OPTS);
eq(nome(r, 'Alysson').valor, 71357.14, '43 legal filho (centavo vai para os últimos)'); eq(nome(r, 'André').valor, 71357.15, '43 legal último filho absorve o centavo');
eq(nome(r, 'Bruno').valor, 35678.57, '43 legal neto por representação');
eq(r.suc.benef.reduce((s, b) => s + b.valor, 0), 499500, '43 quinhões fecham no monte');
const ap = M.aplicarCessao(r, { beneficiarioId: 'aly', taxa: new M.Fr(1570, 2997) });
eq(ap.reais.adr, 33976.19, '43 cessão sobre o quinhão exato: 71.357,14 − 37.380,95'); eq(ap.reais.and, 33976.20, '43 cedente com o centavo'); eq(ap.reais.bru, 16988.09, '43 neto cede 18.690,48');
eq(ap.reais.aly, 295642.85, '43 beneficiário recebe a soma (pacote: 295.642,85)'); eq(ap.cedidoTotal, 224285.71, '43 total cedido 224.285,71');
let real = M.partilhaReal(r, { ativa: true, natureza: 'nao_onerosa', reais: ap.reais, taxaFr: ap.taxa });
eq(real.diferenca, 0, '43 partilha fecha'); eq(real.totalExcedente, 224285.71, '43 excedente'); eq(real.beneficiarios.length, 1, '43 um beneficiário'); eq(real.cedentes.length, 7, '43 sete cedentes');
eq(real.taxaUniforme != null, true, '43 taxa uniforme'); eq(real.taxaFr.txt(), '1570/2997', '43 fração da taxa');
const aly = real.rows.find(x => x.id === 'aly'), adr = real.rows.find(x => x.id === 'adr'), bru = real.rows.find(x => x.id === 'bru');
eq(aly.realFr.txt(), '4139/6993', '43 fração real do beneficiário'); eq(aly.excedenteFr.txt(), '3140/6993', '43 fração do excedente (pacote)');
eq(adr.realFr.txt(), '1427/20979', '43 fração real do cedente'); eq(adr.cedeFr.txt(), '1570/20979', '43 fração cedida'); eq(bru.realFr.txt(), '1427/41958', '43 fração real do neto');
eq(real.avisos.some(a => /INTER VIVOS I/.test(a)), true, '43 aviso da Inter Vivos I');
let ex = M.itcmdExcedente(r, real, OPTS);
eq(ex.total, 4485.71, '43 ITCMD inter vivos 2% sobre 224.285,71'); eq(ex.porBeneficiario[0].situacao, 'tributado', '43 excedente tributado'); eq(ex.porBeneficiario[0].aliq, 0.02, '43 alíquota de imóvel');
// cedentes limitados: só os 5 filhos cedem (netos ficam com o quinhão inteiro)
const ap2 = M.aplicarCessao(r, { beneficiarioId: 'aly', taxa: new M.Fr(1570, 2997), cedentesIds: ['adr', 'ado', 'ala', 'ali', 'and'] });
eq(ap2.reais.bru, 35678.57, '43 neto fora da cessão mantém o quinhão'); eq(ap2.cedidoTotal, 186904.75, '43 total cedido só pelos filhos'); eq(ap2.reais.aly, 258261.89, '43 beneficiário com 5 cedentes');
// valor-alvo: Alysson deve ficar com 295.642,85 → taxa deduzida ≈ 52,3857%
const ap3 = M.aplicarCessao(r, { beneficiarioId: 'aly', alvo: 295642.85 });
eq(ap3.reais.aly, 295642.85, '43 alvo atingido'); eq(Math.abs(ap3.taxaNum - 1570 / 2997) < 1e-6, true, '43 taxa deduzida do alvo');
// onerosa: sem ITCMD inter vivos; aviso de ITBI
real = M.partilhaReal(r, { ativa: true, natureza: 'onerosa', reais: ap.reais, taxaFr: ap.taxa });
eq(real.avisos.some(a => /ITBI/.test(a)), true, '43 cessão onerosa → ITBI');
// partilha que não fecha
real = M.partilhaReal(r, { ativa: true, natureza: 'nao_onerosa', reais: Object.assign({}, ap.reais, { adr: 30000 }) });
eq(Math.abs(real.diferenca) > 0, true, '43 partilha não fecha'); eq(real.avisos.some(a => /não fecha/.test(a)), true, '43 aviso não fecha');
// excedente pequeno (≤ 500 UFP) é isento no inter vivos — aferido no total do beneficiário, não por cedente (R17)
const ap4 = M.aplicarCessao(r, { beneficiarioId: 'aly', taxa: 0.05 });
real = M.partilhaReal(r, { ativa: true, natureza: 'nao_onerosa', reais: ap4.reais });
ex = M.itcmdExcedente(r, real, OPTS);
eq(real.totalExcedente, 21407.16, '43 excedente pequeno'); eq(ex.porBeneficiario[0].situacao, 'isento', '43 isento até 500 UFP'); eq(ex.total, 0, '43 sem imposto');

// auditoria v1.43 — M4: taxa 100% cede o quinhão inteiro (sem sobrar 0,01); valor-alvo exato; alvo inatingível avisa
const ap5 = M.aplicarCessao(r, { beneficiarioId: 'aly', taxa: 1 });
eq(Object.keys(ap5.reais).filter(k => k !== 'aly').every(k => ap5.reais[k] === 0), true, 'M4 taxa 100%: cedentes ficam com zero'); eq(ap5.reais.aly, 499500, 'M4 beneficiário fica com tudo');
const ap6 = M.aplicarCessao(r, { beneficiarioId: 'aly', alvo: 300000 });
eq(ap6.reais.aly, 300000, 'M4 alvo exato ao centavo'); eq(Object.values(ap6.reais).reduce((a, b) => a + b, 0), 499500, 'M4 alvo: partilha fecha');
let erro = ''; try { M.aplicarCessao(r, { beneficiarioId: 'aly', alvo: 50000 }); } catch (e) { erro = e.message; } eq(/menor que o quinhão legal/.test(erro), true, 'M4 alvo abaixo do legal avisa');
erro = ''; try { M.aplicarCessao(r, { beneficiarioId: 'aly', alvo: 600000 }); } catch (e) { erro = e.message; } eq(/passa do que os cedentes/.test(erro), true, 'M4 alvo acima do monte avisa');
// M6: denominadores grandes → sem fração "exata" (fica só o valor em reais), sem estourar
const ap7 = M.aplicarCessao(r, { beneficiarioId: 'aly', taxa: new M.Fr(123456789, 987654321) });
real = M.partilhaReal(r, { ativa: true, natureza: 'nao_onerosa', reais: ap7.reais, taxaFr: ap7.taxa });
eq(real.diferenca, 0, 'M6 fecha'); eq(real.rows.find(x => x.id === 'aly').excedenteFr == null, true, 'M6 fração suprimida quando não é segura');
// M1: meeira como beneficiária (excesso de meação) — filhos cedem tudo à viúva
const V = { nome: 'V', obito: '2026-01-01', estadoCivil: 'casado', regime: 'universal', conjuge: { nome: 'Viúva' }, filhosComuns: 'sim', descendentes: [{ uid: 'f1', nome: 'F1' }, { uid: 'f2', nome: 'F2' }], bens: [{ descricao: 'Casa', tipo: 'imovel_urbano', valor: 400000, natureza: 'comum' }] };
r = M.inventario(V, OPTS);
eq(M.linhasPartilha(r).map(l => l.id).join(','), 'meacao,f1,f2', 'M1 universal: só meação (não concorre)');
const ap8 = M.aplicarCessao(r, { beneficiarioId: 'meacao', taxa: 1 });
real = M.partilhaReal(r, { ativa: true, natureza: 'nao_onerosa', reais: ap8.reais });
eq(real.rows.find(x => x.id === 'meacao').real, 400000, 'M1 viúva fica com tudo'); eq(real.totalExcedente, 200000, 'M1 excesso de meação'); eq(real.beneficiarios[0].id, 'meacao', 'M1 beneficiária = meeira');
ex = M.itcmdExcedente(r, real, OPTS); eq(ex.total, 4000, 'M1 ITCMD inter vivos 2% sobre 200.000');
// L6: base do quadro 10 com isenção do art. 8º, VI parcial — motor expõe baseTrib
const U = { nome: 'U', obito: '2026-01-01', estadoCivil: 'solteiro', descendentes: [{ uid: 'a', nome: 'A' }], bens: [{ descricao: 'Casa', tipo: 'imovel_urbano', valor: 150000, natureza: 'particular' }, { descricao: 'Carro', tipo: 'veiculo', valor: 60000, natureza: 'particular' }], isencaoUnicoImovel: true, isentosVI: { a: true } };
r = M.inventario(U, OPTS);
eq(r.itc.linhas[0].baseTrib, 60000, 'L6 baseTrib = quinhão − imóvel isento'); eq(r.itc.linhas[0].imposto, 1800, 'L6 imposto sobre 60.000');

console.log(`\n${ok} ok, ${falhas} falha(s)`);
process.exit(falhas ? 1 : 0);
