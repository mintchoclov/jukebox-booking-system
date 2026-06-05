// MS2 basic version: this is an individual booking api
const express = require('express')
const router = express.Router()
const db = require('../db')

// valid 2-hour slot times