// server.js
const express = require("express");
const path = require("path");
const app = express();

const PORT = process.env.PORT || 8000;

// Serve everything from this folder (where server.js is)
app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`✅ Chess server running at http://localhost:${PORT}`);
});
