# Sprint 0: Base visual, lobby y claridad del gameplay

## Objetivo

Dejar la base del juego más clara, jugable y visualmente coherente, sin romper la arquitectura actual. Este sprint apunta a que el juego se sienta más serio y a que el jugador entienda enseguida qué debe hacer, cómo jugar y qué tiene disponible.

## Principio del sprint

Este sprint no tiene como objetivo reescribir el juego. Tiene como objetivo mejorar lo que ya existe:

- lobby principal
- pantalla de sala / partida
- HUD en juego
- sensación de arma
- claridad del mapa
- identidad visual del personaje
- mejor flujo de entrada a la partida

## Resultado que esperamos al finalizar este sprint

- Un menú que se vea pulido, con identidad propia y más parecido a la referencia
- Una pantalla de juego con un HUD legible y funcional
- Un jugador visible y reconocible, con armas claras y una sensación de movimiento correcta
- Un lobby con opciones de arma, modo de juego y acceso rápido a la partida
- Una base visual que permita seguir escalando sin tener que rehacer todo

---

## Fase 1 — Ajuste de diseño y flujo del menú

### Objetivo

Que el menú se sienta más premium y más parecido a la referencia, pero con identidad propia.

### Tareas

#### 1. Rediseñar la estructura del menú principal

- Mantener la estructura actual: nombre de usuario, home, profile, inventory, shop
- Crear una disposición más parecida a Shell Shockers:
  - barra superior con usuario y moneda/huevos
  - panel izquierdo con menú
  - centro con preview del personaje
  - botones principales a la izquierda o abajo
  - selección de arma con vista previa

#### 2. Mejorar la identidad gráfica del menú

- paleta azul celeste / turquesa / amarillo brillante
- fondos con degradado y glow sutil
- botones con bordes redondeados y personalidad
- caja central con contraste para que todo se vea limpio
- evitar fondos planos y negros sin contexto

#### 3. Arreglar UX de botón Play y room selector

- mostrar correctamente el nombre de la sala
- mantener opción para entrar a una sala
- dejar claro el flujo: seleccionar arma -> elegir sala -> jugar
- que la interacción se vea clara y no caótica

### Criterio de aceptación

- el usuario entra al menú y entiende qué puede hacer sin leer instrucciones
- la pantalla se ve ordenada y limpia
- la vista previa del personaje se ve con forma y color bien definidos

---

## Fase 2 — Pulido visual del personaje y arma

### Objetivo

Que el personaje y las armas se vean bien, no en negro ni faltos de forma.

### Tareas

#### 1. Revisión del personaje principal

- asegurar que el cuerpo, cabeza, ojos, brazos y piernas tienen proporciones correctamente definidas
- usar materiales con color y brillo para distinguirla del fondo
- añadir altura y volumen para que no aparezca aplastado
- mantener la estética de alien pero con sensación arcade

#### 2. Revisión de las armas

- que las armas se vean claramente desde la cámara del jugador
- hacer que el arma tenga tamaño correcto respecto al personaje
- elegir materiales para arma principal, cañón, grip y detalle
- que cada arma tenga un color o forma distinta

#### 3. Mejorar la cámara y la rotación

- que la cámara siga bien al personaje
- que el personaje mire según el movimiento del ratón
- que el arma se incline de forma natural y no se vea torcida

### Criterio de aceptación

- el jugador se ve claramente en el mapa
- el arma está visible y posicionada bien
- la cámara no queda rara ni descentrada

---

## Fase 3 — Mejorar el HUD del juego

### Objetivo

Que el jugador tenga toda la información importante en la pantalla sin saturar la vista.

### Tareas

#### 1. Añadir HUD básico visible

- vida
- munición
- arma activa
- kills / deaths
- tiempo de partida
- puntaje o estado de ronda

#### 2. Añadir indicadores de partida

- nombre del equipo / color
- estado de juego
- estado de respawn
- mensajes de kill y muerte

#### 3. Integrar info del servidor

- ping
- fps
- mapa
- región / servidor
- estado de conexión

### Criterio de aceptación

- el jugador sabe en cada momento qué está pasando
- no hay un HUD demasiado lleno ni incomprensible
- se puede jugar sin perder mucho tiempo mirando la interfaz

---

## Fase 4 — Lobby / sala y flujo de matchmaking

### Objetivo

