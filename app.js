// ระบบลงชื่อเข้า-ออกงาน — ต้นแบบ frontend ไฟล์เดียว (localStorage + mock data). ไม่ใช่ระบบความปลอดภัยจริง
// ============================================================
// สารบัญ app.js
// 1) Storage & seed       : อ่าน/เขียนข้อมูลตัวอย่างใน localStorage
// 2) Utils                : ฟังก์ชันช่วยแสดงผล วันที่ ตาราง และข้อความแจ้งเตือน
// 3) Auth                 : เข้าสู่ระบบ ออกจากระบบ และตรวจสิทธิ์หน้าเว็บ (เดโม)
// 4) Layout & Menu        : โครงหน้าเว็บ เมนูด้านข้าง และเมนู Hamburger
// 5) Login / Forgot       : หน้าล็อกอินและหน้าลืมรหัสผ่าน (จำลอง)
// 6) Dashboard             : หน้า Home และข้อมูลสรุปตามบทบาท
// 7) Attendance History   : หน้าประวัติการลงเวลา
// 8) Attendance GPS       : ตรวจตำแหน่งและบันทึกเวลาเข้า-ออก (เดโมฝั่งเบราว์เซอร์)
// 9) Other Pages          : โปรไฟล์ การแจ้งเตือน และหน้าที่ยังเป็น placeholder
// 10) Routes              : เชื่อม URL hash กับหน้าเว็บ และตรวจบทบาทเบื้องต้น
// 11) Register             : ส่งข้อมูลสมัครสมาชิกไปยัง API ภายนอก
//
// หมายเหตุความปลอดภัย: โปรเจกต์นี้ยังมีส่วนที่เป็นเดโมและเก็บข้อมูลในเบราว์เซอร์
// ห้ามใช้ localStorage เป็นที่เก็บรหัสผ่านจริง และต้องตรวจสิทธิ์/ตำแหน่งบน backend
// ============================================================

// ===== 1. STORAGE & SEED: จัดเก็บข้อมูลและสร้างข้อมูลตัวอย่าง =====
// localStorage layer. FRONTEND-ONLY DEMO: not secure storage.
const K='att2_';
const rd=(k,d)=>{try{const v=localStorage.getItem(K+k);return v?JSON.parse(v):d}catch{return d}};
const wr=(k,v)=>{try{localStorage.setItem(K+k,JSON.stringify(v));return true}catch{return false}};
// สร้างข้อมูลตัวอย่างเริ่มต้นสำหรับบัญชี กะทำงาน สถานที่ และประวัติลงเวลา
function seed(){
  const users=[
   {id:'U001',name:'สมชาย ใจดี',email:'employee@example.com',password:'Employee123!',role:'employee',dept:'ฝ่ายบัญชี',position:'นักบัญชี',supervisorId:'U002',active:true},
   {id:'U002',name:'สุดา รักงาน',email:'supervisor@example.com',password:'Supervisor123!',role:'supervisor',dept:'ฝ่ายบัญชี',position:'หัวหน้าฝ่าย',supervisorId:null,active:true},
   {id:'U003',name:'ผู้ดูแล ระบบ',email:'admin@example.com',password:'Admin123!',role:'admin',dept:'ฝ่ายบุคคล',position:'เจ้าหน้าที่ HR',supervisorId:null,active:true}];
  const recs=[];const now=new Date();
  for(let i=1;i<=24;i++){const d=new Date(now);d.setDate(d.getDate()-i);if([0,6].includes(d.getDay()))continue;
    const late=i%5===0;const ci=new Date(d);ci.setHours(8,late?50:10+(i*7)%15,0,0);const co=new Date(d);co.setHours(17,35,0,0);
    recs.push({id:'A'+i,userId:'U001',date:d.toLocaleDateString('sv'),checkIn:ci.toISOString(),checkOut:co.toISOString(),shiftId:'S1',late,distance:120+i*9,accuracy:20});}
  return{users,records:recs,
   shifts:[{id:'S1',name:'กะเช้า',start:'08:30',end:'17:30',grace:15,overnight:false}],
   location:{name:'สำนักงานตัวอย่าง (พิกัดตัวอย่าง)',lat:13.7563,lng:100.5018,radius:1000},
   notifications:[{id:'N1',userId:'U001',text:'ยินดีต้อนรับสู่ระบบลงเวลา (ข้อมูลตัวอย่าง)',at:now.toISOString(),read:false,link:'#/dashboard'}],audit:[]};
}
// ตรวจว่ามีข้อมูลเริ่มต้นแล้วหรือยัง; ถ้ายังให้สร้างข้อมูลเดโม
function ensureSeed(){ensureLeaves();if(!rd('seeded',false)){const s=seed();for(const k in s)wr(k,s[k]);wr('seeded',true)}}
const API_BASE='https://school-attendance-api.projectcsemn.workers.dev';
const getUsers=()=>rd('users',[]);
const getCurrentUser=()=>{try{const raw=sessionStorage.getItem('attendance_user');return raw?JSON.parse(raw):null}catch{return null}};
const setCurrentUser=u=>{try{if(u)sessionStorage.setItem('attendance_user',JSON.stringify(u));else{sessionStorage.removeItem('attendance_user');sessionStorage.removeItem('attendance_token')}}catch{}};
async function apiFetch(path,options={}){const token=sessionStorage.getItem('attendance_token');const headers={'Content-Type':'application/json',...(options.headers||{})};if(token)headers.Authorization='Bearer '+token;const response=await fetch(API_BASE+path,{...options,headers});let data={};try{data=await response.json()}catch{}if(!response.ok||data.success===false)throw new Error(data.message||'คำขอไม่สำเร็จ ('+response.status+')');return data}
function normalizeUser(raw){return{id:String(raw.id),name:raw.full_name||raw.name||'',email:raw.email||'',role:raw.role==='admin'?'admin':raw.role==='supervisor'?'supervisor':'employee',active:!!(raw.is_active??raw.active),staffCode:raw.staff_code||'',position:raw.position||''}}
const getAttendanceRecords=()=>rd('records',[]);
const saveAttendanceRecord=r=>{const a=getAttendanceRecords().filter(x=>x.id!==r.id);a.push(r);return wr('records',a)};
const getShifts=()=>rd('shifts',[]);
const getWorkLocation=()=>rd('location',null);
const saveWorkLocation=l=>wr('location',l);
const getNotifications=()=>rd('notifications',[]);
const saveNotifications=n=>wr('notifications',n);
const getAuditLogs=()=>rd('audit',[]);
// ล้างเฉพาะรายการ localStorage ที่ขึ้นต้นด้วย att2_ แล้วสร้างข้อมูลเดโมใหม่
function resetDemoData(){try{const ks=[];for(let i=0;i<localStorage.length;i++)ks.push(localStorage.key(i));ks.filter(k=>k&&k.startsWith(K)).forEach(k=>localStorage.removeItem(k))}catch{}ensureSeed()}
// สร้างรายการลาตัวอย่างครั้งแรก ถ้ายังไม่มีข้อมูลการลา
function ensureLeaves(){if(rd('leaves',null)!==null)return;const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toLocaleDateString('sv')};
  wr('leaves',[{id:'L1',userId:'U001',type:'ลาพักร้อน',start:d(-20),end:d(-19),days:2,submitted:d(-25),status:'approved',approver:'สุดา รักงาน'},
   {id:'L2',userId:'U001',type:'ลากิจ',start:d(7),end:d(7),days:1,submitted:d(-1),status:'pending_supervisor',approver:'-'}])}
