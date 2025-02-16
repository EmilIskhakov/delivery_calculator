function doGet(e) {
  try {
    // Получаем параметры из запроса
    const category = e.parameter.category || '';
    const weight = parseFloat(e.parameter.weight) || 0;
    const length = parseFloat(e.parameter.length) || 0;
    const width = parseFloat(e.parameter.width) || 0;
    const height = parseFloat(e.parameter.height) || 0;
    const cost = parseFloat(e.parameter.cost) || 0;
    const quantity = parseInt(e.parameter.quantity) || 1; // Количество коробок

    // Проверяем, что все параметры указаны
    if (!category || isNaN(weight) || isNaN(length) || isNaN(width) || isNaN(height) || isNaN(cost) || isNaN(quantity)) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Не все параметры указаны" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Расчет объема и плотности
    const volumePerBox = (length / 100) * (width / 100) * (height / 100); // Объем одной коробки в м³
    const totalVolume = volumePerBox * quantity; // Общий объем
    if (volumePerBox === 0) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Объем не может быть равен нулю" })).setMimeType(ContentService.MimeType.JSON);
    }
    const density = weight / volumePerBox; // Плотность одной коробки

    // Рассчитываем стоимость товара за кг
    const costPerKg = cost / (weight * quantity);

    // Определяем процент страхования
    let insuranceRate;
    if (costPerKg < 20) {
      insuranceRate = 0.01; // 1%
    } else if (costPerKg >= 20 && costPerKg < 30) {
      insuranceRate = 0.02; // 2%
    } else {
      insuranceRate = 0.03; // 3%
    }

    // Рассчитываем сумму страхового платежа
    const insurance = cost * insuranceRate;

    // Получаем данные из листа Weight
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const weightSheet = ss.getSheetByName("Weight");
    const densitySheet = ss.getSheetByName("Density");

    // Находим строку с подходящим диапазоном веса
    const weightData = weightSheet.getDataRange().getValues();
    let resultRowWeight = null;
    for (let i = 1; i < weightData.length; i++) {
      const row = weightData[i];
      const minWeight = parseFloat(row[0]);
      const maxWeight = parseFloat(row[1]);
      if (weight >= minWeight && weight < maxWeight) {
        resultRowWeight = row;
        break;
      }
    }

    // Если диапазон не найден, возвращаем ошибку
    if (!resultRowWeight) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Вес не попадает в диапазон" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Извлекаем данные из найденной строки Weight
    const packingFactorBag = parseFloat(resultRowWeight[2]); // Коэффициент упаковки (Мешок)
    const packagingCostBag = parseFloat(resultRowWeight[4]) * quantity; // Стоимость упаковки (Мешок) × количество коробок
    const unloadCostBag = parseFloat(resultRowWeight[5]) * quantity; // Разгрузка (Мешок) × количество коробок
    const additionalWeightCorners = parseFloat(resultRowWeight[6]); // Дополнительный вес (Углы)
    const packagingCostCorners = parseFloat(resultRowWeight[8]) * quantity; // Стоимость упаковки (Углы) × количество коробок
    const unloadCostCorners = parseFloat(resultRowWeight[9]) * quantity; // Разгрузка (Углы) × количество коробок
    const additionalWeightFrame = parseFloat(resultRowWeight[10]); // Дополнительный вес (Каркас)
    const packagingCostFrame = parseFloat(resultRowWeight[12]) * quantity; // Стоимость упаковки (Каркас) × количество коробок
    const unloadCostFrame = parseFloat(resultRowWeight[13]) * quantity; // Разгрузка (Каркас) × количество коробок

    // Находим строку с подходящей плотностью на листе Density
    const densityData = densitySheet.getDataRange().getValues();
    let resultRowDensity = null;
    for (let i = 1; i < densityData.length; i++) {
      const row = densityData[i];
      const rowCategory = row[0]; // Категория
      const minDensity = parseFloat(row[1]); // Минимальная плотность
      const maxDensity = parseFloat(row[2]); // Максимальная плотность
      if (rowCategory === category && density >= minDensity && density < maxDensity) {
        resultRowDensity = row;
        break;
      }
    }

    // Если строка не найдена, возвращаем ошибку
    if (!resultRowDensity) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Плотность не попадает в диапазон для данной категории" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Извлекаем данные из найденной строки Density
    const fastCarCostPerKg = parseFloat(resultRowDensity[4]); // Быстрое авто ($/kg)
    const regularCarCostPerKg = parseFloat(resultRowDensity[5]); // Обычное авто ($/kg)

    // Вычисляем общую стоимость доставки один раз
    const deliveryCostFast = (fastCarCostPerKg * weight * quantity).toFixed(2);
    const deliveryCostRegular = (regularCarCostPerKg * weight * quantity).toFixed(2);

    // Вычисляем вес с упаковкой для каждого типа упаковки
    const packedWeightBag = (packingFactorBag + weight) * quantity; // Вес с упаковкой (Мешок)
    const packedWeightCorners = (additionalWeightCorners + weight) * quantity; // Вес с упаковкой (Картонные уголки)
    const packedWeightFrame = (additionalWeightFrame + weight) * quantity; // Вес с упаковкой (Деревянный каркас)

    // Формируем результаты для каждой категории упаковки
    const results = {
      generalInformation: {
        category: category,
        weight: weight * quantity, // Общий вес
        density: density.toFixed(2),
        productCost: cost,
        insuranceRate: (insuranceRate * 100).toFixed(0) + "%",
        insuranceAmount: insurance.toFixed(2),
        volume: totalVolume.toFixed(2), // Общий объем
        boxCount: quantity
      },
      bag: {
        packedWeight: packedWeightBag.toFixed(2), // Вес с упаковкой (Мешок)
        packagingCost: packagingCostBag, // Стоимость упаковки
        unloadCost: unloadCostBag, // Стоимость разгрузки
        insurance: insurance, // Страховка
        deliveryCostFast: deliveryCostFast, // Стоимость быстрой доставки
        deliveryCostRegular: deliveryCostRegular, // Стоимость обычной доставки
        totalFast: (packagingCostBag + unloadCostBag + insurance + parseFloat(deliveryCostFast)).toFixed(2),
        totalRegular: (packagingCostBag + unloadCostBag + insurance + parseFloat(deliveryCostRegular)).toFixed(2)
      },
      corners: {
        packedWeight: packedWeightCorners.toFixed(2), // Вес с упаковкой (Картонные уголки)
        packagingCost: packagingCostCorners, // Стоимость упаковки
        unloadCost: unloadCostCorners, // Стоимость разгрузки
        insurance: insurance, // Страховка
        deliveryCostFast: deliveryCostFast, // Стоимость быстрой доставки
        deliveryCostRegular: deliveryCostRegular, // Стоимость обычной доставки
        totalFast: (packagingCostCorners + unloadCostCorners + insurance + parseFloat(deliveryCostFast)).toFixed(2),
        totalRegular: (packagingCostCorners + unloadCostCorners + insurance + parseFloat(deliveryCostRegular)).toFixed(2)
      },
      frame: {
        packedWeight: packedWeightFrame.toFixed(2), // Вес с упаковкой (Деревянный каркас)
        packagingCost: packagingCostFrame, // Стоимость упаковки
        unloadCost: unloadCostFrame, // Стоимость разгрузки
        insurance: insurance, // Страховка
        deliveryCostFast: deliveryCostFast, // Стоимость быстрой доставки
        deliveryCostRegular: deliveryCostRegular, // Стоимость обычной доставки
        totalFast: (packagingCostFrame + unloadCostFrame + insurance + parseFloat(deliveryCostFast)).toFixed(2),
        totalRegular: (packagingCostFrame + unloadCostFrame + insurance + parseFloat(deliveryCostRegular)).toFixed(2)
      }
    };

    // Возвращаем JSON-ответ
    return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    // Возвращаем ошибку в формате JSON
    return ContentService.createTextOutput(JSON.stringify({ error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}
