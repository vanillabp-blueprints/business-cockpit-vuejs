import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { BcElementProps } from '@example/bc-module-kit';

/** One component for all areas of the form. The cockpit hands all its properties over as one input. */
@Component({
  selector: 'bc-claim-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host { display: block; font-family: var(--bc-font-family, sans-serif); color: var(--bc-color-text, #222); }
      .form { padding: 16px; }
      h2 { margin: 0 0 12px; color: rgb(150, 60, 150); }
      button { background: rgb(150, 60, 150); color: white; border: 0; padding: 6px 12px; border-radius: 4px; }
      input { display: block; margin: 8px 0; padding: 4px; }
    `,
  ],
  template: `
    <div class="form" data-testid="module-form" data-framework="angular" [attr.data-area]="props().area">
      @if (shows('body')) {
        <div>
          <h2 data-testid="module-title">{{ title() }}</h2>
          <span data-testid="module-state">{{ props().userTask?.suspendedAt ? 'suspended' : 'active' }}</span>
          <input data-testid="module-input" placeholder="Remark" />
          <button data-testid="module-button" (click)="clicks.set(clicks() + 1)">Clicked {{ clicks() }}</button>
          <div style="height: 1500px" data-testid="module-spacer"></div>
        </div>
      }
      @if (shows('information')) {
        <div>
          <div data-testid="module-business-id">{{ props().userTask?.businessId }}</div>
          <div data-testid="module-case-title">{{ workflowTitle() }}</div>
        </div>
      }
      @if (shows('actions')) {
        <div><button data-testid="module-complete">Complete</button></div>
      }
    </div>
  `,
})
export class ClaimForm {
  readonly props = input.required<BcElementProps>();
  readonly clicks = signal(0);

  readonly title = computed(() => {
    const { userTask, language } = this.props();
    return userTask ? (userTask.title[language ?? ''] ?? Object.values(userTask.title)[0]) : '';
  });
  readonly workflowTitle = computed(() => {
    const { userTask, language } = this.props();
    return userTask?.workflowTitle?.[language ?? ''] ?? '';
  });

  shows(part: string): boolean {
    const area = this.props().area;
    return area === 'all' || area === part;
  }
}
