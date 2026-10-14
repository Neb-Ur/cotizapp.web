# Referencias iniciales de vehículos — 13 de octubre de 2026

Se cargaron seis marcas con uso `vehiculo` y trece modelos generales, para dar opciones a los filtros públicos. La carga fue autorizada al solicitar referencias iniciales para los selectores. El manifiesto es `catalogo-vehiculos-inicial.json`; el importador es `functions/scripts/import-initial-vehicle-catalog.mjs`.

| Marca | Modelos | Fuente primaria de los nombres |
| --- | --- | --- |
| Toyota | Corolla, Hilux, Yaris | [Manual de garantía y servicio de Toyota Chile](https://toyota.cl/documents/94/REF_MANUAL_GARANTIA_Y_SERV_V05_1.pdf) |
| Nissan | Sentra, Versa | [Vehículos Nissan Chile](https://www.nissan.cl/vehiculos/nuevos-vehiculos.html) |
| Hyundai | Accent, Tucson | [Modelos Hyundai Chile](https://www.hyundai.cl/quiero-un-hyundai/) |
| Kia | Rio, Sportage | [Referencias de servicio a Rio](https://www.kia.cl/bases-legales.html), [Sportage](https://www.kia.cl/modelos/familiares-suv/kia-sportage.html) |
| Suzuki | Swift, Vitara | [Swift](https://www.suzuki.cl/vehiculo/swift-hybrid/), [Ficha Vitara de Suzuki Perú](https://www.suzuki.com.pe/media/sd5byvpf/ficha-te-cnica_new-vitara.pdf) |
| Chevrolet | Sail, Onix | [Catálogos y fichas técnicas Chevrolet Chile](https://www.chevrolet.cl/catalogo-accesorios-fichas-tecnicas) |

Las fuentes se usan para confirmar nombres generales de modelos actuales o históricos. El catálogo no afirma disponibilidad comercial actual, años de fabricación, motores, generaciones, carrocerías ni equivalencias entre variantes. No copia imágenes o textos comerciales de estas fuentes.

La carga conserva IDs de marcas/modelos existentes y el uso fabricante de una marca compartida. No reactiva modelos existentes inactivos. La segunda ejecución no agrega registros repetidos. Se guarda un recibo privado antes de aplicar y los cambios se escriben en una transacción en las mismas tablas PostgreSQL del catálogo; no hay modificación de esquema.

Estas referencias no asocian vehículos con productos u ofertas. La selección de año filtra únicamente los intervalos declarados por el vendedor en la misma combinación de marca/modelo. Las fichas base siguen sin compatibilidad confirmada ni ofertas. La configuración de nuevas escrituras de asociaciones conserva el piloto anterior.
