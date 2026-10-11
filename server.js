const express = require('express');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const { Server } = require('socket.io');

const PORT = Number(process.env.PORT || 4317);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const DATA = process.env.VIBRATOK_DATA_DIR || path.join(process.env.APPDATA || ROOT, 'VibraTokData');
const UPLOADS = path.join(DATA, 'uploads');
const DB_FILE = path.join(DATA, 'database.json');
const SECRET_FILE = path.join(DATA, '.jwt-secret');
fs.mkdirSync(UPLOADS, {recursive:true});
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'), {mode:0o600});
const SECRET = process.env.JWT_SECRET || fs.readFileSync(SECRET_FILE,'utf8').trim();
const emptyDB = () => ({users:[], posts:[], sounds:[], comments:[], follows:[], likes:[], messages:[], reports:[], blocks:[]});
let db;
try { db = fs.existsSync(DB_FILE) ? {...emptyDB(), ...JSON.parse(fs.readFileSync(DB_FILE,'utf8'))} : emptyDB(); } catch { db = emptyDB(); }
let saveTimer;
function save(){ clearTimeout(saveTimer); saveTimer=setTimeout(()=>{const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2)); fs.renameSync(tmp,DB_FILE);},100); }
function id(){return crypto.randomUUID();}
function safeUser(u){return {id:u.id,username:u.username,displayName:u.displayName,bio:u.bio||'',avatar:u.avatar||'',createdAt:u.createdAt,followers:db.follows.filter(x=>x.to===u.id).length,following:db.follows.filter(x=>x.from===u.id).length};}
function tokenFor(u){return jwt.sign({sub:u.id},SECRET,{expiresIn:'30d'});}
function auth(req,res,next){const h=req.headers.authorization||'';try{if(!h.startsWith('Bearer '))throw 0;const p=jwt.verify(h.slice(7),SECRET);req.user=db.users.find(u=>u.id===p.sub);if(!req.user)throw 0;next();}catch{return res.status(401).json({error:'Inicia sesión para continuar.'});}}
const app=express();
app.disable('x-powered-by'); app.use(helmet({contentSecurityPolicy:false,crossOriginResourcePolicy:{policy:'cross-origin'},crossOriginOpenerPolicy:{policy:'same-origin-allow-popups'}}));
app.use(express.json({limit:'1mb'})); app.use('/uploads',express.static(UPLOADS,{maxAge:'1h'}));
app.use('/api/',rateLimit({windowMs:15*60*1000,limit:500,standardHeaders:true,legacyHeaders:false}));
app.use(express.static(path.join(ROOT,'src')));
const mediaStorage=multer.diskStorage({destination:(_,__,cb)=>cb(null,UPLOADS),filename:(_,file,cb)=>cb(null,crypto.randomUUID()+path.extname(file.originalname).toLowerCase())});
const upload=multer({storage:mediaStorage,limits:{fileSize:250*1024*1024},fileFilter:(_,f,cb)=>cb(null, f.mimetype.startsWith('video/')||f.mimetype.startsWith('image/'))});
const audioUpload=multer({storage:mediaStorage,limits:{fileSize:40*1024*1024},fileFilter:(_,f,cb)=>cb(null, f.mimetype.startsWith('audio/'))});
function safeSound(sound){const owner=db.users.find(u=>u.id===sound.userId);return {id:sound.id,title:sound.title,artist:sound.artist,genre:sound.genre||'',audioUrl:sound.audioUrl,createdAt:sound.createdAt,uploadedBy:owner?{id:owner.id,username:owner.username,displayName:owner.displayName}:null,rightsConfirmed:!!sound.rightsConfirmed,uses:db.posts.filter(p=>p.soundId===sound.id).length};}
app.get('/api/health',(_,res)=>res.json({ok:true,service:'VibraTok',database:'json-persistent',storage:'local',version:'1.0.0'}));
function googleSignInConfig(){try{const f=path.join(DATA,'google-signin.json');return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')):{}}catch{return {}}}
app.get('/api/auth/google-config',(_,res)=>{const cfg=googleSignInConfig();res.json({clientId:process.env.GOOGLE_CLIENT_ID||cfg.clientId||'188062078397-9ghnv0tgdtlfnuaik64pvb0mck1lk13t.apps.googleusercontent.com'})});
app.post('/api/auth/google',rateLimit({windowMs:15*60*1000,limit:15}),async(req,res)=>{try{const cfg=googleSignInConfig(),clientId=process.env.GOOGLE_CLIENT_ID||cfg.clientId||'188062078397-9ghnv0tgdtlfnuaik64pvb0mck1lk13t.apps.googleusercontent.com';if(!clientId)return res.status(503).json({error:'Falta configurar el ID de cliente de Google. Ejecuta CONFIGURAR_INICIO_GOOGLE.bat.'});const credential=String(req.body?.credential||'');if(!credential)return res.status(400).json({error:'Google no devolvió una credencial.'});const client=new OAuth2Client(clientId);const ticket=await client.verifyIdToken({idToken:credential,audience:clientId});const g=ticket.getPayload();if(!g||!g.email||!g.email_verified)return res.status(401).json({error:'Google debe confirmar tu correo electrónico.'});const email=g.email.toLowerCase();let u=db.users.find(x=>x.email===email);if(!u){const base=String(g.name||email.split('@')[0]).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_.]/g,'_').replace(/^[^a-z0-9]+/,'').slice(0,20)||'usuario';let username=base,n=1;while(db.users.some(x=>x.username===username))username=(base.slice(0,20-String(n).length)+n++).slice(0,24);u={id:id(),username,email,displayName:String(g.name||base).slice(0,50),bio:'',avatar:'',emailVerified:true,googleSub:g.sub,createdAt:new Date().toISOString()};db.users.push(u);save()}else if(!u.googleSub){u.googleSub=g.sub;u.emailVerified=true;save()}return res.json({token:tokenFor(u),user:safeUser(u)})}catch(e){console.error('Google sign-in error:',e.message);return res.status(401).json({error:'No se pudo validar el inicio de sesión con Google. Comprueba el cliente OAuth y vuelve a intentarlo.'})}});
// Registro obligatorio por código enviado al correo del usuario.
const registrationCodes = new Map();
function makeCodeEntry(email, payload){ const code=String(crypto.randomInt(0,1000000)).padStart(6,'0'); return {code,entry:{email,hash:crypto.createHash('sha256').update(code).digest('hex'),expires:Date.now()+10*60*1000,attempts:0,payload}}; }
function emailMessage(code, kind){ const registration=kind==='registration'; const purpose=registration?'verificar tu correo y activar tu cuenta':'recuperar tu contraseña'; return {subject:registration?'Verifica tu correo para VibraTok':'Tu código de recuperación de VibraTok',text:`Tu código de VibraTok para ${purpose} es: ${code}\n\nCaduca en 10 minutos. Si no solicitaste este código, ignora este correo.`,html:`<div style="font-family:Arial,sans-serif;background:#101019;color:#fff;padding:28px;border-radius:16px"><h2>VibraTok</h2><p>Tu código para ${purpose} es:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#d85bff">${code}</div><p>Caduca en 10 minutos. Si no solicitaste este código, ignora este correo.</p></div>`}; }
app.post('/api/auth/register',rateLimit({windowMs:60*60*1000,limit:8}),async(req,res)=>{try{let {username,email,password,displayName}=req.body||{};username=String(username||'').trim().toLowerCase().replace(/^@/,'');email=String(email||'').trim().toLowerCase();displayName=String(displayName||username).trim().slice(0,50);if(!/^[a-z0-9_.]{3,24}$/.test(username))return res.status(400).json({error:'El usuario debe tener 3–24 caracteres: letras, números, punto o guion bajo.'});if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:'Escribe un correo válido.'});if(typeof password!=='string'||password.length<8)return res.status(400).json({error:'La contraseña debe tener al menos 8 caracteres.'});if(!displayName)return res.status(400).json({error:'Escribe tu nombre visible.'});if(db.users.some(u=>u.username===username||u.email===email))return res.status(409).json({error:'Ese usuario o correo ya está registrado.'});const transport=mailTransport();if(!transport)return res.status(503).json({error:'El envío de correo todavía no está configurado. El administrador debe configurar el correo de VibraTok antes de registrar cuentas.'});const {code,entry}=makeCodeEntry(email,{username,email,passwordHash:await bcrypt.hash(password,12),displayName});try{const msg=emailMessage(code,'registration');await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER||'VibraTok <vibratokoficial@gmail.com>',to:email,...msg});registrationCodes.set(email,entry);res.status(202).json({message:'Te enviamos un código de 6 dígitos. Revisa tu correo y spam; caduca en 10 minutos.'});}catch(e){console.error('No se pudo enviar el código de registro:',e.message);res.status(502).json({error:'No se pudo enviar el código. Revisa la configuración del correo de VibraTok.'});}}catch(e){console.error(e);res.status(500).json({error:'No se pudo iniciar el registro.'});}});
app.post('/api/auth/verify-registration',rateLimit({windowMs:15*60*1000,limit:10}),async(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase(),code=String(req.body?.code||'').trim();const entry=registrationCodes.get(email);if(!entry||entry.expires<Date.now()){registrationCodes.delete(email);return res.status(400).json({error:'El código caducó o no existe. Inicia el registro de nuevo.'});}entry.attempts++;if(entry.attempts>5){registrationCodes.delete(email);return res.status(429).json({error:'Demasiados intentos. Inicia el registro de nuevo.'});}const hash=crypto.createHash('sha256').update(code).digest('hex');if(!/^\d{6}$/.test(code)||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(entry.hash)))return res.status(400).json({error:'El código no es correcto.'});const d=entry.payload;if(db.users.some(u=>u.username===d.username||u.email===d.email)){registrationCodes.delete(email);return res.status(409).json({error:'Ese usuario o correo ya está registrado.'});}const u={id:id(),...d,bio:'',avatar:'',emailVerified:true,createdAt:new Date().toISOString()};db.users.push(u);registrationCodes.delete(email);save();res.status(201).json({token:tokenFor(u),user:safeUser(u)});});
app.post('/api/auth/login',rateLimit({windowMs:15*60*1000,limit:15}),async(req,res)=>{const login=String(req.body?.login||'').trim().toLowerCase();const u=db.users.find(x=>x.email===login||x.username===login.replace(/^@/,''));if(!u||!await bcrypt.compare(String(req.body?.password||''),u.passwordHash))return res.status(401).json({error:'Usuario/correo o contraseña incorrectos.'});res.json({token:tokenFor(u),user:safeUser(u)});});
// Recuperación de contraseña por código de correo. Requiere configurar SMTP en el equipo servidor.
const resetCodes = new Map();
function mailTransport(){
  // Prefer OAuth2 for Gmail. No se guarda ni se solicita contraseña de aplicación.
  let oauth={};
  try { const cfg=path.join(DATA,'gmail-oauth.json'); if(fs.existsSync(cfg)) oauth=JSON.parse(fs.readFileSync(cfg,'utf8')); } catch(e) { console.error('No se pudo leer la autorización de Gmail:',e.message); }
  const clientId=process.env.GMAIL_OAUTH_CLIENT_ID||oauth.clientId;
  const clientSecret=process.env.GMAIL_OAUTH_CLIENT_SECRET||oauth.clientSecret;
  const refreshToken=process.env.GMAIL_OAUTH_REFRESH_TOKEN||oauth.refreshToken;
  const user=process.env.GMAIL_SENDER||oauth.user||'vibratokoficial@gmail.com';
  if(clientId&&clientSecret&&refreshToken) return nodemailer.createTransport({service:'gmail',auth:{type:'OAuth2',user,clientId,clientSecret,refreshToken}});
  // Compatibilidad temporal con la configuración SMTP previa, por si el usuario decide volver a ella.
  let saved={};
  try { const cfg=path.join(DATA,'smtp-config.json'); if(fs.existsSync(cfg)) saved=JSON.parse(fs.readFileSync(cfg,'utf8')); } catch(e) { console.error('No se pudo leer la configuración SMTP:',e.message); }
  const host=process.env.SMTP_HOST||saved.host, smtpUser=process.env.SMTP_USER||saved.user, pass=process.env.SMTP_PASS||saved.pass;
  if(!host||!smtpUser||!pass) return null;
  return nodemailer.createTransport({host,port:Number(process.env.SMTP_PORT||saved.port||587),secure:String(process.env.SMTP_SECURE??saved.secure??'false')==='true',auth:{user:smtpUser,pass}});
}
app.post('/api/auth/request-password-reset',rateLimit({windowMs:15*60*1000,limit:5}),async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({error:'Escribe un correo válido.'});
  const user=db.users.find(u=>u.email===email);
  // Respuesta genérica para no revelar qué correos tienen cuenta.
  if(!user) return res.json({message:'Si el correo está registrado, recibirás un código de recuperación.'});
  const transport=mailTransport();
  if(!transport) return res.status(503).json({error:'El envío de correo todavía no está configurado. El administrador debe configurar SMTP para enviar códigos reales.'});
  const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
  resetCodes.set(email,{userId:user.id,hash:crypto.createHash('sha256').update(code).digest('hex'),expires:Date.now()+10*60*1000,attempts:0});
  try{
    const msg=emailMessage(code,'recovery');await transport.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER||'VibraTok <vibratokoficial@gmail.com>',to:email,...msg});
    res.json({message:'Si el correo está registrado, recibirás un código de recuperación.'});
  }catch(e){resetCodes.delete(email);console.error('No se pudo enviar correo de recuperación:',e.message);res.status(502).json({error:'No se pudo enviar el correo. Revisa la configuración SMTP del servidor.'});}
});
app.post('/api/auth/reset-password',rateLimit({windowMs:15*60*1000,limit:8}),async(req,res)=>{
  const email=String(req.body?.email||'').trim().toLowerCase(); const code=String(req.body?.code||'').trim(); const password=req.body?.password;
  if(typeof password!=='string'||password.length<8)return res.status(400).json({error:'La nueva contraseña debe tener al menos 8 caracteres.'});
  const entry=resetCodes.get(email);
  if(!entry||entry.expires<Date.now()){resetCodes.delete(email);return res.status(400).json({error:'El código ha caducado o no existe. Solicita uno nuevo.'});}
  entry.attempts++; if(entry.attempts>5){resetCodes.delete(email);return res.status(429).json({error:'Demasiados intentos. Solicita un código nuevo.'});}
  const hash=crypto.createHash('sha256').update(code).digest('hex');
  if(!/^\d{6}$/.test(code)||!crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(entry.hash)))return res.status(400).json({error:'El código no es correcto.'});
  const user=db.users.find(u=>u.id===entry.userId&&u.email===email); if(!user){resetCodes.delete(email);return res.status(400).json({error:'No se pudo recuperar esta cuenta.'});}
  user.passwordHash=await bcrypt.hash(password,12);resetCodes.delete(email);save();res.json({message:'Contraseña actualizada. Ya puedes iniciar sesión.'});
});
app.get('/api/me',auth,(req,res)=>res.json({user:safeUser(req.user)}));
app.patch('/api/me',auth,(req,res)=>{const displayName=String(req.body?.displayName??req.user.displayName).trim().slice(0,50);const bio=String(req.body?.bio??req.user.bio).trim().slice(0,240);if(!displayName)return res.status(400).json({error:'El nombre no puede estar vacío.'});req.user.displayName=displayName;req.user.bio=bio;save();res.json({user:safeUser(req.user)});});
app.post('/api/me/avatar',auth,upload.single('avatar'),(req,res)=>{if(!req.file||!req.file.mimetype.startsWith('image/'))return res.status(400).json({error:'Selecciona una imagen para tu foto de perfil.'});req.user.avatar='/uploads/'+req.file.filename;save();res.json({user:safeUser(req.user)});});
app.get('/api/users',auth,(req,res)=>{const q=String(req.query.q||'').toLowerCase().slice(0,80);res.json(db.users.filter(u=>u.id!==req.user.id&&(u.username.includes(q)||u.displayName.toLowerCase().includes(q))).slice(0,30).map(u=>({...safeUser(u),following:db.follows.some(f=>f.from===req.user.id&&f.to===u.id)})));});
app.post('/api/users/:id/follow',auth,(req,res)=>{if(req.params.id===req.user.id)return res.status(400).json({error:'No puedes seguirte a ti mismo.'});if(!db.users.some(u=>u.id===req.params.id))return res.status(404).json({error:'Usuario no encontrado.'});const i=db.follows.findIndex(f=>f.from===req.user.id&&f.to===req.params.id);if(i>=0)db.follows.splice(i,1);else db.follows.push({from:req.user.id,to:req.params.id,createdAt:new Date().toISOString()});save();res.json({following:i<0});});
// Biblioteca compartida de sonidos. Cada usuario debe confirmar que posee o tiene permiso para distribuir el audio.
app.get('/api/sounds',auth,(req,res)=>{const q=String(req.query.q||'').toLowerCase().slice(0,100);res.json({sounds:db.sounds.filter(s=>(s.title+' '+s.artist+' '+(s.genre||'')).toLowerCase().includes(q)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,200).map(safeSound)});});
app.post('/api/sounds',auth,audioUpload.single('audio'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Selecciona un archivo de audio compatible (MP3, WAV, OGG o M4A).'});const title=String(req.body?.title||'').trim().slice(0,100);const artist=String(req.body?.artist||req.user.displayName).trim().slice(0,100);const genre=String(req.body?.genre||'').trim().slice(0,50);const confirmed=String(req.body?.rightsConfirmed||'')==='true';if(!title){fs.unlink(req.file.path,()=>{});return res.status(400).json({error:'Escribe el título del sonido.'});}if(!confirmed){fs.unlink(req.file.path,()=>{});return res.status(400).json({error:'Debes confirmar que tienes derechos o autorización para compartir este audio.'});}const sound={id:id(),userId:req.user.id,title,artist,genre,audioUrl:'/uploads/'+req.file.filename,originalName:path.basename(req.file.originalname).slice(0,180),rightsConfirmed:true,createdAt:new Date().toISOString()};db.sounds.push(sound);save();res.status(201).json({sound:safeSound(sound)});});
app.get('/api/feed',auth,(req,res)=>{const following=req.query.mode==='following';const blocked=new Set(db.blocks.filter(b=>b.from===req.user.id||b.to===req.user.id).map(b=>b.from===req.user.id?b.to:b.from));const list=db.posts.filter(p=>!blocked.has(p.userId)&&(!following||db.follows.some(f=>f.from===req.user.id&&f.to===p.userId))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,100).map(p=>({...p,sound:p.soundId?(()=>{const so=db.sounds.find(s=>s.id===p.soundId);return so?safeSound(so):null})():null,user:safeUser(db.users.find(u=>u.id===p.userId)),liked:db.likes.some(l=>l.postId===p.id&&l.userId===req.user.id),likeCount:db.likes.filter(l=>l.postId===p.id).length,commentCount:db.comments.filter(c=>c.postId===p.id).length}));res.json({posts:list});});
app.post('/api/posts',auth,upload.single('video'),(req,res)=>{if(!req.file)return res.status(400).json({error:'Selecciona un video o imagen.'});const soundId=String(req.body.soundId||'');const sound=soundId?db.sounds.find(s=>s.id===soundId):null;if(soundId&&!sound){fs.unlink(req.file.path,()=>{});return res.status(400).json({error:'Ese sonido ya no está disponible.'});}const post={id:id(),userId:req.user.id,caption:String(req.body.caption||'').trim().slice(0,2000),mediaUrl:'/uploads/'+req.file.filename,mimeType:req.file.mimetype,originalName:path.basename(req.file.originalname).slice(0,180),soundId:sound?.id||null,createdAt:new Date().toISOString()};db.posts.push(post);save();res.status(201).json({post:{...post,sound:sound?safeSound(sound):null,user:safeUser(req.user),liked:false,likeCount:0,commentCount:0}});});
app.post('/api/posts/:id/like',auth,(req,res)=>{if(!db.posts.some(p=>p.id===req.params.id))return res.status(404).json({error:'Publicación no encontrada.'});const i=db.likes.findIndex(l=>l.postId===req.params.id&&l.userId===req.user.id);if(i>=0)db.likes.splice(i,1);else db.likes.push({postId:req.params.id,userId:req.user.id,createdAt:new Date().toISOString()});save();res.json({liked:i<0,likeCount:db.likes.filter(l=>l.postId===req.params.id).length});});
app.get('/api/posts/:id/comments',auth,(req,res)=>res.json({comments:db.comments.filter(c=>c.postId===req.params.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(c=>({...c,user:safeUser(db.users.find(u=>u.id===c.userId))}))}));
app.post('/api/posts/:id/comments',auth,(req,res)=>{if(!db.posts.some(p=>p.id===req.params.id))return res.status(404).json({error:'Publicación no encontrada.'});const text=String(req.body?.text||'').trim().slice(0,1000);if(!text)return res.status(400).json({error:'Escribe un comentario.'});const c={id:id(),postId:req.params.id,userId:req.user.id,text,createdAt:new Date().toISOString()};db.comments.push(c);save();res.status(201).json({comment:{...c,user:safeUser(req.user)}});});
app.get('/api/messages/:userId',auth,(req,res)=>{const other=req.params.userId;const blocked=db.blocks.some(b=>(b.from===req.user.id&&b.to===other)||(b.from===other&&b.to===req.user.id));if(blocked)return res.status(403).json({error:'Esta conversación no está disponible.'});res.json({messages:db.messages.filter(m=>(m.from===req.user.id&&m.to===other)||(m.from===other&&m.to===req.user.id)).slice(-300).map(m=>({...m,sender:safeUser(db.users.find(u=>u.id===m.from))}))});});
app.get('/api/conversations',auth,(req,res)=>{const ids=new Set();for(const m of db.messages){if(m.from===req.user.id)ids.add(m.to);if(m.to===req.user.id)ids.add(m.from);}res.json({users:[...ids].map(uid=>{const u=db.users.find(x=>x.id===uid);return u?{...safeUser(u),lastMessage:db.messages.filter(m=>(m.from===uid&&m.to===req.user.id)||(m.from===req.user.id&&m.to===uid)).slice(-1)[0]}:null;}).filter(Boolean)});});
app.post('/api/report',auth,(req,res)=>{const reason=String(req.body?.reason||'').trim().slice(0,500);const targetId=String(req.body?.targetId||'').slice(0,80);if(!reason)return res.status(400).json({error:'Indica el motivo.'});db.reports.push({id:id(),from:req.user.id,targetId,reason,createdAt:new Date().toISOString(),status:'pending'});save();res.status(201).json({ok:true,message:'Reporte guardado en este servidor.'});});
app.post('/api/block/:userId',auth,(req,res)=>{if(req.params.userId===req.user.id)return res.status(400).json({error:'No puedes bloquearte.'});const i=db.blocks.findIndex(b=>b.from===req.user.id&&b.to===req.params.userId);if(i>=0)db.blocks.splice(i,1);else db.blocks.push({from:req.user.id,to:req.params.userId,createdAt:new Date().toISOString()});save();res.json({blocked:i<0});});
const server=http.createServer(app);const io=new Server(server,{cors:{origin:false}});
io.use((socket,next)=>{try{const t=socket.handshake.auth?.token;if(!t)throw 0;const p=jwt.verify(t,SECRET);const u=db.users.find(x=>x.id===p.sub);if(!u)throw 0;socket.user=u;next();}catch{next(new Error('No autorizado'));}});
io.on('connection',socket=>{socket.join('user:'+socket.user.id);socket.on('private:send',payload=>{const to=String(payload?.to||'');const text=String(payload?.text||'').trim().slice(0,4000);if(!text||text.length>4000||!db.users.some(u=>u.id===to)||to===socket.user.id)return;const blocked=db.blocks.some(b=>(b.from===socket.user.id&&b.to===to)||(b.from===to&&b.to===socket.user.id));if(blocked)return;const msg={id:id(),from:socket.user.id,to,text,createdAt:new Date().toISOString()};db.messages.push(msg);save();const result={...msg,sender:safeUser(socket.user)};io.to('user:'+to).emit('private:message',result);socket.emit('private:message',result);});socket.on('live:join',room=>{if(typeof room!=='string'||!/^live-[a-zA-Z0-9_-]{1,80}$/.test(room))return;socket.join(room);socket.to(room).emit('live:peer-joined',{peerId:socket.id,user:safeUser(socket.user)});});socket.on('live:leave',room=>{if(typeof room==='string'){socket.to(room).emit('live:peer-left',{peerId:socket.id});socket.leave(room);}});for(const ev of ['live:offer','live:answer','live:ice'])socket.on(ev,p=>{if(!p||typeof p.to!=='string'||typeof p.room!=='string')return;socket.to(p.room).emit(ev,{from:socket.id,description:p.description,candidate:p.candidate});});socket.on('disconnect',()=>{for(const room of socket.rooms){if(room.startsWith('live-'))socket.to(room).emit('live:peer-left',{peerId:socket.id});}});});
server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya está ocupado. Cierra el servidor duplicado o inicia VibraTok desde INICIAR_VIBRATOK.bat, que selecciona un puerto libre automáticamente.`);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 100);
  } else {
    console.error('No se pudo iniciar el servidor:', err.message);
    process.exitCode = 1;
  }
});
server.listen(PORT,HOST,()=>console.log(`VibraTok listo en http://${HOST}:${PORT} | datos: ${DATA}`));
module.exports={server,app};
