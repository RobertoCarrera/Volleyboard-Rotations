# Equipos, jugadores y valoraciones de la Pizarra

## Encargo

Añadir equipos y jugadores con CRUD real en el backend y controles en la interfaz.
Guardar los datos de forma persistente en la cuenta, sin caducidad programada.
Cada jugador puede tener varias posiciones con una nota entera de 0 a 5; la
escala pasa por rojo, naranja, amarillo y verde. `0` es una nota, no ausencia.

## Decisiones de implementación

Estas decisiones completan el encargo con el modelo que ya usa la aplicación:

- Cada equipo pertenece a una cuenta Google verificada y tiene su propia pizarra
  de hasta cinco sets. La plantilla del equipo se reutiliza en todos los sets.
- Cinco habilidades: colocador (`COL`), opuesto (`O`), punta (`R`), central (`C`)
  y líbero (`L`). `null` significa «Sin asignar». Los puestos R1/R2, C1/C2 y
  L1/L2 comparten la valoración de su posición.
- Los sets seleccionan hasta ocho jugadores por referencia a su ficha; editar
  nombre, dorsal o valoración se refleja en todos los sets del equipo.
- El borrado es recuperable desde una papelera. Borrar un equipo oculta su
  plantilla y sus sets; no borra físicamente sus registros. Borrar un jugador
  lo retira de la pista sin afectar a otros jugadores. Sus referencias quedan
  señaladas como eliminadas en los sets y cuentan para el límite hasta pulsar
  «Quitar del set». Restaurar la ficha recupera sus asignaciones conservadas.
- La pizarra anterior sigue disponible como «Pizarra personal». No se migra
  automáticamente: los antiguos sets pueden contener identidades divergentes
  que no conviene fusionar sin una elección explícita.
- Máximo de protección: 100 equipos por cuenta y 200 fichas por equipo,
  incluyendo papelera. Ninguna eliminación periódica ni cambio de plan.

## Alternativas consideradas

1. Ampliar el único JSON por cuenta: menos tablas, pero una edición de cualquier
   equipo volvería a escribir todos los demás y duplicaría las fichas.
2. Tablas privadas de equipos y jugadores: elegida por el implementador porque
   mantiene las identidades y permite CRUD independiente sin tocar datos previos.
3. Jugadores globales con múltiples afiliaciones: añade complejidad que no pide
   este encargo. Se puede ampliar después si se necesita compartir una ficha.

## Persistencia y API

`volley_teams` guarda nombre, propietario, estado de pizarra y borrado lógico.
`volley_players` guarda equipo, propietario, nombre, dorsal, cinco notas anulables
y borrado lógico. Una clave externa compuesta impide enlazar cuentas distintas.
Las tablas mantienen la política privada de NoCodeBackend.

La nueva función sirve `/api/teams` y `/api/teams/*`, con GET/POST para equipos,
GET/PATCH/DELETE para un equipo, POST/PATCH/DELETE para sus jugadores y GET/PUT
para `/api/teams/:id/whiteboard`. Los DELETE son lógicos; PATCH con
`deleted:false` restaura. Respuestas `{status, data}` o `{status,error}`.

Toda identidad procede de la sesión del servidor. Las escrituras requieren el
origen canónico, los identificadores y notas se validan, las lecturas verifican
la propiedad de cada fila y las respuestas privadas no se almacenan en caché.
Las credenciales siguen en Netlify. La API de NCB no ofrece una condición de
versión documentada: las ediciones simultáneas del mismo registro mantienen la
semántica de última escritura; no se anuncia bloqueo entre dispositivos.

## Interfaz y guardado

Selector de equipo, creación/renombrado/borrado, plantilla editable, papelera y
valoraciones con número y color. La pizarra incluye selección de jugadores del
equipo, y distingue «Quitar del set» de «Eliminar del equipo».

El cambio de equipo espera al guardado pendiente y se bloquea si este falla.
La carga fallida mantiene el editor deshabilitado; abrir una cuenta no guarda
valores vacíos encima de datos existentes. Cambiar al simulador mantiene el
componente montado, como en la versión anterior.

## Verificación requerida

Pruebas de CRUD, aislamiento, origen, límites y notas nulas/0/5; referencias a
jugadores ajenos rechazadas. Pruebas de componentes para edición compartida,
recarga, errores y cambios de equipo durante guardado. Construcción completa y
prueba real publicada de crear, editar, guardar, recuperar y borrar/restaurar
registros de prueba identificables, sin tocar equipos reales del usuario.
