# Entorno de desarrollo online

El entorno online se ejecuta en la rama `dev-online`, separada de `main`:

- **Vercel Preview** sirve la interfaz web de la rama de desarrollo.
- **Render Web Service** ejecuta `npm run start:server`.
- **Render PostgreSQL** guarda el estado de sala, roles y turnos.
- **Cloudflare R2** guarda las grabaciones WAV privadas mientras la sala está activa.

No conectar estos servicios a datos ni credenciales de producción.

## Publicar el entorno de prueba

1. En Cloudflare, crear el bucket privado `voicegame-dev` y una credencial R2 con permisos de lectura, escritura y borrado solo sobre ese bucket. Guardar el Account ID, Access Key ID y Secret Access Key para configurarlos directamente en Render.
2. En Render, crear un Blueprint desde este repositorio y seleccionar `dev-online`. El archivo raíz `render.yaml` crea el Web Service y PostgreSQL de desarrollo. Ingresar los secretos de R2 cuando Render los solicite; no guardarlos en Git.
3. En Vercel, importar el mismo repositorio y establecer `dev-online` como rama de desarrollo. El proyecto debe conservar `main` como rama de producción; no configurar variables de salas en Production.
4. Esperar a que Render asigne la URL HTTPS del servicio y configurar `VITE_ROOM_API_URL` en Vercel para Preview con `<URL-HTTPS-DE-RENDER>/api`.
5. Hacer un primer despliegue Preview y copiar el dominio HTTPS de la URL estable de la rama `dev-online` (no una URL de preview por commit). En Render, configurar `WEB_ORIGINS` con ese origen exacto y los orígenes locales separados por comas. No usar `*`.
6. Volver a desplegar Preview. Comprobar `https://<servicio>.onrender.com/health`, crear una sala y unirse desde otro navegador o dispositivo.

El plan gratuito de Render es solo para pruebas: el Web Service puede suspenderse cuando está inactivo y la base de datos gratuita tiene retención limitada/fecha de expiración. No usarlo para partidas con datos que se necesiten conservar.

## Variables de entorno del backend en Render

Configurar en el servicio de desarrollo; los valores sensibles no se guardan en Git:

| Variable               | Descripción                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`         | URL interna de la base Render PostgreSQL de desarrollo                   |
| `PGSSLMODE`            | Usar `require` si la conexión del proveedor lo necesita                  |
| `R2_ACCOUNT_ID`        | ID de la cuenta Cloudflare                                               |
| `R2_ACCESS_KEY_ID`     | Clave de acceso R2 con permisos mínimos sobre el bucket de desarrollo    |
| `R2_SECRET_ACCESS_KEY` | Secreto de esa clave R2                                                  |
| `R2_BUCKET`            | Bucket privado de desarrollo, por ejemplo `voicegame-dev`                |
| `WEB_ORIGINS`          | Orígenes exactos de localhost y del dominio Vercel Preview permitido     |
| `NODE_ENV`             | Configurar `production` en Render para que el cliente PostgreSQL use TLS |

Comandos del servicio:

- **Build**: `npm ci`
- **Start**: `npm run start:server`
- **Health check**: `/health`

El backend aplica `server/schema.sql` al inicio y cada minuto busca salas cerradas o vencidas. La limpieza de una sala elimina sus objetos de R2 antes de eliminar la fila de PostgreSQL. Si el almacenamiento no responde, la sala queda inaccesible en estado `closing` para reintentar la limpieza.

## Variables de Vercel Preview

Configurar `VITE_ROOM_API_URL` únicamente para Preview, con la URL HTTPS del Web Service de Render y el sufijo `/api`, por ejemplo `https://<servicio>.onrender.com/api`. Configurar estas variables en el alcance Preview, no Production.

Añadir el dominio Preview exacto a `WEB_ORIGINS` en Render. No habilitar CORS para `*`.

## CORS de Cloudflare R2

El bucket debe permanecer privado. Configurar CORS para permitir únicamente:

- Origins: `http://localhost:5173` y el dominio Vercel Preview del proyecto.
- Methods: `PUT`, `GET`, `HEAD`.
- Allowed headers: `Content-Type`.

El navegador usa URLs firmadas válidas por dos minutos. Las credenciales R2 solo viven en Render; no se incluyen en el bundle web. El backend limita los audios a WAV de hasta 8 MB y 20 segundos de grabación.

## Desarrollo local

1. Copiar `.env.example` a `.env` y completar PostgreSQL/R2 de desarrollo.
2. Ejecutar `npm run dev:server` en una terminal.
3. Ejecutar `npm run dev` en otra terminal.
4. Abrir la URL de Vite en dos perfiles o navegadores distintos para probar ambos roles.

Las pruebas del servicio usan PostgreSQL embebido y almacenamiento falso; no requieren credenciales reales. Las pruebas de flujo del navegador mockean los servicios externos.

## Privacidad y retención

- Los enlaces de invitación y tokens de participante son secretos; compartirlos solo con la otra persona.
- Los tokens se guardan en `localStorage` del dispositivo para recuperación tras recargar.
- El estado de la sala se conserva en PostgreSQL y los objetos de audio se guardan bajo un bucket privado de R2.
- Cerrar la sala elimina audios y estado. Una sala sin actividad vence después de 24 horas.
- El sistema de limpieza reintenta salas en estado `closing`; revisar logs de Render ante fallos persistentes de eliminación.
- No guardar títulos ni tokens en logs. Rotar las credenciales de desarrollo si se exponen.