const getLeaves=()=>rd('leaves',[]);
const saveLeaves=l=>wr('leaves',l);

// ===== 2. UTILS: ฟังก์ชันช่วยใช้ซ้ำในหลายหน้า =====
const fmtDate=s=>new Date(s).toLocaleDateString('th-TH-u-ca-buddhist',{day:'numeric',month:'short',year:'numeric'});
const fmtTime=s=>s?new Date(s).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'-';
const todayStr=()=>new Date().toLocaleDateString('sv');
// คำนวณระยะทางเป็นเมตรระหว่างพิกัด GPS สองจุด
function haversine(a,b,c,d){const R=6371000,t=x=>x*Math.PI/180,dl=t(c-a),dn=t(d-b);
  const x=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function h(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
// แสดงข้อความแจ้งเตือนชั่วคราวบนหน้าจอ
function toast(msg,type='ok'){const t=h('div','toast',msg);t.style.background=type==='ok'?'#16a34a':type==='warn'?'#ea580c':'#dc2626';document.body.append(t);setTimeout(()=>t.remove(),3000)}
const badge=(text,type='')=>h('span','badge '+type,text);
// สร้างตาราง HTML จากหัวตารางและแถวข้อมูลที่ส่งเข้ามา
function table(head,rows,empty='ไม่พบข้อมูล'){const w=h('div','tw');if(!rows.length){w.append(h('p','msg',empty));return w}
  const t=h('table'),tr=h('tr');head.forEach(x=>tr.append(h('th',null,x)));t.append(tr);
  rows.forEach(r=>{const row=h('tr');r.forEach(c=>{const td=h('td');td.append(c instanceof Node?c:String(c));row.append(td)});t.append(row)});w.append(t);return w}

// ===== 3. AUTH: เข้าสู่ระบบ ออกจากระบบ และตรวจสิทธิ์ (เดโมเท่านั้น) =====
// FRONTEND-ONLY DEMO AUTH. Plain-text passwords in localStorage are NOT secure; real auth must be server-side.

// ตรวจสอบบัญชีในข้อมูลเดโมและบันทึก session ปัจจุบัน
async function login(email,pw){try{const data=await apiFetch('/api/login',{method:'POST',body:JSON.stringify({email:email.trim().toLowerCase(),password:pw})});sessionStorage.setItem('attendance_token',data.token);const user=normalizeUser(data.user);setCurrentUser(user);return{user}}catch(error){return{error:error.message||'เข้าสู่ระบบไม่สำเร็จ'}}}
// ออกจากระบบและกลับไปหน้า Login
function logout(){setCurrentUser(null);location.href='#/login'}
// ตรวจว่ามีผู้ใช้ล็อกอินและมีบทบาทตามที่หน้าต้องการหรือไม่
function requireAuth(roles){ensureSeed();const u=getCurrentUser();if(!u){location.href='#/login';return null}
  if(roles&&!roles.includes(u.role)){location.href='#/dashboard';return null}return u}

const timers=[];const T=(f,ms)=>{timers.push(setInterval(f,ms))};let PAGE={key:'',title:''},LAY=null;

// ===== 4. LAYOUT & MENU: โครงหน้าเว็บ เมนู และแถบด้านบน =====
// Shared layout. NOTE: role checks here are casual UI guards only; real authorization must be enforced by a backend.


const ROLE={employee:'พนักงาน',supervisor:'หัวหน้างาน',admin:'ผู้ดูแล/HR'};
// สร้างรายการเมนูที่เหมาะกับบทบาท employee / supervisor / admin
function menuFor(role){
  const m=[['#/dashboard','🏠',role==='admin'?'Admin Dashboard':'Home'],['#/attendance','📍','ลงเวลาเข้า-ออกงาน'],['#/attendance-history','🕘','ประวัติการลงเวลา'],['#/absence','⚠️','ขาดงาน/มาสาย'],['#/leave-request','📝','ยื่นคำขอลา'],['#/leave','📅','ประวัติการลา'],['#/work-summary','📊','สรุปเวลาทำงาน'],['#/notifications','🔔','การแจ้งเตือน'],['#/profile','👤','โปรไฟล์']];
  if(role==='supervisor')m.push(['#/admin-leaves','✅','รายการรออนุมัติ'],['#/admin-leaves?view=history','🗂️','ประวัติการอนุมัติ']);
  if(role==='admin')m.push(['#/admin-users','👥','จัดการบุคลากร'],['#/admin-location','🗺️','จัดการสถานที่ทำงาน'],['#/admin-shifts','⏱️','จัดการเวลาทำงานและกะ'],['#/admin-attendance','🔍','ตรวจสอบการลงเวลา'],['#/admin-leaves','🧾','จัดการคำขอลา'],['#/admin-reports','📈','รายงาน'],['#/admin-settings','⚙️','ตั้งค่าระบบ']);
  return m}
// สร้างโครงหน้าเว็บหลัก: Sidebar, Hamburger, Topbar, โปรไฟล์ และเนื้อหา
function buildLayout(user){
  const content=h('main'),mq=matchMedia('(max-width:800px)');content.id='content';
  const shell=h('div','shell'),side=h('nav','side'),ov=h('div','ov');ov.hidden=true;side.id='side';side.setAttribute('aria-label','เมนูหลัก');
  const close=h('button','close','ปิดเมนู ✕');close.type='button';
  const brand=h('div','brand','🏢 ระบบลงชื่อเข้า-ออกงาน');side.append(brand,close);
    const closeDrawer=()=>{side.classList.remove('open');ov.hidden=true;mb.setAttribute('aria-expanded','false')};
  menuFor(user.role).forEach(([href,ic,lb])=>{const on=false;
    const a=h('a',on?'on':'');a.href=href;a.title=lb;a.append(h('span','ic',ic),h('span','lb',lb));if(on)a.setAttribute('aria-current','page');a.onclick=()=>{if(mq.matches)closeDrawer()};side.append(a)});
  const out=h('button',null);out.type='button';out.append(h('span','ic','🚪'),h('span','lb','ออกจากระบบ'));out.onclick=logout;side.append(out);
  const main=h('div','main'),top=h('header','top'),mb=h('button','btn menu-btn','☰');mb.type='button';mb.setAttribute('aria-label','เปิด/ปิดเมนู');mb.setAttribute('aria-controls','side');mb.setAttribute('aria-expanded','false');
  mb.onclick=()=>{if(mq.matches){const o=!side.classList.contains('open');side.classList.toggle('open',o);ov.hidden=!o;mb.setAttribute('aria-expanded',String(o))}else{const c=shell.classList.toggle('collapsed');mb.setAttribute('aria-expanded',String(!c))}};
  ov.onclick=closeDrawer;close.onclick=closeDrawer;mq.onchange=closeDrawer;
  const left=h('div','tl');left.append(mb,h('strong','tb','🏢 ระบบลงชื่อเข้า-ออกงาน'),h('span','crumb',`หน้าหลัก / ${PAGE.title}`));
  const clock=h('span','clock'),tick=()=>clock.textContent=new Date().toLocaleString('th-TH-u-ca-buddhist',{dateStyle:'medium',timeStyle:'medium'});tick();setInterval(tick,1000);
  const unread=getNotifications().filter(n=>n.userId===user.id&&!n.read).length;
  const bell=h('a','bell',`🔔 ${unread}`);bell.href='#/notifications';bell.setAttribute('aria-label',`การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน`);
  const um=h('div','um'),ub=h('button','ubtn');ub.type='button';ub.setAttribute('aria-haspopup','true');ub.setAttribute('aria-expanded','false');
  ub.append(h('span','av',user.name.slice(0,1)),h('span','un',`${user.name} · ${ROLE[user.role]}`));
  const dd=h('div','dd');dd.hidden=true;[['#/profile','👤 โปรไฟล์'],[user.role==='admin'?'#/admin-settings':'#/profile','⚙️ ตั้งค่า']].forEach(([hr,t])=>{const a=h('a',null,t);a.href=hr;dd.append(a)});
  const lo=h('button',null,'🚪 ออกจากระบบ');lo.type='button';lo.onclick=logout;dd.append(lo);
  const setDd=o=>{dd.hidden=!o;ub.setAttribute('aria-expanded',String(o))};ub.onclick=e=>{e.stopPropagation();setDd(dd.hidden)};
  document.addEventListener('click',()=>setDd(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setDd(false);closeDrawer()}});
  um.append(ub,dd);top.append(left,h('div','tr'));top.lastChild.append(clock,bell,um);
  main.append(top,content);shell.append(side,ov,main);document.getElementById('app').replaceChildren(shell);return{uid:user.id}}

// ===== 5–9. PAGES: ฟังก์ชันแสดงผลของแต่ละหน้า =====
// ตั้งค่าฟอร์ม Login ตรวจสอบข้อมูล และแสดงข้อผิดพลาด
function page_login(){
  const f=document.getElementById('f');
  const err=document.getElementById('err');
  const pw=document.getElementById('pw');
  const email=document.getElementById('email');
  const show=document.getElementById('show');
  if(!f||!err||!pw||!email){
    console.error('Login form is missing required elements');
    return;
  }
  if(show)show.onchange=e=>pw.type=e.target.checked?'text':'password';

  // The reset button is optional on the login page; never let its absence
  // stop the login form from receiving its submit handler.
  const resetButton=document.getElementById('reset');
  if(resetButton)resetButton.onclick=()=>{
    if(confirm('รีเซ็ตข้อมูลตัวอย่างทั้งหมด?')){
      resetDemoData();
      toast('รีเซ็ตข้อมูลแล้ว');
    }
  };

  f.onsubmit=async e=>{
    e.preventDefault();
    err.textContent='';
    const em=email.value.trim().toLowerCase();
    const p=pw.value;
    if(!/^\S+@\S+\.\S+$/.test(em)){
      err.textContent='กรุณากรอกอีเมลให้ถูกต้อง';
      return;
    }
    if(!p){
      err.textContent='กรุณากรอกรหัสผ่าน';
      return;
    }
    const b=f.querySelector('button[type="submit"]')||f.querySelector('button');
    const originalText=b?b.textContent:'เข้าสู่ระบบ';
    if(b){b.disabled=true;b.textContent='กำลังเข้าสู่ระบบ...';}
    try{
      const result=await login(em,p);
      if(result.error){
        err.textContent=result.error;
        return;
      }
      location.hash='#/dashboard';
      route();
    }catch(error){
      console.error('Login error:',error);
      err.textContent='เกิดข้อผิดพลาดระหว่างเข้าสู่ระบบ กรุณาลองใหม่';
    }finally{
      if(b){b.disabled=false;b.textContent=originalText;}
    }
  };
}

// หน้าลืมรหัสผ่านแบบจำลอง — ไม่ได้ส่งอีเมลหรือรีเซ็ตรหัสผ่านจริง
function page_forgot(){
// DEMO ONLY: no email is sent.
const f=document.getElementById('f'),m=document.getElementById('msg');
f.onsubmit=e=>{e.preventDefault();const v=document.getElementById('email').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(v)){m.style.color='#dc2626';m.textContent='กรุณากรอกอีเมลให้ถูกต้อง';return}
  m.style.color='#166534';m.textContent='(จำลอง) หากอีเมลนี้อยู่ในระบบ จะมีลิงก์รีเซ็ตส่งไป — ระบบเดโมไม่ได้ส่งอีเมลจริง'};

}
// Role-aware Home. Data is read from localStorage on each render so check-in/out updates appear automatically.


