// src/server.js
// Entry point – starts the Express app
// ---------------------------------------------------------------
const app = require('./app');

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 API server listening on http://localhost:${PORT}`);
});
