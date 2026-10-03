// Sessão normal do Hub; não há segundo cadastro nem login por e-mail.
export const ENDPOINT='https://cn2o-hub-backend-production.up.railway.app';
export function hubHeaders(){return {'X-Auth-Token':sessionStorage.getItem('cn2o_token')||''};}
export async function startAuth(){
  const token=sessionStorage.getItem('cn2o_token');
  if(!token)return {user:null};
  const response=await fetch(ENDPOINT+'/hub/eu',{headers:hubHeaders(),cache:'no-store'});
  if(!response.ok)throw new Error('Sua sessão expirou. Entre novamente no Hub.');
  const user=await response.json();
  if(!['cesar.bravo','jonas.aragao'].includes(user.login))throw new Error('Acesso exclusivo de César Bravo e Jonas Aragão.');
  return {user:{id:user.login,login:user.login,name:user.nome||user.login}};
}
export function showAccess(){document.getElementById('access-dialog').showModal();}
document.getElementById('access-open').onclick=showAccess;
document.getElementById('access-logout').hidden=true;
// Acompanha o tema do Hub sem interferir na interface principal.
try{
  const root=window.parent.document.documentElement;
  const apply=()=>document.documentElement.dataset.theme=root.dataset.theme||'light';
  apply();new MutationObserver(apply).observe(root,{attributes:true,attributeFilter:['data-theme']});
}catch{}
