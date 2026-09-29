# Sprint plan: Alien Arena Shooter

## 1. Diagnóstico del estado actual

El proyecto ya tiene una base sólida para una versión jugable y un punto de partida serio:

- Backend con Node.js + Express + Socket.IO
- Lógica de salas y partidas en tiempo real
- Manejo de jugadores, reconexión, persistencia y estadísticas básicas
- Escena 3D con Three.js
- Menú y flujo básico de autenticación / lobby / juego
- Sistema de armas básico, disparos y colisiones elementales
- Estructura de partida y jugadores ya pensada para escalar

Esto significa que no estamos partiendo de cero. La base ya está orientada a un juego multijugador de arena shooter, y lo correcto es potenciarla sin reescribirla cada vez.

### Lo que ya funciona bien

- Autenticación y sesión del usuario
- Conexión de clientes a salas por roomId
- Estado de partida y manejo de jugadores conectados/desconectados
- Reconexion de jugadores y persistencia de estado básico
- Escena 3D de juego y movimiento del personaje principal
- Vista previa del menú y una identidad visual relativamente definida

### Lo que falta para convertirlo en un gran juego

- UX del menú más refinada y fiel a la referencia
- Sistema de armas más completo (cargadores, recarga, spread, daño por arma, skins)
- HUD más robusto con vida, munición, eliminaciones, puntuación, minimapa, tiempo
- Sistema de partidas con objetivos y modos de juego
- Sistema de loot / economía / monedas / huevos / skins / equipos
- Chat en vivo y mensajes de kill feed
- Mapa más dinámico con cobertura, arena, elementos, props y ambientación
- Mejor lógica de sincronización multijugador con replicación clara del estado
- Persistencia más clara de perfiles, inventario y progresión
- Feedback de juego: golpes, muertes, respawn, sonido, partículas, cámara, sensación de arma

---

## 2. Visión del producto

El objetivo es construir un shooter arcade de arena con identidad original, inspirada en la sensación de Shell Shockers pero sin copiarla ni depender de su estética exacta.

La clave no es solo replicar la interfaz, sino recrear la experiencia:

- partidas rápidas
- sensación de “one more round”
- armas con personalidad
- progreso por partidas
- replays de momentos memorables
- competencia por ranking / equipos / skins / rewards

El juego debe sentirse:

- divertido al instante
- fácil de aprender
- adictivo por el progreso
- divertido de jugar en grupo
- con momentos de tensión y emoción

---

## 3. Principios de arquitectura para escalar sin romper todo

Antes de seguir con nuevas features, hay que fijar estas reglas:

### 3.1. No reescribir la base cada vez

Mantener modularidad clara:

- `server/` → lógica de salas, jugadores, partidas, eventos, persistencia
- `public/` → UI, menú, lobby, HUD, escenas y render
- `server/models/` → schema de MongoDB
- `tests/` → pruebas unitarias de lógica central

### 3.2. Separar “estado real” de “estado visual”

- El servidor debe ser fuente de verdad del juego
- El cliente debe renderizar estado recibido
- El cliente debe enviar input y acciones, no “inventar” estado del mundo

### 3.3. Progresar por capas

No hacer features gigantes de golpe. Avanzar por capas de gameplay:

1. Lobby + selección de arma + sala
2. Movimiento + disparos + daño + respawn
3. HUD + kill feed + inventario + economía
4. Modos de juego + equipos + mapas + progression
5. Polishing + sound + session / rewards / socials

### 3.4. Cada sprint debe dejar el juego jugable

Cada fase debe dejar una versión mejor que la anterior, con:

- estado estable
- sin romper la sesión actual
- sin reescribir estructuras previas
- con pruebas de regresión

---

## 4. Estructura de producto a futuro

### 4.1. Lobby / Home

Debe verse parecido a la referencia, con:

- nombre del usuario
- menú principal con Home / Profile / Inventory / Shop
- selección de arma y modo de juego
- botón de Play
- botón de Play with friends
- botón de ajustes
- gran variedad de armas, skins y power-ups

### 4.2. Equipos y modos

- Todos contra todos
- Equipos (rojo/azul)
- Modo por rondas
- Modo “last egg standing” / “capture the egg” / “survive” selon el diseño final

### 4.3. HUD principal

- vida
- munición
- arma actual
- tiempo de partida
- kills / deaths
- ping
- fps
- mapa / server / region
- ping actual y rendimiento

### 4.4. Progresión y economía

- monedas / huevos / crystals / tokens
- recompensas por matar y ganar partidas
- desbloqueo de armas y skins
- lógica de compra por cuenta, no por sesión temporal

### 4.5. Feedback y juego memorable

- kill feed en tiempo real
- notificaciones de muerte / asistencias / bonus
- partículas, sangre / efecto de hit, flash
- animaciones de respawn
- mapas con visual identidad y variedad
- sensación de poder por arma

---

## 5. Sprint recomendado (ruta clara de desarrollo)

# Sprint 0 – Base estable y pulido visual

Objetivo: dejar el juego más serio, legible y atractivo sin romper la base existente.

### Tareas

- Pulir lobby y menu principal
- Mejorar UI de room y selección de arma
- Ajustar tamaño y posicionamiento de pantalla del juego
- Mejorar paleta de colores y tipografías
- Mejorar la identidad visual del personaje y armas
- Revisar claridad del mapa y fondo
- Corregir bugs de render con jugadores y cámara
- Dejar los elementos del HUD más legibles

### Resultado esperado

