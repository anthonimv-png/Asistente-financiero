# MANUAL DE PUESTA EN MARCHA — ASISTENTE FINANCIERO 0.1.2

## 1. Antes de empezar
Necesitas acceso de administrador al proyecto Supabase de la aplicación principal, el correo/contraseña del usuario propietario, Node.js LTS y (para APK) Android Studio. Conserva una copia de seguridad de la base antes de ejecutar SQL. No compartas contraseñas ni claves secretas por chat.

## 2. Verificar la base existente
En Supabase abre **SQL Editor** y ejecuta primero una consulta de solo lectura:

```sql
select table_name from information_schema.tables
where table_schema='public'
  and table_name in ('businesses','business_sync_state');

select table_name, column_name, data_type
from information_schema.columns
where table_schema='public'
  and table_name in ('businesses','business_sync_state')
order by table_name, ordinal_position;
```

Deben existir `businesses.owner_user_id` y `business_sync_state.business_id`, `revision`, `payload`, `updated_at`. La migración también supone que `businesses.id` es UUID y que `auth.uid()` identifica al propietario. Si falta algo, detente y comparte el resultado (ocultando datos personales) antes de ejecutar la migración.

## 3. Aplicar la migración
Si confirmaste que `schema_sync.sql` y `schema_roles.sql` de la versión 0.39.1 ya se ejecutaron y que las columnas anteriores existen:
1. Abre el archivo `supabase/migrations/001_asistente_financiero.sql`.
2. Copia todo su contenido en **Supabase → SQL Editor → New query**.
3. Pulsa **Run** una sola vez.
4. Comprueba que aparecen las tablas `assistant_alerts` y `assistant_preferences`, y las funciones `assistant_get_snapshot`, `assistant_get_preferences`, `assistant_save_preferences`, `assistant_mark_alerts_read`.

La migración no debe ejecutarse antes de las tablas base. No crea otra empresa ni modifica los registros financieros.

## 4. Configurar la aplicación web
1. Descomprime el ZIP en tu PC.
2. Publica la carpeta `www` en un hosting HTTPS (por ejemplo, un hosting estático).
3. Abre la dirección web.
4. En la pantalla inicial introduce **Project URL** y clave pública `anon`/`publishable` del mismo proyecto Supabase. Se encuentran en **Project Settings → API** (la etiqueta puede variar en el panel).
5. Inicia sesión con el correo y contraseña del propietario que creó el espacio empresarial.
6. Verifica que el dashboard muestre fecha/revisión de actualización y cifras coherentes con la aplicación principal.

No uses una clave `service_role` en el navegador o APK.

## 5. Activar el chat con IA
Requiere Supabase CLI instalado y el proyecto enlazado. Desde la carpeta del proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy assistant-chat
supabase secrets set OPENAI_API_KEY=TU_CLAVE OPENAI_MODEL=MODELO_DISPONIBLE
```

Sustituye los valores en tu terminal; no los pegues en archivos públicos. La clave de IA debe pertenecer a un proveedor/modelo que tengas habilitado. Después prueba una pregunta financiera sencilla y comprueba que la respuesta indique datos de la revisión actual.

## 6. Preparar Android
Instala Node.js LTS y Android Studio. En la raíz del proyecto ejecuta:

```bash
npm install
npm run check
npx cap add android
npx cap sync android
npx cap open android
```

En Android Studio espera la sincronización de Gradle y usa **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Instala primero en un teléfono de prueba. El identificador de paquete de esta entrega es `pe.asistentefinanciero.app`.

## 7. Notificaciones con la app cerrada (pendiente)
Las notificaciones web incluidas funcionan solo en escenarios compatibles y con la app/navegador habilitado; no equivalen a push Android garantizado. Para FCM: crear proyecto Firebase, registrar la app Android con el mismo package id, descargar `google-services.json`, añadir el plugin/configuración Firebase al proyecto Capacitor, solicitar permiso de notificaciones en Android 13+, registrar el token en backend y enviar push desde una Edge Function segura. No guardar credenciales privadas Firebase en el APK. Esta fase necesita configuración adicional y pruebas en dispositivo real.

## 8. Voz y tareas automáticas (pendientes)
El chat IA por texto requiere desplegar Edge Function y configurar secretos. Voz (reconocimiento y lectura en voz alta) todavía requiere integrar y probar APIs/plugin compatibles con Android y navegador. No asumir que el micrófono funciona hasta probar permisos y dispositivo. Para tareas periódicas Android usar WorkManager; no confiar en JavaScript ejecutándose permanentemente con la app cerrada.

## 9. Lista de pruebas antes de usar
- [ ] Login correcto solo con la cuenta propietaria.
- [ ] Usuario no propietario rechazado.
- [ ] Snapshot y nombre del espacio empresarial correctos.
- [ ] Dashboard coincide con la aplicación principal para el mismo día.
- [ ] Pagos parciales, pagos anulados/reactivados y cuotas reprogramadas.
- [ ] Interés corriente y moratorio, egresos y créditos pendientes.
- [ ] Realtime al registrar un pago desde la aplicación principal.
- [ ] Alertas sin duplicados.
- [ ] Chat IA no inventa cifras ni expone datos personales innecesarios.
- [ ] APK en Android y PWA en PC.
- [ ] Push FCM con app cerrada (cuando se complete esa fase).

## 10. Si aparece un error
- **No existe espacio empresarial/base central:** inicializa/sincroniza primero desde la aplicación principal y revisa que el usuario autenticado sea el propietario.
- **permission denied / 42501:** revisar que el usuario sea `businesses.owner_user_id` y que RLS/RPC se haya aplicado correctamente.
- **function not found:** vuelve a verificar que la migración se ejecutó en el proyecto Supabase correcto.
- **No actualiza en vivo:** comprobar Realtime y la publicación `supabase_realtime`; mientras la app está abierta hay refresco de respaldo cada minuto.
- **Chat IA no configurado:** comprobar despliegue de `assistant-chat` y secretos `OPENAI_API_KEY` y `OPENAI_MODEL`.

## 11. Qué falta para considerar producción
Migración aplicada y validada con esquema real; web publicada con HTTPS; Edge Function IA desplegada; pruebas funcionales con datos de prueba; configuración FCM y APK firmado; pruebas de seguridad/RLS y revisión de cálculos. Esta entrega no modifica la aplicación principal ni ejecuta operaciones financieras.
