# Feature Specification: VoiceGame en línea

> **Estado**: Borrador de requisitos
> **Fecha**: 2026-11-07
> **Alcance**: Versión de desarrollo en una rama independiente de GitHub y Vercel Preview; no modifica el modo local ni la versión de producción.

## Scope Baseline

- **Método de descubrimiento**: revisión del flujo actual del juego local, sus roles, entrega de turno, captura/reproducción de audio y reglas de privacidad descritas en el README.
- **Elementos funcionales relevantes identificados**: 4 (crear reto, entregar turno, grabar/reproducir audio y adivinar/revelar).
- **Elementos en alcance**: esos 4 flujos adaptados para dos jugadores en dispositivos distintos, más salas de invitación, sincronización y recuperación de sesión.
- **Límite inicial**: dos participantes por sala; partidas por turnos; sin llamada de voz en vivo ni cuentas.
- **Despliegue de desarrollo acordado**: rama de GitHub separada (nombre propuesto: `dev-online`) conectada a un despliegue Preview de Vercel; `main` conserva la versión de producción.
- **Plataforma elegida para las salas**: Render alojará el servicio/backend de partidas del entorno de desarrollo; Vercel Preview alojará la interfaz web.
- **Almacenamiento elegido**: PostgreSQL administrado en Render para estado de salas y Cloudflare R2 privado para grabaciones temporales.

## User Scenarios & Testing

### User Story 1 - Crear y compartir una sala (Priority: P1)

Jugador 1 inicia una partida en línea, recibe una invitación privada y comparte el enlace o código con Jugador 2, sin necesidad de crear una cuenta.

**Why this priority**: es el punto de entrada para que dos personas puedan jugar desde dispositivos separados.

**Independent Test**: abrir dos navegadores independientes, crear una sala en uno y unirse desde el otro usando la invitación.

**Acceptance Scenarios**:

1. **Given** que Jugador 1 no tiene una partida activa, **When** crea una partida en línea, **Then** se crea una sala para dos jugadores y se muestra una invitación que puede copiar o compartir.
2. **Given** una invitación válida para una sala disponible, **When** Jugador 2 la abre, **Then** se une a esa sala y ambos dispositivos muestran que hay dos participantes conectados.
3. **Given** una sala que ya tiene dos participantes, **When** una tercera persona intenta unirse, **Then** no accede a la partida y recibe un mensaje comprensible.

### User Story 2 - Jugar por turnos en dispositivos separados (Priority: P1)

Jugador 1 establece el título secreto y graba el reto en su dispositivo. Jugador 2 recibe la señal de que es su turno, escucha el reto invertido, graba su imitación y la comparte con la sala. Ambos pueden continuar el flujo de adivinanza desde sus propios dispositivos.

**Why this priority**: conserva la mecánica central del juego y reemplaza el pase físico del teléfono.

**Independent Test**: completar una ronda desde dos dispositivos y comprobar que el cambio de turno, los audios y la pantalla de resultado se actualizan en ambos.

**Acceptance Scenarios**:

1. **Given** una sala con ambos jugadores, **When** Jugador 1 guarda el título y termina su grabación, **Then** el título permanece oculto para Jugador 2 y la sala habilita el turno de Jugador 2.
2. **Given** que es el turno de Jugador 2, **When** abre el reto, **Then** puede escuchar la grabación de Jugador 1 invertida y no puede acceder al título ni al audio original sin revelar.
3. **Given** que Jugador 2 termina su imitación, **When** la envía, **Then** ambos dispositivos reciben la misma imitación y pueden reproducirla invertida o tal como se grabó.
4. **Given** la etapa de adivinanza, **When** cualquiera de los participantes envía una respuesta, **Then** el resultado y los intentos restantes se sincronizan en la sala; una respuesta correcta muestra la victoria en ambos dispositivos.
5. **Given** que los jugadores eligen revelar la respuesta, **When** se confirma la acción, **Then** ambos pueden ver y escuchar el original de Jugador 1 con una advertencia visible de que contiene el título.

### User Story 3 - Recuperar una partida tras una interrupción (Priority: P1)

Cada participante puede recargar la página o volver a abrir la invitación mientras la sala siga activa y continuar desde el estado y turno actuales.

**Why this priority**: una recarga, cierre accidental de pestaña o interrupción breve no debe destruir una partida remota.

**Independent Test**: crear una sala, guardar el reto, recargar ambos clientes en distintos momentos y comprobar que recuperan el estado compartido sin volver a grabar.

**Acceptance Scenarios**:

1. **Given** una partida activa con datos guardados, **When** un jugador recarga su página o vuelve a abrir la invitación, **Then** recupera su identidad de participante, la sala y el estado vigente.
2. **Given** que un participante pierde temporalmente la conexión, **When** la conexión se restablece y la sala sigue activa, **Then** el participante recibe el estado más reciente y puede continuar sin duplicar la acción anterior.
3. **Given** que la sala ya terminó, se cerró o caducó, **When** alguien abre su invitación, **Then** no se recupera el contenido de la partida y se explica que la sala ya no está disponible.

