# Auditoría técnica — Asistente Financiero 0.2.0

## Resultado de validación local
- `npm run check`: aprobado.
- `npm test`: 10/10 pruebas aprobadas.
- Se añadieron 3 pruebas para detección de frecuencia semanal, corte exacto de las 15:00/15:01 y niveles de atraso.

## Cambios
1. Módulo de política de riesgo separado del dominio financiero principal.
2. Solo clasifica créditos cuya frecuencia está explícitamente marcada como semanal; no infiere frecuencia si el dato falta.
3. Usa fecha y hora `America/Lima` desde la aplicación para la regla de corte.
4. Actualiza el semáforo cada minuto aunque el snapshot remoto no cambie.
5. No modifica pagos, cuotas, clientes, créditos ni datos de Supabase.

## Límites y validaciones pendientes
- La regla es informativa y no sustituye la lógica de vencimiento ni genera recargos.
- Para confirmar el pago antes de las 15:00 se necesita que la fuente de pagos exponga una hora de registro confiable; el snapshot actual consultado no garantiza ese dato. Por eso la interfaz advierte que no presume puntualidad por falta de hora.
- La frecuencia semanal debe estar guardada en uno de los campos reconocidos. Si el esquema usa otro nombre o valores, se debe adaptar con una muestra real del payload.
- No se ha conectado esta compilación a una cuenta Supabase real ni se ha ejecutado una migración en producción.
- No es un APK compilado; es el código fuente PWA/Capacitor empaquetado en ZIP.
- La rentabilidad contable, predicción de recuperación, comparativos por asesor/zona y recomendaciones gerenciales avanzadas siguen pendientes de datos confiables y definición de métricas. No se presentan como implementadas.

## Comandos ejecutados
```bash
npm test
npm run check
```