const QUOTA=10,ST={pending_supervisor:'รอหัวหน้างานอนุมัติ',pending_hr:'รอฝ่ายบุคคลอนุมัติ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ',withdrawn:'ถอนคำขอแล้ว'};
// รวมข้อมูลที่หน้า Home ต้องใช้ เช่น วันนี้ ทีม คำขอลา และสถิติ
function getDashboardData(u){
  const recs=getAttendanceRecords(),leaves=getLeaves(),users=getUsers().filter(x=>x.active),td=todayStr(),mine=recs.filter(r=>r.userId===u.id);
  const d={mine,today:mine.find(r=>r.date===td),shift:getShifts()[0],loc:getWorkLocation(),myLeaves:leaves.filter(l=>l.userId===u.id),notes:getNotifications().filter(n=>n.userId===u.id)};
  d.leaveLeft=QUOTA-d.myLeaves.filter(l=>l.status==='approved').reduce((s,l)=>s+l.days,0);
  d.team=users.filter(x=>x.supervisorId===u.id);
  d.teamPending=leaves.filter(l=>l.status==='pending_supervisor'&&d.team.some(t=>t.id===l.userId));
  d.teamToday=d.team.map(t=>({t,r:recs.find(r=>r.userId===t.id&&r.date===td)}));
  const tr=recs.filter(r=>r.date===td);d.active=users.length;d.inNow=tr.filter(r=>!r.checkOut).length;d.lateToday=tr.filter(r=>r.late).length;
  d.pendingAll=leaves.filter(l=>l.status.startsWith('pending')).length;return d}
