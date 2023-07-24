const path = require("path")

const PORT = 3000
const express = require("express");
const app = express();


const routesDIR = path.join(__dirname, "routes")
const staticDIR = path.join(__dirname, "static")


app.use(express.static(staticDIR))
app.use(express.json(), express.urlencoded({ extended: true }))


app.use("/spotify-dlp-js", require(path.join(routesDIR, "spotify-dlp-js-route")) )

app.get("/", (req, res) => res.sendFile(path.join(staticDIR, "home.html")))
app.get("/*", (req, res) => res.status(404).sendFile(path.join(staticDIR, "404.html")))


app.listen(PORT);