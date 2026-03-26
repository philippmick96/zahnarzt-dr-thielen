/* ═══════════════════════════════════════════════════════════════
   Zahnarzt Dr. Thielen – main.js
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Current Year in Footer ── */
  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Header scroll shadow ── */
  const header = document.getElementById('header');
  const heroHeight = document.getElementById('home')?.offsetHeight || 600;
  const onScroll = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > heroHeight * 0.7);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Mobile Navigation Toggle ── */
  const burger = document.getElementById('navBurger');
  const menu   = document.getElementById('navMenu');

  if (burger && menu) {
    burger.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      burger.classList.toggle('open', isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
      burger.setAttribute('aria-label', isOpen ? 'Menü schließen' : 'Menü öffnen');
    });

    /* Close menu when a link is clicked */
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Menü öffnen');
      });
    });

    /* Close on outside click */
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target)) {
        menu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });

    /* Close on Escape */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        menu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
      }
    });
  }

  /* ── Active nav link on scroll ── */
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav__link');

  const observerOpts = {
    root: null,
    rootMargin: `-${getComputedStyle(document.documentElement).getPropertyValue('--header-height') || '72px'} 0px -60% 0px`,
    threshold: 0,
  };

  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === `#${entry.target.id}`);
          link.setAttribute('aria-current', href === `#${entry.target.id}` ? 'true' : 'false');
        });
      }
    });
  }, observerOpts);

  sections.forEach(section => navObserver.observe(section));

  /* ── Scroll reveal ── */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const revealEls = document.querySelectorAll(
      '.service-card, .info-card, .about__content, .about__visual, .team-card, .section__header, .why-point, .feature-block__visual, .feature-block__text'
    );

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.06 });

    revealEls.forEach((el, i) => {
      const delay = Math.min(i * 0.05, 0.3);
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = `opacity 0.55s ease ${delay}s, transform 0.55s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`;
      revealObserver.observe(el);
    });

    const revealStyle = document.createElement('style');
    revealStyle.textContent = '.revealed { opacity: 1 !important; transform: none !important; }';
    document.head.appendChild(revealStyle);
  }

  /* ── Custom cursor dot ── */
  if (window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const cursor = document.createElement('div');
    cursor.id = 'cursor-dot';
    document.body.appendChild(cursor);

    const cursorStyle = document.createElement('style');
    cursorStyle.textContent = `
      #cursor-dot {
        position: fixed; top: 0; left: 0;
        width: 8px; height: 8px;
        background: #5423E7;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        transition: transform 0.1s, width 0.2s, height 0.2s, opacity 0.2s;
        opacity: 0;
        mix-blend-mode: normal;
      }
      #cursor-dot.visible { opacity: 1; }
      #cursor-dot.hovered {
        width: 40px; height: 40px;
        background: rgba(84, 35, 231, 0.15);
        border: 1.5px solid rgba(84, 35, 231, 0.6);
      }
    `;
    document.head.appendChild(cursorStyle);

    let cx = 0, cy = 0;
    document.addEventListener('mousemove', (e) => {
      cx = e.clientX; cy = e.clientY;
      cursor.style.left = cx + 'px';
      cursor.style.top  = cy + 'px';
      cursor.classList.add('visible');
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('visible'));

    const hoverTargets = document.querySelectorAll('a, button, .service-card, .info-card, .credential-tag');
    hoverTargets.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hovered'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hovered'));
    });
  }

  /* ── Hero Slideshow ── */
  const slides = document.querySelectorAll('.slideshow__img');
  const dots   = document.querySelectorAll('.slideshow__dot');
  if (slides.length > 1) {
    let current = 0;
    const goTo = (i) => {
      slides[current].classList.remove('active');
      dots[current].classList.remove('active');
      current = (i + slides.length) % slides.length;
      slides[current].classList.add('active');
      dots[current].classList.add('active');
    };
    dots.forEach((dot, i) => dot.addEventListener('click', () => { goTo(i); resetTimer(); }));
    let timer = setInterval(() => goTo(current + 1), 4000);
    const resetTimer = () => { clearInterval(timer); timer = setInterval(() => goTo(current + 1), 4000); };
  }

  /* ── Magnetic buttons ── */
  if (window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('.btn--primary, .btn--white').forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width  / 2;
        const y = e.clientY - r.top  - r.height / 2;
        btn.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  }

})();
