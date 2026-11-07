# VoiceGame

MVP de un juego local para dos o más personas, construido con React y Vite.

## Desarrollo

Requiere Node.js 20 o superior.

```sh
npm install
npm run dev
```

## Producción

```sh
npm run build
```

Publica `dist/` en un hosting estático con HTTPS. Para desarrollo, localhost también permite acceder al micrófono.

## Cómo jugar

1. El jugador 1 escribe un título secreto y graba su nombre (máximo 20 segundos).
2. Al terminar, pasa el dispositivo al jugador 2. El reto permanece oculto hasta que el jugador 2 confirme que está listo.
3. El jugador 2 escucha el audio invertido y graba una imitación.
4. Escuchen la imitación invertida y tal como se grabó, e intenten adivinar. El audio original de Jugador 1 contiene el título: solo muéstrenlo después de adivinar. Si lo necesitan, pueden ralentizar el audio invertido al 85 % de su velocidad normal.
5. Si la respuesta es correcta, aparece la pantalla de victoria. Una respuesta incorrecta permite seguir intentando y revelar la película cuando quieran.

La grabación usa MediaRecorder; la inversión usa Web Audio API y revierte las muestras de cada canal. La velocidad reducida solo cambia la reproducción; no altera el audio grabado ni el archivo descargado. El tema oscuro está integrado y no requiere configuración. Si lo desean, pueden pedir un título aleatorio en español a [Wikidata Query Service](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual), sin clave y solo al pulsar el botón de sugerencia. Se selecciona un título al azar entre hasta 50 resultados con etiqueta en español; requiere conexión a internet y la consulta revela a Wikidata la dirección IP del visitante, pero no envía el título secreto ni las grabaciones. Si el servicio no está disponible, se puede escribir el título manualmente. Los audios permanecen en memoria hasta cambiar de ronda o recargar. El resultado puede descargarse en WAV. La animación de onda es decorativa: no representa un análisis del micrófono.

Usa audífonos o separa a los jugadores durante la primera grabación. Esta versión es para jugar por turnos en el mismo dispositivo; no incluye salas remotas. Necesita permiso de micrófono y un navegador compatible con MediaRecorder y Web Audio. Debe comprobarse la captura con micrófonos reales en los dispositivos de destino.

## Modo online (desarrollo)

El modo online se desarrolla en la rama `dev-online`, separada de `main`. Usa Vercel Preview para la interfaz, Render para el servicio de salas y PostgreSQL, y un bucket privado de Cloudflare R2 para audios temporales. El [Blueprint de Render](./render.yaml) crea el servicio y la base de datos de desarrollo. Antes de probar, completa la [guía de publicación y configuración](./docs/online-play/development-setup.md). No conectes Preview a credenciales o datos de producción.

## Subir a GitHub

Extrae el ZIP y abre la carpeta voicegame en la terminal. Crea un repositorio vacío en GitHub y ejecuta:

```sh
git init
git add .
git commit -m "Initial VoiceGame MVP"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/voicegame.git
git push -u origin main
```

## Publicar en Vercel

Importa el repositorio de GitHub como un proyecto Vite.

- Root Directory: raíz del repositorio (donde está package.json).
- Build Command: npm run build
- Output Directory: dist
- Install Command: npm install
- No requiere variables de entorno.

El micrófono necesita HTTPS o localhost. Vercel proporciona HTTPS en el dominio del despliegue.
