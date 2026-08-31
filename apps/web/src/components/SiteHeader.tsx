'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ContactUsModal } from '@/components/ContactUsModal';
import { HeaderNotifications, HeaderNotificationsInline } from '@/components/HeaderNotifications';
import { useInAppNotifications } from '@/components/InAppNotificationsProvider';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/components/LocaleProvider';
import {
  canCreateProject,
  headerUserLabel,
  type MeResponse,
} from '@/lib/session';

interface SiteHeaderProps {
  me: MeResponse | null;
  onSignIn: () => void;
  onSignOut: () => void;
  /** Opens create-project flow; defaults to `/?create=1`. */
  onCreateProject?: () => void;
}

type NavItem =
  | {
      kind: 'link';
      href: string;
      label: string;
    }
  | {
      kind: 'contact';
      label: string;
    };

const SWIPE_CLOSE_PX = 72;

function isHeaderNavActive(pathname: string, href: string): boolean {
  if (href === '/') {
    return (
      pathname === '/' ||
      pathname === '/projects' ||
      pathname.startsWith('/projects/')
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function headerNavClass(pathname: string, href: string): string {
  return isHeaderNavActive(pathname, href)
    ? 'header-nav-link header-nav-link-active'
    : 'header-nav-link';
}

function HeaderAccountMenu({
  me,
  onSignOut,
}: {
  me: MeResponse;
  onSignOut: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const label = headerUserLabel(me, t('header.signedIn'));

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="header-account header-account--desktop" ref={rootRef}>
      <button
        type="button"
        className="header-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="header-account-avatar" aria-hidden>
          {label.slice(0, 1).toUpperCase()}
        </span>
        <span className="header-account-name">{label}</span>
        <span className="header-account-chevron" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div id={menuId} className="header-account-menu" role="menu">
          <Link
            href="/account"
            role="menuitem"
            className="header-account-menu-item"
            onClick={() => setOpen(false)}
          >
            {t('header.account')}
          </Link>
          <button
            type="button"
            role="menuitem"
            className="header-account-menu-item header-account-menu-item-danger"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            {t('header.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <path d="M6 6l12 12" />
          <path d="M18 6L6 18" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

export function SiteHeader({
  me,
  onSignIn,
  onSignOut,
  onCreateProject,
}: SiteHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { unreadCount } = useInAppNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const menuTitleId = useId();
  const touchRef = useRef<{
    x: number;
    y: number;
    tracking: boolean;
  } | null>(null);

  const isAdmin = Boolean(me?.roles?.includes('admin'));
  const isContractor = Boolean(
    me?.isContractor || me?.roles?.includes('contractor'),
  );
  const isDesigner = Boolean(
    me?.isDesigner || me?.roles?.includes('designer'),
  );
  const showCreateProject = canCreateProject(me);

  const primaryNav: NavItem[] = [
    { kind: 'link', href: '/', label: t('header.projects') },
    { kind: 'link', href: '/materials', label: t('header.materials') },
    { kind: 'link', href: '/help', label: t('header.help') },
    {
      kind: 'contact',
      label: t('header.contactUs'),
    },
  ];

  const roleNav: NavItem[] = [];
  if (isContractor) {
    roleNav.push({
      kind: 'link',
      href: '/contractor',
      label: t('header.contractor'),
    });
  }
  if (isDesigner) {
    roleNav.push({
      kind: 'link',
      href: '/designer',
      label: t('header.designer'),
    });
  }

  const adminNav: NavItem[] = isAdmin
    ? [
        {
          kind: 'link',
          href: '/admin/projects',
          label: t('header.projectsTable'),
        },
        { kind: 'link', href: '/admin/clients', label: t('header.clients') },
        {
          kind: 'link',
          href: '/admin/contractors',
          label: t('header.contractors'),
        },
        {
          kind: 'link',
          href: '/admin/directory',
          label: t('header.supplyRegistry'),
        },
        {
          kind: 'link',
          href: '/admin/signature-requests',
          label: t('header.signatureRequests'),
        },
        { kind: 'link', href: '/admin/settings', label: t('header.settings') },
        { kind: 'link', href: '/admin/ads', label: t('header.ads') },
      ]
    : [];

  const desktopNav = [...primaryNav, ...roleNav, ...adminNav];

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setDragX(0);
    touchRef.current = null;
  }, []);

  const handleCreateProject = useCallback(() => {
    closeMenu();
    if (onCreateProject) {
      onCreateProject();
      return;
    }
    router.push('/?create=1');
  }, [closeMenu, onCreateProject, router]);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    const scrollY = window.scrollY;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [menuOpen, closeMenu]);

  const onDrawerTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      tracking: false,
    };
  };

  const onDrawerTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (!start.tracking) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) >= Math.abs(dx) || dx <= 0) {
        touchRef.current = null;
        setDragX(0);
        return;
      }
      start.tracking = true;
    }

    setDragX(Math.max(0, dx));
  };

  const onDrawerTouchEnd = () => {
    if (dragX >= SWIPE_CLOSE_PX) {
      closeMenu();
      return;
    }
    setDragX(0);
    touchRef.current = null;
  };

  const renderNavItem = (item: NavItem, onNavigate?: () => void) => {
    if (item.kind === 'contact') {
      return (
        <button
          key="contact-us"
          type="button"
          className="header-nav-link"
          onClick={() => {
            onNavigate?.();
            setContactOpen(true);
          }}
        >
          {item.label}
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={headerNavClass(pathname, item.href)}
        aria-current={
          isHeaderNavActive(pathname, item.href) ? 'page' : undefined
        }
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  };

  const menuToggleLabel =
    unreadCount > 0
      ? `${menuOpen ? t('header.closeMenu') : t('header.openMenu')} (${unreadCount})`
      : menuOpen
        ? t('header.closeMenu')
        : t('header.openMenu');

  const mobileMenu =
    menuOpen && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="header-mobile-backdrop"
              aria-label={t('header.closeMenu')}
              onClick={closeMenu}
              style={
                dragX > 0
                  ? { opacity: Math.max(0.15, 1 - dragX / 280) }
                  : undefined
              }
            />
            <div
              className="header-mobile-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby={menuTitleId}
              style={
                dragX > 0
                  ? {
                      transform: `translateX(${dragX}px)`,
                      transition: 'none',
                    }
                  : undefined
              }
              onTouchStart={onDrawerTouchStart}
              onTouchMove={onDrawerTouchMove}
              onTouchEnd={onDrawerTouchEnd}
              onTouchCancel={onDrawerTouchEnd}
            >
              <div className="header-mobile-drawer-header">
                <h2 id={menuTitleId} className="header-mobile-drawer-title">
                  {t('header.menu')}
                </h2>
                <button
                  type="button"
                  className="header-mobile-drawer-close"
                  aria-label={t('header.closeMenu')}
                  onClick={closeMenu}
                >
                  <MenuIcon open />
                </button>
              </div>

              {showCreateProject && (
                <div className="header-mobile-drawer-actions">
                  <button
                    type="button"
                    className="primary header-mobile-create-project"
                    onClick={handleCreateProject}
                  >
                    {t('header.createProject')}
                  </button>
                </div>
              )}

              {me ? (
                <div className="header-mobile-drawer-notifications">
                  <HeaderNotificationsInline onNavigate={closeMenu} />
                </div>
              ) : null}

              <nav
                className="header-mobile-drawer-nav"
                aria-label={t('header.primaryNav')}
              >
                <div className="header-mobile-drawer-section">
                  {primaryNav.map((item) => renderNavItem(item, closeMenu))}
                </div>

                {roleNav.length > 0 && (
                  <div className="header-mobile-drawer-section">
                    {roleNav.map((item) => renderNavItem(item, closeMenu))}
                  </div>
                )}

                {adminNav.length > 0 && (
                  <div className="header-mobile-drawer-section">
                    <p className="header-mobile-drawer-label">
                      {t('header.admin')}
                    </p>
                    {adminNav.map((item) => renderNavItem(item, closeMenu))}
                  </div>
                )}
              </nav>

              {me ? (
                <div className="header-mobile-drawer-footer">
                  <p className="header-mobile-drawer-user muted">
                    {headerUserLabel(me, t('header.signedIn'))}
                  </p>
                  <Link
                    href="/account"
                    className="header-nav-link"
                    onClick={closeMenu}
                  >
                    {t('header.account')}
                  </Link>
                  <button
                    type="button"
                    className="header-nav-link header-mobile-sign-out"
                    onClick={() => {
                      closeMenu();
                      onSignOut();
                    }}
                  >
                    {t('header.signOut')}
                  </button>
                </div>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <header
      className={`site-header${menuOpen ? ' site-header--menu-open' : ''}`}
    >
      <div className="content-container site-header-inner">
        <div className="header-brand-nav">
          <Link href="/" className="brand" aria-label="BuilTHAI">
            <Image
              src="/logo.png"
              alt="BuilTHAI"
              width={121}
              height={36}
              className="brand-logo"
              priority
            />
          </Link>

          <nav
            className="header-nav header-nav--desktop"
            aria-label={t('header.primaryNav')}
          >
            {desktopNav.map((item) => renderNavItem(item))}
          </nav>
        </div>

        <div className="header-utilities">
          <LanguageSwitcher />
          {me ? <HeaderNotifications /> : null}

          {!me ? (
            <button
              type="button"
              className="header-sign-in"
              onClick={onSignIn}
            >
              {t('header.signIn')}
            </button>
          ) : (
            <HeaderAccountMenu me={me} onSignOut={onSignOut} />
          )}

          <button
            type="button"
            className="header-menu-toggle"
            aria-label={menuToggleLabel}
            aria-expanded={menuOpen}
            aria-controls="header-mobile-menu"
            onClick={() =>
              setMenuOpen((open) => {
                if (open) {
                  setDragX(0);
                  touchRef.current = null;
                }
                return !open;
              })
            }
          >
            <MenuIcon open={menuOpen} />
            {!menuOpen && unreadCount > 0 && (
              <span className="header-menu-toggle-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div id="header-mobile-menu">{mobileMenu}</div>

      <ContactUsModal
        isOpen={contactOpen}
        onClose={() => setContactOpen(false)}
        me={me}
      />
    </header>
  );
}
