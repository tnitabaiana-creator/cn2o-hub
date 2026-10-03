// Reenvio idempotente: reutiliza o original, sem criar outra despesa ou perder a leitura.
export async function receiveDocument(candidate,{getDocuments,save,refresh}){
  const old=getDocuments().find(doc=>doc.hash===candidate.hash);
  if(old){old.blob??=candidate.blob;return {document:old,reused:true};}
  try{await save(candidate);return {document:candidate,reused:false};}
  catch(error){
    if(error.code!=='DOCUMENT_EXISTS')throw error;
    await refresh();
    const found=getDocuments().find(doc=>doc.id===error.documentId||doc.hash===candidate.hash);
    if(!found)throw new Error('O documento já foi recebido, mas ainda não apareceu no acervo. Atualize e tente novamente.');
    found.blob??=candidate.blob;return {document:found,reused:true};
  }
}
