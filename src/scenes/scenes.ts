import type { Track } from '../spotify/api';
import { songMap } from './songMap';

export type SceneKey = 'snow'|'rain'|'stars'|'fireflies'|'ember'|'ocean'|'sunset'|'neon'|'blossom'|'art';
export type Scene = { key:SceneKey; label:string; background:string; ink:string; colors:[string,string,string,string]; keywords:string[]; kind:'snow'|'rain'|'plus'|'square'|'triangle'|'wave'|'sun'|'city'|'petal'|'art'; revision?:string };
export const scenes:Scene[]=[
 {key:'snow',label:'Snow',background:'#6FE7FF',ink:'#07121A',colors:['#6FE7FF','#F8F8F2','#FF4FA1','#07121A'],keywords:['snow','winter','frost','ice','christmas','cold'],kind:'snow'},
 {key:'rain',label:'Rain',background:'#537CF2',ink:'#080B20',colors:['#537CF2','#B9D6FF','#161A33','#FC6F58'],keywords:['rain','storm','tears','cloud','blue'],kind:'rain'},
 {key:'stars',label:'Night Stars',background:'#F3C43A',ink:'#16140C',colors:['#F3C43A','#FFF4BD','#122A4A','#EF5B43'],keywords:['night','star','moon','space','dream','midnight'],kind:'plus'},
 {key:'fireflies',label:'Fireflies',background:'#A7DB55',ink:'#10170C',colors:['#A7DB55','#F5EE9E','#1F3722','#FF6F59'],keywords:['love','garden','field','summer','wild','firefly'],kind:'square'},
 {key:'ember',label:'Embers',background:'#F05232',ink:'#1A0D0A',colors:['#F05232','#FFCB46','#24130F','#F8EFD8'],keywords:['fire','flame','burn','heat','ember','red'],kind:'triangle'},
 {key:'ocean',label:'Ocean',background:'#27B8B1',ink:'#071819',colors:['#27B8B1','#B3EEE2','#123F51','#F37F5B'],keywords:['ocean','sea','wave','water','island','beach'],kind:'wave'},
 {key:'sunset',label:'Sunset',background:'#FF815A',ink:'#1B1014',colors:['#FF815A','#FFD35B','#65284F','#F8E9C9'],keywords:['sun','sunset','dusk','daylight','golden'],kind:'sun'},
 {key:'neon',label:'Neon City',background:'#EB5BC3',ink:'#170A20',colors:['#EB5BC3','#70F1DE','#211B43','#F5E650'],keywords:['city','neon','electric','dance','nightlife','lights'],kind:'city'},
 {key:'blossom',label:'Cherry Blossom',background:'#F5A8C7',ink:'#24111B',colors:['#F5A8C7','#FFE9DA','#772B58','#F4CC48'],keywords:['cherry','blossom','flower','spring','petal','rose'],kind:'petal'},
];
const byKey=(key:string)=>scenes.find(s=>s.key===key);
function lighter(hex:string){const raw=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(raw))return hex;const channels=[0,2,4].map(i=>parseInt(raw.slice(i,i+2),16));return `#${channels.map(value=>Math.round(value+(255-value)*.32).toString(16).padStart(2,'0')).join('')}`}
function contrastingInk(hex:string,fallback:string){const raw=hex.replace('#','');if(!/^[0-9a-f]{6}$/i.test(raw))return fallback;const [r,g,b]=[0,2,4].map(i=>parseInt(raw.slice(i,i+2),16));return (r*.299+g*.587+b*.114)<142?'#fff9e8':fallback}
function forTrack(scene:Scene,track:Track,dominant?:[string,string,string]):Scene{let hash=0;for(const char of track.id)hash=(hash*31+char.charCodeAt(0))>>>0;const fallback=`hsl(${hash%360} 82% 70%)`;const background=dominant?lighter(dominant[0]):fallback;const ink=dominant?contrastingInk(background,scene.ink):scene.ink;return {...scene,background,ink,colors:[background,dominant?.[0]||scene.colors[1],dominant?.[1]||scene.colors[2],ink],revision:track.id}}
export function resolveScene(track:Track|null,genres:string[]=[],dominant?:[string,string,string]):Scene {
 if(!track)return byKey('stars')!;
 const mapped=songMap[track.id]; if(mapped&&byKey(mapped))return byKey(mapped)!;
 const text=`${track.name} ${track.album.name} ${track.artists.map(a=>a.name).join(' ')}`.toLowerCase();
 for(const scene of scenes)if(scene.keywords.some(word=>text.includes(word)))return forTrack(scene,track,dominant);
 const genre=genres.join(' ').toLowerCase();
 if(/metal|rock|punk|hardcore/.test(genre))return forTrack(byKey('ember')!,track,dominant);
 if(/electronic|dance|edm|pop/.test(genre))return forTrack(byKey('neon')!,track,dominant);
 if(/ambient|classical|folk|acoustic/.test(genre))return forTrack(byKey('snow')!,track,dominant);
 if(/reggae|tropical|soul/.test(genre))return forTrack(byKey('ocean')!,track,dominant);
 const colors=dominant||['#ED704F','#F3C43A','#253B58'];
 return {key:'art',label:'Album colors',background:lighter(colors[0]),ink:contrastingInk(lighter(colors[0]),'#111111'),colors:[lighter(colors[0]),colors[1],colors[2],'#111111'],keywords:[],kind:'art',revision:track.id};
}
