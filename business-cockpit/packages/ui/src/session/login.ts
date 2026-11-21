import { LOGIN_PATH, LOGOUT_PATH } from '../config';

/**
 * The login is the job of the backend. The user interface only sends the browser there. After
 * the login the backend sends the browser back to the address it came from.
 */
export function sendBrowserToLogin(location: Pick<Location, 'assign'> = window.location): void {
  location.assign(LOGIN_PATH);
}

export function sendBrowserToLogout(location: Pick<Location, 'assign'> = window.location): void {
  location.assign(LOGOUT_PATH);
}
