# Cambios

## 0.3.0
- Nuevo módulo de control y conciliación de caja en modo de solo lectura.
- Se muestran exclusivamente los canales Efectivo y BCP/Yape (una sola cuenta/canal compartido).
- Los pagos con medio ausente o no reconocido quedan como “Sin identificar”; no se asignan por inferencia.
- Filtros de 7, 14, 30 y 90 días para la vista de caja y el análisis gerencial.
- Nuevo centro de inteligencia con recaudación del periodo, cartera activa, capital pendiente y antigüedad de cuotas vencidas.
- Recaudación por asesor solo cuando el nombre del asesor está presente en los datos disponibles.
- Estado de conciliación explícitamente pendiente mientras no existan arqueos de efectivo y movimientos bancarios para comparar.
- No se agregan operaciones de escritura sobre créditos, pagos o clientes.

## 0.2.0
- Semáforo de seguimiento de créditos semanales.
- Reglas de vencimiento hasta las 3:00 p. m. hora Perú.
