import { memo } from 'react';
import { ListMusic, Trash2, X } from 'lucide-react';
import type { Track, QueueTrack } from '../player/types';
import type { SourceId } from '../player/types';

type Props = {
  open: boolean;
  source: SourceId;
  autoplayAvailable: boolean;
  onClose: () => void;
  queue: QueueTrack[];
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
  source,
  autoplayAvailable,
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
            disabled={!autoplayAvailable}
            title={source === 'youtube' ? 'YouTube related picks require a Last.fm API key.' : "Toggle AuraPlayer's similar-track queue filling"}
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
            <span className="upnext-section-label">PLAY ORDER · {source === 'youtube' ? 'LOCAL VIDEO QUEUE' : 'SPOTIFY QUEUE'}</span>
            {queue.map((item, index) => {
              const isCurrent = item.id === currentTrackId;
                const hasPlayed = currentIndex >= 0 && index < currentIndex;
              return (
                <button
                  key={`${item.source}:${item.id || item.uri}`}
                  className={`upnext-row ${isCurrent ? 'is-current' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  disabled={isCurrent}
                  onClick={() => onPlayTrack(item)}
                >
                  <span className="upnext-pos">{String(index + 1).padStart(2, '0')}</span>
                  <div className="upnext-art">
                    {item.artworkUrl ? (
                      <img src={item.artworkUrl} alt="" />
                    ) : (
                      <div className="upnext-art-placeholder">{index + 1}</div>
                    )}
                  </div>
                  <div className="upnext-meta">
                    <strong>{item.title || 'Unknown Track'}</strong>
                    <small>{item.artist || 'Unknown Artist'} · {item.source.toUpperCase()}</small>
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
                    <span className="upnext-duration">{fmt(item.durationMs || 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="upnext-empty-state">
            <span className="empty-sticker">QUEUE EMPTY</span>
            <p>
              {source === 'youtube'
                ? 'YouTube videos are queued locally. Search and choose videos; related picks need a Last.fm API key.'
                : autoplayEnabled
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
