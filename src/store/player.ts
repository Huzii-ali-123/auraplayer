import { create } from 'zustand'; import type { Playback } from '../spotify/api';
import type { YTTrack } from '../ytmusic/api';
type State={
  token:string|null;
  playback:Playback|null;
  playlists:{id:string;name:string;images?:{url:string}[];tracks?:{total:number}}[];
  error:string;loading:boolean;
  // YouTube Music state
  ytMusicConnected:boolean;
  ytMusicTrack:YTTrack|null;
  ytMusicPlaying:boolean;
  ytMusicPosition:number;
  ytMusicDuration:number;
  ytMusicVolume:number;
  set: (p:Partial<State>)=>void;
};
export const usePlayer=create<State>(set=>({
  token:null,playback:null,playlists:[],error:'',loading:false,
  ytMusicConnected:false,ytMusicTrack:null,ytMusicPlaying:false,
  ytMusicPosition:0,ytMusicDuration:0,ytMusicVolume:68,
  set:p=>set(p)
}));
