import type { GroupHierarchyOfUser } from '../generated/cockpit-gui-api/types.gen';

export type RightKind = 'role' | 'right';

export const ORGANISATION = Symbol('given by the identity provider');

export interface RightRow {
  name: string;
  kind: RightKind;
  /** The group that gives the row, or the organisation that gives a group directly. */
  givenBy: string | typeof ORGANISATION;
}

export interface TableOfModule {
  workflowModuleId: string;
  rows: RightRow[];
}

/**
 * Turns the answer of the cockpit into one table for each workflow module. The cockpit does the
 * hard part; this only decides the kind of a row and the order, as the description says.
 */
export function tablesOf(answer: GroupHierarchyOfUser | undefined): TableOfModule[] {
  if (!answer) return [];
  // A target is a role when some entry of any module has it as its group. Then it stands for more.
  const groupsWithAnEntry = new Set(answer.modules.flatMap((module) => module.entries.map((entry) => entry.group)));
  const givenByOrganisation = new Set(answer.givenByOrganisation);

  return answer.modules.map((module) => {
    const rows = new Map<string, RightRow>();
    const addRow = (row: RightRow) => {
      const givenByKey = row.givenBy === ORGANISATION ? '' : row.givenBy;
      rows.set(`${row.name}\u0000${givenByKey}`, row);
    };

    for (const group of answer.givenByOrganisation) {
      addRow({ name: group, kind: 'role', givenBy: ORGANISATION });
    }
    for (const entry of module.entries) {
      for (const target of entry.targets) {
        // A target the organisation also gives shows once, with "Organisation".
        if (givenByOrganisation.has(target)) continue;
        addRow({ name: target, kind: groupsWithAnEntry.has(target) ? 'role' : 'right', givenBy: entry.group });
      }
    }
    return { workflowModuleId: module.workflowModuleId, rows: [...rows.values()].sort(rolesFirstThenByName) };
  });
}

function rolesFirstThenByName(first: RightRow, second: RightRow): number {
  if (first.kind !== second.kind) return first.kind === 'role' ? -1 : 1;
  return first.name.localeCompare(second.name) || givenByText(first).localeCompare(givenByText(second));
}

const givenByText = (row: RightRow) => (row.givenBy === ORGANISATION ? '' : row.givenBy);
