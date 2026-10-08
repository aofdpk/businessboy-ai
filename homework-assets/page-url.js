(function(root){
'use strict';
function normalizePageUrl(value){
 let raw=typeof value==='string'?value.trim():'';
 if(!raw)throw new Error('กรุณาวางลิงก์หน้าเพจ Facebook');
 if(/[\s\\\u0000-\u001f]/.test(raw))throw new Error('กรุณาวางลิงก์เพจเพียง 1 ลิงก์ ไม่ต้องใส่ข้อความอื่น');
 if(!/^[a-z][a-z0-9+.-]*:/i.test(raw))raw='https://'+raw;
 let url;try{url=new URL(raw);}catch{throw new Error('ลิงก์ยังไม่ถูกต้อง กรุณาคัดลอกลิงก์หน้าเพจอีกครั้ง');}
 const hosts=['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com','mbasic.facebook.com','fb.com','www.fb.com','fb.me'];
 if(!['http:','https:'].includes(url.protocol)||!hosts.includes(url.hostname.toLowerCase())||url.username||url.password||url.port)throw new Error('กรุณาใช้ลิงก์หน้าเพจบน Facebook เท่านั้น');
 let path;try{path=decodeURIComponent(url.pathname).toLowerCase();}catch{throw new Error('กรุณาคัดลอกลิงก์หน้าเพจใหม่อีกครั้ง');}
 if(path==='/'||path===''||(path==='/profile.php'&&!/^\d+$/.test(url.searchParams.get('id')||'')))throw new Error('กรุณาคัดลอกลิงก์จากหน้าเพจของคุณ ไม่ใช่หน้าแรก Facebook');
 if(/(?:^|\/)(?:reels?|videos?|watch|posts|stories|groups|events|photo|photos|photo.php|permalink.php|story.php|l.php|login|login.php|sharer|sharer.php)(?:\/|$)/.test(path)||/^\/share\/(?:r|v|p)(?:\/|$)/.test(path))throw new Error('ลิงก์นี้ดูเหมือนลิงก์คลิปหรือโพสต์ครับ กรุณาส่งลิงก์หน้าเพจแทน');
 url.protocol='https:';url.hash='';for(const key of ['fbclid','mibextid','ref','refsrc','__tn__','utm_source','utm_medium','utm_campaign'])url.searchParams.delete(key);
 return url.href;
}
if(typeof module==='object'&&module.exports)module.exports={normalizePageUrl};else root.HomeworkPageUrl={normalizePageUrl};
})(typeof window==='undefined'?this:window);
