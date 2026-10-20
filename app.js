// ระบบลงชื่อเข้า-ออกงาน — ต้นแบบ frontend ไฟล์เดียว (localStorage + mock data). ไม่ใช่ระบบความปลอดภัยจริง
// ===== Storage & seed =====
// localStorage layer. FRONTEND-ONLY DEMO: not secure storage.
const K='att2_';
const rd=(k,d)=>{try{const v=localStorage.getItem(K+k);return v?JSON.parse(v):d}catch{return d}};
const wr=(k,v)=>{try{localStorage.setItem(K+k,JSON.stringify(v));return true}catch{return false}};
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
function ensureSeed(){ensureLeaves();if(!rd('seeded',false)){const s=seed();for(const k in s)wr(k,s[k]);wr('seeded',true)}}
const getUsers=()=>rd('users',[]);
const getCurrentUser=()=>{const id=rd('session',null);return getUsers().find(u=>u.id===id&&u.active)||null};
const setCurrentUser=u=>{try{u?wr('session',u.id):localStorage.removeItem(K+'session')}catch{}};
const getAttendanceRecords=()=>rd('records',[]);
const saveAttendanceRecord=r=>{const a=getAttendanceRecords().filter(x=>x.id!==r.id);a.push(r);return wr('records',a)};
const getShifts=()=>rd('shifts',[]);
const getWorkLocation=()=>rd('location',null);
const saveWorkLocation=l=>wr('location',l);
const getNotifications=()=>rd('notifications',[]);
const saveNotifications=n=>wr('notifications',n);
const getAuditLogs=()=>rd('audit',[]);
function resetDemoData(){try{const ks=[];for(let i=0;i<localStorage.length;i++)ks.push(localStorage.key(i));ks.filter(k=>k&&k.startsWith(K)).forEach(k=>localStorage.removeItem(k))}catch{}ensureSeed()}
function ensureLeaves(){if(rd('leaves',null)!==null)return;const d=n=>{const x=new Date();x.setDate(x.getDate()+n);return x.toLocaleDateString('sv')};
  wr('leaves',[{id:'L1',userId:'U001',type:'ลาพักร้อน',start:d(-20),end:d(-19),days:2,submitted:d(-25),status:'approved',approver:'สุดา รักงาน'},
   {id:'L2',userId:'U001',type:'ลากิจ',start:d(7),end:d(7),days:1,submitted:d(-1),status:'pending_supervisor',approver:'-'}])}
const getLeaves=()=>rd('leaves',[]);
const saveLeaves=l=>wr('leaves',l);

