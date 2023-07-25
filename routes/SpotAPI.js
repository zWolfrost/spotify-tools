module.exports =
{
   getToken,
   getRequest,
   getQueryInfo
}


async function getToken(client_id, client_secret)
{
   let request = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`
   }

   return fetch("https://accounts.spotify.com/api/token", request).then(res => res.json())
}

async function getRequest(token, uri)
{
   let request = {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
   }

   return fetch("https://api.spotify.com/v1" + uri, request).then(res => res.json())
}

async function getQueryInfo(token, query, {searchType="track", searchCount=1, market="US"}={})
{
   function getItemInfo(item)
   {
      let info = {
         name: item.name,
         album: item.album.name,
         authors: item.artists.map(artist => artist.name)
      }

      info.query = Object.values(info).flat().join(" ")
      info.content = `${info.name} - ${info.authors.join(", ")} (${info.album})`

      info.id = item.id
      info.explicit = item.explicit
      info.url = item.external_urls.spotify

      return info
   }

   function cleanUrl(url, begmk="spotify.com/", endmk="?")
   {
      let beg = url.indexOf(begmk)
      if (beg == -1) beg = undefined
      else beg += begmk.length

      let end = url.indexOf(endmk, beg)
      if (end == -1) end = undefined

      return url.slice(beg, end).split("/")
   }


   let [type, id] = cleanUrl(query)

   if (id === undefined)
   {
      let isSingleItem = (searchType == "track" || searchType == "episode")

      let result = await getRequest(token, `/search?q=${query}&type=${searchType}&limit=${isSingleItem ? searchCount : 1}`)

      if ("error" in result) return result

      result = Object.values(result)[0].items

      if (result.length == 0) return { error: { status: 400, message: "No results were found" } }

      type = searchType
      id = isSingleItem ? result.map(item => item.id).join(",") : result[0].id
   }


   info = {
      id: id,
      type: type,
      content: undefined,
      tracklist: []
   }


   try
   {
      switch(type)
      {
         case "artist":
            let [artist, artistTracks] = await Promise.all(
               [
                  getRequest(token, `/artists/${id}`),
                  getRequest(token, `/artists/${id}/top-tracks?market=${market}`)
               ]
            )

            info.content = `${artist.name} - Top Tracks`

            for (let item of artistTracks.tracks)
            {
               info.tracklist.push(getItemInfo(item))
            }

            break;

         case "album":
            let album = await getRequest(token, `/albums/${id}`)

            info.content = `${album.name} - ${album.artists.map(artist => artist.name).join(", ")}`

            for (let item of album.tracks.items)
            {
               item.album = {name: album.name}
               info.tracklist.push(getItemInfo(item, album))
            }

            break;

         case "playlist":
            let playlist = await getRequest(token, `/playlists/${id}`)

            info.content = `${playlist.name} - ${playlist.owner.display_name}`

            for (let item of playlist.tracks.items)
            {
               info.tracklist.push(getItemInfo(item.track))
            }

            break;

         case "track":
            let tracks = await getRequest(token, `/tracks?ids=${id}`)

            info.content = "Custom Track List"

            for (let item of tracks.tracks)
            {
               info.tracklist.push(getItemInfo(item))
            }

            break;


         case "show":
            let show = await getRequest(token, `/shows/${id}?market=${market}`)

            info.content = `${show.name} - ${show.publisher}`

            for (let item of show.episodes.items)
            {
               item.album = {name: show.name}
               item.artists = [{name: show.publisher}]
               info.tracklist.push(getItemInfo(item))
            }

            break;

         case "episode":
            let episodes = await getRequest(token, `/episodes?ids=${id}&market=${market}`)

            info.content = `Custom Episode List`

            for (let item of episodes.episodes)
            {
               item.album = {name: item.show.name}
               item.artists = [{name: item.show.publisher}]
               info.tracklist.push(getItemInfo(item))
            }

            break;


         default: return { error: { status: 400, message: "Invalid or unsupported spotify link" } }
      }
   }
   catch
   {
      return { error: { status: 400, message: "Invalid spotify token and/or link" } }
   }


   return info
}


/*async function a()
{
   console.time()
   const token = await getToken("0e10f546730a413eb13a28a6ffeaece4", "85c7a868f92849c6a9370c1406b665c8")
   let info = await getQueryInfo(token.access_token, "https://open.spotify.com/track/6rDaCGqcQB1urhpCrrD599,6rDaCGqcQB1urhpCrrD599")
   console.timeEnd()

   console.log(JSON.stringify(info, 0, 2));
}
a()*/


/*
https://open.spotify.com/album/09wqWIOKWuS6RwjBrXe08B?si=3266fb2161824070
https://open.spotify.com/artist/7jy3rLJdDQY21OgRLCZ9sD?si=4a55232349a94d48
https://open.spotify.com/episode/5ABQCt345LXOb0dKKM9LZx?si=56eedb17bf7f49f2
https://open.spotify.com/playlist/7mBgbujFe7cAZ5rrK0HTxp?si=82b3e3f2549641b5
https://open.spotify.com/show/6TXzjtMTEopiGjIsCfvv6W?si=5ed6091c9683422b
https://open.spotify.com/track/6rDaCGqcQB1urhpCrrD599,6rDaCGqcQB1urhpCrrD599
*/