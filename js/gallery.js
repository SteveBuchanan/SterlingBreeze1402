// Photo gallery: category filters, "show all", and a <dialog> lightbox (arrows, keyboard, swipe).
import { CATEGORIES, PHOTOS, photoDimensions, photoSrcset, photoUrl } from './gallery-data.js';

const INITIAL_COUNT = 8;

export function initGallery() {
  const filters = document.getElementById('gallery-filters');
  const grid = document.getElementById('gallery-grid');
  const moreButton = document.getElementById('gallery-more');
  const dialog = document.getElementById('lightbox');
  if (!filters || !grid || !moreButton || !(dialog instanceof HTMLDialogElement)) return;

  const lbImage = dialog.querySelector('[data-lightbox-image]');
  const lbCaption = dialog.querySelector('[data-lightbox-caption]');
  const lbCount = dialog.querySelector('[data-lightbox-count]');

  let category = 'all';
  let expanded = false;
  let current = 0; // index into the filtered list
  let lastTrigger = null;

  const filtered = () => (category === 'all' ? PHOTOS : PHOTOS.filter((p) => p.category === category));

  // --- Filters -------------------------------------------------------------------------------
  for (const cat of CATEGORIES) {
    const count = cat.id === 'all' ? PHOTOS.length : PHOTOS.filter((p) => p.category === cat.id).length;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.category = cat.id;
    button.setAttribute('aria-pressed', String(cat.id === category));
    button.innerHTML = `${cat.label} <span class="ml-1 text-xs opacity-60">${count}</span>`;
    button.addEventListener('click', () => {
      category = cat.id;
      expanded = false;
      for (const b of filters.querySelectorAll('button')) {
        b.setAttribute('aria-pressed', String(b.dataset.category === category));
      }
      renderGrid();
    });
    filters.append(button);
  }

  // --- Grid ----------------------------------------------------------------------------------
  function renderGrid() {
    const photos = filtered();
    const visible = expanded ? photos : photos.slice(0, INITIAL_COUNT);
    grid.replaceChildren(
      ...visible.map((photo, index) => {
        const { width, height } = photoDimensions(photo, 600);
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          'group relative block aspect-[4/3] overflow-hidden rounded-xl bg-sand-200 shadow-sm ring-1 ring-ocean-900/5';
        button.setAttribute('aria-label', `View photo: ${photo.caption}`);
        button.innerHTML = `
          <img src="${photoUrl(photo.file, 600)}" srcset="${photoSrcset(photo, [600, 1200])}"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            width="${width}" height="${height}" alt="${photo.caption}" loading="lazy" decoding="async"
            class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105">
          <span class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ocean-950/70 to-transparent px-3 pt-8 pb-2 text-left text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">${photo.caption}</span>`;
        button.addEventListener('click', () => open(index, button));
        return button;
      }),
    );

    const hidden = photos.length - visible.length;
    moreButton.hidden = hidden <= 0;
    moreButton.textContent = `Show all ${photos.length} photos`;
  }

  moreButton.addEventListener('click', () => {
    const firstNew = grid.children.length;
    expanded = true;
    renderGrid();
    grid.children[firstNew]?.focus();
  });

  // --- Lightbox ------------------------------------------------------------------------------
  function show(index) {
    const photos = filtered();
    current = (index + photos.length) % photos.length;
    const photo = photos[current];
    const { width, height } = photoDimensions(photo, 2000);
    lbImage.src = photoUrl(photo.file, 1200);
    lbImage.srcset = photoSrcset(photo, [1200, 2000]);
    lbImage.width = width;
    lbImage.height = height;
    lbImage.alt = photo.caption;
    lbCaption.textContent = photo.caption;
    lbCount.textContent = `${current + 1} / ${photos.length}`;

    // Warm up the neighbours so arrowing through feels instant.
    for (const offset of [1, -1]) {
      const next = photos[(current + offset + photos.length) % photos.length];
      const img = new Image();
      img.srcset = photoSrcset(next, [1200, 2000]);
      img.sizes = '100vw';
    }
  }

  function open(index, trigger) {
    lastTrigger = trigger;
    show(index);
    dialog.showModal();
    document.documentElement.classList.add('overflow-hidden');
  }

  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('overflow-hidden');
    lastTrigger?.focus();
  });

  dialog.querySelector('[data-lightbox-prev]').addEventListener('click', () => show(current - 1));
  dialog.querySelector('[data-lightbox-next]').addEventListener('click', () => show(current + 1));
  dialog.querySelector('[data-lightbox-close]').addEventListener('click', () => dialog.close());

  // Clicking the dark area around the photo closes the lightbox.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog || event.target.hasAttribute?.('data-lightbox-backdrop')) dialog.close();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      show(current - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      show(current + 1);
    }
  });

  // Swipe left/right on touch screens.
  let touchX = null;
  let touchY = null;
  dialog.addEventListener('touchstart', (event) => {
    touchX = event.touches[0].clientX;
    touchY = event.touches[0].clientY;
  }, { passive: true });
  dialog.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const dx = event.changedTouches[0].clientX - touchX;
    const dy = event.changedTouches[0].clientY - touchY;
    touchX = touchY = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  renderGrid();
}
