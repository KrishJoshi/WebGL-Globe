/**
 * dat.globe Javascript WebGL Globe Toolkit
 * http://dataarts.github.com/dat.globe
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

var DAT = DAT || {};

DAT.Globe = function(container, colorFn, texture) {

  colorFn = colorFn || function(x) {
    var c = new THREE.Color();
    c.setHSV((0.6 - (x * 0.5)), 1.0, 1.0);
    return c;
  };

  var Shaders = {
    'earth': {
      uniforms: {
        'texture': {
          type: 't',
          value: 0,
          texture: null
        }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        'vNormal = normalize( normalMatrix * normal );',
        'vUv = uv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
        'vec3 diffuse = texture2D( texture, vUv ).xyz;',
        'float intensity = 1.50 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
        'vec3 atmosphere = vec3( 1.0, 1.0, 1.0 ) * pow( intensity-0.5, 5.0 );',
        'gl_FragColor = vec4( diffuse + atmosphere, 2.3 );',
        '}'
      ].join('\n')
    },
    'atmosphere': {
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
        'vNormal = normalize( normalMatrix * normal );',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
        'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 20.0 );',
        'gl_FragColor = vec4( 1.0, 1.0, 1.0, 1.0 ) * intensity;',
        '}'
      ].join('\n')
    }
  };

  var camera, scene, sceneAtmosphere, renderer, w, h;
  var vector, mesh, atmosphere, point;

  var overRenderer;

  var imgDir = '';

  var curZoomSpeed = 0;
  var zoomSpeed = 50;

  var mouse = {
      x: 0,
      y: 0
    },
    mouseOnDown = {
      x: 0,
      y: 0
    };
  var rotation = {
      x: 0,
      y: 0
    },
    target = {
      x: Math.PI * 3 / 2,
      y: Math.PI / 6.0
    },
    targetOnDown = {
      x: 0,
      y: 0
    };

  var distance = 100000,
    distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

  function init() {

    container.style.color = '#fff';
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    camera = new THREE.Camera(
      30, w / h, 1, 10000);
    camera.position.z = distance;

    vector = new THREE.Vector3();

    scene = this.scene = new THREE.Scene();
    sceneAtmosphere = new THREE.Scene();

    var geometry = new THREE.Sphere(200, 40, 30);


    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    uniforms['texture'].texture = THREE.ImageUtils.loadTexture(texture + 'world.jpg');

    material = new THREE.MeshShaderMaterial({

      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader

    });

    mesh = new THREE.Mesh(geometry, material);
    mesh.matrixAutoUpdate = false;
    scene.addObject(mesh);

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.MeshShaderMaterial({
      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });

    mesh = new THREE.Mesh(geometry, material);
    mesh.scale.x = mesh.scale.y = mesh.scale.z = 1.1;
    mesh.flipSided = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    sceneAtmosphere.addObject(mesh);


    geometry = new THREE.Cube(0.75, 0.75, 1, 1, 1, 1, null, false, {
      px: true,
      nx: true,
      py: true,
      ny: true,
      pz: false,
      nz: true
    });

    for (var i = 0; i < geometry.vertices.length; i++) {
      var vertex = geometry.vertices[i];
      vertex.position.z += 0.5;
    }

    point = new THREE.Mesh(geometry);

    renderer = this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    renderer.autoClear = false;
    renderer.setClearColorHex(0x000000, 0.0);
    renderer.setSize(w, h);

    for (var i = 0; i < 1000; i++) {
      var particle = new THREE.Vertex(
        new THREE.Vector3(0, 0, 0)
      );
      particles.vertices.push(particle);
    }

    this.scene.addObject(particleSystem);

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);
    container.addEventListener('mousedown', onMouseDown, false);
    container.addEventListener('mousewheel', onMouseWheel, false);
    document.addEventListener('keydown', onDocumentKeyDown, false);
    window.addEventListener('resize', onWindowResize, false);
    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);
    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);

    document.addEventListener('touchstart', onDocumentTouchStart, false);
    document.addEventListener('touchmove', onDocumentTouchMove, false);
  }

  this.init = init;


  function onDocumentTouchStart(event) {

    if (event.touches.length === 1) {


      mouseOnDown.x = event.touches[0].pageX;
      targetOnDown.x = target.x;

      container.style.cursor = 'move';

    }

  }

  function onDocumentTouchMove(event) {

    if (event.touches.length === 1) {

      event.preventDefault();
      mouse.x = event.touches[0].pageX;

      var zoomDamp = distance / 1000;

      target.x = targetOnDown.x - ( (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp);

      console.log(mouse.x);

    }

  }


  function onMouseDown(event) {
    event.preventDefault();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    mouseOnDown.x = -event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    container.style.cursor = 'move';
  }

  function onMouseMove(event) {
    mouse.x = -event.clientX;
    mouse.y = event.clientY;

    var zoomDamp = distance / 1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < -PI_HALF ? -PI_HALF : target.y;
  }

  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.style.cursor = 'auto';
  }

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
  }

  function onMouseWheel(event) {
    event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3 || event.wheelDelta * 0.3 || event.detail * -10);
    }
    return false;
  }

  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }
  }

  function onWindowResize(event) {
    console.log('resize');
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 1000 ? 1000 : distanceTarget;
    distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
  }

  function animate() {
    requestAnimationFrame(animate, null);
    render();
  }

  function render() {
    zoom(curZoomSpeed);

    target.x += 0.0001;

    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    vector.copy(camera.position);

    renderer.clear();
    renderer.render(scene, camera);
    renderer.render(sceneAtmosphere, camera);
  }

  var particles = new THREE.Geometry();

  var particleMaterial = new THREE.ParticleBasicMaterial({
    color: 0x3399FF,
    size: 15,
    map: THREE.ImageUtils.loadTexture(texture + 'particle.png'),
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });

  var particleSystem = new THREE.ParticleSystem(particles, particleMaterial);

  this.setData = function(yearData) {

    var pos = function(lat, lon) {
      var phi = (90 - lat) * Math.PI / 180;
      var theta = (180 - lon) * Math.PI / 180;

      var r = 200;

      return {
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.cos(phi),
        z: r * Math.sin(phi) * Math.sin(theta)
      };
    };

    for (var i = 0; i < 1000; i++) {
      var particle = new THREE.Vertex(
        new THREE.Vector3(0, 0, 0)
      );
      particles.vertices[i] = particle;
    }


    var data = yearData;
    var currentVertex = 0;
    for (var i = 0; i < data.length; i += 3) {
      var point = pos(data[i], data[i + 1]);
      var particle = new THREE.Vertex(
        new THREE.Vector3(point.x, point.y, point.z)
      );
      //      var particle = new THREE.Vector3(point.x, point.y, point.z);
      particles.vertices[currentVertex] = particle;
      currentVertex++;
    }

    particleSystem.sortParticles = true;
  };
  this.animate = animate;


  this.__defineGetter__('time', function() {
    return this._time || 0;
  });

  this.__defineSetter__('time', function(t) {
    var validMorphs = [];
    var morphDict = this.points.morphTargetDictionary;
    for (var k in morphDict) {
      if (k.indexOf('morphPadding') < 0) {
        validMorphs.push(morphDict[k]);
      }
    }
    validMorphs.sort();
    var l = validMorphs.length - 1;
    var scaledt = t * l + 1;
    var index = Math.floor(scaledt);
    for (i = 0; i < validMorphs.length; i++) {
      this.points.morphTargetInfluences[validMorphs[i]] = 0;
    }
    var lastIndex = index - 1;
    var leftover = scaledt - index;
    if (lastIndex >= 0) {
      this.points.morphTargetInfluences[lastIndex] = 1 - leftover;
    }
    this.points.morphTargetInfluences[index] = leftover;
    this._time = t;
  });

  return this;

};
