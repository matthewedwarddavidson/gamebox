import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './games/shikaku/ui/App';
import './games/shikaku/ui/styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
