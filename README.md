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

1. Escribe un título secreto y graba su nombre (máximo 20 segundos).
2. Pasa el dispositivo. El otro jugador escucha el audio invertido y graba una imitación.
3. Escuchen la imitación invertida, intenten adivinar y comparen con el original.

La grabación usa MediaRecorder; la inversión usa Web Audio API y revierte las muestras de cada canal. No requiere backend, IA, claves ni APIs de pago. Los audios permanecen en memoria hasta cambiar de ronda o recargar. El resultado puede descargarse en WAV. La animación es decorativa: no representa un análisis del micrófono.

Usa audífonos o separa a los jugadores durante la primera grabación. Esta versión es para jugar por turnos en el mismo dispositivo; no incluye salas remotas. Necesita permiso de micrófono y un navegador compatible con MediaRecorder y Web Audio. Debe comprobarse la captura con micrófonos reales en los dispositivos de destino.

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