### User Story 4 - Finalizar y eliminar una partida (Priority: P1)

Los participantes pueden terminar la partida y cerrar la sala. El sistema elimina el título y las grabaciones al terminarse/cerrarse la sala, y también limpia salas abandonadas según su política de caducidad.

**Why this priority**: el título y las voces son datos privados y solo son necesarios mientras la partida esté activa.

**Independent Test**: finalizar o cerrar una sala y verificar que la invitación deja de funcionar y que la partida no puede recuperarse.

**Acceptance Scenarios**:

1. **Given** una sala activa, **When** un participante confirma que desea terminarla, **Then** ambos reciben el aviso de cierre y dejan de poder reproducir o recuperar sus grabaciones.
2. **Given** una sala sin actividad durante el plazo de caducidad, **When** vence ese plazo, **Then** se cierra y se eliminan el título, las grabaciones y el estado asociado.
3. **Given** que alguien intenta usar después una invitación de una sala cerrada, **When** la abre, **Then** puede iniciar una nueva sala, pero no recuperar datos anteriores.

### Edge Cases

- Dos jugadores envían una respuesta casi simultáneamente: la sala registra las acciones una sola vez y muestra el mismo estado final a ambos.
- Un jugador intenta avanzar fuera de turno o repetir una grabación enviada: la sala rechaza la acción sin sobrescribir el estado válido.
- El permiso de micrófono se deniega, no existe micrófono o la grabación está vacía: el jugador recibe instrucciones para reintentar y el turno no avanza.
- La red se interrumpe durante una grabación o carga: se informa si el audio fue recibido; la acción no se presenta como exitosa hasta confirmarse.
- La invitación está malformada, fue revocada, la sala está llena o caducó: se muestra el motivo sin revelar información de la sala.
- Se recarga una página mientras una grabación local aún no se envió: se informa que esa grabación no quedó guardada y se permite reintentar.
- El usuario intenta reproducir el original antes de adivinar: el original permanece oculto tras una acción explícita de revelado y una advertencia de spoiler.
- Una sala queda abandonada sin que nadie pulse «cerrar»: se aplica el plazo de caducidad definido en Assumptions.

## Requirements

### Functional Requirements

- **REQ-001**: La experiencia en línea MUST permitir crear una sala para exactamente dos participantes sin exigir cuentas.
- **REQ-002**: Al crear una sala, el sistema MUST proporcionar una invitación privada que pueda compartirse como enlace o código.
- **REQ-003**: El sistema MUST permitir que el segundo participante se una mediante una invitación válida y MUST impedir que más de dos participantes entren a la misma partida.
- **REQ-004**: El sistema MUST asignar los roles existentes de Jugador 1 y Jugador 2 a los participantes de la sala y conservar la asignación al reconectarse.
- **REQ-005**: El sistema MUST mantener el título secreto y el audio original inaccesibles para Jugador 2 hasta que la partida permita revelarlos explícitamente.
- **REQ-006**: El sistema MUST sincronizar entre ambos dispositivos el estado de la partida, el turno activo, los cambios de etapa, los errores recuperables y el resultado de adivinanza.
- **REQ-007**: El sistema MUST permitir que Jugador 1 grabe y envíe el reto, y que Jugador 2 reciba el audio para escucharlo invertido y grabar y enviar su imitación.
- **REQ-008**: El sistema MUST entregar a ambos jugadores la imitación enviada y permitir escucharla invertida y sin invertir, con la opción de reproducción lenta ya existente para el audio invertido.
- **REQ-009**: El sistema MUST conservar los comportamientos existentes de victoria, respuesta incorrecta, revelado explícito del original y nueva ronda, sincronizándolos en la sala.
- **REQ-010**: Cualquiera de los dos participantes MUST poder proponer una respuesta; el sistema MUST resolver respuestas concurrentes de forma consistente y mostrar a ambos si la partida continúa o terminó.
- **REQ-011**: El estado compartido y las grabaciones MUST persistir en almacenamiento accesible desde ambos dispositivos durante la vida de la sala y MUST recuperarse al recargar o reconectar mientras la sala siga activa.
- **REQ-012**: Cualquiera de los participantes MUST poder cerrar la sala con confirmación; al cerrarla, el sistema MUST invalidar la invitación y eliminar el título, las grabaciones y el estado de la partida.
- **REQ-013**: El sistema MUST cerrar y limpiar automáticamente salas abandonadas cuando venza el plazo de caducidad comunicado a los jugadores.
- **REQ-014**: Las grabaciones MUST conservar el límite de duración de 20 segundos por audio establecido por el juego actual.
- **REQ-015**: El sistema MUST informar claramente cuando no se pueda unir, guardar una grabación, recuperar una sala o completar una acción por falta de conexión, permiso o caducidad; no MUST avanzar silenciosamente el juego.
- **REQ-016**: El sistema MUST validar la pertenencia a la sala para cada lectura o acción y MUST impedir que personas ajenas accedan al título, las grabaciones o el estado privado.
- **REQ-017**: La invitación MUST ser revocable al cerrar la sala y las solicitudes repetidas de unión MUST limitarse para reducir intentos automatizados de adivinar invitaciones.
- **REQ-018**: El modo en línea MUST desarrollarse en una rama de GitHub distinta de la rama de producción (propuesta: `dev-online`) y MUST publicarse como Vercel Preview, manteniendo el despliegue de producción vinculado a `main`.
- **REQ-019**: El despliegue Preview MUST usar configuración, secretos, dominio y almacenamiento independientes del entorno de producción; las pruebas y salas de desarrollo MUST NOT modificar ni leer datos de partidas de producción.
- **REQ-020**: Cada actualización de la rama de desarrollo MUST poder generar un despliegue Preview identificable y compartible para validar la versión online antes de promover cualquier cambio a producción.
- **REQ-021**: El servicio/backend de salas del entorno de desarrollo MUST alojarse en Render y comunicarse con la interfaz publicada en Vercel Preview.

