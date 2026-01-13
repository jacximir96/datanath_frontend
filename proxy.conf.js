// Lee la configuración desde api-config.json (fuente única de verdad)
const apiConfig = require('./api-config.json');

module.exports = {
  "/login": {
    "target": apiConfig.apiUrl,
    "secure": false,
    "logLevel": "debug"
  },
  "/orquestador": {
    "target": apiConfig.apiUrl,
    "secure": false,
    "logLevel": "debug"
  }
};
