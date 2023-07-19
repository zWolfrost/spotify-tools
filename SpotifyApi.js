module.exports =
{
   getSpotifyToken,
   getRequest,
   getQueryInfo
}


async function getSpotifyToken(client_id, client_secret)
{
   let request = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${client_id}&client_secret=${client_secret}`
   }

   return fetch("https://accounts.spotify.com/api/token", request).then(res => res.json()).then(res => res.access_token)
}

async function getRequest(token, uri)
{
   let request = {
      method: "GET",
      headers: { "Authorization": "Bearer " + token }
   }

   return fetch("https://api.spotify.com/v1" + uri, request).then(res => res.json())
}

async function getQueryInfo(token, query, searchType="track", searchCount=1)
{
   function itemInfo(item, album=null)
   {
      let info = {
         name: item.name,
         album: album?.name ?? item.album.name,
         authors: []
      }

      for (let artist of item.artists) info.authors.push(artist.name)

      info.query = Object.values(info).flat().join(" ")
      info.content = `${info.name} - ${info.authors.join(", ")} (${info.album})`

      info.id = item.id
      info.explicit = item.explicit
      info.url = item.external_urls.spotify

      return info
   }

   function cleanUrl(url, begstr="spotify.com/", endstr="?")
   {
      let beg = url.indexOf(begstr)
      if (beg == -1) beg = 0
      else beg += begstr.length

      let end = url.indexOf(endstr, beg)
      if (end == -1) end = url.length

      return url.slice(beg, end).split("/")
   }


   let [type, id] = cleanUrl(query)

   if (id === undefined)
   {
      let result = await getRequest(token, `/search?q=${query}&type=${searchType}&limit=${searchCount}`)

      if ("error" in result) return result

      result = Object.values(result)[0].items

      if (result.length == 0) return { error: { status: 400, message: "No results were found" } }

      type = searchType
      id = result[0].id
   }


   info = {
      id: id,
      type: type,
      tracklist: []
   }

   let result;

   switch(type)
   {
      case "album":
         let album = await getRequest(token, `/albums/${id}`)
         result = await getRequest(token, `/albums/${id}/tracks`)

         for (let item of result.items)
         {
            info.tracklist.push(itemInfo(item, album))
         }

         let albumartists = []
         for (let artist of album.artists) albumartists.push(artist.name)
         info.content = `${album.name} - ${albumartists.join(", ")}`

         break;

      case "artist":
         let artist = await getRequest(token, `/artists/${id}`)
         result = await getRequest(token, `/artists/${id}/top-tracks?market=US`)

         for (let item of result.tracks)
         {
            info.tracklist.push(itemInfo(item))
         }

         info.content = `${artist.name} - Top Tracks`

         break;

      case "playlist":
         let playlist = await getRequest(token, `/playlists/${id}`)
         result = await getRequest(token, `/playlists/${id}/tracks`)

         for (let item of result.items)
         {
            info.tracklist.push(itemInfo(item.track))
         }

         info.content = `${playlist.name} - ${playlist.owner.display_name}`

         break;

      case "track":
         result = await getRequest(token, `/tracks?ids=${id}`)

         for (let item of result.tracks)
         {
            info.tracklist.push(itemInfo(item))
         }

         info.content = "Custom Track List"

         break;
   }

   return info
}

/*async function a()
{
   const token = await getSpotifyToken("0e10f546730a413eb13a28a6ffeaece4", "85c7a868f92849c6a9370c1406b665c8")
   let info = await getQueryInfo(token, "https://open.spotify.com/album/3DuiGV3J09SUhvp8gqNx8h?si=ReSEd1WYRge0g1P-7WgXuw")
   console.log(info)
}*/

/*
https://open.spotify.com/album/09wqWIOKWuS6RwjBrXe08B?si=3266fb2161824070
https://open.spotify.com/artist/7jy3rLJdDQY21OgRLCZ9sD?si=4a55232349a94d48
https://open.spotify.com/playlist/7mBgbujFe7cAZ5rrK0HTxp?si=82b3e3f2549641b5
https://open.spotify.com/track/6rDaCGqcQB1urhpCrrD599?si=05987dc8f4ae4d31
*/