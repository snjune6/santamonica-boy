(function setupBgWeb() {
  if (document.getElementById("bgCanvas")) return;

  const canvas = document.createElement("canvas");
  canvas.id = "bgCanvas";
  canvas.className = "bg-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  const mouse = {
    x: width / 2,
    y: height / 2,
    targetX: width / 2,
    targetY: height / 2,
  };

  let geoParticles = [];

  const initGeoParticles = () => {
    geoParticles = [];
    const count = Math.floor((width * height) / 10000);
    for (let i = 0; i < count; i++) {
      geoParticles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        radius: Math.random() * 2.5 + 1.5,
      });
    }
  };

  const drawGeoWeb = () => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const connectDist = 140;

    geoParticles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;

      const dx = mouse.x - p.x;
      const dy = mouse.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 200 && dist > 0.001) {
        const force = (200 - dist) / 200;
        p.x += (dx / dist) * force * 1.8;
        p.y += (dy / dist) * force * 1.8;
      }

      ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      for (let j = idx + 1; j < geoParticles.length; j++) {
        const p2 = geoParticles[j];
        const pDistance = Math.hypot(p.x - p2.x, p.y - p2.y);

        if (pDistance < connectDist) {
          const alpha = (1 - pDistance / connectDist) * 0.28;
          ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      if (dist < 180 && dist > 0.001) {
        const mouseAlpha = (1 - dist / 180) * 0.45;
        ctx.strokeStyle = `rgba(236, 72, 153, ${mouseAlpha})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    });
  };

  const animate = () => {
    mouse.x += (mouse.targetX - mouse.x) * 0.12;
    mouse.y += (mouse.targetY - mouse.y) * 0.12;
    drawGeoWeb();
    requestAnimationFrame(animate);
  };

  window.addEventListener(
    "resize",
    () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initGeoParticles();
    },
    { passive: true },
  );

  window.addEventListener(
    "mousemove",
    (event) => {
      mouse.targetX = event.clientX;
      mouse.targetY = event.clientY;
    },
    { passive: true },
  );

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  initGeoParticles();
  if (reduceMotion.matches) {
    drawGeoWeb();
  } else {
    animate();
  }
})();
