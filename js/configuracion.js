/* Parámetros compartidos. Unidades del mundo: metros y segundos. */
'use strict';
window.Torre = window.Torre || {};
Torre.CONFIG = Object.freeze({
  plataformas: 36, escalon: 2, radio: 7.6, angulo: Math.PI / 6,
  ancho: 3.65, grosor: 0.55, checkpointCada: 12,
  gravedad: 20, impulsoSalto: 10.4, velocidad: 6.5,
  aceleracionSuelo: 35, aceleracionAire: 22,
  radioJugador: 0.28, altoJugador: 1.68,
  pasoFijo: 1 / 120, margenSalto: 0.12,
  distanciaCamara: 12, alturaCamara: 6,
  radioNucleo: 3.05, alturaTotal: 72
});
// Ancho y profundidad, en metros. Patrones fijos: sin azar ni saltos imposibles.
// La precisión exigida aumenta en cada vuelta, con rectángulos en ambas orientaciones.
Torre.PERFILES_PLATAFORMAS = [
  [[3.65,3.45],[3.25,3.65],[3.4,3.1],[3.05,3.3]],
  [[2.9,2.7],[2.55,3.1],[2.7,2.5],[2.4,2.8]],
  [[2.35,2.15],[2.05,2.5],[2.2,1.95],[1.9,2.05]]
];
Torre.esCircular = function(indice) {
  const c = Torre.CONFIG;
  return indice > c.checkpointCada && indice < c.plataformas &&
    indice%c.checkpointCada !== 0 && indice%3 === 1;
};
Torre.dimensionesPlataforma = function(indice) {
  const c = Torre.CONFIG;
  if (indice === c.plataformas) return {ancho:5.4,profundidad:5.4};
  if (indice%c.checkpointCada === 0) return {ancho:4.8,profundidad:4.8};
  const zona = Math.min(2,Math.floor(indice/c.checkpointCada));
  const perfil = Torre.PERFILES_PLATAFORMAS[zona][(indice-1)%Torre.PERFILES_PLATAFORMAS[zona].length];
  const ancho = perfil[0]*c.ancho/3.65;
  const profundidad = perfil[1]*c.ancho/3.65;
  if (Torre.esCircular(indice)) {
    const diametro = Math.min(ancho,profundidad);
    return {ancho:diametro,profundidad:diametro};
  }
  return {ancho,profundidad};
};
Torre.ZONAS = [
  { nombre: 'EL BOSQUE', corto: 'El bosque', cielo: 0x203b47, niebla: 0x37535b, luz: 0xffedc5, ambiente: 0xa4c7c7, acento: 0xb2edca, plataforma: 0xb7b198, torre: 0x839383, textura: 'wood512.jpg', intensidad: .9 },
  { nombre: 'LAS NUBES', corto: 'Las nubes', cielo: 0x334961, niebla: 0x68798d, luz: 0xc9e5ff, ambiente: 0xa5b9e5, acento: 0xa9d8ff, plataforma: 0xb5bdc9, torre: 0x8495a5, textura: 'metal_128.jpg', intensidad: 1.1 },
  { nombre: 'EL AMANECER', corto: 'El amanecer', cielo: 0x746372, niebla: 0xb29c98, luz: 0xffd49b, ambiente: 0xe0b6c7, acento: 0xffd897, plataforma: 0xc2b39c, torre: 0x9f938e, textura: 'pisometalico_1024.jpg', intensidad: 1.3 }
];
Torre.formatoTiempo = function(segundos) {
  const total = Math.floor(segundos);
  return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
};
Torre.lerpAngulo = function(actual, destino, factor) {
  return actual + Math.atan2(Math.sin(destino - actual), Math.cos(destino - actual)) * factor;
};
