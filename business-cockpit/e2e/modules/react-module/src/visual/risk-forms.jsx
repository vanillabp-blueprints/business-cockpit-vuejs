import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { defineBcElement } from '@example/bc-module-kit';
import { names } from '../element-names.js';
import styles from './form.css';

const PROCESS = 'react-order';

const titleOf = ({ userTask, language }) => userTask.title[language] ?? Object.values(userTask.title)[0];
const workflowTitleOf = ({ userTask, language }) => userTask.workflowTitle?.[language] ?? '';

function Body(props) {
  const [clicks, setClicks] = useState(0);
  return (
    <div>
      <h2 data-testid="module-title">{titleOf(props)}</h2>
      <span data-testid="module-state">{props.userTask.suspendedAt ? 'suspended' : 'active'}</span>
      <input data-testid="module-input" placeholder="Remark" />
      <button data-testid="module-button" onClick={() => setClicks(clicks + 1)}>Clicked {clicks}</button>
      <div style={{ height: 1500 }} data-testid="module-spacer" />
    </div>
  );
}

const Information = (props) => (
  <div>
    <div data-testid="module-business-id">{props.userTask.businessId}</div>
    <div data-testid="module-case-title">{workflowTitleOf(props)}</div>
  </div>
);

const Actions = () => <button data-testid="module-complete">Complete</button>;

const parts = { body: Body, information: Information, actions: Actions };

function Form(props) {
  const shown = props.area === 'all' ? ['body', 'information', 'actions'] : [props.area];
  return (
    <div className="form" data-testid="module-form" data-framework="react" data-area={props.area}>
      {shown.map((area) => {
        const Part = parts[area];
        return <Part key={area} {...props} />;
      })}
    </div>
  );
}

function defineReactElement(name) {
  const roots = new Map();
  defineBcElement(name, {
    mount: (shadowRoot, props) => {
      const style = document.createElement('style');
      style.textContent = styles;
      const host = document.createElement('div');
      shadowRoot.append(style, host);
      const root = createRoot(host);
      roots.set(shadowRoot, root);
      root.render(<Form {...props} />);
    },
    update: (shadowRoot, props) => roots.get(shadowRoot)?.render(<Form {...props} />),
    unmount: (shadowRoot) => {
      roots.get(shadowRoot)?.unmount();
      roots.delete(shadowRoot);
    },
  });
}

for (const part of ['all', 'body', 'information', 'actions']) defineReactElement(names.userTask(PROCESS, 'assessRisk', part));
defineReactElement(names.userTask(PROCESS, 'confirm', 'page'));
