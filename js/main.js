/* =============================================================
 * Shiori · 交互脚本（Vanilla JS，渐进增强：脚本不可用时正文照常可读）
 * 主题切换 / 移动菜单 / 阅读进度 / 目录联动 / 返回顶部 /
 * 代码复制 / 脚注悬停预览 / 图片说明
 * ============================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 主题切换 ---------- */
  root.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      if (!reduceMotion) {
        root.classList.add('theme-transition');
        setTimeout(function () { root.classList.remove('theme-transition'); }, 300);
      }
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('shiori-theme', next); } catch (e) { /* 私密模式等 */ }
    });
  });

  /* ---------- 移动端菜单 ---------- */
  var menuBtn = root.querySelector('[data-menu-toggle]');
  var nav = doc.getElementById('site-nav');

  function closeMenu() {
    doc.body.classList.remove('menu-open');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }

  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = doc.body.classList.toggle('menu-open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ---------- 滚动统一处理：进度条 / 返回顶部 / 目录联动 ---------- */
  var progress = doc.getElementById('reading-progress');
  var backTop = doc.getElementById('back-to-top');
  var tocLinks = [].slice.call(root.querySelectorAll('.toc-link'));
  var headings = [];

  tocLinks.forEach(function (a) {
    try {
      var id = decodeURIComponent((a.getAttribute('href') || '').slice(1));
      var h = id && doc.getElementById(id);
      if (h) headings.push(h);
    } catch (e) { /* 非法锚点忽略 */ }
  });

  var ticking = false;

  function updateScroll() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset;

    if (progress) {
      var max = root.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(100, Math.max(0, (y / max) * 100)) : 0;
      progress.style.width = pct + '%';
    }

    if (backTop) {
      backTop.classList.toggle('is-visible', y > 600);
    }

    if (headings.length) {
      var current = 0;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top <= 100) current = i;
      }
      tocLinks.forEach(function (a, i) {
        var active = i === current;
        if (a.classList.contains('is-active') !== active) {
          a.classList.toggle('is-active', active);
          if (active) {
            /* 只滚动目录容器自身：scrollIntoView 会连带滚动页面的
               所有祖先滚动容器，在 sticky 目录被推出视口时会把页面拉回顶部 */
            var wrap = a.closest('.toc-wrap');
            if (wrap) {
              var r = a.getBoundingClientRect();
              var w = wrap.getBoundingClientRect();
              if (r.top < w.top + 8) {
                wrap.scrollTop -= (w.top + 8 - r.top);
              } else if (r.bottom > w.bottom - 8) {
                wrap.scrollTop += (r.bottom - (w.bottom - 8));
              }
            }
          }
        }
      });
    }
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(updateScroll);
    }
  }, { passive: true });
  updateScroll();

  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- 代码复制按钮 ---------- */
  function bindCopy(btn, getText) {
    btn.addEventListener('click', function () {
      var text = getText();
      if (!text) return;
      var done = function () {
        btn.classList.add('is-copied');
        btn.textContent = btn.getAttribute('data-copied') || 'OK';
        setTimeout(function () {
          btn.classList.remove('is-copied');
          btn.textContent = btn.getAttribute('data-label') || 'Copy';
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(); });
      } else {
        fallback();
      }
      function fallback() {
        var ta = doc.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        doc.body.appendChild(ta);
        ta.select();
        try { doc.execCommand('copy'); done(); } catch (e) { /* 忽略 */ }
        doc.body.removeChild(ta);
      }
    });
  }

  if (root.querySelector('[data-code-copy]')) {
    var copyLabel = root.querySelector('[data-code-copy]').getAttribute('data-label') || 'Copy';
    var copiedLabel = root.querySelector('[data-code-copy]').getAttribute('data-copied') || 'Copied';

    root.querySelectorAll('figure.highlight').forEach(function (fig) {
      var code = fig.querySelector('td.code');
      if (!code) return;
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = copyLabel;
      btn.setAttribute('data-label', copyLabel);
      btn.setAttribute('data-copied', copiedLabel);
      btn.setAttribute('aria-label', copyLabel);
      fig.appendChild(btn);
      bindCopy(btn, function () {
        return code.innerText.replace(/\n$/, '');
      });
    });

    root.querySelectorAll('.article-body pre').forEach(function (pre) {
      if (pre.closest('figure.highlight')) return;
      if (pre.querySelector('.copy-btn')) return;
      var code = pre.querySelector('code') || pre;
      pre.style.position = 'relative';
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = copyLabel;
      btn.setAttribute('data-label', copyLabel);
      btn.setAttribute('data-copied', copiedLabel);
      btn.setAttribute('aria-label', copyLabel);
      pre.appendChild(btn);
      bindCopy(btn, function () {
        return code.innerText.replace(/\n$/, '');
      });
    });
  }

  /* ---------- 脚注悬停预览 ---------- */
  var pop = null;
  var popHideTimer = null;

  function showFootnote(link) {
    var id;
    try { id = decodeURIComponent((link.getAttribute('href') || '').slice(1)); } catch (e) { return; }
    var target = id && doc.getElementById(id);
    if (!target) return;

    var text = (target.innerText || target.textContent || '').replace(/\s*(↩|⏎)\s*$/, '').trim();
    if (!text) return;

    if (!pop) {
      pop = doc.createElement('div');
      pop.className = 'footnote-pop';
      pop.setAttribute('role', 'tooltip');
      doc.body.appendChild(pop);
    }

    pop.textContent = text;
    pop.classList.add('is-open');

    var rect = link.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    pop.style.left = '0px';
    pop.style.top = '0px';
    var w = pop.offsetWidth;
    var h = pop.offsetHeight;
    var left = Math.min(Math.max(8, rect.left + window.scrollX - w / 2),
      window.scrollX + (root.clientWidth || doc.body.clientWidth) - w - 8);
    pop.style.left = left + 'px';
    pop.style.top = Math.max(8, rect.top + scrollY - h - 10) + 'px';
  }

  function hideFootnote() {
    if (pop) pop.classList.remove('is-open');
  }

  if (doc.body.hasAttribute('data-footnote-pop')) {
    root.querySelectorAll('.article-body a[href^="#fn"]').forEach(function (link) {
      var hash = link.getAttribute('href') || '';
      if (hash.indexOf('#fnref') === 0) return; /* 脚注内的返回链接不需要预览 */
      link.addEventListener('mouseenter', function () {
        clearTimeout(popHideTimer);
        showFootnote(link);
      });
      link.addEventListener('mouseleave', function () {
        popHideTimer = setTimeout(hideFootnote, 120);
      });
      link.addEventListener('focus', function () { showFootnote(link); });
      link.addEventListener('blur', hideFootnote);
      link.addEventListener('click', hideFootnote);
    });
  }

  /* ---------- 图片说明（alt → figcaption） ---------- */
  root.querySelectorAll('.article-body img').forEach(function (img) {
    var parent = img.parentElement;
    if (!parent || img.closest('figure') || !img.alt) return;
    if (!(parent.tagName === 'P' && parent.children.length === 1) && parent.tagName !== 'DIV') return;
    var fig = doc.createElement('figure');
    parent.replaceChild(fig, img);
    fig.appendChild(img);
    var cap = doc.createElement('figcaption');
    cap.textContent = img.alt;
    fig.appendChild(cap);
  });
})();
