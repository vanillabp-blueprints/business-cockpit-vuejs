import type { AppInformation, GroupHierarchyOfUser } from '../../packages/ui/src/generated/cockpit-gui-api/types.gen.ts';
import type { User } from '../../packages/ui/src/generated/official-gui-api/types.gen.ts';

/** What a test can change about the simulated cockpit. Everything lives in memory only. */
export interface SimulatorState {
  appInformation: AppInformation;
  users: SimulatedUser[];
  /** Whether index.html is served without a login, as the cockpit does when the interface is hosted `in-front`. */
  shellIsOpen: boolean;
  /** The settings of each user, by user id and then by key. */
  settings: Record<string, Record<string, unknown>>;
}

export interface SimulatedUser {
  user: User;
  /** The answer of GET /app/current-user/group-hierarchy for this user. */
  groupHierarchy: GroupHierarchyOfUser;
}

export interface RequestLogEntry {
  method: string;
  path: string;
}

export const clerk: SimulatedUser = {
  user: {
    id: 'clerk',
    display: 'Clara Clerk',
    displayShort: 'C. Clerk',
    email: 'clerk@example.com',
    groups: [{ id: 'AccountManagement' }, { id: 'User' }, { id: 'Orders.Cancel' }, { id: 'Orders.View' }],
  },
  groupHierarchy: {
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
  },
};

export function initialState(): SimulatorState {
  return {
    appInformation: {
      titleShort: 'Cockpit',
      titleLong: 'Example Business Cockpit',
      version: '1.2.3',
      buildTimestamp: '2026-11-21T10:30:00Z',
      additionalProperties: { languages: 'de,en,fr' },
    },
    users: [structuredClone(clerk)],
    shellIsOpen: false,
    settings: {},
  };
}

export class Simulator {
  state: SimulatorState = initialState();
  /** The browsers that are logged in, by the value of their session cookie. */
  sessions = new Map<string, string>();
  requests: RequestLogEntry[] = [];

  reset(): void {
    this.state = initialState();
    this.sessions.clear();
    this.requests = [];
  }

  findUser(userId: string): SimulatedUser | undefined {
    return this.state.users.find((candidate) => candidate.user.id === userId);
  }

  userOfSession(sessionId: string | undefined): SimulatedUser | undefined {
    const userId = sessionId ? this.sessions.get(sessionId) : undefined;
    return userId ? this.findUser(userId) : undefined;
  }

  logIn(userId: string): string {
    const sessionId = crypto.randomUUID();
    this.sessions.set(sessionId, userId);
    return sessionId;
  }
}
