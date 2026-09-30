# Voces locales de TikReader

## Subtítulos locales Vosk

Motor Vosk y modelo pequeño en español 0.42, Alpha Cephei / AC Technologies LLC.
Fuente: https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
Licencia: Apache-2.0. El modelo se incluye en la instalación para que los
subtítulos del micrófono funcionen sin descargas ni servicios externos.
La procedencia y los SHA-256 están en `assets/speech`.

## Kokoro 1.0

Autor del modelo: hexgrad / rzvzn. Modelo y voces publicados bajo Apache-2.0.
Fuente: https://huggingface.co/hexgrad/Kokoro-82M
Catálogo: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
Se utiliza una conversión ONNX, sin modificar los pesos ni mezclar voces.
Conversión: https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0

La ficha del autor declara entrenamiento con datos permisivos o no sujetos a copyright.
Se conserva la ficha completa con sus atribuciones en assets/kokoro/MODEL_CARD.md.
Incluye atribución de Koniwa tnc (CC BY 3.0) y SIWIS (CC BY 4.0):
- https://github.com/koniwa/koniwa
- https://datashare.ed.ac.uk/handle/10283/2353
- https://creativecommons.org/licenses/by/3.0/
- https://creativecommons.org/licenses/by/4.0/

La licencia completa del modelo se guarda en assets/kokoro/MODEL_LICENSE.
La procedencia y SHA256 de cada descarga están en assets/kokoro/sources.json.
Los identificadores/nombres son los del catálogo de Kokoro; no son voces de
Casterlabs, Microsoft ni Google, ni se presentan como imitaciones de personas.

## Motor y dependencias

kokoro-onnx 0.4.9, thewh1teagle: MIT. Se conserva ENGINE_LICENSE junto al modelo.
https://github.com/thewh1teagle/kokoro-onnx
ONNX Runtime: MIT. NumPy: BSD. eSpeak NG y phonemizer: GPL-3.0.
Se instalan como dependencias en un entorno aislado, conservando sus metadatos
y licencias. No se modifica su código. Antes de distribuir un instalador que
incluya estas dependencias debe incluirse el código fuente correspondiente
según las licencias GPL, además de los avisos y licencias de las demás dependencias.

## Funcionamiento

La instalación descarga los archivos una vez. La síntesis utiliza exclusivamente
archivos locales, CPU y un proceso con conexiones de red deshabilitadas.
No descarga modelos al leer comentarios, no envía texto a APIs y no tiene fallback
en línea. El motor permanece en RAM hasta cerrar TikReader.

No se instalaron voces del Narrador mediante adaptadores no oficiales, Microsoft
Sam de paquetes antiguos ni DECtalk. Las voces existentes y modelos RVC importados
por el usuario no se sustituyeron; su licencia no forma parte de esta instalación.
