# Sprint 0 – Diseño visual y estructura de interfaz

## Objetivo

Dejar una base visual clara y atractiva, con una identidad inspirada en Shell Shockers pero original, para que el juego se sienta más serio, más divertido y listo para escalar sin romper la estructura actual.

---

## 1. Estructura visual recomendada del menú principal

### Layout general

- Fondo azul cielo con degradado suave
- Panel lateral izquierdo para navegación principal
- Panel central con vista previa del personaje y selección de arma
- Barra superior con información del usuario y su progresión
- Botón principal grande de Play
- Botón secundario para Play with Friends
- Botón para modo de juego

### Layout base sugerido

- Izquierda:
  - nombre del usuario
  - botón Home
  - botón Profile
  - botón Inventory
  - botón Shop
  - botón Settings
- Centro:
  - preview del alien / personaje
  - nombre del arma actual
  - botón de Play
  - botón de Play with Friends
  - selector de modo de juego
- Derecha:
  - estadísticas del usuario
  - desafíos / logros
  - monedas / huevos acumulados
  - opciones rápidas

### Estética

- bordes redondeados
- colores brillantes con contraste alto
- botones con efecto hover
- glow sutil para resaltar selección
- tipografías con peso fuerte y estilo arcade

---

## 2. Referencia de diseño para la pantalla principal

### Elementos visuales clave

#### Barra superior

- nombre del usuario a la izquierda o centro
- Monedas / huevos acumulados a la derecha
- indicador de nivel o rango si llega el momento
- botón de ajustes con icono

#### Navegación lateral

Menú con estilo tipo “cartel de juego”:

- HOME
- PROFILE
- INVENTORY
- SHOP
- SETTINGS

Todos con fondo azul celeste, bordes redondeados y texto blanco o amarillo fuerte.

#### Vista previa central

- personaje gigante con formas tipo huevo / alien
- arma visible en la mano
- fondo con luz y sombra para que se vea volumétrico
- el personaje debe sentirse vivo, no plano

#### Selector de armas

- varias armas disponibles en una fila o en stack vertical
- cada una con nombre, color y pequeño icono
- la arma seleccionada debe destacar con brillo o borde amarillo

---

## 3. Diseño del HUD de partida

### Objetivo

Que el HUD se vea claro, limpio y útil sin saturar la pantalla.

### Elementos a incluir

- Vida en círculo o barra
- Munición actual
- Arma actual en la esquina inferior derecha
- Cantidad de eliminaciones
- Tiempo de partida
- Ping / FPS / Mapa / Server
- Feed de kill / death mensajes en la parte superior o lateral

### Estructura sugerida

- superior central: marcador de equipo o puntuación
- izquierda: lista de jugadores / leaderboard
- derecha: información de mapa, ping, fps, stats rápidas
- inferior izquierda: salud / tiempo de respawn / valor visual
- inferior derecha: arma actual / munición / recarga

### Estilo visual

- elementos grandes y legibles
- colores cálidos para vida / daño / kills
- colores fríos para info del sistema
- textos con sombra para que se lean sobre escenas dinámicas

---

## 4. Diseño de lobby / sala de partida

### Objetivo

Cuando un usuario entra a la sala, debe entender rápidamente:

- en qué sala está
- cuántos jugadores hay
- con quién juega
- si está en equipo o free for all
- qué arma está usando

### Secciones sugeridas

- panel izquierdo: lista de jugadores y puntajes
- centro: cards de equipo / modo de juego / botón jugar
- derecha: info del mapa / modo / ping / match room

### Botones claves

- Play
- Join team
- Change weapon
- Share room
- Spectate / leave room

---

## 5. Estilo visual recomendado para la identidad del juego

### Base de colores

- celeste brillante
- azul marino
- amarillo dorado
- blanco puro
- turquesa / verde agua para energía y highlights

### Paleta sugerida

- fondo base: azul claro / cian
- botones principales: amarillo brillante o turquesa
- botones secundarios: azul oscuro o cian fuerte
- texto principal: blanco, negro o amarillo intenso
- borde: azul oscuro / delgado con glow

### Efectos recomendados

- sombras suaves
- bordes redondeados
- glow de botón en hover o selección
- líneas muy discretas para separar paneles
- materiales con brillo mínimo para dar sensación premium

---

## 6. Cómo organizar el front end y la UI sin romper el proyecto

### Recomendación de estructura

- `public/menu.html` → menú principal
- `public/game.html` → escena de juego y HUD base
- `public/styles.css` → estilos generales, layout y tema visual
- `public/menu-preview.js` → vista previa del personaje
- `public/game.js` → render 3D, cámara, jugadores, armas y HUD principal

### Para escalar bien

- no mezclar lógica UX con lógica de gameplay
- separar UI/DOM del dibujo 3D
- separar elementos del HUD en piezas reutilizables
- reservar un bloque para `HUD`, `Kill Feed`, `Inventory`, `Profile`, `Shop` y `Lobby`

---

## 7. Diseño de armas y personaje

### Personaje

Inspirado en aliens / huevos de Shell Shockers, pero original:

- cabeza ovalada / huevo
- ojos grandes con detalle
- brazos visibles y robustos
- cuerpo con volumen y forma redondeada
- aria de alien con colores vivos
- hat / casco / accesorios opcionales para diferenciar skins

### Armas

Cada arma debe visualizarse con personalidad:

- pistol: más compacto y rápido
- shotgun: más ancho, poderoso, corto
- rifle: más largo, más preciso, más potente en distancia

Cada arma debe tener:

- color característico
- tamaño visible correcto
- posición real en el avatar
- feedback visual de disparo

---

## 8. Sistema de progresión y recompensa visual

### Economía del juego

- monedas o huevos acumulados
- skins por logros o niveles
- recompensas por kills, victorias y partidas jugadas
- niveles o rangos para dar sensación de progresión

### Elementos visuales recomendados

- panel de logros / desafíos con íconos grandes
- dinero o huevos en la parte superior
- botón de shop con icono visible
- feedback cuando compras un arma o skin

---

## 9. Checklist ideal para este sprint

### Menú

- [ ] nombre de usuario visible
- [ ] home/profile/inventory/shop visibles
- [ ] play principal y play with friends presentes
- [ ] selector de arma funcional
- [ ] modo de juego visible
- [ ] fondo y estilo coherentes

### Juego

- [ ] el personaje visible y completo
- [ ] armas visibles y encajadas
- [ ] HUD básico presente
- [ ] mapa claro y legible
- [ ] lista de jugadores visible
- [ ] ping/fps/mapa/estadísticas visibles

### Feedback

- [ ] kill feed funcional
- [ ] mensaje de muerte/kill visible
- [ ] indicadores de vida y munición claros
- [ ] sensación de partida competitiva

---

## 10. Recomendación final para esta fase

La clave de este sprint no es replicar la referencia exactamente, sino capturar su sensación:

- claridad del flujo
- identidad del personaje
- emoción del juego
- comprensión instantánea del estado
- progresión constante

Si logramos esto, la base quedará mucho más sólida para el siguiente sprint de gameplay y de armas reales.
