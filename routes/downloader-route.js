const path = require("path")
const express = require("express")
const router = express.Router()


require("dotenv").config()

const fs = require("fs")
fs.rmSync("tracks", { recursive: true, force: true });
fs.mkdirSync("tracks");

const SpotifyAPI = require("spoteasy");
const yts = require("yt-search");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename");


const UPDATE_INTERVAL_SECONDS = 0.4
const MAX_SIMULTANEOUS_DOWNLOADS = 10
const MAX_TRACKLIST_LENGTH = 30
const YTSEARCH_TAGS = ["hq", "audio"]

let index = {}
let simultaneousDownloads = 0

let spoteasy = new SpotifyAPI()
spoteasy.clientCredentialsFlow(process.env.CLIENT_ID, process.env.CLIENT_SECRET)


function safeDeleteItem(itemID, timeout=180)
{
   let wasComplete = false

   let id = setInterval(() =>
   {
      if (itemID in index == false)
      {
         clearInterval(id)
         return;
      }

      if (wasComplete && index[itemID].complete)
      {
         fs.unlinkSync(`./tracks/${index[itemID].filename}`)
         delete index[itemID]

         clearInterval(id)
      }
      else wasComplete = index[itemID].complete

   }, (timeout/2) * 1000)
}


router.get("/update", (req, res) =>
{
   let begInfo = structuredClone(index[req.query.id])

   if (begInfo == undefined)
   {
      res.status(404).send({ error: "Track not found" })
   }
   else
   {
      let interval = setInterval(() =>
      {
         let curInfo = index[req.query.id]

         if (curInfo.progress !== begInfo.progress || curInfo.complete)
         {
            res.status(200).send({
               percent: curInfo.progress?.percent ?? 0,
               remainingSeconds: curInfo.progress?.estimatedRemainingSeconds,
               trackCount: curInfo.trackids?.length ?? 1,
               complete: curInfo.complete,
            })

            clearInterval(interval)
         }
      }, UPDATE_INTERVAL_SECONDS * 1000)
   }
})
router.get("/download", (req, res) =>
{
   let info = index[req.query.id]

   if (info?.complete)
   {
      res.status(200).download( path.resolve("tracks", info.filename), info.filename )
   }
   else
   {
      res.status(404).send({ error: "Track not found" })
   }
})