const link=(href,t,cls='')=>{const a=h('a','btn '+cls,t);a.href=href;return a};
const stat=(l,v)=>{const d=h('div','card stat');d.append(h('span',null,l),h('b',null,v));return d};
const hours=r=>{if(!r)return'-';const ms=(r.checkOut?new Date(r.checkOut):new Date())-new Date(r.checkIn),m=Math.max(0,Math.floor(ms/60000));return`${Math.floor(m/60)} ชม. ${m%60} นาที`+(r.checkOut?'':' (กำลังนับ)')};
async function perm(){try{return(await navigator.permissions.query({name:'geolocation'})).state}catch{return'unknown'}}
const PT={granted:'อนุญาตแล้ว',denied:'ถูกปฏิเสธ',prompt:'ยังไม่ได้ขออนุญาต',unknown:'ไม่ทราบสถานะ'};
// วาดการ์ดและกิจกรรมล่าสุดบนหน้า Home ตามบทบาทผู้ใช้
async function render(u,c){const d=getDashboardData(u),t=d.today,p=await perm();let lp=null;try{lp=JSON.parse(localStorage.getItem('att2_lastpos'))}catch{}
  const w=h('section','card');w.append(h('h1',null,`สวัสดี, ${u.name}`),h('p',null,`วันนี้ ${new Date().toLocaleDateString('th-TH-u-ca-buddhist',{dateStyle:'full'})}`),
    h('p',null,`แผนก: ${u.dept} · กะ: ${d.shift.name} ${d.shift.start}–${d.shift.end} · สถานที่: ${d.loc.name}`));
  const g=h('div','grid');g.append(stat('สถานะวันนี้',!t?'ยังไม่ลงชื่อ':t.checkOut?'ครบแล้ว':t.late?'เข้างาน (สาย)':'เข้างานแล้ว'),stat('เวลาเข้า',t?fmtTime(t.checkIn):'-'),stat('เวลาออก',t?.checkOut?fmtTime(t.checkOut):'-'),stat('ชั่วโมงทำงานวันนี้',hours(t)),stat('วันลาคงเหลือ',`${d.leaveLeft} / ${QUOTA} วัน`));
  const q=h('section','card');q.append(h('h2',null,'ทางลัด'));const qr=h('div','row');
  qr.append(link('#/attendance','ลงเวลาเข้างาน','g'),link('#/attendance','ลงเวลาออกงาน','o'),link('#/attendance-history','ประวัติการลงเวลา'),link('#/leave-request','ยื่นคำขอลา'),link('#/notifications','การแจ้งเตือน'));q.append(qr);
  const L=h('section','card');L.append(h('h2',null,'สถานะตำแหน่ง'),h('p',null,`สิทธิ์ตำแหน่งในเบราว์เซอร์: ${PT[p]}`));
  if(lp){const ok=lp.dist<=d.loc.radius,s=h('p',null,`ตรวจล่าสุด: ห่าง ${Math.round(lp.dist)} ม. `);s.append(badge(ok?'อยู่ในพื้นที่':'นอกพื้นที่',ok?'ok':'err'));L.append(s,h('small',null,`เมื่อ ${fmtTime(lp.at)}${lp.dev?' (ค่าจำลอง)':''}`))}
  else L.append(h('p','msg','ยังไม่มีข้อมูลระยะ — เปิดหน้าลงเวลาเพื่อตรวจสอบ GPS'));L.append(h('p',null,`รัศมีที่อนุญาต ${d.loc.radius} เมตร`),link('#/attendance','ตรวจสอบ GPS ที่หน้าลงเวลา'));
  const parts=[w,g,q,L];
  if(u.role==='supervisor'){const s=h('section','card');s.append(h('h2',null,'งานของหัวหน้า'),h('p',null,`คำขอลารอคุณอนุมัติ: ${d.teamPending.length} รายการ`),
    h('p',null,`ทีมที่ลงเวลาแล้ววันนี้: ${d.teamToday.filter(x=>x.r).length}/${d.team.length} คน`),link('#/admin-leaves','ไปหน้ารออนุมัติ'));parts.push(s)}
  if(u.role==='admin'){const a=h('section','card');a.append(h('h2',null,'ภาพรวมหน่วยงาน'));const ag=h('div','grid');
    ag.append(stat('พนักงานที่ใช้งาน',d.active),stat('กำลังอยู่ในที่ทำงาน',d.inNow),stat('มาสายวันนี้',d.lateToday),stat('คำขอลารออนุมัติ',d.pendingAll));
    const ar=h('div','row');[['#/admin-users','จัดการบุคลากร'],['#/admin-attendance','ตรวจสอบการลงเวลา'],['#/admin-leaves','จัดการคำขอลา'],['#/admin-reports','รายงาน']].forEach(([x,y])=>ar.append(link(x,y)));a.append(ag,ar);parts.push(a)}
  const ev=[...d.mine.map(r=>({at:r.checkIn,t:`ลงเวลาเข้างาน ${fmtDate(r.date)} ${fmtTime(r.checkIn)}`,href:'#/attendance-history'})),
    ...d.myLeaves.map(l=>({at:l.submitted,t:`คำขอ${l.type} ${fmtDate(l.start)} — ${ST[l.status]}`,href:'#/leave'})),...d.notes.map(n=>({at:n.at,t:n.text,href:n.link||'#/notifications'}))].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,8);
  const R=h('section','card');R.append(h('h2',null,'กิจกรรมล่าสุด'));
  if(!ev.length)R.append(h('p','msg','ยังไม่มีกิจกรรม'));else{const ul=h('ul');ev.forEach(e=>{const li=h('li'),a=h('a',null,e.t);a.href=e.href;li.append(a);ul.append(li)});R.append(ul)}parts.push(R);
  c.replaceChildren(...parts)}
