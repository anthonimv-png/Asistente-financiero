# ASISTENTE FINANCIERO — versión 0.2.0

Aplicación independiente para navegador de PC (PWA) y Android mediante Capacitor. Se conecta al mismo proyecto Supabase y al mismo espacio empresarial ya utilizado por la aplicación principal. No crea otra empresa ni copia clientes, créditos, pagos o egresos.

## Incluido en esta entrega
- Inicio de sesión con Supabase Auth y validación de propietario.
- Consulta de `business_sync_state` mediante RPC `assistant_get_snapshot()`.
- Dashboard financiero y de cobranza basado en el snapshot sincronizado.
- Actualización Realtime y refresco de respaldo cada 60 segundos mientras está abierta.
- Semáforo de riesgo para créditos identificados explícitamente como semanales: al día hasta las 3:00 p. m.; riesgo moderado desde las 3:01 p. m.; riesgo alto de 1 a 14 días; crítico después de 14 días.
- El semáforo se recalcula cada minuto con hora de Lima aunque el snapshot no haya cambiado; no presume que un pago fue puntual si el origen no aporta hora de registro.
- Alertas almacenadas en Supabase para pagos, egresos y créditos listos para desembolso.
- Preferencias de alertas, informes imprimibles/guardables como PDF y consultas rápidas.
- Función Edge `assistant-chat` como base para consultas IA.
- PWA responsive y configuración de Capacitor.

## No está terminado todavía
Esta entrega es una base de proyecto, no un APK compilado ni un servicio desplegado. Requiere ejecutar y validar la migración en tu proyecto, introducir URL/clave pública, desplegar Edge Function y configurar proveedor IA. Push FCM con la app cerrada, empaquetado Android, voz avanzada y pruebas integrales quedan como tareas de puesta en marcha.

## Requisito de base de datos
La migración debe aplicarse solo después de que las migraciones base de la aplicación principal hayan creado `public.businesses` (con `owner_user_id`) y `public.business_sync_state` (con `business_id`, `revision`, `payload`, `updated_at`). Si `schema_sync.sql` y `schema_roles.sql` de la versión 0.39.1 ya fueron ejecutadas correctamente, aplica únicamente `001_asistente_financiero.sql`. Si no estás seguro, no ejecutes todavía: primero verifica las tablas y columnas.

## Seguridad
El navegador y el APK reciben únicamente Project URL y clave pública (`anon` o `publishable`). Nunca incluyas `service_role` ni claves privadas en el frontend. La IA usa secretos de servidor en Supabase Edge Functions. La aplicación es de consulta y análisis; no ejecuta pagos, desembolsos ni modificaciones de créditos.

## Ejecutar localmente
Requiere Node.js LTS. Desde esta carpeta:

```bash
npm install
npm run check
npm test
```

Para Android, instala Android Studio y SDK Android:

```bash
npx cap add android
npx cap sync android
npx cap open android
```

Genera el APK desde Android Studio. La configuración de Firebase/FCM no viene incluida: debe hacerse con el proyecto Firebase propio y su `google-services.json`.

## Nota de privacidad de IA
Al utilizar la función `assistant-chat`, se envía al proveedor IA un resumen con nombres de clientes y datos financieros necesarios para responder consultas. Se excluyen DNI, teléfonos, direcciones, fotografías, pagarés, firmas y notas privadas. Aun así, nombres y cifras financieras son información sensible: revisa la política de privacidad y las autorizaciones aplicables antes de desplegar o habilitar esta función.

La clasificación semanal depende de que el crédito tenga un campo de frecuencia reconocido (`paymentFrequency`, `frequency`, `paymentPeriod`, `periodicity` o `installmentFrequency`) con valor semanal. No cambia ni corrige el estado de los créditos en la aplicación principal.

Consulta `AUDITORIA_0.2.0.md` para el alcance de las correcciones y las validaciones pendientes.


## Versión 0.3.0 — caja e inteligencia gerencial

Incluye vistas de control de caja e inteligencia gerencial en modo de consulta. La caja distingue únicamente Efectivo y BCP/Yape; los medios ausentes o no reconocidos permanecen como “Sin identificar”. La conciliación bancaria/efectivo no se declara completada sin extracto bancario y cierre de caja verificables. Los análisis por asesor solo se muestran si el snapshot contiene esa atribución.

Esta aplicación no registra ni modifica créditos, pagos o clientes.
