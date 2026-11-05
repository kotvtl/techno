'use strict';

(() => {
  // ============================================================
  // Конфигурация
  // ============================================================
  const CONFIG = {
    colors: {
      background: 0x040810,
      green: 0x00ff88,
      red: 0xff0044,
      white: 0xffffff,
      yellow: 0xffdd00,
      cyan: 0xaaffff,
      snow: 0xaaccff,
      grid: { main: 0x00ffaa, sub: 0x002244 },
    },
    tree: {
      height: 22,
      radius: 8,
      spiralLines: 8,
      spiralPoints: 100,
      spiralTurns: 12,
    },
    ornaments: { count: 90, radius: 0.5 },
    arcs: { count: 10, originY: 12, updateInterval: 0.08 },
    snowflakes: {
      orbitCount: 4,
      perOrbit: 4,
      radiusBase: 10,
      radiusStep: 1.5,
      verticalSpacing: 5,
      startY: 5,
    },
    gifts: { count: 5, ringRadius: 12, size: 2 },
    snow: {
      count: 1500,
      area: 80,
      fallSpeed: 0.1,
      drift: 0.01,
      resetBelow: -5,
      resetAbove: 50,
    },
    sparks: {
      count: 40,
      baseSpeed: 1,
      speedRange: 3,
      lifeDecrease: 0.02,
      gravity: 0.05,
    },
    camera: {
      fov: 50,
      near: 0.1,
      far: 1000,
      distance: 55,
      heightBase: 18,
      lookAtY: 12,
      autoRotateSpeed: 0.0015,
      lerp: 0.1,
      pitchMin: -0.2,
      pitchMax: 0.5,
    },
    shake: { duration: 0.15, magnitude: 0.5 },
    flash: { opacity: 0.6, duration: 100 },
    treeGrowStep: 0.02,
    treeRotationSpeed: 0.15,
    starRotationSpeed: 1.5,
  };

  const THEMES = [
    { lineA: 0x00ff88, lineB: 0xffffff, ornament: 0xff0044, lightA: 0x00ff88, lightB: 0xff0044 },
    { lineA: 0xffdd00, lineB: 0x00ff88, ornament: 0x00ffff, lightA: 0xffdd00, lightB: 0x00ffff },
    { lineA: 0xff00aa, lineB: 0xffffff, ornament: 0xffdd00, lightA: 0xff00aa, lightB: 0xffdd00 },
  ];

  // ============================================================
  // Состояние
  // ============================================================
  const state = {
    clicks: 0,
    shake: 0,
    isPointerDown: false,
    pointerX: 0,
    pointerY: 0,
    targetRotY: 0,
    targetRotX: 0,
    currentRotY: 0,
    currentRotX: 0,
    sparks: [],
    arcTimer: 0,
  };

  // ============================================================
  // Сцена / камера / рендерер
  // ============================================================
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(CONFIG.colors.background, 0.015);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.camera.fov,
    window.innerWidth / window.innerHeight,
    CONFIG.camera.near,
    CONFIG.camera.far
  );
  camera.position.set(0, CONFIG.camera.heightBase, CONFIG.camera.distance);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  document.body.appendChild(renderer.domElement);

  const flashEl = document.getElementById('flash');

  // ============================================================
  // Свет
  // ============================================================
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const greenLight = new THREE.PointLight(CONFIG.colors.green, 3, 80);
  greenLight.position.set(0, 5, 10);
  scene.add(greenLight);

  const redLight = new THREE.PointLight(CONFIG.colors.red, 3, 80);
  redLight.position.set(10, 20, -5);
  scene.add(redLight);

  const mouseLight = new THREE.PointLight(0xffffff, 1.5, 40);
  scene.add(mouseLight);

  // ============================================================
  // Пол
  // ============================================================
  const floorGrid = new THREE.GridHelper(
    100,
    40,
    CONFIG.colors.grid.main,
    CONFIG.colors.grid.sub
  );
  floorGrid.position.y = -1;
  scene.add(floorGrid);

  // ============================================================
  // Ёлка
  // ============================================================
  const treeGroup = new THREE.Group();
  treeGroup.scale.setScalar(0.01);
  scene.add(treeGroup);

  const spiralLines = createSpirals(treeGroup);
  const ornaments = createOrnaments(treeGroup);
  const star = createStar(treeGroup);
  const arcs = createArcs(treeGroup, ornaments.positions);
  const orbits = createSnowflakes();
  const gifts = createGifts();
  const snow = createSnow();

  // ---------------- Построение: спирали ----------------
  function createSpirals(parent) {
    const lines = [];
    const { spiralLines: count, spiralPoints, spiralTurns, height, radius } = CONFIG.tree;

    for (let lineIdx = 0; lineIdx < count; lineIdx++) {
      const points = [];
      const angleOffset = (lineIdx / count) * Math.PI * 2;

      for (let p = 0; p <= spiralPoints; p++) {
        const t = p / spiralPoints;
        const r = (1 - t) * radius;
        const angle = t * Math.PI * spiralTurns + angleOffset;
        points.push(new THREE.Vector3(Math.cos(angle) * r, t * height, Math.sin(angle) * r));
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: lineIdx % 2 === 0 ? CONFIG.colors.green : CONFIG.colors.white,
        transparent: true,
        opacity: 0.4,
      });

      const line = new THREE.Line(geometry, material);
      parent.add(line);
      lines.push(line);
    }
    return lines;
  }

  // ---------------- Построение: шары ----------------
  function createOrnaments(parent) {
    const geometry = new THREE.SphereGeometry(CONFIG.ornaments.radius, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: CONFIG.colors.red,
      emissive: 0x440011,
      metalness: 0.8,
      roughness: 0.1,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, CONFIG.ornaments.count);
    const positions = [];
    const dummy = new THREE.Object3D();
    const { height, radius } = CONFIG.tree;
    const ringRadius = radius * 0.9;

    for (let i = 0; i < CONFIG.ornaments.count; i++) {
      const t = Math.random();
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * (1 - t) * ringRadius;
      const y = t * height;
      const z = Math.sin(angle) * (1 - t) * ringRadius;

      positions.push(new THREE.Vector3(x, y, z));
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.8 + Math.random() * 0.4);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    parent.add(mesh);
    return { mesh, material, positions };
  }

  // ---------------- Построение: звезда ----------------
  function createStar(parent) {
    const group = new THREE.Group();
    group.position.y = CONFIG.tree.height + 1.5;

    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1),
      new THREE.MeshBasicMaterial({ color: CONFIG.colors.white })
    );
    const cage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.8),
      new THREE.MeshBasicMaterial({ color: CONFIG.colors.yellow, wireframe: true })
    );

    group.add(core, cage);
    parent.add(group);
    return { group, core, cage };
  }

  // ---------------- Построение: молнии ----------------
  function createArcs(parent, ornamentPositions) {
    const count = CONFIG.arcs.count;
    const buffer = new Float32Array(count * 6); // 2 точки * 3 координаты
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(buffer, 3));

    const material = new THREE.LineBasicMaterial({
      color: CONFIG.colors.white,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.LineSegments(geometry, material);
    parent.add(mesh);

    function update() {
      for (let i = 0; i < count; i++) {
        const target = ornamentPositions[(Math.random() * ornamentPositions.length) | 0];
        const offset = i * 6;
        buffer[offset]     = 0;
        buffer[offset + 1] = CONFIG.arcs.originY;
        buffer[offset + 2] = 0;
        buffer[offset + 3] = target.x;
        buffer[offset + 4] = target.y;
        buffer[offset + 5] = target.z;
      }
      geometry.attributes.position.needsUpdate = true;
    }

    update();
    return { mesh, update };
  }

  // ---------------- Построение: снежинки ----------------
  function createSnowflakes() {
    const template = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: CONFIG.colors.cyan,
      wireframe: true,
    });
    const barGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2.5, 4);

    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(barGeometry, material);
      bar.rotation.z = Math.PI / 2;
      bar.rotation.y = (i / 3) * Math.PI;
      template.add(bar);
    }
    template.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 4, 4), material));

    const orbits = [];
    const { orbitCount, perOrbit, radiusBase, radiusStep, verticalSpacing, startY } =
      CONFIG.snowflakes;

    for (let o = 0; o < orbitCount; o++) {
      const orbit = new THREE.Group();
      orbit.position.y = startY + o * verticalSpacing;
      const radius = radiusBase + o * radiusStep;

      for (let p = 0; p < perOrbit; p++) {
        const flake = template.clone();
        const angle = (p / perOrbit) * Math.PI * 2;
        flake.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        flake.scale.setScalar(1 + Math.random() * 0.5);
        orbit.add(flake);
      }

      scene.add(orbit);
      orbits.push(orbit);
    }

    return { orbits, material };
  }

  // ---------------- Построение: подарки ----------------
  function createGifts() {
    const giftColors = [CONFIG.colors.red, CONFIG.colors.green, CONFIG.colors.yellow];
    const ribbonMaterial = new THREE.MeshBasicMaterial({ color: CONFIG.colors.white });
    const { count, ringRadius, size } = CONFIG.gifts;

    const gifts = [];
    for (let i = 0; i < count; i++) {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size, size, size),
        new THREE.MeshStandardMaterial({
          color: giftColors[i % giftColors.length],
          metalness: 0.5,
          roughness: 0.3,
        })
      );
      box.add(new THREE.Mesh(new THREE.BoxGeometry(size + 0.1, 0.3, size + 0.1), ribbonMaterial));
      box.add(new THREE.Mesh(new THREE.BoxGeometry(size + 0.1, size + 0.1, 0.3), ribbonMaterial));

      const angle = (i / count) * Math.PI * 2 + 0.5;
      box.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
      box.rotation.y = Math.random() * Math.PI;

      scene.add(box);
      gifts.push(box);
    }
    return gifts;
  }

  // ---------------- Построение: снег ----------------
  function createSnow() {
    const texture = createSnowTexture();
    const { count, area } = CONFIG.snow;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
      positions[i] = (Math.random() - 0.5) * area;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      map: texture,
      color: CONFIG.colors.snow,
      size: 0.6,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);
    return { points, geometry };
  }

  function createSnowTexture() {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }

  // ============================================================
  // Взаимодействие
  // ============================================================
  window.addEventListener('pointerdown', (e) => {
    state.isPointerDown = true;
    state.pointerX = e.clientX;
    state.pointerY = e.clientY;
    triggerEffect();
  });

  window.addEventListener('pointerup', () => {
    state.isPointerDown = false;
  });

  window.addEventListener('pointermove', (e) => {
    updateMouseLight(e.clientX, e.clientY);
    if (!state.isPointerDown) return;

    const dx = e.clientX - state.pointerX;
    const dy = e.clientY - state.pointerY;

    state.targetRotY += dx * 0.005;
    state.targetRotX = THREE.MathUtils.clamp(
      state.targetRotX + dy * 0.005,
      CONFIG.camera.pitchMin,
      CONFIG.camera.pitchMax
    );

    state.pointerX = e.clientX;
    state.pointerY = e.clientY;
  });

  window.addEventListener('dblclick', () => {
    state.targetRotY = 0;
    state.targetRotX = 0;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  function updateMouseLight(clientX, clientY) {
    const mx = (clientX / window.innerWidth) * 2 - 1;
    const my = -(clientY / window.innerHeight) * 2 + 1;
    mouseLight.position.set(mx * 20, my * 15 + 12, 10);
  }

  function triggerEffect() {
    state.clicks++;
    state.shake = CONFIG.shake.duration;

    flashEl.style.opacity = CONFIG.flash.opacity;
    window.setTimeout(() => {
      flashEl.style.opacity = 0;
    }, CONFIG.flash.duration);

    spawnSparks();
    applyTheme(THEMES[state.clicks % THEMES.length]);
  }

  function spawnSparks() {
    const geometry = new THREE.TetrahedronGeometry(0.3);
    const { count, baseSpeed, speedRange } = CONFIG.sparks;

    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: CONFIG.colors.white,
        transparent: true,
        blending: THREE.AdditiveBlending,
      });
      const spark = new THREE.Mesh(geometry, material);
      spark.position.set(0, 12, 0);

      const velocity = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize().multiplyScalar(baseSpeed + Math.random() * speedRange);

      spark.userData = { velocity, life: 1.0 };
      scene.add(spark);
      state.sparks.push(spark);
    }
  }

  function applyTheme(theme) {
    spiralLines.forEach((line, i) => {
      line.material.color.setHex(i % 2 === 0 ? theme.lineA : theme.lineB);
    });
    ornaments.material.color.setHex(theme.ornament);
    ornaments.material.emissive.setHex(theme.ornament);
    greenLight.color.setHex(theme.lightA);
    redLight.color.setHex(theme.lightB);
    orbits.material.color.setHex(theme.lightA);
  }

  // ============================================================
  // Анимация
  // ============================================================
  const clock = new THREE.Clock();

  function update(time) {
    // Рост ёлки при старте
    if (treeGroup.scale.x < 1) {
      const next = Math.min(treeGroup.scale.x + CONFIG.treeGrowStep, 1);
      treeGroup.scale.setScalar(next);
    }

    // Тряска
    if (state.shake > 0) {
      state.shake -= 0.016;
      scene.position.x = (Math.random() - 0.5) * CONFIG.shake.magnitude;
      scene.position.y = (Math.random() - 0.5) * CONFIG.shake.magnitude;
    } else if (scene.position.x !== 0 || scene.position.y !== 0) {
      scene.position.set(0, 0, 0);
    }

    // Вращение дерева / звезды
    treeGroup.rotation.y = time * CONFIG.treeRotationSpeed;
    star.group.rotation.y = time * CONFIG.starRotationSpeed;
    star.group.rotation.x = time;
    star.core.scale.setScalar(1 + Math.sin(time * 4) * 0.1);

    // Снежинки на орбитах
    orbits.orbits.forEach((orbit, i) => {
      orbit.rotation.y = time * (0.3 + i * 0.15);
      orbit.rotation.x = Math.sin(time * 0.5) * 0.2;
      orbit.children.forEach((child) => {
        child.rotation.y += 0.02;
      });
    });

    // Обновление молний
    state.arcTimer += 0.016;
    if (state.arcTimer > CONFIG.arcs.updateInterval) {
      arcs.update();
      state.arcTimer = 0;
    }

    // Искры
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const spark = state.sparks[i];
      spark.position.add(spark.userData.velocity);
      spark.userData.velocity.y -= CONFIG.sparks.gravity;
      spark.userData.life -= CONFIG.sparks.lifeDecrease;
      spark.material.opacity = spark.userData.life;

      if (spark.userData.life <= 0) {
        scene.remove(spark);
        spark.material.dispose();
        state.sparks.splice(i, 1);
      }
    }

    // Снег
    updateSnow(time);

    // Камера
    if (!state.isPointerDown) state.targetRotY += CONFIG.camera.autoRotateSpeed;
    state.currentRotY += (state.targetRotY - state.currentRotY) * CONFIG.camera.lerp;
    state.currentRotX += (state.targetRotX - state.currentRotX) * CONFIG.camera.lerp;

    const dist = CONFIG.camera.distance;
    camera.position.x = Math.sin(state.currentRotY) * dist * Math.cos(state.currentRotX);
    camera.position.y = CONFIG.camera.heightBase + Math.sin(state.currentRotX) * dist;
    camera.position.z = Math.cos(state.currentRotY) * dist * Math.cos(state.currentRotX);
    camera.lookAt(0, CONFIG.camera.lookAtY, 0);

    renderer.render(scene, camera);
  }

  function updateSnow(time) {
    const positions = snow.geometry.attributes.position.array;
    const { count, fallSpeed, drift, resetBelow, resetAbove } = CONFIG.snow;

    for (let i = 1; i < count * 3; i += 3) {
      positions[i] -= fallSpeed;
      positions[i - 1] += Math.sin(time + i) * drift;
      if (positions[i] < resetBelow) positions[i] = resetAbove;
    }
    snow.geometry.attributes.position.needsUpdate = true;
  }

  function startAnimation() {
    function tick() {
      requestAnimationFrame(tick);
      update(clock.getElapsedTime());
    }
    tick();
  }

  startAnimation();
})();