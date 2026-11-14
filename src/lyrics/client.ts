import type { Track } from '../spotify/api';

export type LyricsRecord={plainLyrics:string|null;syncedLyrics:string|null;instrumental:boolean};
let retryAfter=0;
export async function fetchLyrics(track:Track,signal:AbortSignal):Promise<LyricsRecord|null>{
 if(Date.now()<retryAfter)return null;
 const params=new URLSearchParams({track_name:track.name,artist_name:track.artists.map(a=>a.name).join(', '),duration:String(Math.max(1,Math.round(track.duration_ms/1000)))});
 if(track.album.name)params.set('album_name',track.album.name);
 const response=await fetch(`https://lrclib.net/api/get?${params}`,{signal,headers:{'X-User-Agent':'AURA//PLAYER/1.0'}});
 if(response.status===404)return null;
 if(response.status===429){const seconds=Number(response.headers.get('Retry-After'))||30;retryAfter=Date.now()+seconds*1000;return null}
 if(!response.ok)return null;
 try{const record=await response.json() as LyricsRecord;if(record.instrumental||(!record.syncedLyrics&&!record.plainLyrics))return null;return record}catch{return null}
}
