import {AppController} from './controllers/app.controller.js';

document.addEventListener('DOMContentLoaded', () => {
  (window as any).app = new AppController();
});
