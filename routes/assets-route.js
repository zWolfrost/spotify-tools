const express = require("express")
const router = express.Router()
const SpotifyAPI = require("spoteasy")


router.get("/icon", async (req, res) =>
{
   if (req.cookies.auth)
   {
      let spoteasy = new SpotifyAPI({ autoRefreshToken: false })
      spoteasy.setToken(JSON.parse(req.cookies.auth))

      const me = await spoteasy.getCurrentUserProfile()
      const iconUrl = me.images?.[0].url

      res.status(200).send({ url: iconUrl })
   }
   else
   {
      res.status(401).send({ error: "Not logged in" })
   }
})


module.exports = router
