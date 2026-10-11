# VibraTok para Windows — ventana de aplicación

Esta versión evita Electron y abre VibraTok en una ventana independiente de Microsoft Edge o Google Chrome (modo aplicación, sin pestañas ni barra de direcciones). Requiere Node.js instalado y conexión a Internet en la primera instalación de dependencias.

## Primera vez
1. Extrae toda la carpeta a una ubicación fija.
2. Abre `INSTALAR_VIBRATOK.bat` una sola vez para instalar las dependencias y arrancar.
3. Para crear un icono en el Escritorio, ejecuta `CREAR_ACCESO_DIRECTO.bat`.

## Uso normal
Haz doble clic en el acceso directo `VibraTok` del Escritorio. No cierres la ventana de consola mientras usas la app.

Nota: esta versión da una ventana con aspecto de aplicación, pero no es un ejecutable autónomo ni un instalador nativo `.exe`; para eso habría que empaquetar y probar una compilación de Windows.


## Recuperación de contraseña por correo
La pantalla incluye recuperación mediante código de 6 dígitos, válido durante 10 minutos. Para enviar correos reales, el administrador del servidor debe configurar SMTP antes de iniciar VibraTok: `SMTP_HOST`, `SMTP_PORT` (normalmente 587), `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (opcional) y `SMTP_SECURE` (`true` solo si el proveedor usa TLS implícito, normalmente puerto 465). No introduzcas la contraseña de tu correo en la aplicación; estas variables son para quien administra el servidor. Sin SMTP configurado, VibraTok mostrará un aviso y no fingirá haber enviado el código.

## Recuperar contraseña por correo
La pantalla de recuperación solicita correo, código de 6 dígitos y contraseña nueva. Para que los códigos lleguen a una bandeja real, configura el envío SMTP una sola vez:

1. En Windows, haz doble clic en `CONFIGURAR_CORREO_GMAIL.bat`.
2. Escribe el Gmail remitente y una **contraseña de aplicación de Google** (no la contraseña normal de Gmail). Google requiere la verificación en dos pasos para generar una contraseña de aplicación.
3. Cierra el servidor VibraTok y vuelve a iniciarlo.
4. Solicita un código desde «¿Olvidaste tu contraseña?» y revisa Recibidos y Spam.

Guía de Nodemailer: https://nodemailer.com/guides/using-gmail
La configuración se guarda localmente en `%APPDATA%\VibraTokData\smtp-config.json`. Ese archivo contiene una credencial de aplicación; no lo compartas ni lo subas a Internet.


## Verificación de correo para registro y recuperación

El registro ahora solicita un código de 6 dígitos enviado al correo indicado por cada usuario. La cuenta se crea únicamente después de introducir el código correcto. La recuperación de contraseña también envía un código temporal al correo asociado a la cuenta. Los códigos caducan en 10 minutos y se limitan los intentos.

Antes de usar estas funciones, ejecuta `CONFIGURAR_CORREO_GMAIL.bat` en el equipo servidor e introduce la cuenta remitente y una contraseña de aplicación de Google. No uses ni compartas la contraseña normal de Gmail. La cuenta remitente configurada debe ser una cuenta controlada por el administrador de VibraTok. Sin configuración SMTP válida, no se enviarán códigos y el registro quedará bloqueado por seguridad.
