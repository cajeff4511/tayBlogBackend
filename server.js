const express = require('express')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const app = express()
const port = '3000'
app.use(cors())
app.use(express.json())


mongoose.connect('mongodb+srv://jeffersonchristian259:Ivh5vgdJAnd9Px2G@taysblog.ldkit.mongodb.net/Blog')
.then(() => {
    console.log('db connected!')
})
.catch(() => {
    console.log('db connection error!')
})


app.get('/', (req, res) => {
    res.send("hello")
})

app.listen(port, () => {
    console.log('localhost:3000')
})