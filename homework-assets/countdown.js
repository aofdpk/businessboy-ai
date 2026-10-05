(function(root){
  'use strict';
  // Use elapsed monotonic time after a server sync, never the learner's wall clock.
  function createClock(monotonicNow){
    let anchor=null;
    return {
      sync(config){
        const deadline=Date.parse(config?.deadline),server=Date.parse(config?.serverTime);
        if(!Number.isFinite(deadline)||!Number.isFinite(server)||typeof config?.open!=='boolean')throw new Error('Invalid countdown time');
        anchor={deadline,server,at:monotonicNow(),open:config.open};
      },
      read(){
        if(!anchor)return null;
        const remaining=anchor.open?Math.max(0,anchor.deadline-anchor.server-Math.max(0,monotonicNow()-anchor.at)):0;
        const total=Math.ceil(remaining/1000);
        return {expired:remaining<=0,urgent:remaining>0&&remaining<86400000,
          days:Math.floor(total/86400),hours:Math.floor(total/3600)%24,minutes:Math.floor(total/60)%60,seconds:total%60};
      }
    };
  }
  if(typeof module==='object'&&module.exports)module.exports={createClock};
  else root.HomeworkCountdown={createClock};
})(typeof window==='undefined'?this:window);
