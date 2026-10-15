# Морской фон

- Файл: [`assets/caspian-water.webp`](../assets/caspian-water.webp).
- Размер: 1024×1536, 174 222 байта. Из исходного PNG выполнено только кодирование в WebP quality 75, без изменения композиции или размеров.
- Создан 16 октября 2026 встроенным инструментом `image_gen`, без CLI/API fallback.
- Фотореалистичное сгенерированное изображение, вдохновлённое Каспием. Не документальная фотография конкретного места.
- В версии 2.2 на мониторе изображение служит текстурой [локальной WebGL-анимации](water-renderer.md) и статическим fallback при reduced motion или отказе графики. На отдельной мобильной форме остаётся CSS-дрейф. Изображение не является видео; недоступность файла не блокирует действия.

## Точный prompt

```text
Use case: photorealistic-natural. Asset type: photographic water background for a premium mobile-first guest feedback web interface for a small seaside coffee shop in Aktau, inspired by the Caspian Sea. Generate ONLY the background image, no interface or text. Vertical portrait composition, 1024x1536. A close, slightly elevated diagonal view across real deep blue-green Caspian water. Entire frame is water, no sky, no horizon, no land. Irregular physically realistic wind-driven small waves with overlapping oblique wavelets, fine choppy ripples, translucent teal troughs and a few soft silver-white foamy crests, natural sparse glints. The waves must not be smooth sine curves or parallel identical lines. Restrained photographic color grading, deep petroleum blue and natural sea green, soft late afternoon diffused light, realistic surface detail, quiet and refined, believable natural photography. Compose a broad slightly darker low-contrast calm zone in the upper central half for UI readability, with most detailed organic breaking ripples along the lower third and sides. Avoid dramatic surf, huge crashing waves, tropical turquoise, sandy beaches, boats, people, coastlines, buildings, rocks, sunsets, gold gradients, logos, letters, watermarks and abstract vector shapes. Full-frame detailed photographic water, suitable to crop naturally on landscape as well as portrait screens.
```
