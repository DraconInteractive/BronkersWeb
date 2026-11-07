import { Game } from './engine/game';
import { mountApp } from './ui/app';
import './style.css';
import { attachRoundLogging } from './telemetry/roundLogging';
declare const __BUILD_COMMIT__:string;
const game = new Game();
const unmount = mountApp(document.querySelector<HTMLElement>('#app')!,game);
const stopLogging=attachRoundLogging(game,{buildCommit:__BUILD_COMMIT__});
if (import.meta.hot) import.meta.hot.dispose(()=>{stopLogging();unmount();});