- el juego se vea “polished” aunque siga siendo versión beta
- el jugador entienda desde el inicio qué hay que hacer
- la experiencia visual se parezca a un shooter con identidad clara

---

# Sprint 1 – Gameplay central completo

Objetivo: dejar el sistema de juego juegable y balanceado.

### Tareas

- Sistema de armas con daño, tasa de disparo, cadencia, recoil
- Sistema de munición por arma y recarga
- Balas de otros jugadores visibles y sincronizadas
- Daño real, muerte real, respawn
- kill feed visual
- puntuación por partida
- mapa con límites y colisiones reales
- mejora del movimiento y cámara

### Resultado esperado

- que una partida sea jugable de principio a fin
- que cada disparo y daño tenga sentido
- que la sensación de arma se sienta mejor

---

# Sprint 2 – HUD, economía e inventario

Objetivo: convertir el juego en algo más adictivo y progresivo.

### Tareas

- HUD con vida, munición, kills, deaths, ping, fps, estado de partida
- inventario de armas y skins
- sistema de monedas / huevos / puntos
- compra y desbloqueo de weapons
- persistencia del inventario por usuario
- menú profile y shop con diseño más completo

### Resultado esperado

- el jugador tenga objetivos progresivos
- haya un loop de mejora y recompensa
- cada partida aporte valor al perfil

---

# Sprint 3 – Modos de juego y equipos

Objetivo: ampliar la variedad de partidas y la rejugabilidad.

### Tareas

- modo FFA
- modo por equipos rojo/azul
- modo round-based
- modo supervivencia en sala
- lógica de winner/rounds
- scoreboard global por sala y por usuario

### Resultado esperado

- partidas con diferentes emociones
- cada jugador pueda elegir estilo de juego
- el juego deja de ser solo “disparar” y se vuelve estratégico

---

# Sprint 4 – Mapa, atmosfera y feedback visual

Objetivo: hacer que cada partida se sienta memorable.

### Tareas

- varios mapas con estilo y colores distintos
- props, cobertura, escaleras, puntos de riesgo, elementos del entorno
- cráteres, particulas, humo, explosions, hit flashes
- sonidos básicos de disparo, impacto, victoria, derrota
- más variedad de skins, personajes y armas visuales

### Resultado esperado

- el videojuego se vea y se sienta más “pro”
- cada mapa tenga personalidad
- los momentos de kill y evento de partida sean más impactantes

---

# Sprint 5 – Social y retention

Objetivo: mantener a los jugadores volviendo.

### Tareas

- chat en sala
- compartir código o enlace de sala
- perfil con estadísticas
- historial de partidas
- achievements / desafíos diarios
- premios por racha y niveles
- sistema de invitación o partidas con amigos

### Resultado esperado

- comunidad activa y más engagement
- no solo jugar una partida, sino volver al juego
- sensación de progresión continua

---

## 6. Roadmap por prioridades

### Fase A – Estabilidad y base de gameplay

- fix visual y render
- arreglar cámara y movimiento
- armas y daño
- munición
- muerte / respawn

### Fase B – Jugabilidad y progresión

- HUD
- inventario
- economy
- unlocks
- profiles

### Fase C – Rejuegos y socialización

- equipos
- modos
- mapas
- chat
- invite/share

### Fase D – Pulido y monetización / retention

- skins
- achievements
- seasonal rewards
- polish visual y audio

---

## 7. Recomendaciones de implementación para no romper el proyecto

### Mantener esta estructura base

- `server/gameState.js` → estado vivo del juego
- `server/matchManager.js` → salas, flujo de partida, reconexión
- `public/game.js` → render + input + sincronización del cliente
- `public/menu-preview.js` → vista previa visual
- `public/session.js` → sesión y persistencia del usuario

### Añadir nuevas features sin reescribir todo

- Cada nueva feature debe añadirse como módulo independiente
- Ejemplo:
  - `public/hud.js`
  - `public/inventory.js`
  - `public/weaponSystem.js`
  - `public/killFeed.js`
  - `server/weaponConfig.js`
  - `server/inventoryManager.js`
  - `server/leaderboard.js`

### Crear pruebas de lógica central

- partidas
- daño
- respawn
- economía de usuario
- inventario y unlocks
- puntuación final

---

## 8. Definition of Done por sprint

Cada sprint debe cumplir:

- juego sigue ejecutándose sin romper base anterior
- la nueva feature está integrada con el flujo actual
- la lógica funciona tanto en backend como en frontend
- hay pruebas al menos para la parte funcional principal
- la UI es clara y usable
- la mejora aporta valor de gameplay y no solo estética

---

## 9. Siguiente paso concreto recomendado

La siguiente ruta más inteligente es esta:

1. Sprint 0: pulir visual y claridad del lobby y juego
2. Sprint 1: armas + daño + munición + respawn + kill feed
3. Sprint 2: inventario + economía + perfiles + shop
4. Sprint 3: equipos + modos + mapas + scoreboards

Esto mantiene una progresión real y evita el problema de “hacer mucho a la vez” y terminar reescribiendo todo.

---

## 10. Resumen ejecutivo

Estamos en una buena posición porque la base técnica ya existe, y lo importante ahora no es empezar de cero sino consolidar una estructura que deje al juego con identidad, progresión, rejugabilidad y claridad visual.

La idea es escalar con disciplina:

- pulir lo que ya está,
- completar el gameplay central,
- agregar progresión y economía,
- ampliar modos y socialización,
- terminar con un juego atractivo y memorable.

Si seguimos así, el proyecto puede crecer sin romper su arquitectura ni perder el tiempo haciendo refactors gigantes.
