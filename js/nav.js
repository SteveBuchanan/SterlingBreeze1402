// Sticky header: data-scrolled once the page moves, data-active on the link for the section in
// view, and the mobile menu toggle.

export function initNav() {
  const header = document.getElementById('site-header');
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!header) return;

  const onScroll = () => header.toggleAttribute('data-scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      menu.hidden = !open;
      header.toggleAttribute('data-menu-open', open);
    };
    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', () => setOpen(false));
  }

  // Highlight the nav link for the section currently in view.
  const links = [...document.querySelectorAll('[data-nav-link]')];
  const sections = [...new Set(links.map((a) => a.getAttribute('href')))]
    .map((href) => document.querySelector(href))
    .filter(Boolean);

  const setActive = (id) => {
    for (const link of links) link.toggleAttribute('data-active', link.getAttribute('href') === `#${id}`);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    },
    // A section counts as "in view" when it crosses a band just below the header.
    { rootMargin: '-30% 0px -60% 0px' },
  );
  for (const section of sections) observer.observe(section);
}
