import { ApplicationRef, type ComponentRef, createComponent, provideZonelessChangeDetection } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { defineBcElement, type BcElementProps } from '@example/bc-module-kit';
import { names } from '../element-names';
import { ClaimForm } from './claim-form';

const PROCESS = 'angular-claim';

// One Angular application for the whole module, and zoneless: zone.js would patch the whole page.
let application: Promise<ApplicationRef> | undefined;
const startApplication = () => (application ??= createApplication({ providers: [provideZonelessChangeDetection()] }));

interface DrawnForm {
  component?: ComponentRef<ClaimForm>;
  latestProps: BcElementProps;
  isRemoved: boolean;
}

function defineAngularElement(name: string): void {
  const forms = new Map<ShadowRoot, DrawnForm>();
  defineBcElement(name, {
    mount: (shadowRoot, props) => {
      // The host element has to be in the shadow root before the component exists, or Angular writes
      // the styles of the component into the head of the page.
      const hostElement = document.createElement('div');
      shadowRoot.append(hostElement);
      const form: DrawnForm = { latestProps: props, isRemoved: false };
      forms.set(shadowRoot, form);
      startApplication().then((running) => {
        if (form.isRemoved) return;
        const component = createComponent(ClaimForm, { environmentInjector: running.injector, hostElement });
        component.setInput('props', form.latestProps);
        component.changeDetectorRef.detectChanges();
        running.attachView(component.hostView);
        form.component = component;
      });
    },
    update: (shadowRoot, props) => {
      const form = forms.get(shadowRoot);
      if (!form) return;
      form.latestProps = props;
      form.component?.setInput('props', props);
    },
    unmount: (shadowRoot) => {
      const form = forms.get(shadowRoot);
      if (form) {
        form.isRemoved = true;
        form.component?.destroy();
      }
      forms.delete(shadowRoot);
    },
  });
}

for (const part of ['all', 'body', 'information', 'actions']) defineAngularElement(names.userTask(PROCESS, 'check', part));
