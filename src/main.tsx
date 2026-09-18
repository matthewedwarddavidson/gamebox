import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell } from './shell/AppShell';
import './games/shikaku/ui/styles.css';
import './shell/shell.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>,
);
