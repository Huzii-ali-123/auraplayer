import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { Scene } from '../scenes/scenes';

export function WipeTransition({scene,onSwap}:{scene:Scene;onSwap:(scene:Scene)=>void}){
 const layer=useRef<HTMLDivElement>(null),first=useRef(true),swapRef=useRef(onSwap);swapRef.current=onSwap;
 useGSAP(()=>{if(first.current){first.current=false;swapRef.current(scene);return}const el=layer.current;if(!el)return;const tl=gsap.timeline();tl.set(el,{transformOrigin:'left center',scaleX:0,backgroundColor:scene.colors[0]}).to(el,{scaleX:1,duration:.34,ease:'power4.in'}).call(()=>swapRef.current(scene)).set(el,{transformOrigin:'right center'}).to(el,{scaleX:0,duration:.34,ease:'power4.out'});return()=>{tl.kill()}},{dependencies:[scene.key,scene.revision,scene.background],revertOnUpdate:true});
 return <div ref={layer} className="scene-wipe" aria-hidden="true"/>;
}
