// In-page notices, used in place of the browser's alert().
//
// alert() blocks the page and cannot be styled or dismissed with the keyboard
// in a consistent way. These notices appear at the top of the screen, are
// announced by screen readers, and go away on their own.
import { toast } from 'sonner@2.0.3';

type NoticeType = 'success' | 'error' | 'info';

// Messages that report a problem or ask the user to fix something.
const PROBLEM = /\b(fail(ed)?|could not|couldn't|cannot|can't|error|please|not available|not supported|larger than|invalid|already)\b/i;

/**
 * Shows a short message. The kind is taken from `type`, or from the wording
 * when it is not given ("Failed to…" and "Please…" are shown as problems).
 */
export function notify(message: string, type?: NoticeType): void {
  const text = String(message ?? '').trim();
  if (!text) return;
  const kind: NoticeType = type ?? (PROBLEM.test(text) ? 'error' : 'success');
  if (kind === 'error') toast.error(text, { duration: 7000 });
  else if (kind === 'info') toast.message(text);
  else toast.success(text);
}
