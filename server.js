const SpotifyApi = require("./SpotifyApi.js");
const { search } = require("libmuse");
const YTDlpWrap = require("yt-dlp-wrap").default;
const sanitize = require("sanitize-filename");

if (process.env.NODE_ENV !== "production") require("dotenv").config()

const PORT = 3000
const express = require("express");
const app = express();

const staticDIR = __dirname + "/static/"

app.use(express.static(staticDIR))
app.use(express.json(), express.urlencoded({ extended: true }))


let index = {}

//setInterval(()=>console.log(index), 1000)


function delItem(itemID, timeout=180)
{
   setTimeout(() =>
   {
      if (itemID in index)
      {
         let path = `./tracks/${index[itemID].filename}`

         require("fs").unlinkSync(path)
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
      let interval = setInterval(() =>
      {
         let curInfo = index[req.query.id]

         if (curInfo.complete)
         {
            res.download(`${__dirname}/tracks/${begInfo.filename}`, begInfo.filename)
            clearInterval(interval)
         }
         else if (curInfo.progress !== begInfo.progress)
         {
            let totalcount = curInfo.trackids?.length ?? 1

            res.send({progresscount: (totalcount * curInfo.progress / 100), totalcount: totalcount})
            clearInterval(interval)
         }
      }, 100)
   }
})
app.get("/*", (req, res) => res.status(404).sendFile(staticDIR + "404.html"))



app.post("/", async (req, res) =>
{
   let query = req.body.query

   const token = await SpotifyApi.getSpotifyToken(process.env.CLIENT_ID, process.env.CLIENT_SECRET)
   let info = await SpotifyApi.getQueryInfo(token, query)

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
   const YTDlp = new YTDlpWrap("./yt-dlp.exe")

   addIndexInfo(info)

   if (info.tracklist.length == 1)
   {
      res.send({id: info.tracklist[0].id})

      recursiveDownloadInfo(structuredClone(info))
   }
   else
   {
      res.send({id: info.id})

      recursiveDownloadInfo(structuredClone(info), () => zipAlbum(info))
   }

   async function recursiveDownloadInfo(recursiveInfo, callback=null)
   {
      if (recursiveInfo.tracklist.length == 0) return callback?.();

      let track = recursiveInfo.tracklist[0]

      let searchID = await search(track.query, { limit: 1 }).then(data => data.categories[0].results[0].videoId);

      YTDlp.exec([`youtu.be/${searchID}`, "-f", "m4a/bestaudio/best", "-o", `${__dirname}/tracks/${index[track.id].filename}`])
         .on("progress", (progress) =>
         {
            index[track.id].progress = progress.percent || 0
         })
         .on("close", () =>
         {
            index[track.id].complete = true

            delItem(track.id)

            recursiveInfo.tracklist.shift()
            recursiveDownloadInfo(recursiveInfo, callback)
         })
   }

   function addIndexInfo(info)
   {
      if (info.tracklist.length == 1)
      {
         index[info.tracklist[0].id] =
         {
            filename: `${sanitize(info.tracklist[0].content)}.${TRACKFORMAT}`,
            progress: 0,
            complete: false
         }
      }
      else
      {
         let trackids = []
         for (let track of info.tracklist)
         {
            trackids.push(track.id)

            index[track.id] =
            {
               filename: `${sanitize(track.content)}.${TRACKFORMAT}`,
               progress: 0,
               complete: false
            }
         }

         index[info.id] =
         {
            filename: `${sanitize(info.content)}.zip`,
            trackids: trackids,
            get progress()
            {
               let totalprogress = 0
               for (let id of this.trackids) totalprogress += index[id].progress

               return totalprogress / this.trackids.length;
            },
            complete: false
         }
      }
   }
   function zipAlbum(info)
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

app.listen(PORT);