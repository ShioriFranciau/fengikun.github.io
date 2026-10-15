/* =============================================================
 * Shiori · 站内搜索（search.json 索引 + 客户端检索）
 * 支持弹窗与独立搜索页两种面板；键盘 ↑↓ 选择、Enter 打开。
 * ============================================================= */
(function () {
  'use strict';

  var cfg = window.SHIORI_SEARCH;
  if (!cfg) return;

  var doc = document;
  var panels = doc.querySelectorAll('[data-search-panel]');
  if (!panels.length) return;

  var dialog = doc.getElementById('search-dialog');
  var index = null;
  var loading = false;

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    fetch(cfg.url, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        index = Array.isArray(data) ? data : [];
        loading = false;
        var input = doc.activeElement && doc.activeElement.matches('[data-search-input]')
          ? doc.activeElement : null;
        if (input) render(input);
      })
      .catch(function () {
        loading = false;
      });
  }

  function resolveUrl(path) {
    var root = cfg.root || '/';
    if (path.charAt(0) === '/') return path;
    return (root === '/' ? '/' : root) + path;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlight(text, q) {
    var safe = escapeHtml(text);
    if (!q) return safe;
    try {
      return safe.replace(new RegExp(escapeRegExp(escapeHtml(q)), 'gi'), '<mark>$&</mark>');
    } catch (e) {
      return safe;
    }
  }

  function score(item, q) {
    var s = 0;
    var title = (item.title || '').toLowerCase();
    var cat = (item.category || '').toLowerCase();
    var tags = (item.tags || []).join(' ').toLowerCase();
    var text = (item.text || '').toLowerCase();
    var pos = title.indexOf(q);
    if (pos > -1) s += pos === 0 ? 20 : 10;
    if (cat.indexOf(q) > -1) s += 6;
    if (tags.indexOf(q) > -1) s += 6;
    if (text.indexOf(q) > -1) s += 2;
    return s;
  }

  function search(q) {
    var needle = q.toLowerCase().trim();
    if (!needle) return [];
    return index
      .map(function (item) { return { item: item, s: score(item, needle) }; })
      .filter(function (r) { return r.s > 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .slice(0, 12)
      .map(function (r) { return r.item; });
  }

  function excerptAround(text, q) {
    text = (text || '').trim();
    var pos = text.toLowerCase().indexOf(q.toLowerCase());
    if (pos < 0) return text.slice(0, 100);
    var start = Math.max(0, pos - 30);
    return (start > 0 ? '…' : '') + text.slice(start, start + 110);
  }

  function render(input) {
    var panel = input.closest('[data-search-panel]');
    if (!panel) return;
    var resultsEl = panel.querySelector('[data-search-results]');
    var statusEl = panel.querySelector('[data-search-status]');
    var q = input.value;
    var results = index ? search(q) : [];

    if (!q.trim()) {
      resultsEl.innerHTML = '';
      statusEl.textContent = '';
      statusEl.hidden = false;
      setStatus(panel, '');
      selected = -1;
      return;
    }

    if (!index) {
      statusEl.textContent = cfg.loadingText || 'Loading…';
      statusEl.hidden = false;
      resultsEl.innerHTML = '';
      selected = -1;
      return;
    }

    if (!results.length) {
      resultsEl.innerHTML = '';
      statusEl.textContent = cfg.emptyText || 'No results';
      statusEl.hidden = false;
      selected = -1;
      return;
    }

    statusEl.hidden = true;
    resultsEl.innerHTML = results.map(function (item, i) {
      var cat = item.category
        ? '<span class="r-chip">' + escapeHtml(item.category) + '</span>'
        : '';
      return '<a class="search-result" href="' + escapeHtml(resolveUrl(item.url)) + '"' +
        (i === 0 ? ' data-selected' : '') + '>' +
        '<div class="r-title">' + highlight(item.title || 'Untitled', q) + '</div>' +
        '<div class="r-meta">' + cat + '<span>' + escapeHtml(item.date || '') + '</span></div>' +
        '<div class="r-text">' + highlight(excerptAround(item.text, q.trim()), q) + '</div>' +
        '</a>';
    }).join('');
    selected = results.length ? 0 : -1;
    updateSelection(resultsEl);
  }

  function setStatus(panel, text) {
    var statusEl = panel.querySelector('[data-search-status]');
    if (statusEl) {
      statusEl.textContent = text;
      statusEl.hidden = !text;
    }
  }

  var selected = -1;

  function resultLinks(panel) {
    return [].slice.call(panel.querySelectorAll('.search-result'));
  }

  function updateSelection(resultsEl) {
    resultLinks(resultsEl.closest('[data-search-panel]')).forEach(function (a, i) {
      a.classList.toggle('is-selected', i === selected);
    });
  }

  doc.querySelectorAll('[data-search-input]').forEach(function (input) {
    input.addEventListener('focus', loadIndex);
    input.addEventListener('input', function () { render(input); });
    input.addEventListener('keydown', function (e) {
      var panel = input.closest('[data-search-panel]');
      var links = resultLinks(panel);
      if (!links.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selected = Math.min(links.length - 1, selected + 1);
        updateSelection(panel.querySelector('[data-search-results]'));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selected = Math.max(0, selected - 1);
        updateSelection(panel.querySelector('[data-search-results]'));
      } else if (e.key === 'Enter') {
        var active = links[selected] || links[0];
        if (active) {
          e.preventDefault();
          location.href = active.getAttribute('href');
        }
      }
    });
  });

  /* 弹窗开关 */
  doc.querySelectorAll('[data-search-open]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      loadIndex();
      if (dialog && typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
        var input = dialog.querySelector('[data-search-input]');
        if (input) {
          input.value = '';
          render(input);
          setTimeout(function () { input.focus(); }, 30);
        }
      }
    });
  });

  if (dialog) {
    /* 点击遮罩关闭 */
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.querySelectorAll('[data-search-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { dialog.close(); });
    });

    /* "/" 快捷键打开搜索（输入类元素聚焦时除外） */
    doc.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      var ae = doc.activeElement;
      var tag = ae ? ae.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (ae && ae.isContentEditable)) return;
      var btn = doc.querySelector('[data-search-open]');
      if (btn) {
        e.preventDefault();
        btn.click();
      }
    });
  }

  /* 独立搜索页：初始聚焦 */
  var pageInput = doc.querySelector('.search-page [data-search-input]');
  if (pageInput && !dialog) {
    loadIndex();
    pageInput.focus();
  }
})();
