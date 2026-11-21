import type { Page } from '@playwright/test';

/**
 * Lets a list claim a total it does not have, for example 1,000,000 entries, without a backend that
 * holds them. The answers of the simulator pass through. The total is raised, and page `n` shows
 * the rows of page `n` modulo the real number of pages. The returned array fills with the page
 * number of every page the browser asked for.
 */
export async function pretendToHaveEntries(page: Page, claimedTotal: number): Promise<number[]> {
  const pagesAsked: number[] = [];
  const realPagesOfMode = new Map<string, number>();

  await page.route(/\/usertask(\/count)?(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();

    if (new URL(request.url()).pathname.endsWith('/count')) {
      const answer = await route.fetch();
      const counts = (await answer.json()) as { counts: { key: string; count: number }[] };
      return route.fulfill({ response: answer, json: { ...counts, counts: counts.counts.map((count) => ({ ...count, count: claimedTotal })) } });
    }

    const asked = request.postDataJSON() as { pageNumber?: number; pageSize: number; mode: string };
    const pageNumber = asked.pageNumber ?? 0;
    pagesAsked.push(pageNumber);
    const realPages = realPagesOfMode.get(asked.mode);
    const pageToFetch = realPages ? pageNumber % realPages : pageNumber;
    let answer = await route.fetch({ postData: JSON.stringify({ ...asked, pageNumber: pageToFetch }) });
    let body = (await answer.json()) as { page: { totalPages: number; totalElements: number; number: number; size: number } };
    realPagesOfMode.set(asked.mode, Math.max(1, body.page.totalPages));
    if (pageToFetch >= body.page.totalPages && body.page.totalPages > 0) {
      answer = await route.fetch({ postData: JSON.stringify({ ...asked, pageNumber: pageNumber % body.page.totalPages }) });
      body = (await answer.json()) as typeof body;
    }
    const page = { ...body.page, number: pageNumber, totalElements: claimedTotal, totalPages: Math.ceil(claimedTotal / asked.pageSize) };
    return route.fulfill({ response: answer, json: { ...body, page } });
  });
  return pagesAsked;
}
