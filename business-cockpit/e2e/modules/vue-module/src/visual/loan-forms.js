import { createApp, shallowRef } from 'vue';
import { defineBcElement } from '@example/bc-module-kit';
import { names } from '../element-names.js';
import LoanForm from './LoanForm.vue';
import LoanPage from './LoanPage.vue';
import styles from './form.css';
import { PROPS_KEY } from './props-key.js';

const PROCESS = 'vue-loan';

/** One small Vue application per web component. The properties of the cockpit reach it as one shallowRef. */
function defineVueElement(name, Component) {
  const applications = new Map();
  defineBcElement(name, {
    mount: (shadowRoot, props) => {
      const style = document.createElement('style');
      style.textContent = styles;
      const host = document.createElement('div');
      shadowRoot.append(style, host);
      const properties = shallowRef(props);
      const application = createApp(Component);
      application.provide(PROPS_KEY, properties);
      application.mount(host);
      applications.set(shadowRoot, { application, properties });
    },
    update: (shadowRoot, props) => {
      applications.get(shadowRoot).properties.value = props;
    },
    unmount: (shadowRoot) => {
      applications.get(shadowRoot)?.application.unmount();
      applications.delete(shadowRoot);
    },
  });
}

for (const part of ['all', 'body', 'information', 'actions']) defineVueElement(names.userTask(PROCESS, 'review', part), LoanForm);
defineVueElement(names.userTask(PROCESS, 'approve', 'all'), LoanForm);
defineVueElement(names.userTask(PROCESS, 'approve', 'sidebar'), LoanForm);
defineVueElement(names.userTask(PROCESS, 'only-body', 'body'), LoanForm);
defineVueElement(names.workflow(PROCESS, 'page'), LoanPage);
