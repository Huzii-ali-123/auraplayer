import { useEffect, useRef } from 'react';
import { Check, ExternalLink, Music2, X } from 'lucide-react';
import { providerCatalog } from '../providers/registry';

type Props = {
  open: boolean;
  spotifyConnected: boolean;
  youtubeConfigured: boolean;
  onClose: () => void;
  onSpotifyConnect: () => void;
  onSpotifyDisconnect: () => void;
};

export function ConnectedServices({ open, spotifyConnected, youtubeConfigured, onClose, onSpotifyConnect, onSpotifyDisconnect }: Props) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="services-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="services-dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="services-title" tabIndex={-1}>
        <header className="services-heading">
          <div><small>AURA//PLAYER / PROVIDER HUB</small><h2 id="services-title">CONNECTED MUSIC SERVICES</h2></div>
          <button className="services-close" onClick={onClose} aria-label="Close connected services"><X size={20} /></button>
        </header>
        <p className="services-intro">Each service has its own permissions and playback rules. Only a working integration is marked as connectable.</p>
        <div className="services-grid">
          {providerCatalog.map(provider => {
            const connected = (provider.id === 'spotify' && spotifyConnected) || (provider.id === 'youtube-videos' && youtubeConfigured);
            const ready = provider.integration === 'full';
            return <article className={`service-card ${connected ? 'is-connected' : ''}`} key={provider.id}>
              <div className="service-card-top">
                <span className={`service-mark service-${provider.id}`}><Music2 size={18} /></span>
                <span className={`service-status ${connected ? 'status-connected' : ''}`}>
                  {provider.id === 'youtube-videos' && connected ? <><Check size={12} /> READY · NO LOGIN</> : connected ? <><Check size={12} /> CONNECTED</> : ready ? 'NOT CONNECTED' : provider.integration === 'not-available' ? 'UNAVAILABLE' : 'NOT INTEGRATED'}
                </span>
              </div>
              <h3>{provider.name}</h3>
              <p>{provider.summary}</p>
              <ul>{provider.capabilities.map(capability => <li key={capability}>{capability}</li>)}</ul>
              <small className="service-requirement">{provider.requirement}</small>
              {provider.id === 'spotify' ? (
                connected
                  ? <button className="service-action" onClick={onSpotifyDisconnect}>DISCONNECT SPOTIFY</button>
                  : <button className="service-action" onClick={onSpotifyConnect}>CONNECT SPOTIFY <ExternalLink size={14} /></button>
              ) : provider.id === 'youtube-videos' ? (
                <span className="service-unavailable-note">{youtubeConfigured ? 'SELECT YOUTUBE IN THE HEADER TO SEARCH AND PLAY.' : 'ADD VITE_YOUTUBE_API_KEY; THIS SOURCE DOES NOT NEED ACCOUNT LOGIN.'}</span>
              ) : <span className="service-unavailable-note">{provider.integration === 'not-available' ? 'NOT AN AVAILABLE ACCOUNT CONNECTION' : 'INTEGRATION REQUIRED BEFORE CONNECTING'}</span>}
            </article>;
          })}
        </div>
        <footer className="services-footer">AURA//PLAYER IS AN INDEPENDENT PROJECT AND IS NOT AFFILIATED WITH THESE SERVICES.</footer>
      </section>
    </div>
  );
}
