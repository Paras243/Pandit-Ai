
/* =====================================================
   PANDIT AI
   Complete Website Interactions
   1. Responsive Navigation
   2. Smooth Internal Scrolling
   3. Thoughts & Reflections Focus Cards
   4. Founder Section Reveal Animation
   5. Founder Image Lightbox
   Vanilla JavaScript
===================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. RESPONSIVE NAVIGATION
  // ==========================================

  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.nav-menu');

  if (toggle && menu) {

    const icon = toggle.querySelector('i');

    const closeMenu = () => {
      menu.classList.remove('is-open');

      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');

      icon?.classList.remove('fa-xmark');
      icon?.classList.add('fa-bars');
    };

    const openMenu = () => {
      menu.classList.add('is-open');

      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation menu');

      icon?.classList.remove('fa-bars');
      icon?.classList.add('fa-xmark');
    };

    toggle.addEventListener('click', event => {
      event.stopPropagation();

      menu.classList.contains('is-open')
        ? closeMenu()
        : openMenu();
    });

    // Close menu after clicking a navigation link
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close menu when clicking outside header
    document.addEventListener('click', event => {
      if (
        menu.classList.contains('is-open') &&
        !event.target.closest('.site-header')
      ) {
        closeMenu();
      }
    });

    // Close menu with Escape key
    document.addEventListener('keydown', event => {
      if (
        event.key === 'Escape' &&
        menu.classList.contains('is-open')
      ) {
        closeMenu();
        toggle.focus();
      }
    });

    // Close menu when switching to desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) {
        closeMenu();
      }
    });
  }


  // ==========================================
  // 2. SMOOTH INTERNAL PAGE SCROLLING
  // ==========================================

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {

    anchor.addEventListener('click', event => {

      const href = anchor.getAttribute('href');

      if (!href || href === '#') return;

      let target;

      try {
        target = document.querySelector(href);
      } catch (error) {
        return;
      }

      if (!target) return;

      event.preventDefault();

      // Close mobile navigation
      if (menu?.classList.contains('is-open')) {

        menu.classList.remove('is-open');

        toggle?.setAttribute('aria-expanded', 'false');
        toggle?.setAttribute('aria-label', 'Open navigation menu');

        const icon = toggle?.querySelector('i');

        icon?.classList.remove('fa-xmark');
        icon?.classList.add('fa-bars');
      }

      // Respect reduced-motion preference
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      target.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start'
      });

      // Update URL hash
      if (history.replaceState) {
        history.replaceState(null, '', href);
      }

    });

  });


  // ==========================================
  // 3. THOUGHTS & REFLECTIONS DATA
  // ==========================================

  const thoughts = [

    {
      tag: 'Inner Wisdom',
      quote: 'The quieter you become, the more you are able to hear.',
      attribution: 'A thought for stillness',
      image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85',
      alt: 'Golden sunrise over a quiet misty landscape'
    },

    {
      tag: 'Self Discovery',
      quote: 'Knowing yourself is the beginning of all wisdom.',
      attribution: 'A reflection on self-knowledge',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1100&q=85',
      alt: 'Mountain landscape beneath a wide open sky'
    },

    {
      tag: 'The Journey',
      quote: 'A journey of a thousand miles begins with a single step.',
      attribution: 'A reminder to begin',
      image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1100&q=85',
      alt: 'A winding path beside a peaceful mountain lake'
    },

    {
      tag: 'Mindfulness',
      quote: 'Peace comes from within. Do not seek it outside.',
      attribution: 'A reminder to look within',
      image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1100&q=85',
      alt: 'Peaceful natural landscape in soft morning light'
    },

    {
      tag: 'Perspective',
      quote: 'What we think, we become. What we feel, we attract.',
      attribution: 'A thought on awareness',
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1100&q=85',
      alt: 'Sunlight filtering through a forest'
    },

    {
      tag: 'Growth',
      quote: 'Every moment is a fresh beginning.',
      attribution: 'A thought on new beginnings',
      image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1100&q=85',
      alt: 'Mountain peaks rising above the clouds'
    }

  ];


  // ==========================================
  // 4. RENDER THOUGHT CARDS
  // ==========================================

  const grid = document.querySelector('#thoughts-grid');

  // Escape dynamic HTML values
  const escapeHTML = value => {

    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

  };

  if (grid) {

    grid.innerHTML = thoughts.map((thought, index) => {

      return `
        <article
          class="thought-card"
          tabindex="0"
          role="button"
          aria-pressed="false"
          aria-label="Highlight thought: ${escapeHTML(thought.quote)}"
          data-thought-index="${index}"
        >

          <img
            src="${escapeHTML(thought.image)}"
            alt="${escapeHTML(thought.alt)}"
            loading="lazy"
            decoding="async"
          >

          <div class="thought-card-content">

            <span class="thought-card-tag">
              ${escapeHTML(thought.tag)}
            </span>

            <blockquote>
              “${escapeHTML(thought.quote)}”
            </blockquote>

            <cite>
              ${escapeHTML(thought.attribution)}
            </cite>

          </div>

        </article>
      `;

    }).join('');


    // Thought card interactions

    const cards = Array.from(
      grid.querySelectorAll('.thought-card')
    );

    const setActiveCard = selectedCard => {

      cards.forEach(card => {

        const active = card === selectedCard;

        card.classList.toggle('is-active', active);

        card.setAttribute(
          'aria-pressed',
          String(active)
        );

      });

    };


    cards.forEach(card => {

      const toggleCard = () => {

        const alreadyActive =
          card.classList.contains('is-active');

        setActiveCard(alreadyActive ? null : card);

      };

      // Mouse and touch
      card.addEventListener('click', toggleCard);

      // Keyboard accessibility
      card.addEventListener('keydown', event => {

        if (
          event.key === 'Enter' ||
          event.key === ' '
        ) {

          event.preventDefault();
          toggleCard();

        }

      });

    });


    // Image fallback
    grid.querySelectorAll('.thought-card img').forEach(img => {

      img.addEventListener('error', () => {
        img.style.display = 'none';
      });

    });

  }


  // ==========================================
  // 5. FOUNDER SECTION REVEAL ANIMATION
  // ==========================================

  const founderSection = document.querySelector('.founder-section');

  if (founderSection) {

    if ('IntersectionObserver' in window) {

      const founderObserver = new IntersectionObserver(
        entries => {

          entries.forEach(entry => {

            if (entry.isIntersecting) {

              entry.target.classList.add('founder-visible');

              founderObserver.unobserve(entry.target);

            }

          });

        },
        {
          threshold: 0.15
        }
      );

      founderObserver.observe(founderSection);

    } else {

      // Fallback for older browsers
      founderSection.classList.add('founder-visible');

    }

  }


  // ==========================================
  // 6. FOUNDER IMAGE LIGHTBOX
  // ==========================================

  const founderImage = document.querySelector(
    '.founder-photo-trigger img'
  );

  const lightbox = document.querySelector(
    '#founder-lightbox'
  );

  const lightboxClose = document.querySelector(
    '.founder-lightbox-close'
  );

  let previousFocus = null;


  if (founderImage && lightbox) {

    const openLightbox = () => {

      previousFocus = document.activeElement;

      lightbox.classList.add('is-open');

      lightbox.setAttribute('aria-hidden', 'false');

      document.body.classList.add('lightbox-open');

      lightboxClose?.focus();

    };


    const closeLightbox = () => {

      lightbox.classList.remove('is-open');

      lightbox.setAttribute('aria-hidden', 'true');

      document.body.classList.remove('lightbox-open');

      previousFocus?.focus();

    };


    // Open image on click
    founderImage.addEventListener('click', openLightbox);


    // Open image using keyboard
    founderImage.addEventListener('keydown', event => {

      if (
        event.key === 'Enter' ||
        event.key === ' '
      ) {

        event.preventDefault();
        openLightbox();

      }

    });


    // Make image keyboard accessible
    founderImage.setAttribute('tabindex', '0');
    founderImage.setAttribute('role', 'button');
    founderImage.setAttribute(
      'aria-label',
      'Open founder photograph'
    );


    // Close button
    lightboxClose?.addEventListener('click', closeLightbox);


    // Close when clicking lightbox background
    lightbox.addEventListener('click', event => {

      if (event.target === lightbox) {
        closeLightbox();
      }

    });


    // Close with Escape
    document.addEventListener('keydown', event => {

      if (
        event.key === 'Escape' &&
        lightbox.classList.contains('is-open')
      ) {

        closeLightbox();

      }

    });

  }


  // ==========================================
  // 7. INITIAL LIGHTBOX STATE
  // ==========================================

  if (lightbox) {

    lightbox.classList.remove('is-open');

    lightbox.setAttribute('aria-hidden', 'true');

  }


  // ==========================================
  // 8. WEBSITE INITIALIZATION COMPLETE
  // ==========================================

  console.log('Pandit AI website initialized successfully.');
  // Automatically update footer copyright year
const footerYear = document.querySelector('#footer-year');

if (footerYear) {
  footerYear.textContent = new Date().getFullYear();
}

});
