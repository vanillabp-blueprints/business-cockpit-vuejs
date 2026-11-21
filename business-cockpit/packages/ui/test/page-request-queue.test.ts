import { describe, expect, it } from 'vitest';
import { createPageRequestQueue, type PageRequest } from '../src/lists/page-request-queue';

function aRequest(key: string, log: string[]) {
  let answer!: (page: string) => void;
  const request: PageRequest<string> = {
    key,
    load: () => new Promise<string>((resolve) => (answer = resolve)),
    onLoaded: (page) => log.push(`loaded ${page}`),
    onFailed: () => log.push(`failed ${key}`),
  };
  return { request, answer: (page: string) => answer(page) };
}

const letPromisesSettle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TL-024 the queue of page requests', () => {
  it('runs only as many requests at once as it may and keeps the others in order', async () => {
    const log: string[] = [];
    const queue = createPageRequestQueue<string>(1);
    const first = aRequest('a', log);
    const second = aRequest('b', log);
    queue.ask(first.request);
    queue.ask(second.request);

    first.answer('page a');
    await letPromisesSettle();
    expect(log).toEqual(['loaded page a']);
    second.answer('page b');
    await letPromisesSettle();
    expect(log).toEqual(['loaded page a', 'loaded page b']);
    expect(queue.isBusy()).toBe(false);
  });

  it('ignores a request whose key is already waiting or running', async () => {
    const queue = createPageRequestQueue<string>(1);
    const log: string[] = [];
    queue.ask(aRequest('a', log).request);
    queue.ask(aRequest('a', log).request);
    queue.ask(aRequest('b', log).request);
    queue.ask(aRequest('b', log).request);
    queue.dropWaitingRequests();
    expect(queue.isBusy()).toBe(true);
  });

  it('passes on no answer and starts nothing after it was closed', async () => {
    const log: string[] = [];
    const queue = createPageRequestQueue<string>(1);
    const running = aRequest('a', log);
    queue.ask(running.request);
    queue.ask(aRequest('b', log).request);
    queue.close();
    running.answer('late');
    await letPromisesSettle();
    expect(log).toEqual([]);
    queue.ask(aRequest('c', log).request);
    expect(queue.isBusy()).toBe(false);
  });

  it('reports a failure of one request and goes on with the next', async () => {
    const log: string[] = [];
    const queue = createPageRequestQueue<string>(1);
    queue.ask({ key: 'a', load: () => Promise.reject(new Error('down')), onLoaded: () => undefined, onFailed: () => log.push('failed a') });
    const second = aRequest('b', log);
    queue.ask(second.request);
    await letPromisesSettle();
    second.answer('page b');
    await letPromisesSettle();
    expect(log).toEqual(['failed a', 'loaded page b']);
  });
});
