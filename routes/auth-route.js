const express = require("express")
const router = express.Router()


require("dotenv").config()

const SpotifyAPI = require("spoteasy")

let spoteasy = new SpotifyAPI({ autoRefreshToken: false })


router.get("/", async (req, res) =>
{
   if (Object.keys(req.query).length === 0)
   {
      let url = spoteasy.authorizationCodePKCEFlow(
         process.env.CLIENT_ID,
         "https://spotify-dlp-js.onrender.com/auth",
         { scope: ["user-library-read", "playlist-modify-private"] }
      )

      res.redirect(url)
   }
   else if ("code" in req.query && "resolve" in spoteasy.token)
   {
      await spoteasy.resolveToken(req.query)

      res.cookie("auth", JSON.stringify({
         access_token: spoteasy.token.access_token,
         token_type: spoteasy.token.token_type,
         expires_in: spoteasy.token.expires_in
      }), {
         maxAge: spoteasy.token.expires_in_ms,
         httpOnly: true,
         secure: true
      })

      res.redirect("../")
   }
   else
   {
      res.redirect("../")
   }
})


module.exports = router