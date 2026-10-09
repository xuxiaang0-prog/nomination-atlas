from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
target=root.parent/'NominationAtlas_Source.zip'
with ZipFile(target,'w',ZIP_DEFLATED) as out:
 for p in sorted(root.rglob('*')):
  if p.is_file() and not any(x in p.relative_to(root).parts for x in ['node_modules','bin','obj','dist','.git','.runtime']):
   out.write(p,'NominationAtlas/'+str(p.relative_to(root)))
print(f'{target}: {target.stat().st_size:,} bytes')
