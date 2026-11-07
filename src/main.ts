import { Game } from './engine/game';
import { mountApp } from './ui/app';
import './style.css';
const mode=new URLSearchParams(location.search).get('mode')==='points'?'points':'goals';
const game = new Game(undefined,undefined,[],{mode});
const unmount = mountApp(document.querySelector<HTMLElement>('#app')!,game);
if (import.meta.hot) import.meta.hot.dispose(unmount);
