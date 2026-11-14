import React from 'react'; import { createRoot } from 'react-dom/client'; import { gsap } from 'gsap'; import App from './App'; import './styles.css';
gsap.ticker.fps(60);
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
