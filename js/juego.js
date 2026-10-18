/* Aplicación: ciclo init / loadScene / update / render de los seminarios.
 * Referencias: practica3.js (OrbitControls), practica4.js (teclado / GUI),
 * tron-final.js (cámara suavizada y salto), s3-cam2.js (primera persona),
 * pres (3).pdf (delta temporal). */
'use strict';
Torre.Juego = class {
  constructor() {
    this.estado = 'cargando';
    this.tiempo = 0;
    this.tiempoVisual = 0;
    this.caidas = 0;
    this.checkpoint = 0;
    this.maxPlataforma = 0;
    this.ultimaPlataforma = 0;
    this.maxAltura = 0;
    this.teclas = new Set();
    this.acumulador = 0;
    this.reloj = new THREE.Clock();
    this.direccion = new THREE.Vector3();
    this.objetivoCamara = new THREE.Vector3();
    this.mirada = new THREE.Vector3();
    this.yaw = Math.PI / 2 + .35;
    this.desfaseYaw = .35;
    this.elevacion = 6;
    this.primeraPersona = false;
    this.yawPrimera = 0;
    this.inclinacionPrimera = -.18;
    this.arrastrando = false;
    this.ultimoHud = 0;
    this.ultimoAviso = 0;
    this.ayudaAnterior = null;
    this.inspeccionAnterior = null;
    this.opciones = {sombras:true,alambrico:false,ejes:false,colisiones:false,camaraAutomatica:true,distancia:12,intensidad:1};
    this.dom = {};
    ['inicio','hud','jugar','pausa','ayuda','victoria','aviso','altura','altura-meta','checkpoint-texto','inspeccion-aviso','cambiar-camara'].forEach(id => { this.dom[id] = document.getElementById(id); });
    this.iniciar();
  }
  iniciar() {
    this.renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    this.renderer.setSize(window.innerWidth,window.innerHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    document.getElementById('escena').appendChild(this.renderer.domElement);
    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(48,window.innerWidth/window.innerHeight,.1,240);
    this.camara.position.set(65,45,82);
    this.camara.lookAt(-10,34,0);
    this.orbita = new THREE.OrbitControls(this.camara,this.renderer.domElement);
    this.orbita.enabled = false;
    this.orbita.enableDamping = true;
    this.orbita.dampingFactor = .08;
    this.orbita.minDistance = 5;
    this.orbita.maxDistance = 130;
    this.orbita.maxPolarAngle = Math.PI * .88;
    const gestor = new THREE.LoadingManager();
    let falloCarga = false;
    gestor.onError = ruta => {
      falloCarga = true;
      Torre.mostrarError('No se ha podido cargar ' + ruta + '. Sirve la carpeta completa con Live Server o iniciar.ps1; consulta README.md.');
    };
    gestor.onLoad = () => {
      if (falloCarga || !this.personaje.listo) return;
      this.estado = 'inicio';
      this.dom.jugar.disabled = false;
      this.dom.jugar.textContent = 'Jugar';
    };
    this.mundo = new Torre.Mundo(this.escena,this.renderer,gestor);
    this.personaje = new Torre.Personaje(gestor);
    this.escena.add(this.personaje.raiz);
    this.fisica = new Torre.FisicaJugador(this.mundo.superficies);
    this.crearInterfazGrafica();
    this.crearEventos();
    this.redimensionar();
    this.bucle = this.bucle.bind(this);
    requestAnimationFrame(this.bucle);
  }
  crearInterfazGrafica() {
    this.gui = new lil.GUI({title:'GPC · Controles gráficos',width:260});
    this.gui.add(this.opciones,'sombras').name('Sombras').onChange(valor => { this.renderer.shadowMap.enabled = valor; });
    this.gui.add(this.opciones,'alambrico').name('Vista alámbrica').onChange(valor => {
      this.mundo.materiales.forEach(m => { m.wireframe = valor; });
      this.personaje.raiz.traverse(o => { if (o.isMesh) o.material.wireframe = valor; });
    });
    this.gui.add(this.opciones,'ejes').name('Ejes del jugador').onChange(valor => { this.mundo.ejes.visible = valor; });
    this.gui.add(this.opciones,'colisiones').name('Volúmenes de colisión').onChange(valor => { this.mundo.ayudas.visible = valor; this.cajaJugador.visible = valor; });
    this.gui.add(this.opciones,'camaraAutomatica').name('Cámara automática');
    this.gui.add(this.opciones,'distancia',8,20,.5).name('Distancia de cámara');
    this.gui.add(this.opciones,'intensidad',.3,2,.1).name('Intensidad del sol');
    const acciones = {inspeccionar:() => this.alternarInspeccion()};
    this.gui.add(acciones,'inspeccionar').name('Inspeccionar torre · C');
    this.gui.hide();
    this.volumenJugador = new THREE.Box3();
    this.cajaJugador = new THREE.Box3Helper(this.volumenJugador,0xffd897);
    this.cajaJugador.visible = false;
    this.escena.add(this.cajaJugador);
  }
  crearEventos() {
    const boton = (id,accion) => document.getElementById(id).addEventListener('click',accion);
    boton('jugar',() => this.nuevaPartida());
    boton('pausar',() => this.pausar());
    boton('continuar',() => this.continuar());
    boton('reiniciar',() => this.nuevaPartida());
    boton('otra-partida',() => this.nuevaPartida());
    boton('ayuda-inicio',() => this.abrirAyuda());
    boton('ayuda-juego',() => this.abrirAyuda());
    boton('ayuda-pausa',() => this.abrirAyuda());
    boton('cerrar-ayuda',() => this.cerrarAyuda());
    boton('cambiar-camara',() => this.alternarCamara());
    window.addEventListener('resize',() => this.redimensionar());
    window.addEventListener('keydown',evento => this.pulsarTecla(evento));
    window.addEventListener('keyup',evento => this.teclas.delete(evento.code));
    window.addEventListener('blur',() => { this.teclas.clear(); if (this.estado === 'jugando') this.pausar(); });
    document.addEventListener('visibilitychange',() => { if (document.hidden && this.estado === 'jugando') this.pausar(); });
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown',evento => {
      if (this.estado !== 'jugando' || evento.button !== 0) return;
      this.arrastrando = true;
      this.ultimoPuntero = {x:evento.clientX,y:evento.clientY};
      canvas.setPointerCapture(evento.pointerId);
    });
    canvas.addEventListener('pointermove',evento => {
      if (!this.arrastrando || this.estado !== 'jugando') return;
      const dx = evento.clientX-this.ultimoPuntero.x;
      const dy = evento.clientY-this.ultimoPuntero.y;
      if (this.primeraPersona) {
        this.yawPrimera -= dx*.006;
        this.inclinacionPrimera = THREE.MathUtils.clamp(this.inclinacionPrimera-dy*.004,-Math.PI*.45,Math.PI*.4);
      } else {
        this.desfaseYaw -= dx*.006;
        this.yaw -= dx*.006;
        this.elevacion = THREE.MathUtils.clamp(this.elevacion+dy*.035,2.5,12);
      }
      this.ultimoPuntero = {x:evento.clientX,y:evento.clientY};
    });
    const soltar = () => { this.arrastrando = false; };
    canvas.addEventListener('pointerup',soltar);
    canvas.addEventListener('pointercancel',soltar);
    canvas.addEventListener('lostpointercapture',soltar);
    canvas.addEventListener('wheel',evento => {
      if (this.estado !== 'jugando') return;
      evento.preventDefault();
      if (this.primeraPersona) return;
      this.opciones.distancia = THREE.MathUtils.clamp(this.opciones.distancia+evento.deltaY*.008,8,20);
      this.gui.controllersRecursive().forEach(control => control.updateDisplay());
    },{passive:false});
    canvas.addEventListener('webglcontextlost',evento => {
      evento.preventDefault();
      this.teclas.clear();
      this.estado = 'error';
      Torre.mostrarError('El navegador ha perdido el contexto gráfico. Recarga la página para volver a iniciar el juego.');
    });
  }
  pulsarTecla(evento) {
    // Los controles de lil-gui conservan sus teclas y no mueven al personaje.
    if (['INPUT','SELECT','TEXTAREA'].includes(evento.target.tagName)) return;
    if (evento.code === 'Tab') { this.atraparFoco(evento); return; }
    const codigos = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyQ','KeyE','KeyR','KeyP','Escape','KeyH','KeyC','KeyG','KeyF'];
    if (!codigos.includes(evento.code)) return;
    // Espacio sobre un botón mantiene la activación accesible del navegador.
    if (evento.code === 'Space' && this.estado !== 'jugando' && evento.target.tagName === 'BUTTON') return;
    evento.preventDefault();
    if (evento.repeat) return;
    if (evento.code === 'KeyG') { this.gui.show(this.gui._hidden); return; }
    if (evento.code === 'KeyH') { this.estado === 'ayuda' ? this.cerrarAyuda() : this.abrirAyuda(); return; }
    if (evento.code === 'KeyC') { this.alternarInspeccion(); return; }
    if (evento.code === 'KeyF') { this.alternarCamara(); return; }
    if (evento.code === 'KeyP' || evento.code === 'Escape') {
      if (this.estado === 'jugando') this.pausar();
      else if (this.estado === 'pausa') this.continuar();
      else if (this.estado === 'ayuda') this.cerrarAyuda();
      else if (this.estado === 'inspeccion') this.alternarInspeccion();
      return;
    }
    if (this.estado !== 'jugando') return;
    this.teclas.add(evento.code);
    if (evento.code === 'Space') this.fisica.solicitarSalto();
    if (evento.code === 'KeyR') this.reaparecer(false);
  }
  atraparFoco(evento) {
    const modal = document.querySelector('.pantalla-modal:not([hidden])');
    if (!modal) return;
    const elementos = [...modal.querySelectorAll('button,a[href]')];
    const primero = elementos[0], ultimo = elementos[elementos.length-1];
    if (evento.shiftKey && (document.activeElement === primero || !modal.contains(document.activeElement))) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && (document.activeElement === ultimo || !modal.contains(document.activeElement))) { evento.preventDefault(); primero.focus(); }
  }
  enfocar(id) { document.getElementById(id).focus({preventScroll:true}); }
  nuevaPartida() {
    this.estado = 'jugando';
    this.tiempo = 0; this.caidas = 0; this.checkpoint = 0;
    this.maxPlataforma = 0; this.maxAltura = 0;
    this.ultimaPlataforma = 0;
    this.acumulador = 0; this.ultimoHud = 0;
    this.teclas.clear();
    this.orbita.enabled = false;
    this.mundo.reiniciar();
    this.fisica.reaparecer(0);
    this.personaje.reiniciar();
    this.desfaseYaw = .35; this.elevacion = 6;
    if (this.primeraPersona) this.orientarPrimeraPersona();
    this.actualizarVistaCamara();
    ['inicio','pausa','ayuda','victoria','inspeccion-aviso'].forEach(id => { this.dom[id].hidden = true; });
    this.dom.hud.hidden = false;
    document.body.classList.add('playing');
    document.activeElement.blur();
    this.ajustarCamara(true);
    this.actualizarHud();
    this.dom.aviso.classList.remove('visible');
  }
  pausar() {
    if (this.estado !== 'jugando') return;
    this.estado = 'pausa';
    this.teclas.clear(); this.acumulador = 0; this.fisica.bufferSalto = 0;
    this.dom.pausa.hidden = false;
    this.enfocar('continuar');
  }
  continuar() {
    if (this.estado !== 'pausa') return;
    this.estado = 'jugando';
    this.dom.pausa.hidden = true;
    this.teclas.clear(); this.acumulador = 0;
    document.activeElement.blur();
  }
  abrirAyuda() {
    if (!['inicio','jugando','pausa','inspeccion','victoria'].includes(this.estado)) return;
    this.ayudaAnterior = this.estado;
    this.estado = 'ayuda';
    this.teclas.clear(); this.acumulador = 0; this.fisica.bufferSalto = 0;
    this.dom.pausa.hidden = true;
    this.dom.victoria.hidden = true;
    this.dom.ayuda.hidden = false;
    this.orbita.enabled = false;
    this.enfocar('cerrar-ayuda');
  }
  cerrarAyuda() {
    if (this.estado !== 'ayuda') return;
    this.estado = this.ayudaAnterior;
    this.dom.ayuda.hidden = true;
    this.dom.pausa.hidden = this.estado !== 'pausa';
    this.dom.victoria.hidden = this.estado !== 'victoria';
    this.orbita.enabled = this.estado === 'inspeccion';
    if (this.estado === 'pausa') this.enfocar('continuar');
    else if (this.estado === 'victoria') this.enfocar('otra-partida');
    else if (this.estado === 'inicio') this.enfocar('jugar');
    else document.activeElement.blur();
  }
  alternarInspeccion() {
    if (this.estado === 'inspeccion') {
      this.estado = this.inspeccionAnterior;
      this.orbita.enabled = false;
      this.dom['inspeccion-aviso'].hidden = true;
      this.dom.pausa.hidden = this.estado !== 'pausa';
      this.dom.victoria.hidden = this.estado !== 'victoria';
      this.dom.inicio.hidden = this.estado !== 'inicio';
      this.actualizarVistaCamara();
      if (['jugando','pausa','victoria'].includes(this.estado)) this.ajustarCamara(true);
      if (this.estado === 'pausa') this.enfocar('continuar');
      if (this.estado === 'victoria') this.enfocar('otra-partida');
      return;
    }
    if (!['jugando','pausa','inicio','victoria'].includes(this.estado)) return;
    this.inspeccionAnterior = this.estado;
    this.estado = 'inspeccion';
    this.actualizarVistaCamara();
    this.teclas.clear(); this.acumulador = 0; this.fisica.bufferSalto = 0;
    ['pausa','victoria','inicio'].forEach(id => { this.dom[id].hidden = true; });
    this.dom['inspeccion-aviso'].hidden = false;
    this.camara.position.set(55,42,70);
    this.orbita.target.set(0,34,0);
    this.orbita.enabled = true;
    this.orbita.update();
    document.activeElement.blur();
  }
  alternarCamara() {
    if (!['jugando','pausa'].includes(this.estado)) return;
    this.primeraPersona = !this.primeraPersona;
    this.arrastrando = false;
    if (this.primeraPersona) this.orientarPrimeraPersona();
    this.actualizarVistaCamara();
    this.ajustarCamara(true);
    if (this.estado === 'jugando') document.activeElement.blur();
  }
  orientarPrimeraPersona() {
    // Al cambiar o reaparecer, se mira hacia el siguiente salto de la ruta.
    const indice = this.fisica.apoyo?.indice ?? this.ultimaPlataforma;
    const siguiente = indice >= Torre.CONFIG.plataformas ? this.mundo.cima.grupo.position :
      this.mundo.plataformas[indice+1].grupo.position;
    const dx = siguiente.x-this.fisica.posicion.x;
    const dz = siguiente.z-this.fisica.posicion.z;
    this.yawPrimera = Math.hypot(dx,dz) > .01 ? Math.atan2(-dx,-dz) : this.yaw;
    this.inclinacionPrimera = -.18;
  }
  actualizarVistaCamara() {
    const enJuego = ['jugando','pausa','victoria'].includes(this.estado) ||
      (this.estado === 'ayuda' && ['jugando','pausa','victoria'].includes(this.ayudaAnterior));
    const primera = this.primeraPersona && enJuego;
    // Ocultar el modelo evita mirar a través de su cabeza. En inspección se ve.
    this.personaje.raiz.visible = !primera;
    this.camara.fov = primera ? 75 : 48;
    this.camara.near = primera ? .05 : .1;
    this.camara.updateProjectionMatrix();
    const boton = this.dom['cambiar-camara'];
    boton.textContent = this.primeraPersona ? '1ª persona' : '3ª persona';
    boton.setAttribute('aria-pressed',String(this.primeraPersona));
    const accion = this.primeraPersona ? 'Cambiar a tercera persona (F)' : 'Cambiar a primera persona (F)';
    boton.title = accion;
    boton.setAttribute('aria-label',accion);
  }
  reaparecer(esCaida) {
    if (esCaida) this.caidas++;
    this.fisica.reaparecer(this.checkpoint);
    this.ultimaPlataforma = this.checkpoint;
    this.personaje.reiniciar();
    this.teclas.clear();
    this.acumulador = 0;
    if (this.primeraPersona) this.orientarPrimeraPersona();
    this.ajustarCamara(true);
    this.actualizarHud();
    this.avisar('Vuelves al punto de control.');
  }
  aterrizar(plataforma,impacto) {
    this.personaje.aterrizar(impacto);
    if (plataforma.esCima) {
      this.ganar();
      return;
    }
    this.ultimaPlataforma = plataforma.indice;
    this.maxPlataforma = Math.max(this.maxPlataforma,plataforma.indice);
    this.mundo.marcarPlataforma(plataforma.indice);
    if (plataforma.checkpoint && plataforma.indice > this.checkpoint) {
      this.checkpoint = plataforma.indice;
      this.avisar(plataforma.indice === Torre.CONFIG.plataformas
        ? 'Último punto de control. Salta hacia la cima de la torre.'
        : 'Punto de control guardado');
    }
  }
  ganar() {
    this.estado = 'victoria';
    this.teclas.clear();
    this.maxAltura = this.mundo.cima.altura;
    let record = this.tiempo;
    // El juego también funciona si el navegador bloquea localStorage.
    try {
      const anterior = Number(localStorage.getItem('torre-ascendente-record-cima'));
      record = anterior > 0 ? Math.min(anterior,this.tiempo) : this.tiempo;
      localStorage.setItem('torre-ascendente-record-cima',String(record));
    } catch (_) { /* El récord se conserva solo durante esta victoria. */ }
    document.getElementById('tiempo-final').textContent = Torre.formatoTiempo(this.tiempo);
    document.getElementById('caidas-final').textContent = this.caidas;
    document.getElementById('record-final').textContent = Torre.formatoTiempo(record);
    this.dom.victoria.hidden = false;
    this.actualizarHud();
    this.enfocar('otra-partida');
  }
  avisar(texto) {
    this.dom.aviso.textContent = texto;
    this.dom.aviso.classList.add('visible');
    this.ultimoAviso = this.tiempoVisual;
  }
  leerDireccion(delta) {
    let x = Number(this.teclas.has('KeyD') || this.teclas.has('ArrowRight'))-Number(this.teclas.has('KeyA') || this.teclas.has('ArrowLeft'));
    let z = Number(this.teclas.has('KeyW') || this.teclas.has('ArrowUp'))-Number(this.teclas.has('KeyS') || this.teclas.has('ArrowDown'));
    const giro = Number(this.teclas.has('KeyE'))-Number(this.teclas.has('KeyQ'));
    if (this.primeraPersona) this.yawPrimera -= giro*delta*1.7;
    else {
      this.desfaseYaw += giro*delta*1.7;
      this.yaw += giro*delta*1.7;
    }
    if (x || z) { const largo = Math.hypot(x,z); x /= largo; z /= largo; }
    // Proyección de los ejes de cámara sobre XZ; evita correr más en diagonal.
    const yaw = this.primeraPersona ? this.yawPrimera : this.yaw;
    this.direccion.set(Math.cos(yaw)*x-Math.sin(yaw)*z,0,-Math.sin(yaw)*x-Math.cos(yaw)*z);
  }
  ajustarCamara(inmediata = false,delta = 1 / 60) {
    const p = this.fisica.posicion;
    if (this.primeraPersona) {
      // Como en s3-cam2.js: posición del jugador y lookAt hacia delante.
      // Se sigue la física directamente para que los ojos no atraviesen el suelo.
      this.camara.position.set(p.x,p.y+Torre.CONFIG.altoJugador*.9,p.z);
      const horizontal = Math.cos(this.inclinacionPrimera);
      this.mirada.copy(this.camara.position).add(new THREE.Vector3(
        -Math.sin(this.yawPrimera)*horizontal,Math.sin(this.inclinacionPrimera),
        -Math.cos(this.yawPrimera)*horizontal
      ));
      this.camara.lookAt(this.mirada);
      return;
    }
    if (this.opciones.camaraAutomatica || inmediata) {
      const yawObjetivo = Math.atan2(p.x,p.z)+this.desfaseYaw;
      this.yaw = inmediata ? yawObjetivo : Torre.lerpAngulo(this.yaw,yawObjetivo,1-Math.exp(-delta*3));
    }
    const distancia = this.opciones.distancia;
    this.objetivoCamara.set(p.x+Math.sin(this.yaw)*distancia,p.y+this.elevacion,p.z+Math.cos(this.yaw)*distancia);
    // Evita que una rotación manual sitúe la cámara dentro del núcleo de la torre.
    const radio = Math.hypot(this.objetivoCamara.x,this.objetivoCamara.z);
    if (radio < 4) { this.objetivoCamara.x *= 4 / Math.max(radio,.01); this.objetivoCamara.z *= 4 / Math.max(radio,.01); }
    const objetivoMirada = new THREE.Vector3(p.x,p.y+1.2,p.z);
    if (inmediata) { this.camara.position.copy(this.objetivoCamara); this.mirada.copy(objetivoMirada); }
    else {
      this.camara.position.lerp(this.objetivoCamara,1-Math.exp(-delta*7));
      this.mirada.lerp(objetivoMirada,1-Math.exp(-delta*10));
    }
    // Raycaster también evita que el núcleo o una plataforma tapen al personaje.
    this.escena.updateMatrixWorld(true);
    const haciaCamara = this.camara.position.clone().sub(objetivoMirada);
    const largo = haciaCamara.length();
    const rayo = new THREE.Raycaster(objetivoMirada,haciaCamara.normalize(),.3,largo);
    const obstaculos = this.mundo.plataformas.map(plataforma => plataforma.suelo);
    // El núcleo visible de cada tramo está registrado por nombre de su padre.
    this.mundo.grupo.getObjectByName('torre').traverse(o => { if (o.isMesh && o.geometry.type === 'CylinderGeometry') obstaculos.push(o); });
    const intersecciones = rayo.intersectObjects(obstaculos,false);
    if (intersecciones.length && intersecciones[0].distance < largo-.2) {
      this.camara.position.copy(objetivoMirada).addScaledVector(haciaCamara,Math.max(.6,intersecciones[0].distance-.25));
    }
    this.camara.lookAt(this.mirada);
  }
  actualizarHud() {
    const c = Torre.CONFIG;
    const altura = THREE.MathUtils.clamp(this.fisica.posicion.y,0,this.mundo.cima.altura);
    // Los vértices de las mallas pueden situar un suelo unas milésimas más abajo.
    this.dom.altura.textContent = Math.floor(altura+.001);
    this.dom['altura-meta'].textContent = this.mundo.cima.altura;
    this.dom['checkpoint-texto'].textContent = 'Control: '+(this.checkpoint === 0 ? 'Base' : this.checkpoint*c.escalon+' m');
  }
  redimensionar() {
    this.renderer.setSize(window.innerWidth,window.innerHeight);
    this.camara.aspect = window.innerWidth/window.innerHeight;
    this.camara.updateProjectionMatrix();
  }
  bucle() {
    requestAnimationFrame(this.bucle);
    // Paso fijo de 120 Hz con acumulador. El render es independiente de la física.
    const delta = Math.min(this.reloj.getDelta(),.05);
    this.tiempoVisual += delta;
    if (this.estado === 'jugando') {
      this.tiempo += delta;
      this.leerDireccion(delta);
      this.acumulador += delta;
      while (this.acumulador >= Torre.CONFIG.pasoFijo && this.estado === 'jugando') {
        const eventos = this.fisica.paso(Torre.CONFIG.pasoFijo,this.direccion);
        this.acumulador -= Torre.CONFIG.pasoFijo;
        if (eventos.salto) this.personaje.saltar();
        if (eventos.aterrizaje) this.aterrizar(eventos.aterrizaje,eventos.impacto);
        this.maxAltura = Math.max(this.maxAltura,THREE.MathUtils.clamp(this.fisica.posicion.y,0,this.mundo.cima.altura));
        const limiteCaida = Math.max(-2,this.checkpoint*Torre.CONFIG.escalon-11);
        if (this.fisica.posicion.y < limiteCaida || Math.hypot(this.fisica.posicion.x,this.fisica.posicion.z) > 24) this.reaparecer(true);
      }
      this.ajustarCamara(false,delta);
    } else if (this.estado === 'inicio' || this.estado === 'cargando') {
      const angulo = .9+Math.sin(this.tiempoVisual*.06)*.13;
      this.camara.position.set(Math.cos(angulo)*105,45,Math.sin(angulo)*105);
      this.camara.lookAt(window.innerWidth > 700 ? -20 : 0,34,0);
    } else if (this.estado === 'inspeccion') this.orbita.update();
    const animacionDelta = ['jugando','inicio','cargando','victoria'].includes(this.estado) ? delta : 0;
    this.personaje.actualizar(animacionDelta,this.fisica,this.tiempoVisual);
    this.mundo.actualizar(delta,this.tiempoVisual,this.fisica.posicion,this.estado !== 'inicio' && this.estado !== 'cargando',this.opciones.intensidad);
    const c = Torre.CONFIG;
    this.volumenJugador.min.set(this.fisica.posicion.x-c.radioJugador,this.fisica.posicion.y,this.fisica.posicion.z-c.radioJugador);
    this.volumenJugador.max.set(this.fisica.posicion.x+c.radioJugador,this.fisica.posicion.y+c.altoJugador,this.fisica.posicion.z+c.radioJugador);
    if (this.tiempoVisual-this.ultimoAviso > 4) this.dom.aviso.classList.remove('visible');
    if (this.tiempoVisual-this.ultimoHud > .1) { this.actualizarHud(); this.ultimoHud = this.tiempoVisual; }
    this.renderer.render(this.escena,this.camara);
  }
};
Torre.mostrarError = function(texto) {
  document.getElementById('error-texto').textContent = texto;
  document.getElementById('error').hidden = false;
};
try {
  if (location.protocol === 'file:') Torre.mostrarError('Abre el proyecto con un servidor local para poder cargar las texturas. En VS Code: clic derecho en index.html → Open with Live Server. También puedes ejecutar iniciar.ps1.');
  else window.juego = new Torre.Juego();
} catch (error) {
  console.error(error);
  Torre.mostrarError('No se ha podido crear la escena WebGL. Comprueba que el navegador permite aceleración gráfica y que la carpeta lib está completa. Detalle: '+error.message);
}