router.post("/request", async (req, res) =>
{
   if (simultaneousDownloads+1 > MAX_SIMULTANEOUS_DOWNLOADS)
   {
      res.status(429).send({ error: "Too Many Requests" })
      return;
   }


   const QUERY = req.body.query
   const TRIM_INDEXES = req.body.trim?.map(n => parseInt(n) || undefined) || [undefined, undefined]


   let info;

   try
   {
      info = await spoteasy.getMagic(QUERY)
   }
   catch ( e )
   {
      res.status(400).send({ error: e.message })
      return;
   }


   if (SpotifyAPI.isValidURL(QUERY))
   {
      let {id, type} = SpotifyAPI.parseURL(QUERY)

      info.id = id

      switch(type)
      {
         case "artist":
            let artist = await spoteasy.getArtist(id)
            info.content = `${artist.name} - Top Tracks`
            break;

         case "album":
            info.content = `${info.name} - ${info.artists.map(artist => artist.name).join(", ")}`
            break;

         case "playlist":
            info.content = `${info.name} - ${info.owner.display_name}`
            break;

         case "track":
            info.content = "Custom Track List"
            break;

         case "show":
            info.content = `${info.name} - ${info.publisher}`
            break;

         case "episode":
            info.content = `Custom Episode List`
            break;

         default: info.content = `Custom Item List`
      }
   }


   let uniqueTracklist;
   try
   {
      info.parsed_tracks = info.parsed_tracks.slice(...TRIM_INDEXES)
      uniqueTracklist = Object.values( info.parsed_tracks.reduce((track, obj) => ({ ...track, [obj.id]: obj }), {}) );
   }
   catch
   {
      res.status(400).send({ error: "Invalid trim information" })
      return;
   }

   if (uniqueTracklist.length == 0)
   {
      res.status(400).send({ error: "Tracklist contains no tracks" })
      return;
   }
   if (uniqueTracklist.length > MAX_TRACKLIST_LENGTH)
   {
      res.status(400).send({ error: `Tracklist contains too many tracks (max is "${MAX_TRACKLIST_LENGTH}")` })
      return;
   }

   addInfoToIndex(info)


   simultaneousDownloads++

   const isSingleTrack = (uniqueTracklist.length == 1)
   if (isSingleTrack) info.id = info.parsed_tracks[0].id

   res.status(202).send(info)

   await addYTIDsToTracklist(uniqueTracklist)
   await downloadTracklist(uniqueTracklist)
   if (isSingleTrack == false) await zipTracklist(info)

   simultaneousDownloads--



   function addInfoToIndex(info, formats={audio: "m4a", archive: "zip"})
   {
      let trackids = []
      for (let track of info.parsed_tracks)
      {
         trackids.push(track.id)

         index[track.id] =
         {
            filename: `${sanitize(track.title)}.${formats.audio}`,
            complete: false
         }
      }

      if (info.parsed_tracks.length == 1) return

      index[info.id] =
      {
         filename: `${sanitize(info.content)}.${formats.archive}`,
         complete: false,
         trackids: trackids,
         get progress()
         {
            let totalProgress =
            {
               totalBytes: 0,
               downloadedBytes: 0,
               percent: 0,

               startTime: undefined,
               elapsedSeconds: 0,
               estimatedRemainingSeconds: undefined
            }

            for (let id of this.trackids)
            {
               totalProgress.totalBytes += index[id].progress?.totalBytes ?? 0
               totalProgress.downloadedBytes += index[id].progress?.downloadedBytes ?? 0

               totalProgress.percent += index[id].progress?.percent ?? 0

               if (index[id].progress?.startTime !== undefined)
               {
                  if (totalProgress.startTime === undefined || totalProgress.startTime > index[id].progress.startTime)
                  {
                     totalProgress.startTime = index[id].progress.startTime
                  }
               }
            }

            totalProgress.percent /= this.trackids.length

            totalProgress.elapsedSeconds = (Date.now() - totalProgress.startTime) / 1000
            totalProgress.estimatedRemainingSeconds =  Math.max((totalProgress.elapsedSeconds / totalProgress.percent * 100) - totalProgress.elapsedSeconds, 0)

            return totalProgress
         }
      }
   }

   function addYTIDsToTracklist(tracklist)
   {
      let searchVideoId = (query) => yts(query).then(res => res.videos[0].videoId);

      let requests = tracklist.map(async track => track.youtube_id = await searchVideoId(`${track.query} ${YTSEARCH_TAGS.join(" ")}`))

      return Promise.all(requests)
   }

   function downloadTracklist(tracklist)
   {
      tracklist = structuredClone(tracklist)

      return new Promise(async resolve =>
      {
         let track = tracklist.shift()

         youtubeDL(`https://youtu.be/${track.youtube_id}`, `./tracks/${index[track.id].filename}`, { filter: "audioonly" },
            {
               progress: function(progress)
               {
                  index[track.id].progress = progress
               },
               complete: function()
               {
                  index[track.id].complete = true

                  safeDeleteItem(track.id)

                  if (tracklist.length == 0) resolve("done")
                  else resolve(downloadTracklist(tracklist))
               }
            }
         )
      })
   }

   function zipTracklist(info)
   {
      return new Promise(async resolve =>
      {
         let filepaths = []
         for (let track of info.parsed_tracks)
         {
            filepaths.push( path.resolve("tracks", index[track.id].filename) )
         }

         await zipFiles(`./tracks/${index[info.id].filename}`, filepaths)

         index[info.id].complete = true

         safeDeleteItem(info.id)

         resolve()
      })
   }
})


function zipFiles(outputpath, filepaths)
{
   return new Promise(resolve =>
   {
      let fs = require("fs");
      let archiver = require("archiver");

      let output = fs.createWriteStream(outputpath);
      let archive = archiver("zip", { gzip: true, zlib: { level: 9 } });

      //archive.on("error", (err) => {throw err} );
      archive.on("end", resolve);

      archive.pipe(output);

      for (let singlepath of filepaths) archive.file(singlepath, { name: path.parse(singlepath).base });

      archive.finalize();
   })
}

function youtubeDL(url, path, opts={}, events={ response: null, progress: null, complete: null })
{
   const video = ytdl(url, opts);

   video.pipe(fs.createWriteStream(path))


   let progress = {
      totalBytes: undefined,
      downloadedBytes: 0,
      get percent() { return (this.downloadedBytes / this.totalBytes) * 100 },

      startTime: undefined,
      get elapsedSeconds() { return (Date.now() - this.startTime) / 1000 },
      get estimatedRemainingSeconds()
      {
         let elapsedSeconds = this.elapsedSeconds
         let remainingSeconds = (elapsedSeconds / this.percent * 100) - elapsedSeconds
         return Math.max(remainingSeconds, 0)
      }
   }

   video.once("response", function()
   {
      progress.startTime = Date.now()

      events?.response?.(progress)
   })

   video.on("progress", function(chunkLength, downloadedBytes, totalBytes)
   {
      progress.totalBytes = totalBytes
      progress.downloadedBytes = downloadedBytes;

      events?.progress?.(progress)
   });

   video.on("end", function()
   {
      events?.complete?.(progress)
   })
}


//console.clear()
//setInterval(() => { console.clear(); console.log(index) }, 100)

//let timeout = (ms) => new Promise(resolve => setTimeout(resolve, ms))

module.exports = router