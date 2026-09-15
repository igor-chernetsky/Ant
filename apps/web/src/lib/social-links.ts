/**
 * Public social profiles of the platform, used by the footer, the mobile menu,
 * the contact dialog, the landing pages, structured data and outbound email.
 *
 * Keep this list as the single source of truth on the web side: adding Instagram
 * or LINE later means adding one entry here, not touching every placement.
 */
export interface SocialLink {
  id: 'facebook';
  /** Brand name shown next to the icon — never translated. */
  label: string;
  /** Account name shown as the secondary line in the contact dialog. */
  handle: string;
  href: string;
}

export const SOCIAL_LINKS: SocialLink[] = [
  {
    id: 'facebook',
    label: 'Facebook',
    handle: 'Builthai',
    href: 'https://www.facebook.com/profile.php?id=61593503415341',
  },
];
