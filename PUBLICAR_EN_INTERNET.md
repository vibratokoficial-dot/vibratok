# VibraTok: publicación pública (Render)

Este paquete deja preparada la configuración de despliegue, pero **no publica el servicio por sí solo**. Hace falta que el propietario cree/inicie sesión en una cuenta de hosting y conecte este proyecto desde un repositorio Git. No compartas contraseñas ni credenciales por chat.

## Qué hace falta
- Cuenta en Render y una cuenta GitHub para subir este proyecto a un repositorio privado.
- Un Gmail remitente controlado por el propietario, con verificación en dos pasos y contraseña de aplicación de Google.
- El plan de hosting con disco persistente habilitado para conservar las cuentas y archivos subidos. El `render.yaml` solicita un servicio Starter y un disco persistente de 1 GB; Render puede cobrar por estos recursos.

## Pasos
1. En tu computadora, crea un repositorio **privado** en GitHub y sube los archivos de esta carpeta. No subas nunca credenciales SMTP ni archivos con contraseñas.
2. En Render, crea un servicio nuevo tipo Blueprint y conecta ese repositorio. Render leerá `render.yaml`.
3. En la configuración del servicio, completa las variables secretas:
   - `SMTP_USER`: dirección Gmail remitente, por ejemplo `vibratokoficial@gmail.com`.
   - `SMTP_PASS`: contraseña de aplicación de Google (NO la contraseña normal de Gmail).
   - `SMTP_FROM`: `VibraTok <vibratokoficial@gmail.com>`.
   - El resto de variables SMTP ya tiene valores para Gmail (`smtp.gmail.com`, puerto 465, TLS).
4. Espera a que el despliegue termine. Abre la URL `https://...onrender.com` que Render asigna.
5. Comprueba `https://TU-SERVICIO.onrender.com/api/health`; debe devolver `ok: true`.
6. Desde el iPhone, abre la misma URL en Safari. Ya no depende del Wi-Fi de tu casa.
7. Prueba un registro con un correo distinto al remitente, verifica que llega el código y luego prueba recuperación de contraseña.

## Limitaciones importantes antes de abrirlo al público
- La app actual usa una base JSON y almacenamiento de archivos en un disco persistente local: apropiado para pruebas pequeñas, no para una red social grande. Para producción real se recomienda migrar a PostgreSQL y almacenamiento de medios tipo S3/R2, con copias de seguridad.
- Los códigos pendientes de registro/recuperación viven en memoria; un reinicio puede invalidarlos, así que se deberá volver a solicitar el código.
- No se ha realizado un despliegue real ni una prueba de entrega de correos desde aquí. El envío solo estará activo tras introducir credenciales válidas y verificarlo.
- No publiques el repositorio como público ni subas credenciales. La URL HTTPS de Render puede usarse para pruebas; dominio propio no es necesario al principio.
