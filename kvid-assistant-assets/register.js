'use strict';
const $=id=>document.getElementById(id),ticket=location.hash.slice(1);
history.replaceState(null,'',location.pathname);
async function api(action,data={}){const r=await fetch('/api/kvid-assistant?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,ticket})});const value=await r.json();if(!r.ok)throw Error(value.error||'ระบบกำลังมีผู้ใช้จำนวนมาก กรุณาลองอีกครั้ง');return value;}
async function start(){try{if(!/^[A-Za-z0-9_-]{43}$/.test(ticket))throw Error('กรุณาเปิดลิงก์ลงทะเบียนที่ผู้ช่วย KVID ส่งให้ใน Codex');const v=await api('enrollment-info');for(const id of ['firstName','lastName','phone','cohort'])$(id).value=v[id];if(v.existing){$('firstName').readOnly=true;$('lastName').readOnly=true;}$('enrollment').hidden=false;$('status').textContent=v.existing?'เติมเบอร์โทรและรุ่นเรียนให้ครบ เพื่อใช้งานบัญชีเดิมต่อได้เลย':'';}catch(e){$('status').textContent=e.message;}}
$('enrollment').addEventListener('submit',async e=>{e.preventDefault();$('submit').disabled=true;$('status').textContent='กำลังบันทึกข้อมูล…';try{const data=Object.fromEntries(new FormData(e.target));await api('enrollment-save',data);$('enrollment').hidden=true;$('success').hidden=false;$('status').textContent='';}catch(e){$('status').textContent=e.message;}finally{$('submit').disabled=false;}});
start();