// เปิดหน้า Home และตั้งเวลารีเฟรชข้อมูลทุก 30 วินาที
async function page_dashboard(u){
 const c=document.getElementById('content');c.replaceChildren(h('p','msg','กำลังโหลดข้อมูลจริงจากระบบ...'));
 const card=(title,sub)=>{const x=h('section','card');x.append(h('h2',null,title));if(sub)x.append(h('p','msg',sub));return x};
 try{
  const data=await apiFetch('/api/attendance');const records=data.records||[];
  const dayKey=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x));
  const today=records.filter(x=>dayKey(x.recorded_at)===dayKey(Date.now()));
  const ci=today.find(x=>x.attendance_type==='check_in'),co=today.find(x=>x.attendance_type==='check_out');
  const welcome=card('สวัสดี '+(u.name||''),'ข้อมูลจาก Cloudflare D1 · '+new Date().toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'full'}));
  const stats=h('div','grid');stats.append(stat('สถานะวันนี้',!ci?'ยังไม่ลงเวลา':co?'ลงเวลาครบ':'เข้างานแล้ว'),stat('เวลาเข้า',ci?new Date(ci.recorded_at).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}):'—'),stat('เวลาออก',co?new Date(co.recorded_at).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}):'—'),stat('รายการที่โหลด',records.length+' รายการ'));
  const quick=card('เมนูใช้งาน');const links=h('div','row');[['#/attendance','ลงเวลาเข้า–ออก'],['#/attendance-history','ประวัติลงเวลา'],['#/leave-request','ยื่นคำขอลา'],['#/profile','ข้อมูลบัญชี']].forEach(([href,label])=>links.append(link(href,label)));quick.append(links);
  const recent=card('รายการลงเวลาล่าสุด');recent.append(table(['วันและเวลา','รายการ','พิกัด'],records.slice(0,8).map(x=>[new Date(x.recorded_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'}),x.attendance_type==='check_in'?'เข้างาน':'ออกงาน',x.latitude==null?'—':x.latitude+', '+x.longitude]),'ยังไม่มีข้อมูลลงเวลา'));
  const parts=[welcome,stats,quick,recent];
  if(u.role==='admin'){
   const [people,leaves,locations]=await Promise.all([apiFetch('/api/admin/personnel'),apiFetch('/api/admin/leaves'),apiFetch('/api/admin/locations')]);
   const pending=(people.personnel||[]).filter(x=>!x.is_active).length,pendingLeaves=(leaves.requests||[]).filter(x=>x.status==='pending').length,active=(people.personnel||[]).filter(x=>x.is_active).length;
   const panel=card('ภาพรวมผู้บริหาร','ข้อมูลปัจจุบันจากฐานข้อมูล');const g=h('div','grid');g.append(stat('บัญชีใช้งาน',active),stat('รออนุมัติบัญชี',pending),stat('คำขอลารอพิจารณา',pendingLeaves),stat('จุดทำงาน',(locations.locations||[]).filter(x=>x.is_active).length));panel.append(g);const row=h('div','row');[['#/admin-users','จัดการบัญชี'],['#/admin-location','ปักหมุดสถานที่'],['#/admin-shifts','กะทำงาน'],['#/admin-leaves','อนุมัติคำขอ'],['#/admin-attendance','ตรวจสอบลงเวลา']].forEach(([href,label])=>row.append(link(href,label)));panel.append(row);parts.unshift(panel)
  }
  c.replaceChildren(...parts)
 }catch(e){c.replaceChildren();adminMessage(c,e.message,'err')}
}
// แสดงประวัติลงเวลา พร้อมตัวกรองเดือน สถานะ และวันที่
async function page_history(u){
 const out=document.getElementById('out'),mo=document.getElementById('mo'),st=document.getElementById('st'),dt=document.getElementById('dt');
 out.textContent='กำลังโหลดประวัติจากฐานข้อมูล...';
 const dayKey=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
 const dateText=key=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d,12)).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'})};
 const timeText=value=>new Date(value).toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'});
 let records=[];
 async function load(){out.replaceChildren(h('p','msg','กำลังโหลดประวัติจากฐานข้อมูล...'));try{const data=await apiFetch('/api/attendance');records=data.records||[];draw()}catch(err){out.replaceChildren();adminMessage(out,err.message,'err')}}
 function draw(){let filtered=records.filter(r=>{const day=dayKey(r.recorded_at);return(!mo.value||day.startsWith(mo.value))&&(!dt.value||day===dt.value)});const grouped=new Map();filtered.forEach(r=>{const day=dayKey(r.recorded_at);if(!grouped.has(day))grouped.set(day,{day,checkIn:null,checkOut:null,events:[]});const g=grouped.get(day);g.events.push(r);if(r.attendance_type==='check_in'&&!g.checkIn)g.checkIn=r;if(r.attendance_type==='check_out'&&!g.checkOut)g.checkOut=r});const rows=[...grouped.values()].sort((a,b)=>b.day.localeCompare(a.day)).filter(g=>!st.value||(st.value==='in'&&g.checkIn)||(st.value==='missing'&&(!g.checkIn||!g.checkOut))).map(g=>[dateText(g.day),g.checkIn?timeText(g.checkIn.recorded_at):'—',g.checkOut?timeText(g.checkOut.recorded_at):'—',g.checkIn&&g.checkOut?'ลงเวลาครบ':g.checkIn?'ยังไม่มีเวลาออก':'มีรายการเวลาออกแต่ไม่พบเวลาเข้า',g.events.length]);out.replaceChildren(table(['วันที่','เวลาเข้า','เวลาออก','สถานะ','จำนวนรายการ'],rows,'ไม่พบประวัติตามเงื่อนไข'))}
 st.replaceChildren();[['','ทั้งหมด'],['in','มีเวลาเข้า'],['missing','รายการไม่ครบ']].forEach(([v,t])=>{const o=h('option',null,t);o.value=v;st.append(o)});[mo,st,dt].forEach(e=>e.oninput=draw);document.getElementById('rs').onclick=()=>{mo.value=st.value=dt.value='';draw()};await load()
}

// PROTOTYPE ONLY: distance checks here run in the browser and can be bypassed.
// Production must re-validate GPS, distance, and server time on a backend.

// หน้าลงเวลา: แสดงแผนที่ ตรวจ GPS คำนวณระยะ และบันทึกเข้า/ออก
async function page_attendance(u){
 const $=id=>document.getElementById(id);let locations=[],coords=null,acc=0,map=null;
 const message=(t)=>{$('gps').textContent=t};
 T(()=>$('clk').textContent=new Date().toLocaleString('th-TH',{timeZone:'Asia/Bangkok',hour12:false}),1000);
 $('wp').textContent='กำลังโหลดสถานที่...';$('sh').textContent='เวลาจากเซิร์ฟเวอร์';$('ci').disabled=true;$('co').disabled=true;
 $('dev')?.closest('label')?.remove();$('dev')?.remove();
 if(window.L){map=L.map('map').setView([15.87,100.99],6);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map)}
 const dist=(a,b,c,d)=>{const r=x=>x*Math.PI/180,x=r(c-a),y=r(d-b),q=Math.sin(x/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q))};
 async function refreshStatus(){try{const d=await apiFetch('/api/attendance'),key=x=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(x)),today=(d.records||[]).filter(x=>key(x.recorded_at)===key(Date.now())),ci=today.some(x=>x.attendance_type==='check_in'),co=today.some(x=>x.attendance_type==='check_out');$('stt').textContent=!ci?'ยังไม่ได้ลงชื่อเข้างาน':co?'ลงเวลาครบแล้ว':'ลงชื่อเข้างานแล้ว';$('ci').disabled=ci||!coords;$('co').disabled=!ci||co||!coords}catch(e){$('stt').textContent=e.message}}
 function readGPS(){coords=null;$('ci').disabled=true;$('co').disabled=true;if(!navigator.geolocation){message('เบราว์เซอร์ไม่รองรับ GPS');return}message('กำลังค้นหาตำแหน่ง GPS...');navigator.geolocation.getCurrentPosition(p=>{coords={latitude:p.coords.latitude,longitude:p.coords.longitude};acc=p.coords.accuracy;$('acc').textContent='±'+Math.round(acc)+' เมตร';if(map){L.marker([coords.latitude,coords.longitude]).addTo(map).bindPopup('ตำแหน่งปัจจุบัน');map.setView([coords.latitude,coords.longitude],15)}const nearest=locations.map(l=>({...l,d:dist(coords.latitude,coords.longitude,l.latitude,l.longitude)})).sort((a,b)=>a.d-b.d)[0];$('dist').textContent=nearest?Math.round(nearest.d)+' เมตร':'—';message(nearest&&nearest.d<=nearest.radius_meters?'ได้รับตำแหน่งแล้ว อยู่ในพื้นที่':'ได้รับตำแหน่งแล้ว');refreshStatus()},e=>message(e.code===1?'กรุณาอนุญาตสิทธิ์ตำแหน่งในเบราว์เซอร์':'อ่านตำแหน่งไม่สำเร็จ กรุณาลองใหม่'),{enableHighAccuracy:true,timeout:15000,maximumAge:0})}
 async function send(type){if(!coords)return toast('กรุณาอ่านตำแหน่ง GPS ก่อน','err');if(!Number.isFinite(acc)||acc>100)return toast('GPS คลาดเคลื่อนมากเกินไป กรุณาลองใหม่','err');$('ci').disabled=true;$('co').disabled=true;try{const d=await apiFetch('/api/attendance',{method:'POST',body:JSON.stringify({type,latitude:coords.latitude,longitude:coords.longitude,accuracy:acc})});toast(d.message);await refreshStatus()}catch(e){toast(e.message,'err');await refreshStatus()}}
 $('rf').onclick=readGPS;$('ci').onclick=()=>send('check_in');$('co').onclick=()=>send('check_out');
 try{const d=await apiFetch('/api/work-location');locations=d.locations||[];if(!locations.length)throw Error('ยังไม่มีสถานที่ทำงานที่เปิดใช้งาน กรุณาติดต่อแอดมิน');$('wp').textContent=locations.map(l=>l.name+' · รัศมี '+l.radius_meters+' เมตร').join(' / ');if(map){locations.forEach(l=>{L.marker([l.latitude,l.longitude]).addTo(map).bindPopup(l.name);L.circle([l.latitude,l.longitude],{radius:l.radius_meters}).addTo(map)});if(locations.length===1)map.setView([locations[0].latitude,locations[0].longitude],15)}await refreshStatus();readGPS()}catch(e){message(e.message);$('wp').textContent=e.message}
}

