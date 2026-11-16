import { memo } from 'react';
import { ListMusic, Trash2, X } from 'lucide-react';
import type { Track } from '../spotify/api';
import type { QueuedTrack } from '../autoplay/autoplay';

type Props = {
  open: boolean;
  onClose: () => void;
  queue: QueuedTrack[];
  currentTrackId?: string;
  autoplayEnabled: boolean;
  onToggleAutoplay: () => void;
  onClearQueue: () => void;
  onPlayTrack: (track: Track) => void;
};

const fmt = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

function UpNextQueueView({
  open,
  onClose,
  queue,
  currentTrackId,
  autoplayEnabled,
  onToggleAutoplay,
  onClearQueue,
  onPlayTrack
}: Props) {
  const currentIndex = queue.findIndex(item => item.id === currentTrackId);

  return (
    <aside
      className={`upnext-dock ${open ? 'is-open' : ''}`}
      aria-label="Playback queue"
      aria-hidden={!open}
    >
      <header className="upnext-header">
        <div className="upnext-title">
          <ListMusic size={18} />
          <h2>PLAY ORDER ({queue.length})</h2>
        </div>
        <div className="upnext-header-actions">
          <button
            className={`upnext-pill-btn ${autoplayEnabled ? 'is-active' : ''}`}
            onClick={onToggleAutoplay}
            title="Toggle AuraPlayer's similar-track queue filling"
            aria-pressed={autoplayEnabled}
          >
            RELATED PICKS: {autoplayEnabled ? 'ON' : 'OFF'}
          </button>
          {queue.length > 0 && (
            <button className="upnext-pill-btn is-danger" onClick={onClearQueue} title="Clear the displayed queue history">
              <Trash2 size={12} /> CLEAR
            </button>
          )}
          <button className="upnext-close-btn" onClick={onClose} aria-label="Close queue">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="upnext-content">
        {queue.length ? (
          <div className="upnext-scroll-list">
            <span className="upnext-section-label">PLAY ORDER · RELATED PICKS ARE ADDED AUTOMATICALLY</span>
            {queue.map((item, index) => {
              const isCurrent = item.id === currentTrackId;
                const hasPlayed = currentIndex >= 0 && index < currentIndex;
              return (
                <button
                  key={item.id || item.uri}
                  className={`upnext-row ${isCurrent ? 'is-current' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  disabled={isCurrent}
                  onClick={() => onPlayTrack(item)}
                >
                  <span className="upnext-pos">{String(index + 1).padStart(2, '0')}</span>
                  <div className="upnext-art">
                    {item.album?.images?.[0]?.url ? (
                      <img src={item.album.images[0].url} alt="" />
                    ) : (
                      <div className="upnext-art-placeholder">{index + 1}</div>
                    )}
                  </div>
                  <div className="upnext-meta">
                    <strong>{item.name || 'Unknown Track'}</strong>
                    <small>{item.artists?.map(artist => artist?.name || '').filter(Boolean).join(', ') || 'Unknown Artist'}</small>
                  </div>
                  <div className="upnext-right">
                    {isCurrent ? (
                      <span className="now-playing-pill">NOW PLAYING</span>
                    ) : hasPlayed ? (
                      <span className="queue-pill">PLAYED</span>
                    ) : item.isAutoplay ? (
                      <span className="autoplay-pill">RELATED PICK</span>
                    ) : (
                      <span className="queue-pill">QUEUED</span>
                    )}
                    <span className="upnext-duration">{fmt(item.duration_ms || 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="upnext-empty-state">
            <span className="empty-sticker">QUEUE EMPTY</span>
            <p>
              {autoplayEnabled
                ? 'AuraPlayer will find related tracks and add them to your Spotify queue as playback continues.'
                : 'No queue entries yet. Search for a track or turn on related picks.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export const UpNextQueue = memo(UpNextQueueView);
