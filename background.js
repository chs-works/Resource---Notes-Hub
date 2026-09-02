/* Resource Hub — premium Aurora background
   No network/spider-web lines: soft moving light fields, particles and
   a subtle cursor-following glow. */
(() => {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, raf = 0, t = 0;
  let pointer = { x: -9999, y: -9999, active: false };
  let dust = [];
  const blobs = [
    { x:.12, y:.18, r:.25, sx:.00022, sy:.00017, p:0, c:'violet' },
    { x:.84, y:.20, r:.24, sx:.00017, sy:.00025, p:2, c:'cyan' },
    { x:.52, y:.80, r:.30, sx:.00013, sy:.00019, p:4, c:'pink' },
    { x:.20, y:.72, r:.18, sx:.00024, sy:.00014, p:6, c:'mint' }
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(90, Math.max(38, Math.round((w*h)/18000)));
    dust = Array.from({length: count}, () => ({
      x: Math.random()*w, y: Math.random()*h,
      r: .45 + Math.random()*1.45,
      a: .10 + Math.random()*.25,
      vx: (Math.random()-.5)*.08,
      vy: -.025 - Math.random()*.06,
      tw: Math.random()*Math.PI*2
    }));
  }

  function palette() {
    const dark = document.body.classList.contains('dark-mode');
    return dark ? {
      violet:[139,124,255], cyan:[57,217,255], pink:[255,112,200], mint:[90,230,190],
      baseAlpha:.16, dust:.34
    } : {
      violet:[121,91,230], cyan:[32,174,191], pink:[229,92,155], mint:[57,180,150],
      baseAlpha:.10, dust:.24
    };
  }

  function drawBlob(b, rgb, now, alpha) {
    const x = (b.x + Math.sin(now*b.sx + b.p)*.09) * w;
    const y = (b.y + Math.cos(now*b.sy + b.p)*.08) * h;
    const r = b.r * Math.min(w,h);
    const g = ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0, `rgba(${rgb.join(',')},${alpha})`);
    g.addColorStop(.34, `rgba(${rgb.join(',')},${alpha*.48})`);
    g.addColorStop(1, `rgba(${rgb.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }

  function render(now) {
    t = now;
    const pal = palette();
    ctx.clearRect(0,0,w,h);
    ctx.globalCompositeOperation = 'screen';
    blobs.forEach(b => drawBlob(b, pal[b.c], now, pal.baseAlpha));

    // Slow, sparse dust for a premium "floating in space" feel.
    dust.forEach((p, i) => {
      if (!reduced) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -4) { p.y = h+4; p.x = Math.random()*w; }
        if (p.x < -4) p.x = w+4;
        if (p.x > w+4) p.x = -4;
      }
      const pulse = .65 + .35*Math.sin(now*.001 + p.tw);
      ctx.fillStyle = `rgba(${pal.cyan.join(',')},${p.a*pulse*pal.dust})`;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    });

    if (pointer.active) {
      const g = ctx.createRadialGradient(pointer.x,pointer.y,0,pointer.x,pointer.y,210);
      g.addColorStop(0, `rgba(${pal.violet.join(',')},.13)`);
      g.addColorStop(.45, `rgba(${pal.cyan.join(',')},.055)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(pointer.x,pointer.y,210,0,Math.PI*2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!reduced) raf = requestAnimationFrame(render);
  }

  window.addEventListener('resize', resize, {passive:true});
  window.addEventListener('pointermove', e => {
    pointer.x=e.clientX; pointer.y=e.clientY; pointer.active=true;
  }, {passive:true});
  window.addEventListener('pointerleave', () => { pointer.active=false; }, {passive:true});
  resize(); render(0);
})();
