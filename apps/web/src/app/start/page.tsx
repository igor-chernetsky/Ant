import { redirect } from 'next/navigation';

/**
 * Ad landing alias.
 *
 * Facebook ads point here so the creative never has to carry a query string:
 * `/start` opens the home page with the guest estimate flow already running
 * (`?create=1` opens the create modal, see `home-client.tsx`).
 */
export default function StartPage() {
  redirect('/?create=1');
}
