
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./send-if.db');

app.use(cors());
app.use(bodyParser.json());

// Serve arquivos estáticos (HTML, CSS, JS)
app.use(express.static(__dirname));

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`🚀 Servidor completo rodando em http://localhost:${PORT}`);
    console.log(`📊 Database: send-if.db`);
});
