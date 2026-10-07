# Best-quality cutouts

These files power the "Best" option in Make a cutout. They load only when someone picks Best, run on that person's device, and are kept by the browser after the first time.

- `silueta.onnx`: the silueta model from the rembg project (a smaller U²-Net). U²-Net is Apache-2.0; rembg is MIT. Taken from the npm package `@rmbg/model-silueta` (the five parts joined).
- `ort.wasm.min.js`, `ort-wasm-simd-threaded.wasm`, `ort-wasm-simd-threaded.mjs`: ONNX Runtime Web 1.20.1 (MIT), from the npm package `onnxruntime-web`.
