const formatPercent = (value) => `${Math.max(0, Math.min(100, Number(value) || 0))}%`;

const animateCounter = (el) => {
  const target = Number(el.dataset.count || el.textContent || 0);
  const duration = Number(el.dataset.duration || 900);
  const start = performance.now();

  const tick = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    el.textContent = value.toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
};

const setupPrintButtons = () => {
  document.querySelectorAll('[data-print]').forEach((button) => {
    button.addEventListener('click', () => {
      window.print();
    });
  });
};

const setupActiveNav = () => {
  const page = document.body.dataset.page || '';
  document.querySelectorAll('.nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    const normalized = href.replace(/^\.\//, '');
    const isActive =
      (page === 'index' && normalized === 'index.html') ||
      (page !== 'index' && normalized.includes(`${page}.html`)) ||
      (page === 'system-guide' && normalized.includes('system-guide')) ||
      (page === 'diagrams' && normalized.includes('diagrams')) ||
      (page === 'candidate' && normalized.includes('candidate-manual')) ||
      (page === 'recruiter' && normalized.includes('recruiter-manual'));

    if (isActive) {
      link.classList.add('is-active');
      link.setAttribute('aria-current', 'page');
    }
  });
};

const setupMetrics = () => {
  document.querySelectorAll('[data-donut]').forEach((el) => {
    const value = Number(el.dataset.donut || 0);
    el.style.setProperty('--value', String(Math.max(0, Math.min(100, value))));
    if (el.dataset.accent) {
      el.style.setProperty('--accent', el.dataset.accent);
    }
  });

  document.querySelectorAll('[data-meter]').forEach((meter) => {
    const value = Number(meter.dataset.meter || 0);
    meter.style.width = formatPercent(value);
  });

  document.querySelectorAll('[data-count]').forEach((el) => animateCounter(el));
};

const setupExternalLinks = () => {
  document.querySelectorAll('[data-open-live]').forEach((link) => {
    link.setAttribute('href', 'https://frontend-production-a792.up.railway.app/');
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noreferrer');
  });
};

const setupCanvasEffects = () => {
  const board = document.querySelector('[data-diagram-board]');
  if (!board) return;

  board.addEventListener('mousemove', (event) => {
    const rect = board.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    board.style.setProperty('--glow-x', `${x}%`);
    board.style.setProperty('--glow-y', `${y}%`);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  setupPrintButtons();
  setupActiveNav();
  setupMetrics();
  setupExternalLinks();
  setupCanvasEffects();
  document.body.classList.add('is-ready');
});