### Key Entities

- **Sala**: partida compartida de dos participantes; contiene estado, etapa, actividad, invitación y ciclo de vida.
- **Participante**: persona que entra a la sala con un rol fijo y una sesión de acceso mientras participa.
- **Ronda**: unidad de juego con título, turno, respuestas y resultado.
- **Grabación**: audio asociado al reto de Jugador 1 o la imitación de Jugador 2, con dueño, tipo y estado de envío.
- **Invitación**: referencia privada para unirse a una sala; deja de ser válida al cerrarse o caducar la sala.

### Assumptions

- La primera versión remota será por turnos y no ofrecerá llamada de voz, video ni chat.
- Una sala admite dos participantes, cada uno en su propio dispositivo y navegador.
- Se mantienen los roles y reglas actuales: Jugador 1 prepara el reto; Jugador 2 escucha e imita.
- Se mantiene el límite actual de 20 segundos por grabación.
- Cualquiera de los dos jugadores puede enviar una respuesta durante la etapa compartida de adivinanza.
- Los datos y grabaciones se conservan temporalmente en un almacenamiento compartido del servicio, no solo en la caché local del navegador, para permitir recuperación entre dispositivos.
- Una sala inactiva caduca tras 24 horas sin actividad. El sistema avisa el plazo y elimina sus datos al caducar.
- La rama `main` y el dominio de producción permanecen sin cambios mientras se desarrolla el modo online en la rama separada propuesta `dev-online`.
- Vercel genera despliegues Preview a partir de la rama de desarrollo; las variables de entorno Preview y la URL de prueba se mantienen separadas de las de producción.
- Render aloja el servicio/backend de salas para desarrollo; Vercel Preview aloja la interfaz web y se conecta a dicho servicio.
- PostgreSQL y el bucket de Cloudflare R2 se aprovisionan exclusivamente para desarrollo, con credenciales distintas de producción. Render como plataforma del backend no implica guardar datos duraderos en el sistema de archivos local del servicio.
- Al cerrar una sala, el backend elimina sus objetos de audio de R2 y su estado de PostgreSQL. Una regla de ciclo de vida de R2 sirve como limpieza de respaldo de objetos huérfanos; no reemplaza el borrado inmediato solicitado al cierre.
- Las sugerencias de películas siguen siendo opcionales; el modo en línea no depende de ellas para crear o completar una partida.

## Success Criteria

### Measurable Outcomes

- **REQ-022 / SC-001**: Una persona puede crear una sala y compartir su invitación en menos de 60 segundos, sin registrarse.
- **REQ-023 / SC-002**: Al menos el 95 % de las acciones confirmadas de turno, grabación, respuesta y revelado se refleja en el otro dispositivo en menos de 2 segundos bajo una conexión estable.
- **REQ-024 / SC-003**: En pruebas de aceptación, ambos jugadores completan una ronda en dos dispositivos sin pasar físicamente un dispositivo ni volver a grabar tras una recarga de página.
- **REQ-025 / SC-004**: En el 100 % de las pruebas de control de acceso, una tercera persona o una invitación inválida no puede consultar ni modificar datos de la partida.
- **REQ-026 / SC-005**: En el 100 % de las pruebas de cierre y caducidad, el enlace deja de permitir acceso y ningún dato del juego puede recuperarse después de eliminarse.
- **REQ-027 / SC-006**: Ante desconexión, denegación del micrófono o fallo de carga, los jugadores ven un mensaje accionable y el turno no cambia hasta confirmar la acción requerida.
- **REQ-028 / SC-007**: En pruebas de usabilidad, al menos 9 de cada 10 parejas identifican correctamente qué jugador debe actuar y qué audio contiene la respuesta sin ayuda externa.
- **REQ-029 / SC-008**: Las actualizaciones del modo online pueden validarse mediante una URL de Preview sin cambiar el contenido ni la disponibilidad de la versión de producción.