// ===== Utils =====
const fmtDate=s=>new Date(s).toLocaleDateString('th-TH-u-ca-buddhist',{day:'numeric',month:'short',year:'numeric'});
const fmtTime=s=>s?new Date(s).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'-';
const todayStr=()=>new Date().toLocaleDateString('sv');
function haversine(a,b,c,d){const R=6371000,t=x=>x*Math.PI/180,dl=t(c-a),dn=t(d-b);
  const x=Math.sin(dl/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
function h(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function toast(msg,type='ok'){const t=h('div','toast',msg);t.style.background=type==='ok'?'#16a34a':type==='warn'?'#ea580c':'#dc2626';document.body.append(t);setTimeout(()=>t.remove(),3000)}
const badge=(text,type='')=>h('span','badge '+type,text);
function table(head,rows,empty='ไม่พบข้อมูล'){const w=h('div','tw');if(!rows.length){w.append(h('p','msg',empty));return w}
  const t=h('table'),tr=h('tr');head.forEach(x=>tr.append(h('th',null,x)));t.append(tr);
  rows.forEach(r=>{const row=h('tr');r.forEach(c=>{const td=h('td');td.append(c instanceof Node?c:String(c));row.append(td)});t.append(row)});w.append(t);return w}

// ===== Auth (demo only) =====
// FRONTEND-ONLY DEMO AUTH. Plain-text passwords in localStorage are NOT secure; real auth must be server-side.

function login(email,pw){ensureSeed();const u=getUsers().find(x=>x.email===email.trim().toLowerCase());
  if(!u||u.password!==pw)return{error:'อีเมลหรือรหัสผ่านไม่ถูกต้อง'};if(!u.active)return{error:'บัญชีนี้ถูกระงับ'};setCurrentUser(u);return{user:u}}
function logout(){setCurrentUser(null);location.href='#/login'}
function requireAuth(roles){ensureSeed();const u=getCurrentUser();if(!u){location.href='#/login';return null}
  if(roles&&!roles.includes(u.role)){location.href='#/dashboard';return null}return u}

const timers=[];const T=(f,ms)=>{timers.push(setInterval(f,ms))};let PAGE={key:'',title:''},LAY=null;

// ===== Layout =====
// Shared layout. NOTE: role checks here are casual UI guards only; real authorization must be enforced by a backend.



const ROLE={employee:'พนักงาน',supervisor:'หัวหน้างาน',admin:'ผู้ดูแล/HR'};
function menuFor(role){
  const m=[['#/dashboard','🏠',role==='admin'?'Admin Dashboard':'Home'],['#/attendance','📍','ลงเวลาเข้า-ออกงาน'],['#/attendance-history','🕘','ประวัติการลงเวลา'],['#/absence','⚠️','ขาดงาน/มาสาย'],['#/leave-request','📝','ยื่นคำขอลา'],['#/leave','📅','ประวัติการลา'],['#/work-summary','📊','สรุปเวลาทำงาน'],['#/notifications','🔔','การแจ้งเตือน'],['#/profile','👤','โปรไฟล์']];
  if(role==='supervisor')m.push(['#/admin-leaves','✅','รายการรออนุมัติ'],['#/admin-leaves?view=history','🗂️','ประวัติการอนุมัติ']);
  if(role==='admin')m.push(['#/admin-users','👥','จัดการบุคลากร'],['#/admin-location','🗺️','จัดการสถานที่ทำงาน'],['#/admin-shifts','⏱️','จัดการเวลาทำงานและกะ'],['#/admin-attendance','🔍','ตรวจสอบการลงเวลา'],['#/admin-leaves','🧾','จัดการคำขอลา'],['#/admin-reports','📈','รายงาน'],['#/admin-settings','⚙️','ตั้งค่าระบบ']);
  return m}
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

// ===== Pages =====
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
      const result=login(em,p);
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

function page_forgot(){
// DEMO ONLY: no email is sent.
const f=document.getElementById('f'),m=document.getElementById('msg');
f.onsubmit=e=>{e.preventDefault();const v=document.getElementById('email').value.trim();
  if(!/^\S+@\S+\.\S+$/.test(v)){m.style.color='#dc2626';m.textContent='กรุณากรอกอีเมลให้ถูกต้อง';return}
  m.style.color='#166534';m.textContent='(จำลอง) หากอีเมลนี้อยู่ในระบบ จะมีลิงก์รีเซ็ตส่งไป — ระบบเดโมไม่ได้ส่งอีเมลจริง'};

}
// Role-aware Home. Data is read from localStorage on each render so check-in/out updates appear automatically.



const QUOTA=10,ST={pending_supervisor:'รอหัวหน้างานอนุมัติ',pending_hr:'รอฝ่ายบุคคลอนุมัติ',approved:'อนุมัติแล้ว',rejected:'ไม่อนุมัติ',withdrawn:'ถอนคำขอแล้ว'};
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
function page_dashboard(u){const c=document.getElementById('content');c.append(h('p','msg','กำลังโหลด...'));render(u,c);T(()=>render(u,c),30000)}


function page_history(u){const out=document.getElementById('out'),mo=document.getElementById('mo'),st=document.getElementById('st'),dt=document.getElementById('dt');
  const draw=()=>{let r=getAttendanceRecords().filter(x=>x.userId===u.id);if(mo.value)r=r.filter(x=>x.date.startsWith(mo.value));if(dt.value)r=r.filter(x=>x.date===dt.value);
    if(st.value)r=r.filter(x=>st.value==='late'?x.late:!x.late);r.sort((a,b)=>b.date.localeCompare(a.date));
    out.replaceChildren(table(['วันที่','กะ','เข้า','ออก','สถานะ','ระยะ (ม.)'],r.slice(0,50).map(x=>[fmtDate(x.date),x.shiftId,fmtTime(x.checkIn),fmtTime(x.checkOut),x.late?badge('สาย','warn'):badge('ตรงเวลา','ok'),Math.round(x.distance)]),'ไม่พบประวัติตามเงื่อนไข'))};
  [mo,st,dt].forEach(e=>e.oninput=draw);document.getElementById('rs').onclick=()=>{mo.value=st.value=dt.value='';draw()};draw()}

// PROTOTYPE ONLY: distance checks here run in the browser and can be bypassed.
// Production must re-validate GPS, distance, and server time on a backend.

function page_attendance(u){const $=id=>document.getElementById(id),loc=getWorkLocation(),shift=getShifts()[0];let pos=null,dist=null,map,me;
  $('wp').textContent=`${loc.name} (${loc.lat}, ${loc.lng}) รัศมี ${loc.radius} ม.`;$('sh').textContent=`${shift.name} ${shift.start}–${shift.end}`;
  T(()=>$('clk').textContent=new Date().toLocaleString('th-TH-u-ca-buddhist'),1000);
  if(window.L){map=L.map('map').setView([loc.lat,loc.lng],14);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
    L.marker([loc.lat,loc.lng]).addTo(map).bindPopup('สถานที่ทำงาน');L.circle([loc.lat,loc.lng],{radius:loc.radius}).addTo(map)}else $('map').textContent='ไม่สามารถโหลดแผนที่ได้ (ต้องใช้อินเทอร์เน็ต)';
  const today=()=>getAttendanceRecords().find(r=>r.userId===u.id&&r.date===todayStr());
  function ui(){const t=today(),ok=dist!=null&&dist<=loc.radius;
    $('ci').disabled=!(ok&&!t);$('co').disabled=!(ok&&t&&!t.checkOut);
    $('stt').textContent=!t?'ยังไม่ได้ลงชื่อเข้างาน':t.checkOut?`ครบแล้ว (เข้า ${fmtTime(t.checkIn)} ออก ${fmtTime(t.checkOut)})`:`เข้างานแล้ว ${fmtTime(t.checkIn)}`;
    $('dist').textContent=dist==null?'-':`${Math.round(dist)} เมตร`+(ok?' (อยู่ในพื้นที่)':` — อยู่นอกพื้นที่ ต้องอยู่ภายใน ${loc.radius} เมตร`)}
  function got(p,dev){pos={lat:p.latitude,lng:p.longitude,acc:p.accuracy};dist=haversine(pos.lat,pos.lng,loc.lat,loc.lng);try{localStorage.setItem("att2_lastpos",JSON.stringify({dist,acc:pos.acc,at:Date.now(),dev:!!dev}))}catch{}
    $('gps').textContent='ได้รับตำแหน่งแล้ว'+(dev?' (โหมดจำลองสำหรับพัฒนา)':'');$('acc').textContent=`±${Math.round(pos.acc)} เมตร`;
    if(map){me&&me.remove();me=L.marker([pos.lat,pos.lng]).addTo(map).bindPopup('ตำแหน่งของคุณ')}ui()}
  function refresh(){dist=null;ui();const m=$('dev').value;
    if(m==='in')return got({latitude:loc.lat+.002,longitude:loc.lng,accuracy:15},true);
    if(m==='out')return got({latitude:loc.lat+.03,longitude:loc.lng,accuracy:15},true);
    if(!navigator.geolocation){$('gps').textContent='เบราว์เซอร์ไม่รองรับ GPS';return}
    $('gps').textContent='กำลังค้นหาตำแหน่ง...';
    navigator.geolocation.getCurrentPosition(p=>got(p.coords),e=>{$('gps').textContent=e.code===1?'ถูกปฏิเสธสิทธิ์ตำแหน่ง: กดไอคอนกุญแจข้าง URL > อนุญาต "ตำแหน่ง" แล้วกดรีเฟรชตำแหน่ง':e.code===3?'หมดเวลาค้นหาตำแหน่ง กรุณากดลองใหม่':'ไม่พบตำแหน่ง กรุณากดลองใหม่'},{enableHighAccuracy:true,timeout:10000,maximumAge:0})}
  function act(kind){if(dist==null||dist>loc.radius)return toast('อยู่นอกพื้นที่ปฏิบัติงาน','err');const t=today(),now=new Date();
    if(kind==='in'){if(t)return toast('ลงชื่อเข้างานแล้ว','warn');const[hh,mm]=shift.start.split(':').map(Number),lim=new Date(now);lim.setHours(hh,mm+shift.grace,0,0);
      const saved=saveAttendanceRecord({id:'A'+Date.now(),userId:u.id,date:todayStr(),checkIn:now.toISOString(),checkOut:null,shiftId:shift.id,late:now>lim,distance:dist,accuracy:pos.acc});if(!saved)return toast('บันทึกข้อมูลไม่สำเร็จ พื้นที่จัดเก็บในเบราว์เซอร์อาจเต็มหรือถูกปิดใช้งาน','err');toast('ลงชื่อเข้างานสำเร็จ')}
    else{if(!t)return toast('ต้องลงชื่อเข้างานก่อน','err');if(t.checkOut)return toast('ลงชื่อออกงานแล้ว','warn');const previousCheckOut=t.checkOut;t.checkOut=now.toISOString();if(!saveAttendanceRecord(t)){t.checkOut=previousCheckOut;return toast('บันทึกข้อมูลไม่สำเร็จ พื้นที่จัดเก็บในเบราว์เซอร์อาจเต็มหรือถูกปิดใช้งาน','err')}toast('ลงชื่อออกงานสำเร็จ')}ui()}
  $('ci').onclick=()=>act('in');$('co').onclick=()=>act('out');$('rf').onclick=refresh;$('dev').onchange=refresh;ui();refresh()}

// Generic page: real profile (read-only) and notifications; other pages are labeled placeholders.

function page_stub(u){const c=document.getElementById('content'),p=PAGE.key;c.append(h('h1',null,PAGE.title));
  if(p==='profile'){c.append(table(['ข้อมูล','ค่า'],[['รหัสพนักงาน',u.id],['ชื่อ',u.name],['อีเมล',u.email],['แผนก',u.dept],['ตำแหน่ง',u.position],['บทบาท',u.role],['สถานะบัญชี','ใช้งานอยู่']]))}
  else if(p==='notifications'){const box=h('div','card');c.append(box);const draw=()=>{const all=getNotifications(),mine=all.filter(n=>n.userId===u.id);box.replaceChildren();
    const b=h('button','btn','อ่านทั้งหมด');b.onclick=()=>{mine.forEach(n=>n.read=true);saveNotifications(all);draw()};box.append(b);
    if(!mine.length)box.append(h('p','msg','ไม่มีการแจ้งเตือน'));mine.forEach(n=>{const r=h('p',null,`${n.read?'':'● '}${n.text} — ${fmtDate(n.at)}`);if(!n.read){const m=h('button','btn','อ่านแล้ว');m.onclick=()=>{n.read=true;saveNotifications(all);draw()};r.append(' ',m)}box.append(r)})};draw()}
  else{const m=h('div','card');m.append(h('p','msg','ต้นแบบ: หน้านี้ยังไม่ได้พัฒนาฟังก์ชันในรอบนี้ (ลิงก์ใช้งานได้ ไม่มีหน้าเสีย)'));const a=h('a','btn','กลับหน้าหลัก');a.href='#/dashboard';m.append(a);c.append(m)}}

// ===== Routes =====
const ADM=['admin'],SUP=['supervisor','admin'];
const ROUTES={login:{title:'เข้าสู่ระบบ',fn:page_login,pub:1},'forgot-password':{title:'ลืมรหัสผ่าน',fn:page_forgot,pub:1},
 dashboard:{title:'หน้าหลัก',fn:page_dashboard},attendance:{title:'ลงเวลาเข้า-ออกงาน',fn:page_attendance},'attendance-history':{title:'ประวัติการลงเวลา',fn:page_history}};
[['absence','ขาดงาน/มาสาย'],['leave-request','ยื่นคำขอลา'],['leave','ประวัติการลา'],['work-summary','สรุปเวลาทำงาน'],['notifications','การแจ้งเตือน'],['profile','โปรไฟล์']].forEach(([k,t])=>ROUTES[k]={title:t,fn:page_stub});
[['admin-users','จัดการบุคลากร'],['admin-location','จัดการสถานที่ทำงาน'],['admin-shifts','จัดการเวลาทำงานและกะ'],['admin-attendance','ตรวจสอบการลงเวลา'],['admin-reports','รายงาน'],['admin-settings','ตั้งค่าระบบ']].forEach(([k,t])=>ROUTES[k]={title:t,fn:page_stub,roles:ADM});
ROUTES['admin-leaves']={title:'จัดการคำขอลา',fn:page_stub,roles:SUP};
ROUTES.register={title:'สมัครสมาชิก',fn:page_register,pub:1};
// Frontend-only role guard (casual). Real authorization must be enforced by a backend.
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

// สมัครสมาชิก: ส่งข้อมูลไปยัง Cloudflare Worker เพื่อบันทึกลง D1
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
