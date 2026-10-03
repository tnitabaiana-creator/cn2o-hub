"""Dependências locais de OCR com versões e integridade fixadas; sem CDN em execução."""
from pathlib import Path
import base64,hashlib,io,tarfile,urllib.request,concurrent.futures
ROOT=Path(__file__).resolve().parent
TARGET=ROOT/'controle-despesas/vendor'
if not (ROOT/'controle-despesas').is_dir():TARGET=ROOT/'dist/controle-despesas/vendor'
TARGET.mkdir(parents=True,exist_ok=True)
PACKAGES=[
 ('pdfjs-dist','5.6.205','tlUj+2IDa7G1SbvBNN74UHRLJybZDWYom+k6p5KIZl7huBvsA4APi6mKL+zCxd3tLjN5hOOEE9Tv7VdzO88pfg=='),
 ('tesseract.js','7.0.0','exPBkd+z+wM1BuMkx/Bjv43OeLBxhL5kKWsz/9JY+DXcXdiBjiAch0V49QR3oAJqCaL5qURE0vx9Eo+G5YE7mA=='),
 ('tesseract.js-core','7.0.0','WnNH518NzmbSq9zgTPeoF8c+xmilS8rFIl1YKbk/ptuuc7p6cLNELNuPAzcmsYw450ca6bLa8j3t0VAtq435Vw==')]
def install(pkg):
 name,version,expected=pkg
 data=urllib.request.urlopen(f'https://registry.npmjs.org/{name}/-/{name}-{version}.tgz',timeout=90).read()
 if base64.b64encode(hashlib.sha512(data).digest()).decode()!=expected:raise RuntimeError('Integridade divergente: '+name)
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
  for member in archive.getmembers():
   if not member.isfile():continue
   sub=member.name.removeprefix('package/')
   destination=None
   if name=='pdfjs-dist':
    if sub in ('build/pdf.mjs','build/pdf.worker.mjs'):destination=TARGET/Path(sub).name
    elif sub.startswith(('cmaps/','standard_fonts/','wasm/')):destination=TARGET/sub
    elif sub=='LICENSE':destination=TARGET/'PDFJS-LICENSE.txt'
   elif name=='tesseract.js':
    if sub in ('dist/tesseract.min.js','dist/worker.min.js'):destination=TARGET/Path(sub).name
    elif sub=='LICENSE.md':destination=TARGET/'TESSERACTJS-LICENSE.txt'
   elif sub.endswith(('.wasm','.wasm.js')) or sub.startswith('LICENSE'):destination=TARGET/'tesseract-core'/sub
   if destination:
    if not destination.resolve().is_relative_to(TARGET.resolve()):raise RuntimeError('Caminho inseguro no pacote')
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_bytes(archive.extractfile(member).read())
 return name
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
 for name in executor.map(install,PACKAGES):print('OCR instalado:',name)
language=urllib.request.urlopen('https://tessdata.projectnaptha.com/4.0.0/por.traineddata.gz',timeout=90).read()
if hashlib.sha256(language).hexdigest()!='3f5feea9dfc39106c92348089097a39bec66e9d6d09ca49befebb0bb60947374':raise RuntimeError('Integridade divergente do idioma português')
(TARGET/'lang').mkdir(exist_ok=True)
(TARGET/'lang/por.traineddata.gz').write_bytes(language)
print('OCR português pronto; arquivos e credenciais de usuários ficam fora da publicação.')
