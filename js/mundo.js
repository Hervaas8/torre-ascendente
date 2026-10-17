/* Escena y materiales: s2-grafo.js, practica5.js y P5_LucesMateriales.
 * Todo el escenario se genera con geometrías de Three.js y las texturas del curso. */
'use strict';
Torre.Mundo = class {
  constructor(escena, renderer, gestor) {
    this.escena = escena;
    this.renderer = renderer;
    this.plataformas = [];
    this.balizas = [];
    this.nubes = [];
    this.materiales = [];
    this.colores = {};
    this.grupo = new THREE.Group();
    this.grupo.name = 'mundo';
    escena.add(this.grupo);
    this.texturas = {};
    const cargador = new THREE.TextureLoader(gestor);
    ['grass.png','wood512.jpg','metal_128.jpg','pisometalico_1024.jpg'].forEach(nombre => {
      const textura = cargador.load('assets/texturas/' + nombre);
      textura.encoding = THREE.sRGBEncoding;
      textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
      textura.repeat.set(2,2);
      if (nombre === 'grass.png') textura.repeat.set(10,10);
      textura.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
      this.texturas[nombre] = textura;
    });
    this.crearLuces();
    this.crearIsla();
    this.crearTorre();
    this.crearPlataformas();
    this.crearAtmosfera();
    this.superficies = [...this.plataformas,{
      indice:0,grupo:this.grupo,suelo:this.sueloIsla,altura:-.1,
      checkpoint:false,zona:0,radio:14,lados:12
    }];
    this.ejes = new THREE.AxesHelper(5);
    this.ejes.visible = false;
    escena.add(this.ejes);
    this.ayudas = new THREE.Group();
    this.ayudas.name = 'volumenes-colision';
    this.ayudas.visible = false;
    escena.add(this.ayudas);
    this.grupo.updateMatrixWorld(true);
    this.superficies.forEach(p => {
      p.caja = new THREE.Box3().setFromObject(p.suelo);
      this.ayudas.add(new THREE.Box3Helper(p.caja,0xb2edca));
    });
    const nucleo = new THREE.Mesh(new THREE.CylinderGeometry(Torre.CONFIG.radioNucleo,Torre.CONFIG.radioNucleo,75,24),new THREE.MeshBasicMaterial({color:0xffad79,wireframe:true}));
    nucleo.position.y = 36;
    this.ayudas.add(nucleo);
  }
  material(tipo,parametros) {
    const material = new THREE[tipo](parametros);
    this.materiales.push(material);
    return material;
  }
  malla(geometria,material,posicion,padre = this.grupo) {
    const m = new THREE.Mesh(geometria,material);
    m.position.set(...posicion);
    m.castShadow = true;
    m.receiveShadow = true;
    padre.add(m);
    return m;
  }
  crearLuces() {
    this.ambiente = new THREE.AmbientLight(0xa4c7c7,.42);
    this.sol = new THREE.DirectionalLight(0xffedc5,.9);
    this.sol.position.set(25,46,18);
    this.sol.target.position.set(0,20,0);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048,2048);
    Object.assign(this.sol.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:100});
    this.sol.shadow.normalBias = .035;
    this.sol.shadow.bias = -.00015;
    this.foco = new THREE.SpotLight(0xb2edca,.5,36,Math.PI / 5,.6,1);
    this.foco.castShadow = true;
    this.foco.shadow.mapSize.set(1024,1024);
    this.foco.shadow.normalBias = .03;
    this.relleno = new THREE.HemisphereLight(0xc6e6ed,0x445348,.28);
    this.escena.add(this.ambiente,this.sol,this.sol.target,this.foco,this.foco.target,this.relleno);
  }
  crearIsla() {
    const isla = new THREE.Group();
    isla.name = 'isla-de-partida';
    this.grupo.add(isla);
    const roca = this.material('MeshLambertMaterial',{color:0x697a70});
    const hierba = this.material('MeshLambertMaterial',{color:0x718f79,map:this.texturas['grass.png']});
    this.malla(new THREE.CylinderGeometry(14,10,5,12),roca,[0,-3.2,0],isla);
    this.malla(new THREE.ConeGeometry(10,11,12),roca,[0,-10.9,0],isla).rotation.z = Math.PI;
    this.sueloIsla = this.malla(new THREE.CylinderGeometry(14,14,.7,12),hierba,[0,-.45,0],isla);
    // La superficie de la isla también es sólida; su contorno es un dodecágono.
    const tronco = this.material('MeshLambertMaterial',{color:0x665f49});
    const hojas = [0x496e5e,0x66846a,0x7b9678].map(color => this.material('MeshLambertMaterial',{color}));
    for (let i = 0; i < 16; i++) {
      const angulo = i / 16 * Math.PI * 2;
      const radio = 11.7 + Math.sin(i * 7) * .8;
      const arbol = new THREE.Group();
      arbol.position.set(Math.cos(angulo)*radio,-.1,Math.sin(angulo)*radio);
      const alto = 1.8 + (i % 4) * .5;
      this.malla(new THREE.CylinderGeometry(.12,.17,alto,6),tronco,[0,alto/2,0],arbol);
      this.malla(new THREE.ConeGeometry(.85,alto*1.3,6),hojas[i%3],[0,alto,0],arbol);
      this.malla(new THREE.ConeGeometry(.6,alto*.9,6),hojas[(i+1)%3],[0,alto*1.55,0],arbol);
      isla.add(arbol);
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = 10 + Math.sin(i) * 1.2;
      const piedra = this.malla(new THREE.DodecahedronGeometry(.35 + i%3*.15),roca,[Math.cos(a)*r,.1,Math.sin(a)*r],isla);
      piedra.scale.y = .7;
    }
    // Islas lejanas: referencias de escala y profundidad, sin colisiones.
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const r = 40 + i % 3 * 13;
      const remota = new THREE.Group();
      remota.position.set(Math.cos(a)*r,-5 + i%3*9,Math.sin(a)*r);
      this.malla(new THREE.CylinderGeometry(4,2.3,3,5),roca,[0,-1.7,0],remota);
      this.malla(new THREE.ConeGeometry(2.3,6,5),roca,[0,-6.2,0],remota).rotation.z = Math.PI;
      this.malla(new THREE.CylinderGeometry(4,4,.3,5),hierba,[0,0,0],remota);
      this.grupo.add(remota);
    }
  }
  crearTorre() {
    const torre = new THREE.Group();
    torre.name = 'torre';
    this.grupo.add(torre);
    const oscuro = this.material('MeshLambertMaterial',{color:0x3d5359});
    const borde = this.material('MeshPhongMaterial',{color:0x9bafaa,map:this.texturas['metal_128.jpg'],shininess:45});
    for (let zona = 0; zona < 3; zona++) {
      const datos = Torre.ZONAS[zona];
      const segmento = new THREE.Group();
      segmento.name = 'tramo-' + datos.corto;
      torre.add(segmento);
      const material = this.material(zona === 2 ? 'MeshPhongMaterial' : 'MeshLambertMaterial',{color:datos.torre,map:this.texturas[datos.textura]});
      this.malla(new THREE.CylinderGeometry(3.05,3.05,24,12),material,[0,zona*24+11.7,0],segmento);
      for (let j = 0; j < 6; j++) {
        const y = zona*24+j*4;
        this.malla(new THREE.CylinderGeometry(3.24,3.24,.24,12),borde,[0,y,0],segmento);
        for (let ventana = 0; ventana < 6; ventana++) {
          const a = ventana * Math.PI / 3;
          const hueco = this.malla(new THREE.BoxGeometry(.32,1.4,.1),oscuro,[Math.cos(a)*3.01,y+2,Math.sin(a)*3.01],segmento);
          hueco.rotation.y = -a + Math.PI/2;
        }
      }
      const luz = this.material('MeshBasicMaterial',{color:datos.acento});
      const aro = this.malla(new THREE.TorusGeometry(3.3,.035,6,48),luz,[0,zona*24+.3,0],segmento);
      aro.rotation.x = Math.PI / 2;
    }
    this.malla(new THREE.CylinderGeometry(3.65,3.65,.65,12),borde,[0,72.2,0],torre);
    const corona = this.material('MeshPhongMaterial',{color:0xffd897,shininess:100,emissive:0xb77732,emissiveIntensity:.2});
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI*2;
      this.malla(new THREE.BoxGeometry(.45,1.7,.45),corona,[Math.cos(a)*3.1,73.25,Math.sin(a)*3.1],torre);
    }
    const gema = this.malla(new THREE.OctahedronGeometry(1),corona,[0,75.8,0],torre);
    this.gemaCima = gema;
    const pedestal = this.material('MeshLambertMaterial',{color:0x566c6c});
    this.malla(new THREE.CylinderGeometry(3.8,4.3,1,12),pedestal,[0,-.1,0],torre);
  }
  crearFlecha(color) {
    // BufferGeometry explícita: posiciones, índices y normales (P2 / s2-geom-index).
    const geometria = new THREE.BufferGeometry();
    geometria.setAttribute('position',new THREE.Float32BufferAttribute([
      -.09,0,-.34, .09,0,-.34, .09,0,.08, .27,0,.08,
      0,0,.43, -.27,0,.08, -.09,0,.08
    ],3));
    geometria.setIndex([0,2,1,0,6,2,5,4,3]);
    geometria.computeVertexNormals();
    return new THREE.Mesh(geometria,this.material('MeshBasicMaterial',{color,side:THREE.DoubleSide}));
  }
  crearNumero(numero,color) {
    const lienzo = document.createElement('canvas');
    lienzo.width = 128; lienzo.height = 64;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#' + new THREE.Color(color).getHexString();
    ctx.font = '500 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(String(numero).padStart(2,'0'),64,46);
    const textura = new THREE.CanvasTexture(lienzo);
    textura.encoding = THREE.sRGBEncoding;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.8,.4),new THREE.MeshBasicMaterial({map:textura,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    m.rotation.x = -Math.PI / 2;
    return m;
  }
  crearHalo(color) {
    // Halo con una textura transparente, sin efectos de posprocesado.
    if (!this.texturaHalo) {
      const lienzo = document.createElement('canvas');
      lienzo.width = lienzo.height = 128;
      const ctx = lienzo.getContext('2d');
      const gradiente = ctx.createRadialGradient(64,64,0,64,64,64);
      gradiente.addColorStop(0,'rgba(255,255,255,.65)');
      gradiente.addColorStop(.25,'rgba(255,255,255,.3)');
      gradiente.addColorStop(.6,'rgba(255,255,255,.08)');
      gradiente.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = gradiente;
      ctx.fillRect(0,0,128,128);
      this.texturaHalo = new THREE.CanvasTexture(lienzo);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map:this.texturaHalo,color,transparent:true,depthWrite:false,
      blending:THREE.AdditiveBlending,opacity:.7
    }));
    halo.scale.set(2.2,2.2,1);
    return halo;
  }
  crearPlataformas() {
    const c = Torre.CONFIG;
    const soporte = this.material('MeshLambertMaterial',{color:0x4e6868});
    const acabados = Torre.ZONAS.map((z,i) => this.material(i === 2 ? 'MeshPhongMaterial' : 'MeshLambertMaterial',{
      color:z.plataforma,map:this.texturas[z.textura]
    }));
    const zocalos = Torre.ZONAS.map(z => this.material('MeshPhongMaterial',{color:z.acento,shininess:40,emissive:z.acento,emissiveIntensity:.12}));
    for (let i = 0; i <= c.plataformas; i++) {
      const angulo = i * c.angulo;
      const zona = Math.min(2,Math.floor(i / c.checkpointCada));
      const esCheckpoint = i % c.checkpointCada === 0;
      const {ancho,profundidad} = Torre.dimensionesPlataforma(i);
      const grupo = new THREE.Group();
      grupo.name = 'plataforma-' + String(i).padStart(2,'0');
      grupo.position.set(Math.cos(angulo)*c.radio,i*c.escalon,Math.sin(angulo)*c.radio);
      this.grupo.add(grupo);
      // Las cajas no giran: el volumen de colisión coincide con la geometría visible.
      const suelo = this.malla(new THREE.BoxGeometry(ancho,c.grosor,profundidad),acabados[zona],[0,-c.grosor/2,0],grupo);
      this.malla(new THREE.BoxGeometry(ancho+.07,.12,profundidad+.07),zocalos[zona],[0,-c.grosor+.08,0],grupo);
      const brazo = this.malla(new THREE.BoxGeometry(c.radio-3,.3,.35),soporte,[-Math.cos(angulo)*2.1,-.85,-Math.sin(angulo)*2.1],grupo);
      brazo.rotation.y = -angulo;
      const numero = this.crearNumero(i,Torre.ZONAS[zona].acento);
      numero.position.set(0,.018,Math.min(.85,profundidad/2-.3));
      grupo.add(numero);
      if (i < c.plataformas) {
        const flecha = this.crearFlecha(Torre.ZONAS[zona].acento);
        const siguiente = new THREE.Vector3(Math.cos(angulo+c.angulo)*c.radio,0,Math.sin(angulo+c.angulo)*c.radio);
        flecha.rotation.y = Math.atan2(siguiente.x-grupo.position.x,siguiente.z-grupo.position.z);
        flecha.position.set(0,.025,-.1);
        grupo.add(flecha);
      }
      const separacionBaliza = Math.min(.95,Math.min(ancho,profundidad)/2-.3);
      const color = Torre.ZONAS[zona].acento;
      // Emissive hace visible el cristal incluso a oscuras. PointLight ilumina
      // además el suelo y al personaje: el material por sí solo no emite luz real.
      const materialBaliza = esCheckpoint ? this.material('MeshPhongMaterial',{
        color,emissive:color,emissiveIntensity:1.8,shininess:100
      }) : zocalos[zona];
      const baliza = this.malla(new THREE.OctahedronGeometry(i === c.plataformas ? .45 : esCheckpoint ? .33 : .19),materialBaliza,[-Math.cos(angulo)*separacionBaliza,.85,-Math.sin(angulo)*separacionBaliza],grupo);
      let luzCheckpoint = null;
      if (esCheckpoint) {
        // A un lado del centro, para que el personaje no tape el cristal.
        baliza.position.set(Math.sin(angulo)*1.25,.85,-Math.cos(angulo)*1.25);
        baliza.name = 'cristal-checkpoint-' + i;
        baliza.add(this.crearHalo(color));
        luzCheckpoint = new THREE.PointLight(color,1.6,5,2);
        luzCheckpoint.name = 'luz-checkpoint-' + i;
        baliza.add(luzCheckpoint);
        baliza.userData.luzCheckpoint = luzCheckpoint;
      }
      this.balizas.push(baliza);
      let aro = null;
      if (esCheckpoint) {
        aro = this.malla(new THREE.TorusGeometry(ancho*.35,.045,6,40),zocalos[zona],[0,.035,0],grupo);
        aro.rotation.x = Math.PI / 2;
      }
      this.plataformas.push({indice:i,grupo,suelo,baliza,luzCheckpoint,aro,checkpoint:esCheckpoint,altura:i*c.escalon,zona,ancho,profundidad});
    }
    // Disco de partida ancho: permite aprender los controles antes del primer salto.
    const base = this.malla(new THREE.BoxGeometry(5.8,.5,6),acabados[0],[c.radio,-.25,0]);
    const p0 = this.plataformas[0];
    p0.grupo.remove(p0.suelo);
    p0.suelo.geometry.dispose();
    p0.suelo = base;
    p0.ancho = 5.8;
    p0.profundidad = 6;
  }
  crearAtmosfera() {
    this.escena.background = new THREE.Color(Torre.ZONAS[0].cielo);
    this.escena.fog = new THREE.Fog(Torre.ZONAS[0].niebla,55,145);
    const materialNube = new THREE.MeshLambertMaterial({color:0xc3d1d5,transparent:true,opacity:.18,depthWrite:false});
    for (let i = 0; i < 22; i++) {
      const grupo = new THREE.Group();
      grupo.name = 'nube-' + i;
      const a = i * 2.39;
      const radio = 22 + i%4*8;
      grupo.position.set(Math.cos(a)*radio,15+i%7*8,Math.sin(a)*radio);
      for (let j = 0; j < 3; j++) {
        const nube = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4+j*.3,1),materialNube);
        nube.position.set(j*2,Math.sin(j+i)*.4,0);
        nube.scale.set(1.8,.55,1);
        grupo.add(nube);
      }
      this.grupo.add(grupo);
      this.nubes.push({grupo,x:grupo.position.x,z:grupo.position.z});
    }
    // Semilla fija: la decoración y las pruebas son reproducibles.
    let semilla = 42;
    const azar = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296; };
    const puntos = [];
    for (let i = 0; i < 170; i++) puntos.push((azar()-.5)*120,azar()*100,(azar()-.5)*120);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(puntos,3));
    this.particulas = new THREE.Points(geo,new THREE.PointsMaterial({color:0xd6f5d9,size:.09,transparent:true,opacity:.55,depthWrite:false}));
    this.grupo.add(this.particulas);
    this.colores = {cielo:new THREE.Color(),niebla:new THREE.Color(),luz:new THREE.Color(),ambiente:new THREE.Color(),acento:new THREE.Color()};
  }
  actualizar(delta,tiempo,posicion,enPartida,iluminacion = 1) {
    const tramo = THREE.MathUtils.clamp(posicion.y/24,0,2);
    const a = Torre.ZONAS[Math.floor(tramo)];
    const b = Torre.ZONAS[Math.min(2,Math.floor(tramo)+1)];
    const mezcla = THREE.MathUtils.smoothstep(tramo%1,0,1);
    const suavidad = 1 - Math.exp(-delta*2);
    ['cielo','niebla','luz','ambiente','acento'].forEach(nombre => {
      this.colores[nombre].set(a[nombre]).lerp(new THREE.Color(b[nombre]),mezcla);
    });
    this.escena.background.lerp(this.colores.cielo,suavidad);
    this.escena.fog.color.lerp(this.colores.niebla,suavidad);
    this.sol.color.lerp(this.colores.luz,suavidad);
    this.sol.intensity = THREE.MathUtils.lerp(a.intensidad,b.intensidad,mezcla)*iluminacion;
    this.ambiente.color.lerp(this.colores.ambiente,suavidad);
    this.foco.color.lerp(this.colores.acento,suavidad);
    const focoY = enPartida ? posicion.y : 20;
    this.sol.position.set(25,focoY+32,18);
    this.sol.target.position.set(0,focoY,0);
    this.foco.position.set(posicion.x+4,posicion.y+10,posicion.z+5);
    this.foco.target.position.copy(posicion);
    this.ejes.position.copy(posicion);
    this.balizas.forEach((baliza,i) => {
      baliza.rotation.y = tiempo*.8+i;
      baliza.position.y = .85+Math.sin(tiempo*2+i)*.12;
      if (baliza.userData.luzCheckpoint) {
        const pulso = Math.sin(tiempo*2+i)*.2;
        baliza.material.emissiveIntensity = 1.8+pulso;
        baliza.userData.luzCheckpoint.intensity = baliza.visible ? 1.6+pulso : 0;
      }
    });
    this.gemaCima.rotation.y = tiempo*.5;
    this.gemaCima.position.y = 75.8 + Math.sin(tiempo*1.4)*.22;
    this.nubes.forEach((n,i) => { n.grupo.position.x = n.x+Math.sin(tiempo*.05+i)*2; });
    this.particulas.rotation.y = tiempo*.006;
  }
  reiniciar() {
    this.balizas.forEach(b => {
      b.visible = true;
      if (b.userData.luzCheckpoint) b.userData.luzCheckpoint.intensity = 1.6;
    });
  }
  marcarPlataforma(indice) {
    const baliza = this.balizas[indice];
    baliza.visible = false;
    if (baliza.userData.luzCheckpoint) baliza.userData.luzCheckpoint.intensity = 0;
  }
};
