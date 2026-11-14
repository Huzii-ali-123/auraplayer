/// <reference types="vite/client" />
interface Window { onSpotifyWebPlaybackSDKReady?:()=>void; Spotify?:{Player:new(options:{name:string;getOAuthToken:(cb:(token:string)=>void)=>void;volume:number})=>SpotifyPlayer} }
interface SpotifyPlayer { connect:()=>Promise<boolean>;disconnect:()=>void;addListener:(event:string,callback:(data:any)=>void)=>boolean;getCurrentState:()=>Promise<any>;togglePlay:()=>Promise<void>;nextTrack:()=>Promise<void>;previousTrack:()=>Promise<void>;seek:(ms:number)=>Promise<void>;setVolume:(v:number)=>Promise<void>;activateElement:()=>Promise<void> }
