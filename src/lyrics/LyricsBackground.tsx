import { memo,useMemo,useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import type { Track } from '../spotify/api';
import type { ProgressState } from '../components/WheelPlayer';
import type { LyricsRecord } from './client';

type Line={at:number;text:string};
function parseLrc(value:string):Line[]{const lines:Line[]=[];for(const row of value.split(/\r?\n/)){const times=[...row.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];const text=row.replace(/\[[^\]]+\]/g,'').trim();if(!text)continue;for(const time of times){const fraction=(time[3]||'0').padEnd(3,'0').slice(0,3);lines.push({at:(Number(time[1])*60+Number(time[2]))*1000+Number(fraction),text})}}lines.sort((a,b)=>a.at-b.at);return lines}
function LyricsBackgroundView({track,lyrics,progressRef,playing}:{track:Track|null;lyrics:LyricsRecord|null;progressRef:React.MutableRefObject<ProgressState>;playing:boolean}){
 const previous=useRef<HTMLSpanElement>(null),current=useRef<HTMLSpanElement>(null),next=useRef<HTMLSpanElement>(null);const synced=lyrics?.syncedLyrics||'';const entries=useMemo(()=>synced?parseLrc(synced):[],[synced]);const plainLines=useMemo(()=>lyrics?.plainLyrics?.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)||[],[lyrics]);
 useGSAP(()=>{if(!lyrics||(!entries.length&&!plainLines.length))return;let last=-1;const paint=()=>{let index=0;if(entries.length){const p=progressRef.current;const position=p.position+(p.playing?Math.max(0,performance.now()-p.updatedAt):0);let low=0,high=entries.length-1;while(low<=high){const mid=(low+high)>>1;if(entries[mid].at<=position){index=mid;low=mid+1}else high=mid-1}}if(index===last)return;last=index;const before=entries.length?entries[index-1]?.text||'':plainLines[0]||'';const active=entries.length?entries[index]?.text||'':plainLines[1]||plainLines[0]||'';const after=entries.length?entries[index+1]?.text||'':plainLines[2]||'';if(previous.current)previous.current.textContent=before;if(current.current)current.current.textContent=active;if(next.current)next.current.textContent=after;if(current.current)gsap.fromTo(current.current,{yPercent:18,opacity:0},{yPercent:0,opacity:entries.length ? 0.34 : 0.26,duration:.38,ease:'power2.out',overwrite:true})};paint();if(!entries.length||!playing)return;gsap.ticker.add(paint);return()=>gsap.ticker.remove(paint)},{dependencies:[track?.id,lyrics,entries,plainLines,playing],revertOnUpdate:true});
 if(!track||!lyrics||(!entries.length&&!plainLines.length))return null;
 return <aside className={`lyrics-backdrop ${entries.length?'synced':'unsynced'}`} aria-hidden="true"><small>{entries.length?'LIVE LYRICS / SYNCED':'LYRICS / UNSYNCED'} <b>✳</b></small><span ref={previous} className="lyric-line lyric-near">{entries[0]?.text||plainLines[0]||''}</span><span ref={current} className="lyric-line lyric-current">{entries[0]?.text||plainLines[1]||plainLines[0]||''}</span><span ref={next} className="lyric-line lyric-near">{entries[1]?.text||plainLines[2]||''}</span></aside>
}
export const LyricsBackground=memo(LyricsBackgroundView);
