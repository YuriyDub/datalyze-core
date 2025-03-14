const express = require('express');
const bodyParser = require('body-parser');

const app = express();

//middleware
app.use(bodyParser.json());