Hacer que entrar a la partida sea claro, rápido y coherente.

### Tareas

#### 1. Rediseñar la sala de juego

- mostrar nombre de la sala,
- mostrar jugadores conectados,
- mostrar estado del equipo o modo,
- mostrar selección actual del arma

#### 2. Mejorar la invocación de partida

- botón Play
- botón Play with friends
- modo competitivo / team / ffa
- compartir código o enlace de la sala

#### 3. Dejar la lógica preparada para escalado

- usar `roomId` y persistencia clara del usuario
- evitar lógica mezclada en frontend
- preparar la estructura para mapas, equipos y modos futuros

### Criterio de aceptación

- un usuario puede entrar a la sala sin errores visibles
- la experiencia se ve ordenada y comprensible
- el flujo de sala está listo para el siguiente sprint de gameplay

---

## Fase 5 — Mapa y ambiente base

### Objetivo

Crear una arena visualmente clara con perspectiva y entendimiento del espacio.

### Tareas

- mejorar el suelo y los colores del mapa
- crear una arena con límites claros
- añadir elementos visuales básicos para dar profundidad
- preparar la base para obstáculos, cobertura y props
- dejar un mapa que no se vea vacío ni negro

### Criterio de aceptación

- el mapa tiene profundidad y presencia
- el jugador distingue bien dónde puede moverse
- las colisiones y el entorno no se sienten caóticos

---

## Fase 6 — Feedback del juego y kill feed

### Objetivo

Que cada acción se sienta como parte de un shooter competitivo.

### Tareas

- mensaje cuando matas a alguien
- mensaje cuando te matan
- mostrar quién usó qué arma
- mostrar eliminaciones en el listado de jugadores
- añadir animaciones simples de impacto y respawn

### Criterio de aceptación

- la partida tiene sensación de feedback y emoción
- el jugador siente que la acción está ocurriendo
- la información es útil y visualmente clara

---

## Fase 7 — Preparación para sprint siguiente

### Objetivo

No dejar la base rota para el sprint 1.

### Tareas

- separar mejor lógica de arma y munición
- dejar estructura de estado del player más clara
- definir configuración base por arma
- preparar el sistema para HUD de vida y munición
- dejar la base del inventario y economía preparada en backend

### Criterio de aceptación

- el juego sigue funcionando sin errores grandes al pasar al sprint 1
- el código está listo para ampliar sin reescribirlo
- la base del siguiente sprint es clara y modular

---

## Lista de tareas por orden de prioridad

### Prioridad 1: visual y claridad

- [ ] pulir lobby principal
- [ ] mejorar paleta y contraste
- [ ] arreglar personaje principal y arma
- [ ] corregir cámara y posiciones
- [ ] dejar mapa visible y limpio

### Prioridad 2: flujo y partida

- [ ] revisar workflow de selección de arma
- [ ] dejar sala y partida más claras
- [ ] integrar HUD básico
- [ ] preparar kicks, kills, feedback visual

### Prioridad 3: escalabilidad

- [ ] separar lógica de UI y gameplay
- [ ] preparar sistema de armas modular
- [ ] preparar inventario y economía
- [ ] preparar estructura para modos y equipos

---

## Recomendación de ejecución

Este sprint se debe trabajar en bloques de 2 a 3 tareas por vez, y cada bloque debe dejar la base jugable. No conviene hacer todo visual, luego todo backend, luego todo UI, porque se rompe la coherencia del juego.

### Orden recomendado

1. Fase 1: menú y flujo
2. Fase 2: personaje y arma
3. Fase 3: HUD y partidas
4. Fase 4: salle / lobby / room flow
5. Fase 5: mapa y visual ambiente
6. Fase 6: feedback de juego
7. Fase 7: preparación para sprint 1

---

## Definition of Done del Sprint 0

El sprint 0 se considera hecho cuando:

- el menú se ve más pulido y coherente
- el jugador está visible y el arma queda clara
- el juego entra a la sala sin errores graves
- el HUD aporta información útil
- la base está lista para el sprint 1 sin reescribir la estructura principal

---

## Siguiente paso recomendado

Una vez terminado este sprint, el siguiente bloque ideal es:

- armas con daño real
- munición y recarga
- kill feed
- respawn mejorado
- HUD en juego más funcional

Eso llevará al proyecto de una base “jugable visual” a una versión de “gameplay competitivo real”.
