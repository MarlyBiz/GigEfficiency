/** Share the app link: native share sheet when available, otherwise copy the link. */
export const APP_URL = 'https://gig.marlylabs.app';
export const SHARE_DATA = {
  title: 'Gig Efficiency Tracker',
  text: 'Track gig shifts, real $/hour and miles across Uber, Lyft, DoorDash and more. Free, and your data stays on your phone.',
  url: APP_URL,
};

export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed';

export async function shareApp(nav: Navigator = navigator): Promise<ShareResult> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share(SHARE_DATA);
      return 'shared';
    } catch (e: any) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // fall through to copy (e.g. NotAllowedError)
    }
  }
  try {
    await nav.clipboard.writeText(APP_URL);
    return 'copied';
  } catch {
    return 'failed';
  }
}