// Generic page: real profile (read-only) and notifications; other pages are labeled placeholders.

// แสดงหน้าโปรไฟล์/แจ้งเตือนจริงบางส่วน; หน้าอื่นเป็นโครงรอพัฒนาต่อ
function page_stub(u){const c=document.getElementById('content'),p=PAGE.key;c.append(h('h1',null,PAGE.title));
  if(p==='profile'){c.append(table(['ข้อมูล','ค่า'],[['รหัสพนักงาน',u.id],['ชื่อ',u.name],['อีเมล',u.email],['แผนก',u.dept],['ตำแหน่ง',u.position],['บทบาท',u.role],['สถานะบัญชี','ใช้งานอยู่']]))}
  else if(p==='notifications'){const box=h('div','card');c.append(box);const draw=()=>{const all=getNotifications(),mine=all.filter(n=>n.userId===u.id);box.replaceChildren();
    const b=h('button','btn','อ่านทั้งหมด');b.onclick=()=>{mine.forEach(n=>n.read=true);saveNotifications(all);draw()};box.append(b);
    if(!mine.length)box.append(h('p','msg','ไม่มีการแจ้งเตือน'));mine.forEach(n=>{const r=h('p',null,`${n.read?'':'● '}${n.text} — ${fmtDate(n.at)}`);if(!n.read){const m=h('button','btn','อ่านแล้ว');m.onclick=()=>{n.read=true;saveNotifications(all);draw()};r.append(' ',m)}box.append(r)})};draw()}
  else{const m=h('div','card');m.append(h('p','msg','ต้นแบบ: หน้านี้ยังไม่ได้พัฒนาฟังก์ชันในรอบนี้ (ลิงก์ใช้งานได้ ไม่มีหน้าเสีย)'));const a=h('a','btn','กลับหน้าหลัก');a.href='#/dashboard';m.append(a);c.append(m)}}


