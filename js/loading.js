/* 서버에서 내 공부 기록을 불러오는 동안 보여 주는 로딩 화면(로그인·새로고침 뒤 내 공부방으로 올 때). */
(function () {
  let el = null, timer = null;
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'app-loader'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.hidden = true;
    el.innerHTML = '<div class="ld-card"><div class="ld-books" aria-hidden="true"><span>📘</span><span>📗</span><span>📙</span></div>'
      + '<div class="ld-text">내 공부방을 불러오는 중이에요</div><div class="ld-sub">지난 공부 기록과 배지를 가져오고 있어요</div>'
      + '<div class="ld-dots" aria-hidden="true"><i></i><i></i><i></i></div></div>';
    document.body.appendChild(el);
    return el;
  }
  // 아주 빨리 끝나면 깜빡이지 않도록 0.15초 뒤에 띄운다
  window.showLoader = function (text, sub) {
    const n = ensure();
    n.querySelector('.ld-text').textContent = text || '내 공부방을 불러오는 중이에요';
    n.querySelector('.ld-sub').textContent = sub || '지난 공부 기록과 배지를 가져오고 있어요';
    clearTimeout(timer); timer = setTimeout(() => { n.hidden = false; }, 150);
  };
  window.hideLoader = function () { clearTimeout(timer); if (el) el.hidden = true; };
})();
