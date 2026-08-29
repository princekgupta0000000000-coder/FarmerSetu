'use client';

import {useEffect} from 'react';

export default function BookingSuccessSound(){
  useEffect(()=>{
    let lastId='';
    try{
      const current=JSON.parse(localStorage.getItem('farmersetu_bookings')||'[]');
      lastId=current?.[0]?.id||'';
    }catch{}

    const announce=()=>{
      try{
        if('speechSynthesis' in window){
          window.speechSynthesis.cancel();
          const utterance=new SpeechSynthesisUtterance('Your slot has been booked successfully. Aapka slot book ho gaya hai.');
          utterance.rate=.95;
          utterance.pitch=1;
          window.speechSynthesis.speak(utterance);
        }
      }catch{}

      try{
        const AudioCtx=window.AudioContext||window.webkitAudioContext;
        if(!AudioCtx)return;
        const ctx=new AudioCtx();
        const osc=ctx.createOscillator();
        const gain=ctx.createGain();
        osc.type='sine';
        osc.frequency.value=880;
        gain.gain.setValueAtTime(.0001,ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.01);
        gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.28);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start();osc.stop(ctx.currentTime+.3);
        setTimeout(()=>ctx.close().catch(()=>{}),450);
      }catch{}
    };

    const timer=setInterval(()=>{
      try{
        const current=JSON.parse(localStorage.getItem('farmersetu_bookings')||'[]');
        const newest=current?.[0]?.id||'';
        if(newest&&newest!==lastId){
          lastId=newest;
          announce();
        }
      }catch{}
    },500);

    return()=>clearInterval(timer);
  },[]);

  return null;
}
