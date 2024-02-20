const DL_QUERY = document.getElementById("download-field")
const DL_BUTTON = document.getElementById("download-button")
const TRIM_INDEXES = document.getElementById("trim-indexes")
const TRACKLIST = document.getElementsByClassName("tracklist")[0]


DL_QUERY.addEventListener("keypress", function(e)
{
   if (e.key === "Enter")
   {
      e.preventDefault();
      DL_BUTTON.click();
   }
});

DL_BUTTON.addEventListener("click", async () =>
{
   let query = DL_QUERY.value
   let trim_indexes = TRIM_INDEXES.value.split(":").filter(n => n !== "")

   downloadStart()


   let info = await fetch("request", {
      method: "POST",
      headers: {
         "Content-Type": "application/json",
         "Accept": "application/json"
      },
      body: JSON.stringify({
         query: query,
         trim: trim_indexes
      })
   }).then(res => res.json())


   if ("error" in info)
   {
      downloadEnd()
      setMessage(info.error)
   }
   else
   {
      displayTracklist(info.parsed_tracks)
      recursiveCheckID(info.id)
   }

   async function recursiveCheckID(id)
   {
      let res = await fetch(`update?id=${id}`).then(res => res.json())

      downloadProgress(res.percent, res.remainingSeconds, res.trackCount)

      if (res.complete)
      {
         window.open(`download?id=${id}`, "_self")
         displayTracklist()
         downloadEnd()
      }
      else
      {
         recursiveCheckID(id)
      }
   }
})



function displayTracklist(tracklist=[])
{
   if (TRACKLIST.childNodes.length === 0 && tracklist.length > 0)
   {
      for (const track of tracklist)
      {
         TRACKLIST.appendChild(createSpotifyEmbed(track))
      }

      TRACKLIST.classList.add("open")
   }
   else if (TRACKLIST.classList.contains("open"))
   {
      TRACKLIST.classList.remove("open")

      TRACKLIST.addEventListener("transitionend", () =>
      {
         TRACKLIST.textContent = ""
         displayTracklist(tracklist)
      }, {once: true})
   }
}
function createSpotifyEmbed(track)
{
   const EMBED_OPTS =
   {
      class: "track",
      src: `https://open.spotify.com/embed/${track.type}/${track.id}`,
      width: "100%",
      height: "80",
      frameBorder: "0",
      //allow: "encrypted-media",
      loading: "lazy"
   }

   const IFRAME = document.createElement("iframe")

   for (const [key, value] of Object.entries(EMBED_OPTS))
   {
      IFRAME.setAttribute(key, value)
   }

   return IFRAME
}


function downloadStart()
{
   DL_QUERY.value = ""
   TRIM_INDEXES.value = ""
   DL_BUTTON.innerText = "Processing Request..."

   disableInputs(true)
}
function downloadProgress(percent, remainingSeconds, totalCount=1)
{
   function secondsToHms(d)
   {
      let h = Math.floor(d / 3600);
      let m = Math.floor(d % 3600 / 60);
      let s = Math.floor(d % 3600 % 60);

      let hDisplay = h>0 ? h+"h" : "";
      let mDisplay = m>0 ? m+"m" : "";
      let sDisplay = s>0 ? s+"s" : "";

      return `${hDisplay} ${mDisplay} ${sDisplay}`;
   }

   DL_QUERY.style.setProperty("--progress-percent", percent + "%");
   TRIM_INDEXES.value = remainingSeconds ? `${secondsToHms(remainingSeconds.toFixed(2))}` : ""

   if (percent % (100/totalCount) == 0) DL_BUTTON.innerText = `Initializing Download...`
   else DL_BUTTON.innerText = `Downloading... (${Math.floor(totalCount*percent/100)}/${totalCount})`
}
function downloadEnd()
{
   DL_QUERY.style.setProperty("--progress-percent", "0%");

   TRIM_INDEXES.value = ""
   DL_BUTTON.innerText = "Download"

   disableInputs(false)
}

function setMessage(message, timeout=2)
{
   DL_BUTTON.disabled = true

   DL_QUERY.value = ""

   let prevPlaceholder = DL_QUERY.placeholder
   DL_QUERY.placeholder = message

   setTimeout(() =>
   {
      DL_QUERY.placeholder = prevPlaceholder

      DL_BUTTON.disabled = false
   }, timeout*1000)
}

function disableInputs(disabled)
{
   DL_QUERY.disabled = disabled
   TRIM_INDEXES.disabled = disabled
   DL_BUTTON.disabled = disabled
}