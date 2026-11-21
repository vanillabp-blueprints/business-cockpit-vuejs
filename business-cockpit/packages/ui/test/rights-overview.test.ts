import { describe, expect, it } from 'vitest';
import { ORGANISATION, tablesOf } from '../src/session/rights-overview';

const answerOfTheDescription = {
  givenByOrganisation: ['AccountManagement'],
  modules: [
    {
      workflowModuleId: 'orders',
      entries: [
        { group: 'AccountManagement', givenByOrganisation: true, targets: ['Orders.Cancel', 'User'] },
        { group: 'User', givenByOrganisation: false, targets: ['Orders.View'] },
      ],
    },
  ],
};

const summary = (rows: ReturnType<typeof tablesOf>[number]['rows']) =>
  rows.map((row) => [row.name, row.kind, row.givenBy === ORGANISATION ? 'Organisation' : row.givenBy]);

describe('NAV-020 NAV-021 the overview has one table for each module with name, kind and who gives it', () => {
  it('shows the example of the description', () => {
    const [orders] = tablesOf(answerOfTheDescription);
    expect(orders.workflowModuleId).toBe('orders');
    expect(summary(orders.rows)).toEqual([
      ['AccountManagement', 'role', 'Organisation'],
      ['User', 'role', 'AccountManagement'],
      ['Orders.Cancel', 'right', 'AccountManagement'],
      ['Orders.View', 'right', 'User'],
    ]);
  });

  it('shows a target the organisation also gives once, as Organisation', () => {
    const [orders] = tablesOf({
      givenByOrganisation: ['AccountManagement', 'User'],
      modules: [{ workflowModuleId: 'orders', entries: answerOfTheDescription.modules[0].entries }],
    });
    expect(summary(orders.rows).filter(([name]) => name === 'User')).toEqual([['User', 'role', 'Organisation']]);
  });

  it('has nothing to show without an answer', () => {
    expect(tablesOf(undefined)).toEqual([]);
  });
});

describe('NAV-030 a target from two groups has one row for each group', () => {
  it('keeps both rows', () => {
    const [orders] = tablesOf({
      givenByOrganisation: ['A', 'B'],
      modules: [
        {
          workflowModuleId: 'orders',
          entries: [
            { group: 'A', givenByOrganisation: true, targets: ['Orders.View'] },
            { group: 'B', givenByOrganisation: true, targets: ['Orders.View'] },
          ],
        },
      ],
    });
    expect(summary(orders.rows).filter(([name]) => name === 'Orders.View')).toEqual([
      ['Orders.View', 'right', 'A'],
      ['Orders.View', 'right', 'B'],
    ]);
  });

  it('counts a group of the hierarchy of another module as a role', () => {
    const tables = tablesOf({
      givenByOrganisation: ['Staff'],
      modules: [
        { workflowModuleId: 'billing', entries: [{ group: 'Staff', givenByOrganisation: true, targets: ['Billing.Clerk'] }] },
        { workflowModuleId: 'orders', entries: [{ group: 'Billing.Clerk', givenByOrganisation: false, targets: ['Orders.View'] }] },
      ],
    });
    expect(summary(tables[0].rows)).toContainEqual(['Billing.Clerk', 'role', 'Staff']);
    // In the table of the other module the group shows only as "Given by".
    expect(summary(tables[1].rows).filter(([name]) => name === 'Billing.Clerk')).toEqual([]);
    expect(summary(tables[1].rows)).toContainEqual(['Orders.View', 'right', 'Billing.Clerk']);
  });
});
