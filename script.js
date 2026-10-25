'use strict';
const $ = (id) => document.getElementById(id);
const openBtn = $('openInvite');
openBtn.addEventListener('click', () => { $('cover').classList.add('is-open'); document.body.classList.remove('locked'); setTimeout(() => { $('cover').hidden = true; }, 950); });
$('joinButton').addEventListener('click', () => { $('registration').hidden = false; $('registration').scrollIntoView({behavior:'smooth'}); });
const target = new Date('2026-11-21T10:00:00+08:00').getTime();
function tick(){const diff=Math.max(0,target-Date.now());const values=[Math.floor(diff/86400000),Math.floor(diff/3600000)%24,Math.floor(diff/60000)%60,Math.floor(diff/1000)%60];['days','hours','minutes','seconds'].forEach((id,i)=>$(id).textContent=String(values[i]).padStart(2,'0'));if(!diff)$('countdownMessage').textContent='The royal day has arrived!';}tick();setInterval(tick,1000);
// Optional music: put a licensed audio file at assets/music.mp3 and set this to true.
const ENABLE_MUSIC=false;let audio=null;
if(ENABLE_MUSIC){const toggle=$('musicToggle');toggle.hidden=false;audio=new Audio('assets/music.mp3');audio.loop=true;toggle.addEventListener('click',async()=>{if(audio.paused){try{await audio.play();toggle.textContent='♫ Music: On';}catch{toggle.textContent='♫ Tap to play';}}else{audio.pause();toggle.textContent='♫ Music: Off';}});openBtn.addEventListener('click',()=>{audio.play().then(()=>toggle.textContent='♫ Music: On').catch(()=>{});});}
const form=$('pledgeForm');let pending=null;
function status(message){$('formStatus').textContent=message;}
form.addEventListener('submit',async(e)=>{
 e.preventDefault(); if(pending)return;
 const endpoint=(window.DUKE_CONFIG?.appsScriptUrl||'').trim();
 if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(endpoint)){status('Preview mode: Registration is not yet connected. No information was saved or certificate issued.');return;}
 const name=$('guardianName').value.trim(),promise=$('promise').value,message=$('message').value.trim();
 if(!name||!promise||!$('consent').checked)return;
 const fingerprint=JSON.stringify({name,promise,message});const previous=window.dukeRetry;const requestId=(previous?.fingerprint===fingerprint?previous.requestId:(typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(36).slice(2)));window.dukeRetry={fingerprint,requestId};
 pending={requestId,name};$('submitPledge').disabled=true;status('Sending your royal promise…');
 // Form POST to a hidden iframe avoids Apps Script redirect/CORS restrictions.
 const iframe=document.createElement('iframe');iframe.name='duke-submit-'+Date.now();iframe.style.display='none';iframe.title='Registration submission';document.body.appendChild(iframe);
 const sender=document.createElement('form');sender.method='POST';sender.action=endpoint;sender.target=iframe.name;sender.style.display='none';
 const data={requestId,name,promise,message,consent:'yes'};
 for(const [key,value] of Object.entries(data)){const input=document.createElement('input');input.name=key;input.value=value;sender.appendChild(input);}
 document.body.appendChild(sender);sender.submit();sender.remove();
 const cleanup=()=>{setTimeout(()=>iframe.remove(),1000);};
 const timeout=setTimeout(()=>{if(pending?.requestId===requestId){pending=null;window.removeEventListener('message',receive);$('submitPledge').disabled=false;status('We could not confirm your submission. Please check with the family before retrying to avoid duplicates.');cleanup();}},25000);
 const receive=(event)=>{if(!/^https:\/\/(?:[a-z0-9-]+\.)*(?:googleusercontent\.com|google\.com)$/.test(event.origin))return;const d=event.data;if(!d||d.type!=='DUKE_PLEDGE_RESULT'||d.requestId!==requestId)return;window.removeEventListener('message',receive);clearTimeout(timeout);pending=null;$('submitPledge').disabled=false;cleanup();if(d.ok){window.dukeRetry=null;status('Your promise and private archive certificate have been saved!');renderCertificate(name,d.reference||'',d.date||new Date().toISOString().slice(0,10));form.reset();$('certificateSection').hidden=false;$('certificateSection').scrollIntoView({behavior:'smooth'});}else status('Registration was not saved: '+(d.error||'Please try again later.'));};
 window.addEventListener('message',receive);
});
function renderCertificate(name,reference,date){const canvas=$('certificateCanvas'),ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;ctx.fillStyle='#faf8f0';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#c5a46d';ctx.lineWidth=7;ctx.strokeRect(40,40,w-80,h-80);ctx.lineWidth=2;ctx.strokeRect(59,59,w-118,h-118);ctx.fillStyle='#425d48';ctx.textAlign='center';ctx.font='84px Georgia';ctx.fillText('♛',w/2,185);ctx.fillStyle='#7b9076';ctx.font='bold 25px Georgia';ctx.fillText('THE ROYAL HOUSEHOLD OF DUKE SAFFRON',w/2,250);ctx.fillStyle='#425d48';ctx.font='74px Georgia';ctx.fillText('Certificate of Royal Affection',w/2,360);ctx.font='30px Georgia';ctx.fillText('This certificate is joyfully presented to',w/2,440);ctx.font='italic 66px Georgia';const safeName=name.length>38?name.slice(0,38)+'…':name;ctx.fillText(safeName,w/2,530);ctx.fillStyle='#c5a46d';ctx.fillRect(480,564,640,3);ctx.fillStyle='#425d48';ctx.font='bold 45px Georgia';ctx.fillText('ROYAL GUARDIAN OF LOVE',w/2,645);ctx.font='30px Georgia';ctx.fillText('of Duke Saffron M. Yumang',w/2,705);ctx.font='27px Georgia';ctx.fillText('In grateful recognition of your promise to offer',w/2,780);ctx.fillText('love, kindness, guidance, and encouragement as Duke grows.',w/2,825);ctx.font='italic 31px Georgia';ctx.fillText('A promise made with love. A bond treasured for life.',w/2,890);ctx.font='21px Georgia';ctx.fillStyle='#71806c';ctx.fillText('Registered '+date+'   ·   '+reference,w/2,961);ctx.font='18px Georgia';ctx.fillText('Commemorative keepsake only — not an official church godparent appointment',w/2,1006);}
$('downloadCertificate').addEventListener('click',()=>{const a=document.createElement('a');a.download='Duke-Saffron-Royal-Guardian-Certificate.png';a.href=$('certificateCanvas').toDataURL('image/png');a.click();});
