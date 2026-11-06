/* THE STYLE HUB — Trang chủ: lật outfit + cuộn slide 2 chiều.
   Không thay đổi catalog, thanh toán, đăng nhập, wishlist hay trang con. */
(function () {
  'use strict';

  function init() {
    const home = document.querySelector('.premium-home #home-page-view');
    if (!home) return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    const grid = document.getElementById('shPersonalGrid');
    const featured = document.getElementById('shPersonalSection');

    /* Scroll-linked reveal: vùng xuất hiện theo vị trí cuộn ở cả hai chiều.
       Không chặn cuộn hay fullpage snap nên giỏ hàng / xem sản phẩm vẫn ổn định. */
    const slideTargets = new Set();
    let scrollFrame = 0;
    let slideReady = false;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    // offsetTop/offsetHeight phản ánh vị trí bố cục, không bị transform reveal
    // làm lệch mỗi frame (getBoundingClientRect đọc cả transform dẫn tới rung/nhảy).
    function layoutPositionInViewport(element, scrollY) {
      let top = 0;
      let cursor = element;
      while (cursor) {
        top += cursor.offsetTop || 0;
        cursor = cursor.offsetParent;
      }
      top -= scrollY;
      return { top, bottom: top + element.offsetHeight };
    }

    function updateSlidePositions() {
      scrollFrame = 0;
      if (!slideReady || motionQuery.matches) return;
      const viewport = window.innerHeight || 800;
      const scrolled = window.scrollY;

      for (const element of slideTargets) {
        if (!element.isConnected) { slideTargets.delete(element); continue; }
        const box = layoutPositionInViewport(element, scrolled);
        // 2 chiều: vào từ dưới (cuộn xuống) hoặc từ trên (cuộn lên).
        // Không gắn cờ "seen" vĩnh viễn: rời màn hình rồi quay lại vẫn chạy lại.
        const fromBottom = clamp((viewport * .96 - box.top) / (viewport * .29), 0, 1);
        const fromTop = clamp((box.bottom - viewport * .035) / (viewport * .17), 0, 1);
        const progress = Math.min(fromBottom, fromTop);
        const isEnteringFromTop = fromTop < fromBottom;
        const remaining = 1 - progress;
        element.classList.toggle('sh-slide-near', box.bottom > -60 && box.top < viewport + 60);
        element.style.setProperty('--sh-scroll-progress', progress.toFixed(3));
        element.style.setProperty('--sh-slide-offset-x', (remaining * Number(element.dataset.shSlideDirection || 0)).toFixed(1) + 'px');
        element.style.setProperty('--sh-slide-offset-y', (remaining * (isEnteringFromTop ? -52 : 56)).toFixed(1) + 'px');
        element.style.setProperty('--sh-slide-scale', (0.965 + 0.035 * progress).toFixed(3));
      }
      document.documentElement.style.setProperty('--sh-home-scroll',
        (document.documentElement.scrollHeight > viewport
          ? clamp(scrolled / (document.documentElement.scrollHeight - viewport), 0, 1)
          : 0).toFixed(3));
      if (!document.body.classList.contains('sh-scroll-ready'))
        document.body.classList.add('sh-scroll-ready');
    }

    function scheduleSlide() {
      if (slideFrameNeeded()) scrollFrame = requestAnimationFrame(updateSlidePositions);
    }
    function slideFrameNeeded() { return slideReady && !scrollFrame && !motionQuery.matches; }

    function registerSlides() {
      if (motionQuery.matches || !('requestAnimationFrame' in window)) return;
      const targets = [
        ...home.querySelectorAll('.sh-reveal'),
        ...home.querySelectorAll('.split-hero-container .hero-column'),
        ...home.querySelectorAll('.outfit-video-left-box, .outfit-grid-right-box'),
        ...home.querySelectorAll('.sh-personal-heading'),
        ...home.querySelectorAll('.sh-pick-stage')
      ];
      targets.forEach((element, index) => {
        if (slideTargets.has(element)) return;
        element.classList.add('sh-scroll-slide');
        element.dataset.shSlideDirection = String(index % 2 === 0 ? -32 : 32);
        slideTargets.add(element);
      });
      slideReady = true;
      updateSlidePositions();
    }

    window.addEventListener('scroll', scheduleSlide, { passive: true });
    window.addEventListener('resize', scheduleSlide, { passive: true });
    if (motionQuery.addEventListener) {
      motionQuery.addEventListener('change', () => {
        if (motionQuery.matches) {
          document.body.classList.remove('sh-scroll-ready');
          slideTargets.forEach(el => {
            ['--sh-scroll-progress', '--sh-slide-offset-x', '--sh-slide-offset-y', '--sh-slide-scale']
              .forEach(name => el.style.removeProperty(name));
          });
        } else registerSlides();
      });
    }

    /* Giữ các hiệu ứng chiều sâu của banner và hai khu bộ sưu tập. */
    if (!motionQuery.matches && hoverQuery.matches) {
      const hero = home.querySelector('.main-hero-banner');
      if (hero) {
        let frame = 0;
        hero.addEventListener('pointermove', event => {
          if (frame) cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            const rect = hero.getBoundingClientRect();
            hero.style.setProperty('--sh-hero-x', (((event.clientX - rect.left) / rect.width - .5) * -18).toFixed(1) + 'px');
            hero.style.setProperty('--sh-hero-y', (((event.clientY - rect.top) / rect.height - .5) * -12).toFixed(1) + 'px');
          });
        }, { passive: true });
        hero.addEventListener('pointerleave', () => {
          if (frame) cancelAnimationFrame(frame);
          hero.style.setProperty('--sh-hero-x', '0px');
          hero.style.setProperty('--sh-hero-y', '0px');
        });
      }
      home.querySelectorAll('.hero-image-wrapper').forEach(card => {
        let frame = 0;
        card.addEventListener('pointermove', event => {
          if (frame) cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            const rect = card.getBoundingClientRect();
            card.style.setProperty('--sh-tilt-x', ((.5 - (event.clientY - rect.top) / rect.height) * 5).toFixed(2) + 'deg');
            card.style.setProperty('--sh-tilt-y', (((event.clientX - rect.left) / rect.width - .5) * 5).toFixed(2) + 'deg');
          });
        }, { passive: true });
        card.addEventListener('pointerleave', () => {
          if (frame) cancelAnimationFrame(frame);
          card.style.setProperty('--sh-tilt-x', '0deg');
          card.style.setProperty('--sh-tilt-y', '0deg');
        });
      });
    }

    function addPhotoSide(scene, src, alt, side) {
      const face = document.createElement('div');
      face.className = 'sh-flip-face sh-flip-' + side;
      const image = document.createElement('img');
      image.src = src;
      image.alt = alt;
      image.loading = 'lazy';
      image.decoding = 'async';
      face.appendChild(image);
      scene.appendChild(face);
      return image;
    }

    function drawPicks() {
      if (!grid || typeof database === 'undefined') return;
      const keys = Object.keys(database).filter(key => {
        const item = database[key];
        return item && (item.mainImg || (item.images && item.images[0]));
      });
      if (!keys.length) { if (featured) featured.hidden = true; return; }
      if (featured) featured.hidden = false;
      const recommender = window.StyleHubRecommendations;
      // Gợi ý trang chủ theo lịch sử thật, không dùng sản phẩm mẫu `kids-1`.
      const ranked = recommender && typeof recommender.recommendHome === 'function'
        ? recommender.recommendHome(4) : [];
      const selected = [...new Set(ranked.map(item => item.id).filter(key => database[key]))];
      const description = document.getElementById('shPersonalDescription');
      if (description) {
        const firstReason = ranked[0] && ranked[0].reason || '';
        if (firstReason.startsWith('Vì bạn gần đây xem nhiều ')) {
          const type = firstReason.slice('Vì bạn gần đây xem nhiều '.length);
          description.textContent = 'Bạn gần đây xem nhiều ' + type + '. Những thiết kế cùng loại đang được ưu tiên — không cần bấm yêu thích hay đánh giá.';
        } else if (firstReason === 'Khám phá bộ sưu tập') {
          description.textContent = 'Khám phá vài sản phẩm hoặc làm quiz Style DNA để nhận gợi ý riêng theo gu của bạn.';
        } else if (ranked[0] && ranked[0].source === 'server') {
          description.textContent = 'Gợi ý lai (hybrid) từ hành vi của bạn và những khách hàng có gu tương tự — mỗi thẻ ghi rõ lý do.';
        } else {
          description.textContent = 'Gợi ý dựa trên lịch sử xem, yêu thích và các tương tác trên trình duyệt này — mỗi thẻ ghi rõ lý do.';
        }
      }
      if (selected.length < 4) {
        for (const key of keys) {
          if (selected.includes(key) || selected.length >= 4) continue;
          if (window.StyleHubProductAdmin && typeof window.StyleHubProductAdmin.getAdminStockInfo === 'function') {
            try { if (window.StyleHubProductAdmin.getAdminStockInfo(key).status === 'out') continue; }
            catch (_) { continue; }
          }
          selected.push(key);
        }
      }

      grid.replaceChildren();
      selected.forEach((key, index) => {
        const product = database[key];
        if (!product) return;
        const frontSrc = product.mainImg || (product.images && product.images[0]) || '';
        // Đúng logic .img-hover của collections.html: ảnh thứ hai từ cùng sản phẩm.
        const secondSrc = product.images && product.images.find(src => src && src !== frontSrc);
        const canFlip = Boolean(secondSrc);
        const stage = document.createElement('div');
        stage.className = 'sh-pick-stage' + (canFlip ? ' sh-has-flip' : '');
        stage.dataset.productId = key;
        const link = document.createElement('a');
        link.className = 'sh-pick';
        link.href = 'product-detail.html?id=' + encodeURIComponent(key);
        const rec = ranked.find(item => item.id === key);
        link.setAttribute('data-rec-id', key);
        link.setAttribute('data-rec-rank', String(index));
        link.setAttribute('data-rec-context', 'home:' + ((rec && rec.source) || 'local'));
        link.setAttribute('aria-label', 'Xem sản phẩm ' + (product.name || key));
        const photo = document.createElement('div');
        photo.className = 'sh-pick-photo';
        const flipper = document.createElement('div');
        flipper.className = 'sh-pick-flipper';
        addPhotoSide(flipper, frontSrc, product.name || 'Sản phẩm thời trang', 'front');
        if (canFlip) {
          const backImg = addPhotoSide(flipper, secondSrc, 'Góc nhìn thứ hai: ' + (product.name || 'Sản phẩm'), 'back');
          // Nếu ảnh phụ lỗi, lật phải tự tắt để không có mặt sau trống.
          backImg.addEventListener('error', () => { stage.classList.remove('sh-has-flip', 'sh-flipped'); });
          const hint = document.createElement('span');
          hint.className = 'sh-pick-flip-hint';
          hint.setAttribute('aria-hidden', 'true');
          hint.textContent = '↻  LẬT XEM OUTFIT';
          photo.appendChild(hint);
        }
        photo.prepend(flipper);
        const brand = document.createElement('span');
        brand.className = 'sh-pick-label';
        brand.textContent = product.brand || 'THE STYLE HUB';
        const name = document.createElement('p');
        name.className = 'sh-pick-name';
        name.textContent = product.name || 'Khám phá sản phẩm';
        const price = document.createElement('p');
        price.className = 'sh-pick-price';
        price.textContent = product.price || '';
        link.append(photo, brand, name, price);
        if (rec && rec.reason) {
          const why = document.createElement('p');
          why.className = 'sh-pick-reason';
          why.textContent = rec.reason;
          link.appendChild(why);
        }
        stage.appendChild(link);

        // Touch / bàn phím: nút bên ngoài liên kết, không chặn click mở sản phẩm.
        if (canFlip) {
          const flip = document.createElement('button');
          flip.type = 'button';
          flip.className = 'sh-pick-flip-toggle';
          flip.setAttribute('aria-label', 'Lật xem mặt sau: ' + (product.name || key));
          flip.setAttribute('aria-pressed', 'false');
          flip.textContent = '↻ XEM MẶT SAU';
          flip.addEventListener('click', () => {
            const flipped = stage.classList.toggle('sh-flipped');
            flip.setAttribute('aria-pressed', String(flipped));
            flip.setAttribute('aria-label', (flipped ? 'Quay lại mặt trước: ' : 'Lật xem mặt sau: ') + (product.name || key));
            flip.textContent = flipped ? '↶ MẶT TRƯỚC' : '↻ XEM MẶT SAU';
          });
          stage.appendChild(flip);
        }
        grid.appendChild(stage);
      });
      if (recommender && typeof recommender.trackImpressions === 'function') {
        recommender.trackImpressions(selected.map(key => ranked.find(item => item.id === key) || { id: key, source: 'fallback' }), 'home');
      }
      // Đồng bộ nút tim & nhãn kho với các chức năng sẵn có.
      document.dispatchEvent(new Event('stylehub-recommendations-rendered'));
      registerSlides();
    }

    try { drawPicks(); } catch (error) {
      console.warn('Không thể tải gợi ý trang chủ:', error);
      if (featured) featured.hidden = true;
    }
    registerSlides();
    window.addEventListener('storage', drawPicks);
    window.addEventListener('pageshow', event => { if (event.persisted) drawPicks(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) drawPicks(); });
    document.addEventListener('stylehub-preferences-change', drawPicks);
    document.addEventListener('stylehub-recommendations-updated', drawPicks);
    document.addEventListener('stylehub-wishlist-change', drawPicks);
    window.addEventListener('stylehub-inventory-change', drawPicks);
    window.addEventListener('stylehub-products-change', drawPicks);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
