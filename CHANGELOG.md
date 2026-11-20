## 0.3.2
- Navegación móvil tipo drawer con fondo modal, cierre por selección, toque exterior y tecla Escape.
- Botón de menú accesible con estado aria-expanded y relación aria-controls.
- Pulido de microinteracciones: brillo sutil en botones, movimiento ambiental, entrada animada de gráficos y brillo de progreso.
- Ajustes responsive para encabezado, tarjetas y controles en pantallas pequeñas.
- Se respeta prefers-reduced-motion; no se alteran cálculos, datos ni operaciones financieras.

## 0.3.1
- Renovación visual premium con paleta grafito, ámbar y naranja cálido.
- Glassmorphism mejorado en paneles, tarjetas y pantalla de acceso.
- Microinteracciones de elevación, bordes luminosos y entrada progresiva de indicadores.
- Ajustes de foco accesible y respeto a la preferencia de movimiento reducido.
- Cambios limitados a presentación: no se modifican cálculos, datos ni operaciones financieras.

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


## 0.4.0 — Dashboard ejecutivo y experiencia móvil
- Dashboard: selector de tendencia de recaudación de 7 o 30 días, con barras animadas, etiquetas accesibles y desplazamiento horizontal en móvil.
- Navegación: iconografía SVG coherente y mejor jerarquía visual en el menú lateral.
- Transiciones: entrada suave al cambiar de módulo, respetando `prefers-reduced-motion`.
- Paneles: controles para contraer y expandir paneles sin alterar los datos mostrados.
- Android: reducción de desenfoques y efectos costosos en pantallas pequeñas, optimización de áreas de repintado y actualización de caché del service worker.
- Sin cambios en reglas de cálculo financiero, esquema de Supabase, autenticación ni políticas de seguridad. La recomendación 6 queda expresamente pendiente.

## Preparación Android — build reproducible
- Añadido script `scripts/build-android-debug.sh` para validar, sincronizar Capacitor y compilar `assembleDebug`.
- Añadido workflow GitHub Actions para generar y publicar como artefacto el APK debug.
- Documentados los requisitos del SDK y la diferencia entre APK debug y release firmado.
