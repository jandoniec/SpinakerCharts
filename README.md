# SpinakerCharts 0.6.2

SpinakerCharts is a JavaScript charting library for interactive data visualization. It includes standard charts, sailing charts, synchronized telemetry replay, UTC time support and PNG export.

## Requirements

Node.js 18 or newer. No runtime dependencies.

## Usage

```js
import { createChart } from "./src/index.js";

createChart("#chart", {
  type: "line",
  data: [
    { time: "10:00", speed: 6.2 },
    { time: "10:01", speed: 7.1 },
    { time: "10:02", speed: 6.8 }
  ],
  x: "time",
  y: "speed",
  theme: "midnight"
});
```

## Demo

Run `npm run demo` and open:

- `http://localhost:8080/demo/`
- `http://localhost:8080/demo/sailing.html`
- `http://localhost:8080/demo/studio.html`

## Tests

Run `npm test`.

## License

Licensed under the MIT License. See [LICENSE](LICENSE).
