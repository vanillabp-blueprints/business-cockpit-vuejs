import { createApp } from 'vue';
import '@example/bc-theme/bc-theme.css';
import './styles.css';
import App from './App.vue';
import { configureGuiApiClients } from './api/clients';
import { setLanguage, DEFAULT_LANGUAGE } from './i18n/texts';
import { currentUser, startSession } from './session/session';
import { refreshCountsOfToggle, refreshCountsWhenTheTabComesBack } from './counts/counts';
import { startModuleRegistry } from './modules/module-host';
import { router } from './router/router';
import { vuetify } from './vuetify';

configureGuiApiClients();
setLanguage(DEFAULT_LANGUAGE);
createApp(App).use(vuetify).use(router).mount('#app');
startSession().then(() => {
  // Without a login the browser is on its way to the login, and a count would only answer 401.
  if (currentUser.value) {
    refreshCountsOfToggle();
    startModuleRegistry();
  }
});
refreshCountsWhenTheTabComesBack();
