// Serviço do servidor como primeira opção; leitura local como recuperação automática.
const useful=result=>!!result?.text?.trim();
const strong=result=>useful(result)&&(result.confidence==null||result.confidence>=50);
export async function automaticRead({primary,secondary,primaryEnabled=true,onFallback=()=>{}}){
  let first,primaryError;
  if(primaryEnabled){
    try{first=await primary();if(strong(first))return first;}
    catch(error){if([401,403].includes(error.status))throw error;primaryError=error;}
  }
  onFallback();
  try{
    const second=await secondary();
    if(!useful(second)&&useful(first))return first;
    if(useful(first)&&useful(second)&&Number(first.confidence)>Number(second.confidence))return first;
    return {...second,fallbackUsed:primaryEnabled};
  }catch(error){
    if(useful(first))return first;
    throw new Error(primaryError?'Não foi possível concluir a leitura automática. O original está guardado; tente reprocessar.':error.message||'Não foi possível ler o documento.');
  }
}
