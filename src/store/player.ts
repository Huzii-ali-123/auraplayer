import { create } from 'zustand'; import type { Playback } from '../spotify/api';
type State={token:string|null;playback:Playback|null;playlists:{id:string;name:string;images?:{url:string}[];tracks?:{total:number}}[];error:string;loading:boolean;set: (p:Partial<State>)=>void;};
export const usePlayer=create<State>(set=>({token:null,playback:null,playlists:[],error:'',loading:false,set:p=>set(p)}));
