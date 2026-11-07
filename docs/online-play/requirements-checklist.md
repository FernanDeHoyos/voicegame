# Requirements Quality Checklist: VoiceGame en línea

## Requirement ID Coverage

- [x] Los requisitos y criterios usan IDs `REQ-XXX`.
- [x] Los IDs son únicos y secuenciales.
- [x] Cada requisito es comprobable de forma independiente.

## Testability

- [x] Historias priorizadas e independientes con escenarios Given-When-Then.
- [x] Casos límite cubren red, turnos, grabación, concurrencia, invitaciones y privacidad.
- [x] Los criterios de éxito son observables y medibles.

## Completeness

- [x] Scope Baseline describe el flujo actual revisado y el alcance del modo en línea.
- [x] Se cubren creación y unión a sala, turnos remotos, recuperación y cierre/limpieza.
- [x] Entidades principales y política temporal de datos están identificadas.
- [x] Se especifica una rama GitHub separada (`dev-online`, nombre propuesto) y despliegues Vercel Preview separados de producción.
- [x] Se elige Render para alojar el backend de salas del entorno de desarrollo.
- [x] Se elige Render PostgreSQL para estado de salas y Cloudflare R2 para audios temporales.
- [x] Se establece que backend y almacenamiento de pruebas no deben compartir datos con producción.

## Open Decisions

- [ ] Configurar y revisar límites, costos y ubicación de datos en Render y Cloudflare antes del despliegue público.
