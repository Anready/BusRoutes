const shapefile = require("shapefile");
const fs = require("fs");
const csv = require("csv-parser");

const stopData = new Map();
const routeList = []; // Список маршрутов

class Stop {
  constructor(description, lat, lon, name) {
    this.description = description;
    this.lat = lat;
    this.lon = lon;
    this.name = name;
  }
}

// Читаем CSV с остановками
fs.createReadStream("stops.csv")
  .pipe(csv())
  .on("data", (row) => {
    const stop = new Stop(row.description, parseFloat(row.lat), parseFloat(row.lon), row.description);
    stopData.set(row.code, stop);
  })
  .on("end", () => {
    console.log("CSV файл успешно прочитан");
    shapefile.open("file.shp")
      .then(source => extractData(source))
      .catch(error => console.error("Ошибка чтения shapefile:", error));
  });

async function extractData(source) {
  let result;

  while (!(result = await source.read()).done) {
    const feature = result.value;
    const routeName = feature.properties.ROUTE_NAME.replace(/[\s\/]/g, "_"); // Убираем пробелы
    const lineId = feature.properties.LINE_ID;
    const lineName = feature.properties.LINE_NAME;
    const coordinates = feature.geometry.coordinates.map(coord => ({ lat: coord[1], lng: coord[0] }));

    // Собираем список остановок
    const stopIds = feature.properties.STOPS.split(",");
    const stops = stopIds.map(id => stopData.get(id)).filter(stop => stop !== undefined);

    // Создаём JSON-файл с координатами маршрута
    fs.writeFileSync(`${routeName}.json`, JSON.stringify(coordinates, null, 2));

    // Создаём JSON-файл с остановками маршрута
    fs.writeFileSync(`${routeName}stops.json`, JSON.stringify(stops, null, 2));

    // Добавляем строку в список маршрутов
    routeList.push(`${lineName}###${routeName}`);
  }
  routeList.sort((a, b) => {
            const routeA = a.split("###")[0].trim();
            const routeB = b.split("###")[0].trim();

            const [, letterA = "", numberA = ""] = routeA.match(/([^\d]*)(\d+)/) || [];
            const [, letterB = "", numberB = ""] = routeB.match(/([^\d]*)(\d+)/) || [];
            if (letterA !== letterB) {
                return letterA.localeCompare(letterB);
            }

            return parseInt(numberA, 10) - parseInt(numberB, 10);
        });
  // Сохраняем список маршрутов в отдельный файл
  fs.writeFileSync("routes_list.txt", routeList.join("\n"));

  console.log("Все файлы успешно созданы!");
}
