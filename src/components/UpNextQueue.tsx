import { memo } from 'react';
import { ListMusic, Play, Trash2, X } from 'lucide-react';
import type { Track } from '../spotify/api';
import type { QueuedTrack } from '../autoplay/autoplay';

type Props = {
  open: boolean;
  onClose: () => void;
  queue: QueuedTrack[];
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
  autoplayEnabled,
  onToggleAutoplay,
  onClearQueue,
  onPlayTrack
}: Props) {
  const nextTrack = queue[0];
  const upcomingTracks = queue.slice(1);

  return (
    <aside
      className={`upnext-dock ${open ? 'is-open' : ''}`}
      aria-label="Upcoming tracks queue"
      aria-hidden={!open}
    >
      {/* Header */}
      <header className="upnext-header">
        <div className="upnext-title">
          <ListMusic size={18} />
          <h2>UP NEXT ({queue.length})</h2>
        </div>
        <div className="upnext-header-actions">
          <button
            className={`upnext-pill-btn ${autoplayEnabled ? 'is-active' : ''}`}
            onClick={onToggleAutoplay}
            title="Toggle Spotify Autoplay engine"
          >
            AUTOPLAY: {autoplayEnabled ? 'ON' : 'OFF'}
          </button>
          {queue.length > 0 && (
            <button
              className="upnext-pill-btn is-danger"
              onClick={onClearQueue}
              title="Clear all tracks in queue"
            >
              <Trash2 size={12} /> CLEAR
            </button>
          )}
          <button className="upnext-close-btn" onClick={onClose} aria-label="Close queue">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="upnext-content">
        {queue.length > 0 ? (
          <>
            {/* Prominent NEXT Card on Top */}
            {nextTrack && (
              <div className="next-spotlight-card">
                <div className="next-badge-row">
                  <span className="next-sticker">SPOT 01 // UP NEXT</span>
                  {nextTrack.isAutoplay && <span className="autoplay-pill">AUTOPLAY</span>}
                </div>
                <div className="next-card-body" onClick={() => onPlayTrack(nextTrack)}>
                  <div className="next-art-wrap">
                    {nextTrack.album?.images?.[0]?.url ? (
                      <img src={nextTrack.album.images[0].url} alt="" />
                    ) : (
                      <div className="next-art-fallback">01</div>
                    )}
                    <span className="next-play-overlay">
                      <Play size={20} fill="#111" />
                    </span>
                  </div>
                  <div className="next-details">
                    <strong>{nextTrack.name || 'Unknown Track'}</strong>
                    <span>
                      {Array.isArray(nextTrack.artists)
                        ? nextTrack.artists.map(a => a?.name || '').join(', ') || 'Unknown Artist'
                        : 'Unknown Artist'}
                    </span>
                    <small>
                      {nextTrack.album?.name || ''} • {fmt(nextTrack.duration_ms || 0)}
                    </small>
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable list of at least the next 8 tracks */}
            <div className="upnext-scroll-list">
              <span className="upnext-section-label">FOLLOWING TRACKS</span>
              {upcomingTracks.map((item, idx) => {
                const pos = idx + 2;
                return (
                  <button
                    key={`${item.id}-${idx}`}
                    className="upnext-row"
                    onClick={() => onPlayTrack(item)}
                  >
                    <span className="upnext-pos">{String(pos).padStart(2, '0')}</span>
                    <div className="upnext-art">
                      {item.album?.images?.[0]?.url ? (
                        <img src={item.album.images[0].url} alt="" />
                      ) : (
                        <div className="upnext-art-placeholder">{pos}</div>
                      )}
                    </div>
                    <div className="upnext-meta">
                      <strong>{item.name || 'Unknown Track'}</strong>
                      <small>
                        {Array.isArray(item.artists)
                          ? item.artists.map(a => a?.name || '').join(', ')
                          : ''}
                      </small>
                    </div>
                    <div className="upnext-right">
                      {item.isAutoplay ? (
                        <span className="autoplay-pill">AUTOPLAY</span>
                      ) : (
                        <span className="queue-pill">QUEUE</span>
                      )}
                      <span className="upnext-duration">{fmt(item.duration_ms || 0)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="upnext-empty-state">
            <span className="empty-sticker">QUEUE EMPTY</span>
            <p>
              {autoplayEnabled
                ? 'Spotify Autoplay is active. Similar tracks will be automatically fetched and queued as current songs play.'
                : 'Queue is empty and Autoplay is paused. Toggle AUTOPLAY above or search tracks to queue them.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}

export const UpNextQueue = memo(UpNextQueueView);
