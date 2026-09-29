# prueba1-juego
 
// run de terminal 
// npm start  

🧭 Cómo evitarlo en el futuro
Si vuelves a ver esto, revisa qué proceso está usando 3000:

netstat -ano | findstr :3000
luego:
taskkill /PID <ID> /F
O, si quieres evitar conflicto sin matar el proceso viejo, puedes arrancar el servidor en otro puerto:

PORT=3001 npm start



'''''''''''''''''''''''''''''''''''''''
El siguiente orden profesional será:

Sprint de movimiento

movimiento con aceleración
salto real
rampas y escaleras transitables
colisiones sólidas
cámara FPS estable
Sprint de armas

cadencia por arma
recoil
cargadores
escopeta con dispersión
rifle con zoom
proyectiles y efectos distintos
Sprint de mapa

arena grande
casas y torres
árboles y cobertura
plataformas elevadas
rutas y puntos de spawn
Sprint de experiencia

menú estilo shooter
HUD completo
chat
sonido
kill feed
estadísticas persistentes
Para ver los errores:


Para desarrollo con reinicio automático:


Y para el frontend, abre F12, entra en Console y recarga con Ctrl + F5.
