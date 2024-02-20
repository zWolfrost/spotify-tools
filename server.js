const path = require("path")

const PORT = 3000
const express = require("express");
const app = express();

const cookieParser = require("cookie-parser");


const routesDIR = path.join(__dirname, "routes")
const staticDIR = path.join(__dirname, "static")


app.use(express.static(staticDIR))
app.use(express.json(), express.urlencoded({ extended: true }))
app.use(cookieParser())


app.use("/downloader", require(path.join(routesDIR, "downloader-route")) )
app.use("/recommender", require(path.join(routesDIR, "recommender-route")) )
app.use("/auth", require(path.join(routesDIR, "auth-route")) )
app.use("/assets", require(path.join(routesDIR, "assets-route")) )

app.get("/", (req, res) => res.sendFile(path.join(staticDIR, "home.html")) )
app.get("*", (req, res) => res.status(404).sendFile(path.join(staticDIR, "404.html")) )


app.listen(PORT);