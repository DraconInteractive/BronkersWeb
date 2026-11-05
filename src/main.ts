import { Game } from './engine/game';
import { mountApp } from './ui/app';
import './style.css';
const game = new Game();
const unmount = mountApp(document.querySelector<HTMLElement>('#app')!,game);
if (import.meta.hot) import.meta.hot.dispose(unmount);
