// Перенаправление на страницу с результатами
const encodedResults = encodeURIComponent(JSON.stringify(results));
window.location.href = "/results.html?results=" + encodedResults;
