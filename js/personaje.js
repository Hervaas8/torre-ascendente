/* Modelo gratuito RobotExpressive, de Tomás Laulhé (Quaternius), CC0 1.0.
 * Carga con GLTFLoader y animación con AnimationMixer, como ej-loader.js
 * y pres (3).pdf, pp. 14–15. Procedencia en assets/modelos/README_ORIGINAL.md. */
'use strict';
Torre.Personaje = class {
  constructor(gestor) {
    this.raiz = new THREE.Group();
    this.raiz.name = 'jugador';
    this.cuerpo = new THREE.Group();
    this.cuerpo.name = 'contenedor-modelo';
    this.raiz.add(this.cuerpo);
    this.listo = false;
    this.mixer = null;
    this.acciones = {};
    this.animacion = null;
    this.compresion = 0;
    this.nuevoSalto = false;
    new THREE.GLTFLoader(gestor).load('assets/modelos/RobotExpressive.glb',gltf => {
      this.modelo = gltf.scene;
      this.modelo.name = 'robot-expressive';
      this.cuerpo.add(this.modelo);
      this.modelo.traverse(objeto => {
        if (!objeto.isMesh) return;
        objeto.castShadow = true;
        objeto.receiveShadow = true;
        // Las extremidades pueden salir del volumen estático durante una animación.
        objeto.frustumCulled = false;
      });
      this.mixer = new THREE.AnimationMixer(this.modelo);
      gltf.animations.forEach(clip => {
        const accion = this.mixer.clipAction(clip);
        if (clip.name === 'Jump' || clip.name === 'WalkJump') {
          accion.setLoop(THREE.LoopOnce,1);
          accion.clampWhenFinished = true;
        }
        this.acciones[clip.name] = accion;
      });
      const faltan = ['Idle','Walking','Running','WalkJump'].filter(nombre => !this.acciones[nombre]);
      if (faltan.length) {
        Torre.mostrarError('El modelo no contiene las animaciones necesarias: '+faltan.join(', '));
        return;
      }
      this.cambiarAnimacion('Idle',0);
      this.mixer.update(0);
      // En r140 Box3.setFromObject no aplica el esqueleto a los vértices.
      // Las manos en pose de enlace desplazarían erróneamente el centro del robot.
      const caja = this.obtenerCajaVisible();
      const centro = caja.getCenter(new THREE.Vector3());
      const escala = Torre.CONFIG.altoJugador/caja.getSize(new THREE.Vector3()).y;
      this.modelo.scale.multiplyScalar(escala);
      this.modelo.position.set(-centro.x*escala,-caja.min.y*escala,-centro.z*escala);
      this.modelo.updateMatrixWorld(true);
      this.listo = true;
    });
  }
  obtenerCajaVisible() {
    // Solo se calcula al cargar y en las pruebas, no en cada fotograma.
    this.raiz.updateMatrixWorld(true);
    const inversa = this.cuerpo.matrixWorld.clone().invert();
    const caja = new THREE.Box3();
    const punto = new THREE.Vector3();
    this.modelo.traverse(objeto => {
      if (!objeto.isMesh || !objeto.visible) return;
      if (objeto.isSkinnedMesh) objeto.skeleton.update();
      const posiciones = objeto.geometry.attributes.position;
      for (let i = 0; i < posiciones.count; i++) {
        punto.fromBufferAttribute(posiciones,i);
        if (objeto.isSkinnedMesh) objeto.boneTransform(i,punto);
        punto.applyMatrix4(objeto.matrixWorld).applyMatrix4(inversa);
        caja.expandByPoint(punto);
      }
    });
    return caja;
  }
  cambiarAnimacion(nombre,duracion = .16) {
    if (nombre === this.animacion) return;
    const anterior = this.acciones[this.animacion];
    const siguiente = this.acciones[nombre];
    siguiente.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    if (nombre === 'WalkJump') siguiente.setDuration(.85);
    siguiente.play();
    if (anterior) anterior.crossFadeTo(siguiente,duracion,false);
    // Con duración cero se aplica la pose completa ya en mixer.update(0).
    // Un fadeIn(0) deja peso cero en ese instante y altera la medida inicial.
    else if (duracion > 0) siguiente.fadeIn(duracion);
    this.animacion = nombre;
  }
  aterrizar(velocidad) { this.compresion = Math.min(.1,Math.abs(velocidad)*.007); }
  saltar() { this.nuevoSalto = true; }
  reiniciar() {
    this.compresion = 0;
    this.cuerpo.scale.set(1,1,1);
    this.nuevoSalto = false;
    if (!this.mixer) return;
    this.mixer.stopAllAction();
    this.animacion = null;
    this.cambiarAnimacion('Idle',0);
    this.mixer.update(0);
  }
  actualizar(delta,fisica) {
    this.raiz.position.copy(fisica.posicion);
    if (!this.listo) return;
    const rapidez = Math.hypot(fisica.velocidad.x,fisica.velocidad.z);
    const factor = 1-Math.exp(-12*delta);
    if (rapidez > .15) {
      const angulo = Math.atan2(fisica.velocidad.x,fisica.velocidad.z);
      this.raiz.rotation.y = Torre.lerpAngulo(this.raiz.rotation.y,angulo,factor);
    }
    if (delta > 0) {
      const estado = !fisica.enSuelo ? 'WalkJump' : rapidez > 3.8 ? 'Running' : rapidez > .25 ? 'Walking' : 'Idle';
      const repetirSalto = estado === 'WalkJump' && this.animacion === 'WalkJump' && this.nuevoSalto;
      this.cambiarAnimacion(estado,estado === 'WalkJump' ? .08 : .16);
      if (repetirSalto) {
        this.acciones.WalkJump.reset().setDuration(.85).play();
      }
      if (estado === 'Running') this.acciones.Running.setEffectiveTimeScale(THREE.MathUtils.clamp(rapidez/Torre.CONFIG.velocidad,.65,1.2));
      if (estado === 'Walking') this.acciones.Walking.setEffectiveTimeScale(THREE.MathUtils.clamp(rapidez/2.8,.5,1.4));
      this.mixer.update(delta);
      this.nuevoSalto = false;
    }
    this.compresion = THREE.MathUtils.lerp(this.compresion,0,1-Math.exp(-14*delta));
    this.cuerpo.scale.y = 1-this.compresion;
  }
};
