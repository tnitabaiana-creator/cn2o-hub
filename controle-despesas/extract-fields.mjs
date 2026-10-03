// Extract only labelled facts. Fiscal treatment and payment confirmation are never inferred.
export const FIELD_NAMES = {supplier:'Fornecedor / favorecido',taxId:'CPF / CNPJ do favorecido',description:'Descrição',amount:'Valor',paidDate:'Data do pagamento'};
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const recipient = /^(dados (do|da) )?(recebedor|favorecido|beneficiario|destinatario|destino|fornecedor|prestador|emitente)\b/;
const payer = /^(dados (do|da) )?(pagador|remetente|origem|ordenante|cliente|tomador)\b/;
function dateValue(text){
  const m=text.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
  if(!m)return null;
  const [day,month,year]=m.slice(1).map(Number),d=new Date(Date.UTC(year,month-1,day));
  return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`:null;
}
function amountValue(text){
  const matches=[...text.matchAll(/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})(?!\d)/g)];
  if(matches.length!==1)return null;
  const raw=matches[0][1],number=raw.includes(',')?Number(raw.replace(/\./g,'').replace(',','.')):Number(raw);
  return Number.isFinite(number)&&number>0&&number<1e9?number.toFixed(2):null;
}
function fact(value,page,line,quote,method){return {value,source:{page,line,quote:quote.slice(0,600)},method};}
export function extractFields(pages,{kind='Comprovante de pagamento'}={}){
  const candidates=Object.fromEntries(Object.keys(FIELD_NAMES).map(k=>[k,[]]));
  const warnings=[];
  const payment=normalize(kind).includes('pagamento');
  for(const page of pages){
    const lines=String(page.text||'').replace(/\r/g,'').split('\n').map(x=>x.trim()).filter(Boolean);
    let role=null;
    for(let i=0;i<lines.length;i++){
      const line=lines[i],norm=normalize(line),method=page.method||'ocr';
      const add=(key,val)=>{if(val!==null&&val!==undefined&&String(val).trim())candidates[key].push(fact(val,page.page||1,i+1,line,method));};
      if(payer.test(norm))role='payer';else if(recipient.test(norm))role='recipient';
      const read=(pattern)=>{
        const match=line.match(pattern);if(!match)return null;
        const remainder=(match[1]||'').trim();
        if(remainder)return remainder;
        const next=lines[i+1]||'';
        // Never treat another label as the missing value of this label.
        return next&&!/^(nome|cpf|cnpj|valor|data|banco|institui[cç][aã]o|ag[eê]ncia|conta|vencimento|descri[cç][aã]o)\b/i.test(next)?next:null;
      };
      const named=read(/^(?:fornecedor|favorecido|benefici[aá]rio|recebedor|prestador|emitente|raz[aã]o social)\s*[:\-]\s*(.*)$/i);
      if(named&&role!=='payer')add('supplier',named);
      if(role==='recipient'){
        const name=read(/^nome(?:\s+(?:do|da)\s+(?:recebedor|favorecido|benefici[aá]rio|fornecedor))?\s*(?:[:\-]\s*(.*)|$)/i);
        if(name)add('supplier',name);
        const id=line.match(/(?:CPF\s*\/?\s*CNPJ|CNPJ\s*\/?\s*CPF|CPF|CNPJ)\s*[:\-]?\s*([\d.\-/ ]{11,22})/i);
        if(id){const digits=id[1].replace(/\D/g,'');if([11,14].includes(digits.length))add('taxId',id[1].trim());}
      }
      const explicitId=line.match(/(?:CPF|CNPJ)\s+(?:do|da)\s+(?:recebedor|favorecido|benefici[aá]rio|fornecedor|prestador|emitente)\s*[:\-]?\s*([\d.\-/ ]{11,22})/i);
      if(explicitId){const digits=explicitId[1].replace(/\D/g,'');if([11,14].includes(digits.length))add('taxId',explicitId[1].trim());}
      const amount=read(/^(?:valor(?:\s+(?:pago|transferido|total|do\s+pix|da\s+transa[cç][aã]o|do\s+pagamento))?|total(?:\s+(?:pago|geral|da\s+nota))?)\s*[:\-]?\s*((?:R\$\s*)?[\d.,]+(?:\s.*)?)?$/i);
      if(amount)add('amount',amountValue(amount));
      const dateText=read(/^(?:data\s+(?:do\s+pagamento|da\s+transa[cç][aã]o|da\s+transfer[eê]ncia)|pago\s+em|efetivado\s+em|realizado\s+em)\s*[:\-]?\s*(.*)$/i);
      if(dateText)add('paidDate',dateValue(dateText));
      if(payment){const genericDate=read(/^(?:data(?:\s+e\s+hora)?|data\/hora)(?:\s*[:\-]\s*|\s+(?=\d)|\s*$)(.*)$/i);if(genericDate)add('paidDate',dateValue(genericDate));}
      const description=read(/^(?:descri[cç][aã]o|hist[oó]rico|referente\s+a|servi[cç]o|objeto|discrimina[cç][aã]o|finalidade|mensagem)\s*[:\-]\s*(.*)$/i);
      if(description)add('description',description);
    }
  }
  const fields={};
  for(const [key,items] of Object.entries(candidates)){
    const unique=new Map(items.map(item=>[normalize(item.value),item]));
    if(unique.size===1)fields[key]=[...unique.values()][0];
    else if(unique.size>1)warnings.push({field:key,message:`${FIELD_NAMES[key]}: informações diferentes no documento. Conferir manualmente.`,candidates:items});
  }
  if(!fields.paidDate)warnings.push({field:'paidDate',message:'Data efetiva do pagamento não identificada de forma única. Vencimento e emissão não foram usados.'});
  if(!fields.taxId)warnings.push({field:'taxId',message:'CPF/CNPJ do favorecido não identificado de forma única. Dados do pagador não foram usados.'});
  return {fields,warnings,parserVersion:'labelled-facts-1.0'};
}
export function combineDocuments(docs){
  const fields={},conflicts=[];
  for(const key of Object.keys(FIELD_NAMES)){
    const options=docs.flatMap(doc=>doc.ocr?.fields?.[key]?[{...doc.ocr.fields[key],documentId:doc.id,documentName:doc.name}]:[]);
    const values=new Map(options.map(item=>[normalize(item.value),item]));
    if(values.size===1)fields[key]=[...values.values()][0];
    else if(values.size>1)conflicts.push({field:key,message:`${FIELD_NAMES[key]}: os documentos vinculados apresentam valores diferentes.`,candidates:options});
  }
  // A conflicted field in one attached document must not be filled from another silently.
  for(const doc of docs)for(const warning of doc.ocr?.warnings||[]){
    if(warning.candidates?.length){delete fields[warning.field];conflicts.push({...warning,documentId:doc.id});}
  }
  return {fields,conflicts};
}
