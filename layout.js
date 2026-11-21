// Shared nav + footer for all Nexqor pages
(function () {
  const page = (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
  const links = [
    ['news', 'News'], ['threatmap', '3D Map'], ['playbook', 'Playbook'], ['checklist', 'Checklist'], ['tools', 'Scanner'], ['resources', 'Resources'], ['glossary', 'Glossary']
  ];
  const nav = document.createElement('nav');
  nav.innerHTML = `<div class="wrap">
    <a class="logo" href="index.html"><img src="avatar.jpg" alt="">NEXQOR</a>
    <ul id="nx-menu">${links.map(([h, t]) => `<li><a href="${h}.html"${page === h ? ' class="on"' : ''}>${t}</a></li>`).join('')}</ul>
    <div class="nav-r"><a class="btn solid" href="https://x.com/whyNexqor" target="_blank" rel="noopener">Follow on 𝕏</a>
    <button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="nx-menu"><i></i><i></i><i></i></button></div></div>`;
  document.body.prepend(nav);
  const burger = nav.querySelector('.burger');
  burger.onclick = () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o); };
  nav.querySelectorAll('#nx-menu a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  const f = document.createElement('footer');
  f.innerHTML = `<div class="wrap">
    <span>© 2026 Nexqor · AI is the new attack surface · Educational content for defenders.</span>
    <span><a href="https://x.com/whyNexqor">𝕏 @whyNexqor</a> · <a href="https://github.com/Nexqor">GitHub</a> · <a href="news.html">News</a></span></div>`;
  document.body.append(f);

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .12 });
  window.nxReveal = () => document.querySelectorAll('.reveal:not(.on)').forEach(el => io.observe(el));
  window.nxReveal();
})();

// Render news from news.json into a container
window.nxNews = async function (el, opts = {}) {
  let items = [];
  try { items = await (await fetch('news.json', { cache: 'no-store' })).json(); }
  catch (e) { el.innerHTML = '<p class="mono" style="color:var(--muted)">News feed unavailable.</p>'; return; }
  items.sort((a, b) => b.date.localeCompare(a.date));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const draw = (cat) => {
    const list = items.filter(i => !cat || cat === 'all' || i.category === cat).slice(0, opts.limit || 999);
    el.innerHTML = list.map(i => `<article class="item reveal">
      <div><div class="d">${esc(i.date)}</div><span class="sev ${esc(i.severity)}">${esc(i.severity.toUpperCase())}</span></div>
      <div><h3>${esc(i.title)}</h3><p>${esc(i.summary)}</p>
      <div class="take"><b class="mono" style="color:var(--cyan)">Nexqor take:</b> ${esc(i.take)}</div>
      <div class="meta">#${esc(i.category)} · source: <a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.source)}</a>${i.play ? ` · <a href="playbook.html#${esc(i.play)}">playbook →</a>` : ''}</div></div>
    </article>`).join('');
    window.nxReveal && window.nxReveal();
  };
  draw('all');
  if (opts.filters) {
    const cats = ['all', ...new Set(items.map(i => i.category))];
    opts.filters.innerHTML = cats.map(c => `<button class="chip${c === 'all' ? ' on' : ''}" data-c="${c}">${c === 'all' ? 'all' : '#' + c}</button>`).join('');
    opts.filters.onclick = e => {
      const b = e.target.closest('.chip'); if (!b) return;
      opts.filters.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b));
      draw(b.dataset.c);
    };
  }
};
