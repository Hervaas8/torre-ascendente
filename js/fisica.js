/* Cinemática propia, sin motor externo. Basada en el salto de tron-final.js
 * y Raycaster de s3-colisiones.js. Separamos física y dibujo para usar paso fijo.
 * El jugador se representa por pies + radio horizontal + altura. */
'use strict';
Torre.FisicaJugador = class {
  constructor(plataformas) {
    this.plataformas = plataformas;
    this.posicion = new THREE.Vector3();
    this.velocidad = new THREE.Vector3();
    this.enSuelo = true;
    this.apoyo = null;
    this.coyote = 0;
    this.bufferSalto = 0;
    this.rayo = new THREE.Raycaster();
    this.abajo = new THREE.Vector3(0,-1,0);
    this.origen = new THREE.Vector3();
    this.reaparecer(0);
  }
  reaparecer(indice) {
    const p = this.plataformas[indice];
    this.posicion.copy(p.grupo.position);
    this.posicion.y = p.altura;
    this.velocidad.set(0,0,0);
    this.enSuelo = true;
    this.apoyo = p;
    this.coyote = Torre.CONFIG.margenSalto;
    this.bufferSalto = 0;
  }
  solicitarSalto() { this.bufferSalto = Torre.CONFIG.margenSalto; }
  dentro(p,x,z,margen = 0) {
    if (p.radio) {
      const apotema = p.radio*Math.cos(Math.PI/p.lados)+margen;
      for (let i = 0; i < p.lados; i++) {
        const normal = (i+.5)*Math.PI*2/p.lados;
        if (x*Math.sin(normal)+z*Math.cos(normal) >= apotema) return false;
      }
      return true;
    }
    return x > p.caja.min.x-margen && x < p.caja.max.x+margen && z > p.caja.min.z-margen && z < p.caja.max.z+margen;
  }
  moverHorizontal(eje,desplazamiento) {
    const c = Torre.CONFIG;
    this.posicion[eje] += desplazamiento;
    const otro = eje === 'x' ? 'z' : 'x';
    for (const p of this.plataformas) {
      // La isla solo actúa como suelo. Su borde conduce a una caída libre.
      if (p.radio) continue;
      // Solo las caras laterales que se solapan verticalmente con el cuerpo.
      if (this.posicion.y >= p.caja.max.y-.001 || this.posicion.y+c.altoJugador <= p.caja.min.y+.001) continue;
      if (this.posicion[otro]+c.radioJugador <= p.caja.min[otro] || this.posicion[otro]-c.radioJugador >= p.caja.max[otro]) continue;
      if (this.posicion[eje]+c.radioJugador <= p.caja.min[eje] || this.posicion[eje]-c.radioJugador >= p.caja.max[eje]) continue;
      if (desplazamiento > 0) this.posicion[eje] = p.caja.min[eje]-c.radioJugador;
      else if (desplazamiento < 0) this.posicion[eje] = p.caja.max[eje]+c.radioJugador;
      this.velocidad[eje] = 0;
    }
    // Núcleo circular sólido; proyectamos hacia fuera para poder deslizar por él.
    const distancia = Math.hypot(this.posicion.x,this.posicion.z);
    const limite = c.radioNucleo+c.radioJugador;
    if (distancia < limite && this.posicion.y < 74 && this.posicion.y+c.altoJugador > -.5) {
      const nx = distancia > .0001 ? this.posicion.x/distancia : 1;
      const nz = distancia > .0001 ? this.posicion.z/distancia : 0;
      this.posicion.x = nx*limite;
      this.posicion.z = nz*limite;
      const normal = this.velocidad.x*nx+this.velocidad.z*nz;
      if (normal < 0) { this.velocidad.x -= normal*nx; this.velocidad.z -= normal*nz; }
    }
  }
  paso(delta,direccion) {
    const c = Torre.CONFIG;
    const eventos = {aterrizaje:null,impacto:0,salto:false};
    this.bufferSalto = Math.max(0,this.bufferSalto-delta);
    this.coyote = this.enSuelo ? c.margenSalto : Math.max(0,this.coyote-delta);
    if (this.bufferSalto > 0 && this.coyote > 0) {
      this.velocidad.y = c.impulsoSalto;
      this.enSuelo = false; this.apoyo = null;
      this.bufferSalto = 0; this.coyote = 0;
      eventos.salto = true;
    }
    const aceleracion = this.enSuelo ? c.aceleracionSuelo : c.aceleracionAire;
    for (const eje of ['x','z']) {
      const objetivo = direccion[eje]*c.velocidad;
      const diferencia = objetivo-this.velocidad[eje];
      this.velocidad[eje] += THREE.MathUtils.clamp(diferencia,-aceleracion*delta,aceleracion*delta);
      this.moverHorizontal(eje,this.velocidad[eje]*delta);
    }
    if (this.enSuelo && this.apoyo && !this.dentro(this.apoyo,this.posicion.x,this.posicion.z)) {
      this.enSuelo = false;
      this.apoyo = null;
    }
    if (this.enSuelo) return eventos;
    const anterior = this.posicion.y;
    const nueva = anterior+this.velocidad.y*delta-.5*c.gravedad*delta*delta;
    this.velocidad.y -= c.gravedad*delta;
    this.posicion.y = nueva;
    if (this.velocidad.y <= 0) {
      // Barrido vertical: el rayo cubre TODO el tramo recorrido en este paso.
      // Nunca ajustamos a una plataforma situada por encima de los pies.
      const candidatos = this.plataformas.filter(p => p.caja.max.y <= anterior+.002 && p.caja.max.y >= nueva-.002 && this.dentro(p,this.posicion.x,this.posicion.z));
      if (candidatos.length) {
        this.origen.set(this.posicion.x,anterior+.01,this.posicion.z);
        this.rayo.set(this.origen,this.abajo);
        this.rayo.far = anterior-nueva+.03;
        const impactos = this.rayo.intersectObjects(candidatos.map(p => p.suelo),false);
        if (impactos.length) {
          const p = candidatos.find(candidato => candidato.suelo === impactos[0].object);
          eventos.impacto = this.velocidad.y;
          eventos.aterrizaje = p;
          this.posicion.y = p.caja.max.y;
          this.velocidad.y = 0;
          this.enSuelo = true;
          this.apoyo = p;
        }
      }
    } else {
      // Golpes con la cara inferior: cancelan el impulso, no atraviesan el techo.
      for (const p of this.plataformas) {
        if (!this.dentro(p,this.posicion.x,this.posicion.z,c.radioJugador)) continue;
        if (anterior+c.altoJugador <= p.caja.min.y+.001 && nueva+c.altoJugador >= p.caja.min.y) {
          this.posicion.y = p.caja.min.y-c.altoJugador;
          this.velocidad.y = 0;
        }
      }
    }
    return eventos;
  }
};
