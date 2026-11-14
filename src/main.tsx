import React from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

gsap.ticker.fps(60);

// Keep the page, PKCE storage, and Spotify callback on the same origin.
if (
  window.location.hostname.toLowerCase() === 'localhost' &&
  window.location.port === '5173'
) {
  window.location.replace(
    `http://127.0.0.1:5173${window.location.pathname}${window.location.search}${window.location.hash}`
  );
} else {
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
