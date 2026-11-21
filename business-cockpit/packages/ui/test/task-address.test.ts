import { describe, expect, it } from 'vitest';
import { addressOfTask, wayToOpen } from '../src/modules/task-address';

describe('the address of a user task', () => {
  it('TF-020 is the uiUri unchanged when it starts with http:// or https://', () => {
    expect(addressOfTask({ workflowModuleId: 'orders', uiUri: 'https://example.org/a?b=1#c' })).toBe('https://example.org/a?b=1#c');
    expect(addressOfTask({ workflowModuleId: 'orders', uiUri: 'http://example.org/a' })).toBe('http://example.org/a');
  });

  it('TF-020 is a path below /wm/<workflowModuleId>/ for every other uiUri', () => {
    expect(addressOfTask({ workflowModuleId: 'orders', uiUri: '/bc-manifest.json' })).toBe('/wm/orders/bc-manifest.json');
    expect(addressOfTask({ workflowModuleId: 'orders', uiUri: 'pages/start.html' })).toBe('/wm/orders/pages/start.html');
    expect(addressOfTask({ workflowModuleId: 'Taxi Ride', uiUri: '/x' })).toBe('/wm/Taxi%20Ride/x');
  });

  it('TF-019 the type decides how a task opens, never the form of its address', () => {
    expect(wayToOpen({ uiUriType: 'ES_MODULES' })).toBe('in-cockpit');
    expect(wayToOpen({ uiUriType: 'EXTERNAL' })).toBe('own-tab');
    expect(wayToOpen({ uiUriType: 'SOMETHING_OF_ANOTHER_COCKPIT' })).toBe('unknown');
  });
});
