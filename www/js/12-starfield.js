/* ============================================================ */
/* LUNA NIGHT SKY FX - starfield generator, shooting star, ripple */
/* (terpisah dari logic aplikasi utama, murni efek visual)        */
/* ============================================================ */
(function () {
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function initStarfield() {
        var container = document.getElementById('starfield-container');
        if (!container) return;

        var starCount = reduceMotion ? 0 : (window.innerWidth < 480 ? 25 : 35);
        var frag = document.createDocumentFragment();

        for (var i = 0; i < starCount; i++) {
            var star = document.createElement('div');
            star.className = 'fl-star';
            var size = (Math.random() * 2 + 1).toFixed(1);
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.top = (Math.random() * 100) + 'vh';
            star.style.left = (Math.random() * 100) + 'vw';
            star.style.setProperty('--star-min', (Math.random() * 0.25 + 0.05).toFixed(2));
            star.style.setProperty('--star-max', (Math.random() * 0.4 + 0.6).toFixed(2));
            star.style.animationDuration = (Math.random() * 3 + 2).toFixed(2) + 's';
            star.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
            frag.appendChild(star);
        }
        container.appendChild(frag);

        if (!reduceMotion) scheduleShootingStar(container);
    }

    function scheduleShootingStar(container) {
        var delay = Math.random() * 7000 + 5000; // 5-12 detik
        setTimeout(function () {
            spawnShootingStar(container);
            scheduleShootingStar(container);
        }, delay);
    }

    function spawnShootingStar(container) {
        if (document.hidden) return;
        var star = document.createElement('div');
        star.className = 'fl-shooting-star';
        star.style.top = (Math.random() * 40) + 'vh';
        star.style.left = (Math.random() * 60 + 30) + 'vw';
        container.appendChild(star);
        setTimeout(function () {
            if (star.parentNode) star.parentNode.removeChild(star);
        }, 1700);
    }

    // --- Ripple effect untuk semua tombol utama ---
    var RIPPLE_SELECTOR = '.btn-premium-action, .btn-add-new, .btn-mini-primary, .btn-mini-sec, ' +
        '.btn-mini-danger, .btn-danger-clean, .landing-btn, .btn-tutup-nota, ' +
        '.header-controls button, .hamburger-btn, .btn-luna-avatar, .product-card, .wdp-day-dot';

    document.addEventListener('click', function (e) {
        var target = e.target.closest ? e.target.closest(RIPPLE_SELECTOR) : null;
        if (!target) return;
        var rect = target.getBoundingClientRect();
        var ripple = document.createElement('span');
        var size = Math.max(rect.width, rect.height);
        ripple.className = 'fl-ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        target.appendChild(ripple);
        setTimeout(function () {
            if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
        }, 600);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initStarfield);
    } else {
        initStarfield();
    }
})();
