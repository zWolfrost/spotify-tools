const express = require("express")
const router = express.Router()
const SpotifyAPI = require("spoteasy")


router.get("/recommend", async (req, res) =>
{
   if (req.cookies.auth)
   {
      let spoteasy = new SpotifyAPI({ autoRefreshToken: false })
      spoteasy.setToken(JSON.parse(req.cookies.auth))

      let favs = await spoteasy.getUserSavedTracks({ limit: 50 })

      let recommendations = await spoteasy.getRecommendations({
         seed_tracks: shuffle(favs.parsed_tracks).slice(0, 5).map(track => track.id),
         limit: 10
      })

      res.status(200).send(recommendations.parsed_tracks)
   }
   else
   {
      res.status(401).send({ error: "Not logged in" })
   }
})

function shuffle(array)
{
   for (let i = array.length - 1; i > 0; i--)
   {
      let j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
   }
   return array;
}


module.exports = router