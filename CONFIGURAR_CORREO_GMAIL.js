const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { stdin, stdout } = process;
const email = 'vibratokoficial@gmail.com';
function ask(q){ return new Promise(resolve=>{ const rl=readline.createInterface({input:stdin,output:stdout}); rl.question(q, a=>{rl.close(); resolve(a.trim());}); }); }
function askHidden(q){ return new Promise((resolve,reject)=>{
  stdout.write(q); let value='';
  const wasRaw=stdin.isRaw; stdin.setRawMode(true); stdin.resume();
  const onData=(buf)=>{ const s=buf.toString('utf8');
    if(s==='\u0003'){cleanup(); stdout.write('\nCancelado.\n'); reject(new Error('Cancelado')); return;}
    if(s==='\r'||s==='\n'){cleanup(); stdout.write('\n'); resolve(value.replace(/\s/g,'')); return;}
    if(s==='\u007f'||s==='\b'){value=value.slice(0,-1); return;}
    if(s.charCodeAt(0)>=32) value+=s;
  };
  function cleanup(){stdin.removeListener('data',onData); stdin.setRawMode(wasRaw||false);}
  stdin.on('data',onData);
 }); }
(async()=>{
 try {
  console.log('VIBRATOK - CONFIGURAR CORREO');
  console.log('Remitente: '+email);
  console.log('Usa la contraseña de aplicación de Google, no la contraseña normal.');
  console.log('La contraseña no se mostrará mientras escribes.');
  const pass=await askHidden('Pega la contraseña de aplicación y pulsa Enter: ');
  if(!pass) throw new Error('No escribiste ninguna contraseña.');
  const base=process.env.VIBRATOK_DATA_DIR || path.join(process.env.APPDATA || __dirname,'VibraTokData');
  const dir=base;
  fs.mkdirSync(dir,{recursive:true});
  const cfg={host:'smtp.gmail.com',port:465,secure:true,user:email,pass,from:'VibraTok <'+email+'>',service:'gmail'};
  const target=path.join(dir,'smtp-config.json');
  fs.writeFileSync(target,JSON.stringify(cfg,null,2),{encoding:'utf8',mode:0o600});
  // Confirm the file can be read back before reporting success.
  const check=JSON.parse(fs.readFileSync(target,'utf8'));
  if(check.user!==email || !check.pass) throw new Error('No se pudo verificar el archivo guardado.');
  console.log('\nConfiguración guardada en: '+target);
  console.log('Cierra VibraTok completamente y vuelve a abrirlo.');
  console.log('Después prueba recuperación con un correo tuyo. El envío aún debe probarse.');
 } catch(e){ console.error('\nNo se pudo guardar: '+e.message); if(e.code==='EACCES'||e.code==='EPERM') console.error('Windows denegó el acceso a la carpeta. Extrae VibraTok en Documentos o Escritorio, no en Archivos de programa.'); process.exitCode=1; }
})();
