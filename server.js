require("dotenv").config()

const fs = require("fs")
fs.rmSync("tracks", { recursive: true, force: true });
fs.mkdirSync("tracks");

const SpotifyApi = require("./SpotifyApi.js");
const { search } = require("libmuse");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename");

const PORT = 3000
const express = require("express");
const app = express();

const staticDIR = __dirname + "/static/"

app.use(express.static(staticDIR))
app.use(express.json(), express.urlencoded({ extended: true }))


const UPDATE_INTERVAL_SECONDS = 0.5
const MAX_SIMULTANEOUS_DOWNLOADS = 15
const MAX_TRACKLIST_LENGTH = 30

let index = {}, token = {}
let simultaneousDownloads = 0


async function getSpotifyToken()
{
   let spotifyToken = await SpotifyApi.getSpotifyToken(process.env.CLIENT_ID, process.env.CLIENT_SECRET)
   spotifyToken.expiring_date = Date.now() + (spotifyToken.expires_in * 1000)
   return spotifyToken
}
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


app.get("/" , (req, res) => res.sendFile(staticDIR + "home.html"))
app.get("/update", (req, res) =>
{
   let begInfo = structuredClone(index[req.query.id])

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
})
app.get("/download", (req, res) =>
{
   let info = index[req.query.id]

   if (info?.complete)
   {
      res.status(200).download(`${__dirname}/tracks/${info.filename}`, info.filename)
   }
   else
   {
      res.status(503).send({ error: "Service Unavailable" })
   }
})

app.post("/", async (req, res) =>
{
   if (simultaneousDownloads+1 > MAX_SIMULTANEOUS_DOWNLOADS)
   {
      res.status(429).send({ error: "Too Many Requests" })
      return;
   }


   const QUERY = req.body.query
   const TRIM_INDEXES = req.body.trim.map(n => parseInt(n) || undefined)

   if (token.expiring_date == undefined || Date.now() >= token.expiring_date)
   {
      token = await getSpotifyToken()
   }

   let info = await SpotifyApi.getQueryInfo(token.access_token, QUERY)


   if ("error" in info)
   {
      res.status(info.error.status).send({ error: info.error.message })
      return;
   }


   let uniqueTracklist;
   try
   {
      info.tracklist = info.tracklist.slice(...TRIM_INDEXES)
      uniqueTracklist = Object.values( info.tracklist.reduce((track, obj) => ({ ...track, [obj.id]: obj }), {}) );
   }
   catch
   {
      res.status(400).send({ error: "Invalid trim information" })
      return;
   }

   if (info.tracklist.length == 0 || uniqueTracklist.length == 0)
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

   if (uniqueTracklist.length == 1)
   {
      res.status(202).send({id: uniqueTracklist[0].id})

      downloadTracklist(uniqueTracklist, () =>
      {
         simultaneousDownloads--
      })
   }
   else
   {
      res.status(202).send({id: info.id})

      downloadTracklist(uniqueTracklist, () =>
      {
         zipTracklist(info)
         simultaneousDownloads--
      })
   }


   function addInfoToIndex(info, formats={audio: "mp3", archive: "zip"})
   {
      let trackids = []
      for (let track of info.tracklist)
      {
         trackids.push(track.id)

         index[track.id] =
         {
            filename: `${sanitize(track.content)}.${formats.audio}`,
            complete: false
         }
      }

      if (info.tracklist.length == 1) return

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

   async function searchVideoIdFromQuery(query, limit=1)
   {
      let searchResult = await search(query, { limit: limit })
      return searchResult.top_result.videoId ?? searchResult.categories[0].results[0].videoId
   }

   async function downloadTracklist(tracklist, callback=null)
   {
      if (tracklist.length == 0) return callback?.();

      let track = tracklist.shift()

      let videoID = await searchVideoIdFromQuery(track.query)


      youtubeDL(`https://youtu.be/${videoID}`, `./tracks/${index[track.id].filename}`, { filter: "audioonly" },
         {
            progress: function(progress)
            {
               index[track.id].progress = progress
            },
            complete: function()
            {
               index[track.id].complete = true

               safeDeleteItem(track.id)

               downloadTracklist(tracklist, callback)
            }
         }
      )
   }

   function zipTracklist(info)
   {
      let filepaths = []
      for (let track of info.tracklist)
      {
         filepaths.push(`${__dirname}/tracks/${index[track.id].filename}`)
      }

      zipFiles(`./tracks/${index[info.id].filename}`, filepaths, () =>
      {
         index[info.id].complete = true

         safeDeleteItem(info.id)
      })
   }
})


function zipFiles(path, filepaths, callback=null)
{
   let fs = require("fs");
   let archiver = require("archiver");

   let output = fs.createWriteStream(path);
   let archive = archiver("zip", { gzip: true, zlib: { level: 9 } });

   //archive.on("error", (err) => {throw err} );
   archive.on("end", () => callback?.());

   archive.pipe(output);

   for (let path of filepaths) archive.file(path, { name: path.split("/").at(-1) });

   archive.finalize();
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


app.get("/*", (req, res) => res.status(404).sendFile(staticDIR + "404.html"))
app.listen(PORT);


//setInterval(() => { console.clear(); console.log(token, Date.now()) }, 100)