const fs = require("fs")
fs.rmSync("tracks", { recursive: true, force: true });
fs.mkdirSync("tracks");

const SpotifyApi = require("./SpotifyApi.js");
const { search } = require("libmuse");
const ytdl = require("ytdl-core");
const sanitize = require("sanitize-filename");

if (process.env.NODE_ENV !== "production") require("dotenv").config()

const PORT = 3000
const express = require("express");
const app = express();

const staticDIR = __dirname + "/static/"

app.use(express.static(staticDIR))
app.use(express.json(), express.urlencoded({ extended: true }))


let index = {}

const MAX_SIMULTANEOUS_DOWNLOADS = 1
let simultaneousDownloads = 0


//setInterval(() => console.log(index["4JJk011GtXda1dBAyGzrqa"]?.progress), 200)


function delItem(itemID, timeout=180)
{
   setTimeout(() =>
   {
      if (itemID in index)
      {
         let path = `./tracks/${index[itemID].filename}`

         fs.unlinkSync(path)
         delete index[itemID]
      }

   }, timeout * 1000)
}


app.get("/" , (req, res) => res.sendFile(staticDIR + "home.html"))
app.get("/download", (req, res) =>
{
   let begInfo = structuredClone(index[req.query.id])

   if (begInfo.complete)
   {
      res.download(`${__dirname}/tracks/${begInfo.filename}`, begInfo.filename)
   }
   else
   {
      const UPDATEINTERVAL = 100

      let interval = setInterval(() =>
      {
         let curInfo = index[req.query.id]

         if (curInfo.progress !== begInfo.progress)
         {
            let percent = curInfo.progress?.percent ?? 0
            let totalcount = curInfo.trackids?.length ?? 1

            res.send({progresscount: (totalcount * percent / 100), totalcount: totalcount})
            clearInterval(interval)
         }
         else if (curInfo.complete)
         {
            res.download(`${__dirname}/tracks/${begInfo.filename}`, begInfo.filename)
            clearInterval(interval)
         }
      }, UPDATEINTERVAL)
   }
})
app.get("/*", (req, res) => res.status(404).sendFile(staticDIR + "404.html"))



app.post("/", async (req, res) =>
{
   if (simultaneousDownloads + 1 > MAX_SIMULTANEOUS_DOWNLOADS)
   {
      res.status(502).send({ error: "Server temporarily busy" })
      return;
   }

   let query = req.body.query

   const token = await SpotifyApi.getSpotifyToken(process.env.CLIENT_ID, process.env.CLIENT_SECRET)
   let info = await SpotifyApi.getQueryInfo(token, query)

   //console.log(info.tracklist[0].query)

   if ("error" in info)
   {
      res.status(info.error.status).send({ error: info.error.message })
      return;
   }

   /*info = {
      id: '4JJk011GtXda1dBAyGzrqa',
      type: 'playlist',
      tracklist: [
         {
            name: 'One Step Closer',
            album: 'Hybrid Theory',
            authors: ["Linkin Park"],
            query: 'One Step Closer Hybrid Theory Linkin Park',
            content: 'One Step Closer - Linkin Park (Hybrid Theory)',
            id: '4bYLTrlcqctyHck3fjhMgW',
            explicit: false,
            url: 'https://open.spotify.com/track/4bYLTrlcqctyHck3fjhMgW'
         },
         {
            name: 'Digital Bath',
            album: 'White Pony',
            authors: ["Deftones"],
            query: 'Digital Bath White Pony Deftones',
            content: 'Digital Bath - Deftones (White Pony)',
            id: '2jSJm3Gv6GLxduWLenmjKS',
            explicit: false,
            url: 'https://open.spotify.com/track/2jSJm3Gv6GLxduWLenmjKS'
         }
      ],
      content: 'The Uncharted - zWolfrost'
   }*/

   const TRACKFORMAT = "m4a"

   addInfoToIndex(info)
   let uniqueTracklist = Object.values( info.tracklist.reduce((track, obj) => ({ ...track, [obj.id]: obj }), {}) );

   simultaneousDownloads++

   if (info.tracklist.length == 1)
   {
      res.send({id: info.tracklist[0].id})

      downloadTracklist(uniqueTracklist, () =>
      {
         simultaneousDownloads--
      })
   }
   else
   {
      res.send({id: info.id})

      downloadTracklist(uniqueTracklist, () =>
      {
         zipTracklist(info)
         simultaneousDownloads--
      })
   }

   async function downloadTracklist(tracklist, callback=null)
   {
      if (tracklist.length == 0) return callback?.();

      let track = tracklist[0]

      let searchResult = await search(track.query, { limit: 1 })
      let videoID = searchResult.top_result.videoId ?? searchResult.categories[0].results[0].videoId


      youtubeDL(`https://youtu.be/${videoID}`, `./tracks/${index[track.id].filename}`, { filter: "audioonly" },
         {
            progress: function(progress)
            {
               index[track.id].progress = progress
            },
            complete: function()
            {
               index[track.id].complete = true

               delItem(track.id)

               tracklist.shift()
               downloadTracklist(tracklist, callback)
            }
         }
      )
   }

   function addInfoToIndex(info)
   {
      let trackids = []
      for (let track of info.tracklist)
      {
         trackids.push(track.id)

         index[track.id] =
         {
            filename: `${sanitize(track.content)}.${TRACKFORMAT}`,
            complete: false
         }
      }

      if (info.tracklist.length == 1) return

      index[info.id] =
      {
         filename: `${sanitize(info.content)}.zip`,
         trackids: trackids,
         get progress()
         {
            let totalProgress =
            {
               totalBytes: 0,
               downloadedBytes: 0,
               percent: 0,

               startTime: undefined,
               get elapsedSeconds() { return (Date.now() - this.startTime) / 1000 },
               get estimatedRemainingSeconds()
               {
                  let elapsedSeconds = this.elapsedSeconds
                  return (elapsedSeconds / this.percent * 100) - elapsedSeconds
               }
            }

            for (let id of this.trackids)
            {
               totalProgress.totalBytes += index[id].progress?.totalBytes ?? 0
               totalProgress.downloadedBytes += index[id].progress?.downloadedBytes ?? 0

               totalProgress.percent += index[id].progress?.percent ?? 0

               if (index[id].progress?.startTime !== undefined)
               {
                  if (totalProgress.progress?.startTime === undefined || totalProgress.startTime > index[id].progress.startTime)
                  {
                     totalProgress.startTime = index[id].progress.startTime
                  }
               }
            }

            totalProgress.percent /= this.trackids.length

            return totalProgress
         },
         complete: false
      }
   }
   function zipTracklist(info)
   {
      let filepaths = []
      for (let track of info.tracklist) filepaths.push(`${__dirname}/tracks/${index[track.id].filename}`)

      zipFiles(`./tracks/${sanitize(info.content)}.zip`, filepaths, () =>
      {
         index[info.id].complete = true

         delItem(info.id)
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
         return (elapsedSeconds / this.percent * 100) - elapsedSeconds
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


app.listen(PORT);