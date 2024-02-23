const express = require("express")
const router = express.Router()
const SpotifyAPI = require("spoteasy")


router.get("/create", async (req, res) =>
{
   if (req.cookies.auth)
   {
      let spoteasy = new SpotifyAPI({ autoRefreshToken: false })
      spoteasy.setToken(JSON.parse(req.cookies.auth))

      let savedTracks = (await getSavedTracks(spoteasy)).map(t => t.uri)
      let userID = (await spoteasy.getCurrentUserProfile()).id
      let playlistID = (await spoteasy.createPlaylist(userID, "Liked Songs",
      {
         description: "All the songs you've liked",
         public_playlist: false
      })).id

      for (let i=0; i<savedTracks.length; i+=100)
      {
         await spoteasy.addItemsToPlaylist(playlistID, {uris: savedTracks.slice(i, i+100), position: i})
      }

      res.status(200).send({ message: "Playlist created" })
   }
   else
   {
      res.status(401).send({ error: "Not logged in" })
   }
})

async function getSavedTracks(spoteasy)
{
   const totalSavedTracks = (await spoteasy.getUserSavedTracks({ limit: 1 })).total

   let savedPromises = [];

   for (let i=0; i<totalSavedTracks; i+=50)
   {
      savedPromises.push(spoteasy.getUserSavedTracks({ limit: Math.min(50, totalSavedTracks-i), offset: i }))
   }

   let savedTracks = (await Promise.all(savedPromises)).map(t => t.parsed_tracks).flat().filter(x => !!x.name)

   return savedTracks
}


module.exports = router