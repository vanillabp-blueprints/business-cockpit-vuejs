import { createRoot } from 'react-dom/client';
import { defineBcElement } from '@example/bc-module-kit';
import { names } from '../element-names.js';
import styles from './form.css';

const roots = new Map();

defineBcElement(names.custom('start-order'), {
  mount: (shadowRoot) => {
    const style = document.createElement('style');
    style.textContent = styles;
    const host = document.createElement('div');
    shadowRoot.append(style, host);
    const root = createRoot(host);
    roots.set(shadowRoot, root);
    root.render(<button data-testid="module-header-button">Start order</button>);
  },
  unmount: (shadowRoot) => {
    roots.get(shadowRoot)?.unmount();
    roots.delete(shadowRoot);
  },
});
