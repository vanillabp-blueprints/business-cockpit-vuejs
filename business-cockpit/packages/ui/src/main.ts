import { createApp } from 'vue';
import '@example/bc-theme/bc-theme.css';
import './styles.css';
import App from './App.vue';
import { configureGuiApiClients } from './api/clients';
import { setLanguage, DEFAULT_LANGUAGE } from './i18n/texts';
import { startSession } from './session/session';
import { vuetify } from './vuetify';

configureGuiApiClients();
setLanguage(DEFAULT_LANGUAGE);
createApp(App).use(vuetify).mount('#app');
startSession();
