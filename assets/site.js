<script>
// ---------- tiny utilities ----------
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const ok = r => { if(!r.ok) throw new Error(r.status); return r; };
const j = p => fetch(p, {cache:'no-store'}).then(ok).then(r=>r.json());
const esc = s => (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ---------- chrome: nav/footer from site.json ----------
async function hydrateChrome() {
  try {
    const site = await j('../data/site.json').catch(()=> j('data/site.json'));
    const set = (id, txt) => { const el = document.getElementById(id); if(el && txt) el.textContent = txt; };

    set('siteName', site.name);
    if (site.links?.linkedin) { const a = document.getElementById('linkedinLink'); if (a){ a.href = site.links.linkedin; a.textContent = site.links.linkedin.replace(/^https?:\/\//,''); } }
    if (site.links?.website)  { const a = document.getElementById('siteLink'); if (a){ a.href = site.links.website; a.textContent = site.links.website.replace(/^https?:\/\//,''); } }
    if (site.contact?.email)  { const a = document.getElementById('email'); if (a){ a.href = `mailto:${site.contact.email}`; a.textContent = site.contact.email; } }
    if (site.photo) { const img = document.getElementById('profilePhoto'); if (img) img.src = site.photo; }

    // Build nav (desktop + mobile)
    if (Array.isArray(site.nav)) {
      const nav = document.getElementById('nav');
      const mobWrap = document.getElementById('mobileMenu')?.querySelector('.container');
      const html = site.nav.map(n => `<a href="${n.href.includes('#')? n.href : ('/'+n.href)}">${esc(n.label)}</a>`).join('');
      if (nav) nav.innerHTML = html;
      if (mobWrap) mobWrap.innerHTML = site.nav.map(n=>`<a class="py-2" href="${n.href.includes('#')? n.href : ('/'+n.href)}">${esc(n.label)}</a>`).join('');
    }
  } catch (e) {}
}

// ---------- theme & menu ----------
function initUI() {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if (saved) root.classList.toggle('dark', saved === 'dark');
  const t = document.getElementById('themeToggle'); if (t) t.onclick = () => { const d = root.classList.toggle('dark'); localStorage.setItem('theme', d?'dark':'light'); };
  const btn = document.getElementById('menuBtn'), menu = document.getElementById('mobileMenu');
  if (btn && menu){ btn.onclick=()=>menu.classList.toggle('hidden'); $$('#mobileMenu a').forEach(a=>a.onclick=()=>menu.classList.add('hidden')); }
  const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();
}

// ---------- carousel (vanilla) ----------
class Carousel {
  constructor(root, images = []) {
    this.root = root;
    this.images = images;
    this.i = 0;
    this.track = document.createElement('div');
    this.track.className = 'flex transition-transform duration-300 ease-out';
    this.root.classList.add('relative', 'overflow-hidden');
    this.root.innerHTML = ''; // clear

    // slides
    images.forEach(src => {
      const slide = document.createElement('div');
      slide.className = 'min-w-full';
      slide.innerHTML = `<img src="${esc(src)}" class="w-full h-auto object-cover rounded-xl" loading="lazy">`;
      this.track.appendChild(slide);
    });
    this.root.appendChild(this.track);

    // arrows
    const mkBtn = (dir) => {
      const b = document.createElement('button');
      b.className = 'absolute top-1/2 -translate-y-1/2 ' + (dir==='prev'?'left-2':'right-2') +
        ' bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-full p-2 hover:shadow';
      b.innerHTML = dir==='prev'?'&#10094;':'&#10095;';
      b.onclick = () => this.go(dir==='prev'? this.i-1 : this.i+1);
      return b;
    };
    if (images.length>1) {
      this.root.appendChild(mkBtn('prev'));
      this.root.appendChild(mkBtn('next'));
    }

    // dots
    this.dots = document.createElement('div');
    this.dots.className = 'absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2';
    images.forEach((_,idx)=>{
      const d=document.createElement('button');
      d.className='w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700';
      d.onclick=()=>this.go(idx);
      this.dots.appendChild(d);
    });
    if (images.length>1) this.root.appendChild(this.dots);

    // swipe
    let sx=0, dx=0;
    this.root.addEventListener('pointerdown', e=>{ sx=e.clientX; this.root.setPointerCapture(e.pointerId); });
    this.root.addEventListener('pointermove', e=>{ if(!sx) return; dx = e.clientX - sx; this.track.style.transform = `translateX(calc(${-this.i*100}% + ${dx}px))`; });
    const end = ()=>{ if(!sx) return;
      if (dx < -60) this.go(this.i+1); else if (dx > 60) this.go(this.i-1); else this.go(this.i);
      sx=0; dx=0;
    };
    this.root.addEventListener('pointerup', end);
    this.root.addEventListener('pointercancel', end);

    this.go(0);
  }
  go(idx){
    this.i = (idx + this.images.length) % this.images.length;
    this.track.style.transform = `translateX(${-this.i*100}%)`;
    if (this.dots) [...this.dots.children].forEach((d,k)=> d.style.opacity = String(k===this.i?1:0.4));
  }
}

// ---------- lightbox ----------
class Lightbox {
  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'fixed inset-0 hidden items-center justify-center bg-black/80 z-[1000] p-4';
    this.el.innerHTML = `
      <div class="max-w-5xl w-full">
        <img id="lbImg" class="w-full h-auto rounded-xl" src="">
      </div>`;
    document.body.appendChild(this.el);
    this.el.addEventListener('click', ()=> this.hide());
    document.addEventListener('keydown', e=>{ if(e.key==='Escape') this.hide(); });
  }
  show(src){ $('#lbImg').src = src; this.el.classList.remove('hidden','opacity-0'); }
  hide(){ this.el.classList.add('hidden'); }
}
const lightbox = new Lightbox();

// helper to attach lightbox to a grid of images
function enableLightbox(container) {
  container.querySelectorAll('img').forEach(img=>{
    img.classList.add('cursor-zoom-in');
    img.addEventListener('click', ()=> lightbox.show(img.src));
  });
}

// Expose globally for pages
window.Portfolio = { j, esc, Carousel, enableLightbox, hydrateChrome, initUI };
</script>