async function page_leave_request(u){
 const c=document.getElementById('content'),card=h('section','card');card.append(h('h2',null,'ยื่นคำขอลา'),h('p','msg','คำขอจะถูกบันทึกลงฐานข้อมูลและส่งให้แอดมินพิจารณา'));c.append(card);
 const form=h('form','form-grid');
 const type=adminInput('ประเภทการลา','leave-type');type.input.type='text';type.input.placeholder='เช่น ลาป่วย ลากิจ ลาพักผ่อน';type.input.required=true;
 const start=adminInput('วันที่เริ่มลา','leave-start','date'),end=adminInput('วันที่สิ้นสุด','leave-end','date'),reason=adminInput('เหตุผล','leave-reason');reason.input.placeholder='ระบุเหตุผล (ถ้ามี)';
 [type,start,end,reason].forEach(x=>{x.wrap.style.marginBottom='12px';form.append(x.wrap)});
 const submit=h('button','btn g','ส่งคำขอลา');submit.type='submit';form.append(submit);card.append(form);
 const history=adminCard('คำขอของฉัน','ประวัติคำขอจากบัญชีนี้');c.append(history);
 form.onsubmit=async e=>{e.preventDefault();if(end.input.value<start.input.value)return toast('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มลา','err');submit.disabled=true;try{const d=await apiFetch('/api/leave-requests',{method:'POST',body:JSON.stringify({leaveType:type.input.value.trim(),startDate:start.input.value,endDate:end.input.value,reason:reason.input.value.trim()})});toast(d.message);form.reset();await loadMine()}catch(err){toast(err.message,'err')}finally{submit.disabled=false}};
 async function loadMine(){try{const d=await apiFetch('/api/leave-requests');history.replaceChildren(h('h2',null,'คำขอของฉัน'));history.append(table(['ประเภท','วันที่','เหตุผล','สถานะ'],(d.requests||[]).map(x=>[x.leave_type,x.start_date+' ถึง '+x.end_date,x.reason||'—',x.status==='pending'?'รอพิจารณา':x.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธ']),'ยังไม่มีคำขอ'))}catch(err){adminMessage(history,err.message,'err')}}
 await loadMine()
}

/* ===== ADMIN PAGES: ใช้งาน Cloudflare API จริง ===== */
function adminCard(title,description){const c=h('section','card');c.append(h('h2',null,title));if(description)c.append(h('p','msg',description));return c}
function adminButton(label,fn,cls='btn'){const b=h('button',cls,label);b.type='button';b.onclick=fn;return b}
function adminInput(labelText,id,type='text',value=''){const w=h('div');const l=h('label',null,labelText);l.htmlFor=id;const i=h('input');i.id=id;i.type=type;i.value=value;w.append(l,i);return {wrap:w,input:i}}
function adminMessage(parent,text,kind=''){const p=h('p','msg '+kind,text);parent.append(p);return p}

async function page_admin_location(){
 const c=document.getElementById('content');const card=adminCard('จัดการสถานที่ทำงาน','ปักหมุดบนแผนที่ หรือกรอกพิกัดเอง กำหนดรัศมีได้ 10–5,000 เมตร');c.append(card);
 const form=h('form','form-grid');const name=adminInput('ชื่อสถานที่','loc-name');const lat=adminInput('ละติจูด','loc-lat','number','');const lng=adminInput('ลองจิจูด','loc-lng','number','');const radius=adminInput('รัศมี (เมตร)','loc-radius','number','100');
 [name,lat,lng,radius].forEach(x=>{x.input.required=true;x.wrap.style.marginBottom='10px';form.append(x.wrap)});lat.input.step='any';lng.input.step='any';radius.input.min='10';radius.input.max='5000';
 const map=h('div');map.id='admin-location-map';map.style.cssText='height:320px;border-radius:12px;margin:12px 0;background:#eef2f7';form.append(map);
 const hint=h('p','msg','คลิกแผนที่เพื่อกำหนดหมุด หรือกรอกละติจูด/ลองจิจูดด้วยตนเอง');form.append(hint);
 const save=h('button','btn g','บันทึกสถานที่');save.type='submit';form.append(save);card.append(form);
 const listCard=adminCard('สถานที่ที่ตั้งค่าไว้','ระบบอนุญาตให้มีหลายจุดทำงาน และใช้จุดที่อยู่ในรัศมีเป็นเกณฑ์ลงเวลา');c.append(listCard);
 let leafletMap=null, pin=null;
 if(window.L){leafletMap=L.map(map).setView([15.87,100.99],6);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(leafletMap);leafletMap.on('click',e=>{lat.input.value=e.latlng.lat.toFixed(6);lng.input.value=e.latlng.lng.toFixed(6);if(pin)pin.setLatLng(e.latlng);else pin=L.marker(e.latlng).addTo(leafletMap)});setTimeout(()=>leafletMap.invalidateSize(),100)}
 form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const result=await apiFetch('/api/admin/locations',{method:'POST',body:JSON.stringify({name:name.input.value.trim(),latitude:Number(lat.input.value),longitude:Number(lng.input.value),radiusMeters:Number(radius.input.value)})});toast(result.message);await loadLocations()}catch(err){toast(err.message,'err')}finally{save.disabled=false}};
 async function loadLocations(){listCard.replaceChildren(h('h2',null,'สถานที่ที่ตั้งค่าไว้'));try{const data=await apiFetch('/api/admin/locations');if(!data.locations.length){adminMessage(listCard,'ยังไม่มีสถานที่ทำงาน กรุณาเพิ่มสถานที่แรก');return}data.locations.forEach(loc=>{const row=h('div','card');row.style.marginTop='10px';row.append(h('strong',null,loc.name),h('p',null,'พิกัด: '+loc.latitude+', '+loc.longitude),h('p',null,'รัศมี: '+loc.radius_meters+' เมตร · '+(loc.is_active?'เปิดใช้งาน':'ปิดใช้งาน')));const r=adminInput('ปรับรัศมี (เมตร)','radius-'+loc.id,'number',String(loc.radius_meters));r.input.min='10';r.input.max='5000';r.input.style.maxWidth='180px';row.append(r.wrap,adminButton('บันทึกรัศมี',async()=>{try{await apiFetch('/api/admin/locations',{method:'PATCH',body:JSON.stringify({id:loc.id,radiusMeters:Number(r.input.value)})});toast('บันทึกรัศมีแล้ว');loadLocations()}catch(err){toast(err.message,'err')}}),adminButton(loc.is_active?'ปิดใช้งาน':'เปิดใช้งาน',async()=>{try{await apiFetch('/api/admin/locations',{method:'PATCH',body:JSON.stringify({id:loc.id,active:!loc.is_active})});toast('อัปเดตสถานที่แล้ว');loadLocations()}catch(err){toast(err.message,'err') }},'btn o'));listCard.append(row)})}catch(err){adminMessage(listCard,err.message,'err')}}
 await loadLocations();
}
async function page_admin_users(){
 const c=document.getElementById('content'),card=adminCard('จัดการบัญชีบุคลากร','อนุมัติบัญชีใหม่ ระงับบัญชี และตรวจสอบบทบาทผู้ใช้งาน');c.append(card);
 try{const data=await apiFetch('/api/admin/personnel');const rows=data.personnel.map(p=>{const roleSelect=h('select');[['staff','พนักงาน'],['supervisor','หัวหน้างาน'],['admin','แอดมิน']].forEach(([v,t])=>{const o=h('option',null,t);o.value=v;if(p.role===v) o.selected=true;roleSelect.append(o)});const roleWrap=h('div');roleWrap.append(roleSelect,adminButton('บันทึกสิทธิ์',async()=>{if(!confirm('เปลี่ยนบทบาทบัญชี '+p.full_name+' เป็น '+roleSelect.options[roleSelect.selectedIndex].text+' ?'))return;try{const result=await apiFetch('/api/admin/personnel/role',{method:'POST',body:JSON.stringify({id:p.id,role:roleSelect.value})});toast(result.message);page_admin_users()}catch(err){toast(err.message,'err')}},'btn'));const statusButton=adminButton(p.is_active?'ระงับบัญชี':'อนุมัติบัญชี',async()=>{if(!confirm((p.is_active?'ระงับบัญชี ':'อนุมัติบัญชี ')+p.full_name+' ?'))return;try{const result=await apiFetch('/api/admin/approve',{method:'POST',body:JSON.stringify({id:p.id,active:!p.is_active})});toast(result.message);page_admin_users()}catch(err){toast(err.message,'err')}},p.is_active?'btn o':'btn g');return[p.staff_code,p.full_name,p.email||'-',p.position,p.role,p.is_active?'ใช้งาน':'รออนุมัติ/ระงับ',roleWrap,statusButton]});card.append(table(['รหัสบุคลากร','ชื่อ-นามสกุล','อีเมล','ตำแหน่ง','บทบาท','สถานะ','เปลี่ยนบทบาท','บัญชี'],rows,'ยังไม่มีบัญชีบุคลากร'))}catch(err){adminMessage(card,err.message,'err')}
}
async function page_admin_leaves(){
 const c=document.getElementById('content'),card=adminCard('จัดการคำขอลา','ตรวจสอบคำขอและบันทึกผลการพิจารณา');c.append(card);
 try{const data=await apiFetch('/api/admin/leaves');const rows=data.requests.map(r=>[r.full_name,r.leave_type,r.start_date+' ถึง '+r.end_date,r.reason||'-',r.status==='pending'?'รอพิจารณ':r.status==='approved'?'อนุมัติแล้ว':'ปฏิเสธ',r.status==='pending'?adminButton('อนุมัติ',()=>review(r.id,'approved'),'btn g'): '-',r.status==='pending'?adminButton('ปฏิเสธ',()=>review(r.id,'rejected'),'btn o'):'-']);card.append(table(['บุคลากร','ประเภทลา','ช่วงวันที่','เหตุผล','สถานะ','อนุมัติ','ปฏิเสธ'],rows,'ไม่มีคำขอลา'))}catch(err){adminMessage(card,err.message,'err')}
 async function review(id,status){if(!confirm(status==='approved'?'ยืนยันอนุมัติคำขอนี้?':'ยืนยันปฏิเสธคำขอนี้?'))return;try{const result=await apiFetch('/api/admin/leaves/review',{method:'POST',body:JSON.stringify({id,status})});toast(result.message);page_admin_leaves()}catch(err){toast(err.message,'err')}}
}
async function page_admin_shifts(){
 const c=document.getElementById('content'),card=adminCard('จัดการเวลาทำงานและกะ','กำหนดชื่อกะ เวลาเริ่ม–สิ้นสุด และเวลาผ่อนผัน');c.append(card);
 const form=h('form','row');const name=adminInput('ชื่อกะ','shift-name');const start=adminInput('เวลาเริ่ม','shift-start','time','08:30');const end=adminInput('เวลาสิ้นสุด','shift-end','time','17:30');const grace=adminInput('ผ่อนผัน (นาที)','shift-grace','number','15');[name,start,end,grace].forEach(x=>{x.input.required=true;form.append(x.wrap)});const save=h('button','btn g','เพิ่มกะ');save.type='submit';form.append(save);card.append(form);const out=adminCard('รายการกะทำงาน');c.append(out);
 form.onsubmit=async e=>{e.preventDefault();try{const d=await apiFetch('/api/admin/shifts',{method:'POST',body:JSON.stringify({name:name.input.value.trim(),startTime:start.input.value,endTime:end.input.value,graceMinutes:Number(grace.input.value)})});toast(d.message);load()}catch(err){toast(err.message,'err')}};
 async function load(){out.replaceChildren(h('h2',null,'รายการกะทำงาน'));try{const d=await apiFetch('/api/admin/shifts');out.append(table(['ชื่อกะ','เริ่ม','สิ้นสุด','ผ่อนผัน','สถานะ'],d.shifts.map(x=>[x.name,x.start_time,x.end_time,x.grace_minutes+' นาที',x.is_active?'ใช้งาน':'ปิดใช้งาน']),'ยังไม่มีกะทำงาน'))}catch(err){adminMessage(out,err.message,'err')}}await load()
}
async function page_admin_attendance(){
 const c=document.getElementById('content'),card=adminCard('ตรวจสอบการลงเวลา','รายการล่าสุดสูงสุด 500 รายการจากฐานข้อมูล');c.append(card);
 try{const d=await apiFetch('/api/attendance');card.append(table(['บุคลากร','รหัส','ประเภท','วันและเวลา','พิกัด','หมายเหตุ'],d.records.map(x=>[x.full_name||x.personnel_id,x.staff_code||'-',x.attendance_type==='check_in'?'เข้างาน':'ออกงาน',x.recorded_at,x.latitude!=null?x.latitude+', '+x.longitude:'-',x.note||'-']),'ยังไม่มีประวัติการลงเวลา'))}catch(err){adminMessage(card,err.message,'err')}
}

// ===== 10. ROUTES: จับคู่เส้นทางเว็บกับหน้าที่ต้องแสดง =====
const ADM=['admin'],SUP=['supervisor','admin'];
const ROUTES={login:{title:'เข้าสู่ระบบ',fn:page_login,pub:1},'forgot-password':{title:'ลืมรหัสผ่าน',fn:page_forgot,pub:1},
 dashboard:{title:'หน้าหลัก',fn:page_dashboard},attendance:{title:'ลงเวลาเข้า-ออกงาน',fn:page_attendance},'attendance-history':{title:'ประวัติการลงเวลา',fn:page_history}};
[['absence','ขาดงาน/มาสาย'],['leave','ประวัติการลา'],['work-summary','สรุปเวลาทำงาน'],['notifications','การแจ้งเตือน'],['profile','โปรไฟล์']].forEach(([k,t])=>ROUTES[k]={title:t,fn:page_stub});\nROUTES['leave-request']={title:'ยื่นคำขอลา',fn:page_leave_request};
[['admin-users','จัดการบุคลากร',page_admin_users],['admin-location','จัดการสถานที่ทำงาน',page_admin_location],['admin-shifts','จัดการเวลาทำงานและกะ',page_admin_shifts],['admin-attendance','ตรวจสอบการลงเวลา',page_admin_attendance],['admin-reports','รายงาน',page_admin_attendance],['admin-settings','ตั้งค่าระบบ',page_stub]].forEach(([k,t,fn])=>ROUTES[k]={title:t,fn,roles:ADM});
ROUTES['admin-leaves']={title:'จัดการคำขอลา',fn:page_admin_leaves,roles:ADM};
ROUTES.register={title:'สมัครสมาชิก',fn:page_register,pub:1};
// Frontend-only role guard (casual). Real authorization must be enforced by a backend.
// อ่าน location.hash, ตรวจการล็อกอิน/บทบาท และเรียกฟังก์ชันของหน้าที่เลือก
function route(){timers.splice(0).forEach(clearInterval);
 const key=(location.hash.slice(2)||'').split('?')[0],r=ROUTES[key],u=getCurrentUser(),app=document.getElementById('app'),go=k=>location.replace('#/'+k);
 if(!r)return go(u?'dashboard':'login');
 if(r.pub){if(u&&key==='login')return go('dashboard');LAY=null;PAGE={key,title:r.title};app.replaceChildren(document.getElementById('t-'+key).content.cloneNode(true));r.fn();return}
 if(!u)return go('login');if(r.roles&&!r.roles.includes(u.role))return go('dashboard');
 PAGE={key,title:r.title};if(!LAY||LAY.uid!==u.id)LAY=buildLayout(u);
 document.querySelector('.crumb').textContent='หน้าหลัก / '+r.title;
 document.querySelectorAll('.side a').forEach(a=>{const on=a.getAttribute('href')===location.hash;a.classList.toggle('on',on);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
 document.querySelector('.bell').textContent='🔔 '+getNotifications().filter(x=>x.userId===u.id&&!x.read).length;
 const c=document.getElementById('content');c.replaceChildren();const t=document.getElementById('t-'+key);if(t)c.append(t.content.cloneNode(true));r.fn(u);scrollTo(0,0)}
addEventListener('hashchange',route);ensureSeed();route();

// ===== 11. REGISTER: สมัครสมาชิกผ่าน API =====
// ส่งข้อมูลไปยัง Cloudflare Worker เพื่อบันทึกลงฐานข้อมูล D1
// ตรวจฟอร์มสมัครสมาชิกและส่งข้อมูลไป API; ไม่เก็บรหัสผ่านลง localStorage
function page_register() {
    const $ = id => document.getElementById(id);
    const form = $('f');
    const msg = $('msg');
    const button = form.querySelector('button');

    const show = (text, type = 'err') => {
        msg.textContent = text;
        msg.className = 'msg ' + type;
    };

    form.onsubmit = async e => {
        e.preventDefault();

        const fullName = $('nm').value.trim();
        const staffCode = $('staffCode').value.trim();
        const position = $('position').value.trim();
        const email = $('email').value.trim().toLowerCase();
        const password = $('pw').value;
        const password2 = $('pw2').value;

        if (!fullName) return show('กรุณากรอกชื่อ-นามสกุล');
        if (!staffCode) return show('กรุณากรอกรหัสบุคลากร');
        if (!position) return show('กรุณากรอกตำแหน่ง');
        if (!email) return show('กรุณากรอกอีเมล');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return show('รูปแบบอีเมลไม่ถูกต้อง');
        }
        if (!password) return show('กรุณากรอกรหัสผ่าน');
        if (password.length < 8 || password.length > 128) {
            return show('รหัสผ่านต้องมีความยาว 8–128 ตัวอักษร');
        }
        if (password !== password2) {
            return show('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
        }

        if (button) button.disabled = true;
        show('กำลังส่งข้อมูลสมัครสมาชิก...', 'ok');

        try {
            const response = await fetch(
                'https://school-attendance-api.projectcsemn.workers.dev/api/register',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, staffCode, position, email, password })
                }
            );

            let result;
            try {
                result = await response.json();
            } catch {
                throw new Error('เซิร์ฟเวอร์ตอบกลับในรูปแบบที่อ่านไม่ได้');
            }

            if (!response.ok || !result.success) {
                show(result.message || `สมัครสมาชิกไม่สำเร็จ (HTTP ${response.status})`);
                return;
            }

            form.reset();
            show(result.message || 'ส่งข้อมูลสมัครสมาชิกแล้ว กรุณารอผู้ดูแลอนุมัติบัญชี', 'ok');
        } catch (error) {
            console.error('Register error:', error);
            show('เชื่อมต่อระบบสมัครสมาชิกไม่ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
        } finally {
            if (button) button.disabled = false;
        }
    };
}
