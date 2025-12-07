console.log('[index.ts] Starting app initialization...');
import { registerRootComponent } from 'expo';

import App from './App';

console.log('[index.ts] About to register root component');
// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
console.log('[index.ts] Root component registered');
