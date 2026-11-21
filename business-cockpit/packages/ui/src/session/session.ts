import { ref } from 'vue';
import { LoginApi, UserRightsApi } from '../generated/cockpit-gui-api/sdk.gen';
import { OfficialCurrentUserApi } from '../generated/official-gui-api/sdk.gen';
import type { AppInformation, GroupHierarchyOfUser } from '../generated/cockpit-gui-api/types.gen';
import type { User } from '../generated/official-gui-api/types.gen';
import { sendBrowserToLogin } from './login';

const login = new LoginApi();
const currentUserOfApp = new OfficialCurrentUserApi();
const userRights = new UserRightsApi();

export const appInformation = ref<AppInformation>();
export const currentUser = ref<User>();

/**
 * Asks the backend who is logged in. The frame shows nothing before the answer. Without a user the
 * browser goes to the login, so no page ever shows an error for a missing login.
 */
export async function startSession(): Promise<void> {
  const [information, user] = await Promise.all([login.appInformation(), currentUserOfApp.currentUser()]);
  // Without a login the answer is 200 with no body, and the client turns that into an empty object.
  if (!user?.id) return sendBrowserToLogin();
  appInformation.value = information;
  currentUser.value = user;
}

/** The overview of roles and rights is asked on the first mouse-over and kept until the page is loaded again. */
let rightsOfUserAsked: Promise<GroupHierarchyOfUser | undefined> | undefined;

export function rightsOfUser(): Promise<GroupHierarchyOfUser | undefined> {
  rightsOfUserAsked ??= userRights.getGroupHierarchyOfCurrentUser().catch(() => undefined);
  return rightsOfUserAsked;
}
