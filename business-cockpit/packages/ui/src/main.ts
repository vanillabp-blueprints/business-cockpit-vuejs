import { createApp } from 'vue';
import '@example/bc-theme/bc-theme.css';
import './styles.css';
import App from './App.vue';
import { configureGuiApiClients } from './api/clients';
import { vuetify } from './vuetify';

configureGuiApiClients();
createApp(App).use(vuetify).mount('#app');
